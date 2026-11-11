'use server';

import Razorpay from 'razorpay';
import { adminDb } from '@/lib/firebaseAdmin';
import * as admin from 'firebase-admin';
import { revalidatePath } from 'next/cache';
import { triggerRefresh } from '@/lib/revalidateUtils';
import { getPushTemplate } from '@/app/actions/pushSettingsActions';
import { replacePlaceholders } from '@/lib/seoUtils';
import { getTimestampMillis } from '@/lib/utils';
import { getProviderDefaultSettingsAction } from '@/app/actions/providerDefaultSettingsActions';

// MySQL database imports
import { db } from '@/lib/mysqlDb';
import { doc, getDoc, getDocs, setDoc, updateDoc, addDoc, collection, query, where, orderBy, limit, Timestamp, deleteDoc } from '@/lib/mysqlDb';

export interface WalletProviderSettings {
  minDepositAmount: number;
  maxDepositAmount: number;
  depositBonusPercentage: number;
  minBalanceForJobs: number;
}

export interface WalletTransaction {
  id: string;
  providerId: string;
  amount: number;
  type: 'deposit' | 'commission_deduction' | 'commission_refund' | 'manual_adjustment';
  bookingId?: string | null;
  description: string;
  timestamp: number;
  bonusAmount?: number;
  razorpayPaymentId?: string | null;
  razorpayOrderId?: string | null;
  stripeSessionId?: string | null;
  stripePaymentIntent?: string | null;
}

const DEFAULT_SETTINGS: WalletProviderSettings = {
  minDepositAmount: 500,
  maxDepositAmount: 10000,
  depositBonusPercentage: 0,
  minBalanceForJobs: 100,
};

// 1. Fetch wallet settings (MySQL)
export async function getProviderWalletSettingsAction(): Promise<WalletProviderSettings> {
  try {
    const adminSnap = await adminDb.collection('appConfiguration').doc('wallet_provider').get();
    if (adminSnap.exists) {
      const data = adminSnap.data() as any;
      return {
        minDepositAmount: Number(data.minDepositAmount ?? DEFAULT_SETTINGS.minDepositAmount),
        maxDepositAmount: Number(data.maxDepositAmount ?? DEFAULT_SETTINGS.maxDepositAmount),
        depositBonusPercentage: Number(data.depositBonusPercentage ?? DEFAULT_SETTINGS.depositBonusPercentage),
        minBalanceForJobs: Number(data.minBalanceForJobs ?? DEFAULT_SETTINGS.minBalanceForJobs),
      };
    }

    const settingsDoc = await getDoc(doc(db, 'appConfiguration', 'wallet_provider'));
    if (settingsDoc.exists()) {
      const data = settingsDoc.data() as any;
      return {
        minDepositAmount: Number(data.minDepositAmount ?? DEFAULT_SETTINGS.minDepositAmount),
        maxDepositAmount: Number(data.maxDepositAmount ?? DEFAULT_SETTINGS.maxDepositAmount),
        depositBonusPercentage: Number(data.depositBonusPercentage ?? DEFAULT_SETTINGS.depositBonusPercentage),
        minBalanceForJobs: Number(data.minBalanceForJobs ?? DEFAULT_SETTINGS.minBalanceForJobs),
      };
    }
    return DEFAULT_SETTINGS;
  } catch (error) {
    console.error("Error fetching wallet settings:", error);
    return DEFAULT_SETTINGS;
  }
}

// 2. Save wallet settings (MySQL)
export async function saveProviderWalletSettingsAction(settings: WalletProviderSettings) {
  try {
    const cleanSettings = {
      minDepositAmount: Number(settings.minDepositAmount),
      maxDepositAmount: Number(settings.maxDepositAmount),
      depositBonusPercentage: Number(settings.depositBonusPercentage),
      minBalanceForJobs: Number(settings.minBalanceForJobs),
      updatedAt: Timestamp.now()
    };

    // Save directly via adminDb into MySQL
    await adminDb.collection('appConfiguration').doc('wallet_provider').set(cleanSettings, { merge: true });

    // Also persist via client SDK reference to ensure cache synchronization
    try {
      const docRef = doc(db, 'appConfiguration', 'wallet_provider');
      await setDoc(docRef, cleanSettings, { merge: true });
    } catch (sdkError) {
      // adminDb write already committed directly to the database
    }

    revalidatePath('/admin/provider-withdrawals');
    revalidatePath('/provider/wallet');
    triggerRefresh('/admin/provider-withdrawals');
    triggerRefresh('/provider/wallet');
    triggerRefresh('wallet-provider-config');
    triggerRefresh('global-cache');

    return { success: true, message: "Wallet settings saved successfully." };
  } catch (error: any) {
    console.error("Error saving wallet settings:", error);
    return { success: false, message: error.message || "Failed to save settings." };
  }
}

// 3. Get provider wallet details (MySQL)
export async function getProviderWalletDetailsAction(providerId: string) {
  try {
    const userDoc = await getDoc(doc(db, 'users', providerId));
    const balance = userDoc.exists() ? (userDoc.data()?.providerWalletBalance || 0) : 0;

    const txSnap = await getDocs(
      query(
        collection(db, 'providerWalletTransactions'),
        where('providerId', '==', providerId),
        orderBy('timestamp', 'desc'),
        limit(50)
      )
    );

    const transactions: WalletTransaction[] = [];
    txSnap.docs.forEach(docSnap => {
      const data = docSnap.data();
      transactions.push({
        id: docSnap.id,
        providerId: data.providerId,
        amount: data.amount,
        type: data.type,
        bookingId: data.bookingId || null,
        description: data.description,
        timestamp: getTimestampMillis(data.timestamp) || Date.now(),
        bonusAmount: data.bonusAmount,
        razorpayPaymentId: data.razorpay_payment_id || null,
        razorpayOrderId: data.razorpay_order_id || null,
        stripeSessionId: data.stripe_session_id || null,
        stripePaymentIntent: data.stripe_payment_intent || null,
      });
    });

    return { balance, transactions };
  } catch (error) {
    console.error("Error fetching provider wallet details:", error);
    return { balance: 0, transactions: [] };
  }
}

// 4. Deposit funds via verified Razorpay checkout (MySQL)
export async function depositProviderWalletAction(
  providerId: string,
  amount: number,
  paymentDetails: { 
    razorpay_order_id?: string; 
    razorpay_payment_id?: string;
    stripe_session_id?: string;
    stripe_payment_intent?: string;
    payment_method?: string;
  }
) {
  try {
    // Idempotency check: prevent duplicate credits
    if (paymentDetails.stripe_session_id) {
      const q = query(
        collection(db, 'providerWalletTransactions'),
        where('stripe_session_id', '==', paymentDetails.stripe_session_id)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        return { success: true, message: "This transaction has already been credited." };
      }
    }
    if (paymentDetails.razorpay_payment_id) {
      const q = query(
        collection(db, 'providerWalletTransactions'),
        where('razorpay_payment_id', '==', paymentDetails.razorpay_payment_id)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        return { success: true, message: "This transaction has already been credited." };
      }
    }

    const settings = await getProviderWalletSettingsAction();
    const bonusPercentage = settings.depositBonusPercentage || 0;
    const bonusAmount = bonusPercentage > 0 ? (amount * bonusPercentage) / 100 : 0;
    const finalCredit = amount + bonusAmount;

    // Retrieve active currency symbol
    const appConfigSnap = await getDoc(doc(db, 'webSettings', 'applicationConfig'));
    const appConfig = appConfigSnap.exists() ? appConfigSnap.data() as any : null;
    const symbol = appConfig?.currencySymbol || "₹";

    // Fetch user details from MySQL
    const userDocRef = doc(db, 'users', providerId);
    const userSnap = await getDoc(userDocRef);
    const currentBalance = userSnap.exists() ? (userSnap.data()?.providerWalletBalance || 0) : 0;
    const providerName = userSnap.exists() ? (userSnap.data()?.displayName || 'Provider') : 'Provider';
    const finalBalance = currentBalance + finalCredit;

    // Update MySQL user balance
    await updateDoc(userDocRef, {
      providerWalletBalance: finalBalance,
    });

    const isStripe = paymentDetails.payment_method?.toLowerCase() === 'stripe' || !!paymentDetails.stripe_session_id;
    const methodLabel = isStripe ? 'Stripe' : 'Razorpay';

    // Write ledger in MySQL
    await addDoc(collection(db, 'providerWalletTransactions'), {
      providerId,
      amount,
      type: 'deposit',
      description: `Prepaid wallet deposit via ${methodLabel}${bonusPercentage > 0 ? ` (+${bonusPercentage}% bonus)` : ''}`,
      timestamp: Timestamp.now(),
      bonusAmount: bonusAmount || null,
      razorpay_order_id: paymentDetails.razorpay_order_id || null,
      razorpay_payment_id: paymentDetails.razorpay_payment_id || null,
      stripe_session_id: paymentDetails.stripe_session_id || null,
      stripe_payment_intent: paymentDetails.stripe_payment_intent || null,
    });

    // Dispatch push to Provider
    await sendServerPushNotification({
      userId: providerId,
      title: "Wallet Deposited!",
      body: `Successfully added ${symbol}${finalCredit.toFixed(2)} to your prepaid wallet.`,
      href: '/provider/wallet',
      type: 'provider_wallet_deposit',
      variables: {
        amount: finalCredit.toFixed(2),
        balance: finalBalance.toFixed(2),
        currencySymbol: symbol
      }
    }).catch(e => console.error("Error sending provider deposit push:", e));

    // Dispatch push to Admins
    try {
      const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "fixbro.in@gmail.com";
      const adminIds = new Set<string>();

      // Get super_admin and finance_admin roles
      const adminsSnap = await getDocs(
        query(
          collection(db, 'users'),
          where('role', 'in', ['super_admin', 'finance_admin'])
        )
      );
      adminsSnap.forEach(adminDoc => {
        adminIds.add(adminDoc.id);
      });

      // Explicitly fetch the primary admin email user
      const primaryAdminQuery = query(collection(db, 'users'), where('email', '==', ADMIN_EMAIL), limit(1));
      const primaryAdminSnap = await getDocs(primaryAdminQuery);
      if (!primaryAdminSnap.empty) {
        adminIds.add(primaryAdminSnap.docs[0].id);
      }

      if (adminIds.size > 0) {
        const promises = Array.from(adminIds).map(async (adminUid) => {
          // Write userNotification in database for admin panel inbox
          const adminNotificationData = {
            userId: adminUid,
            title: "Provider Wallet Deposit",
            message: `Provider ${providerName} added ${symbol}${finalCredit.toFixed(2)} to their wallet.`,
            type: 'info',
            href: '/admin/provider-withdrawals?tab=wallet_complaints',
            read: false,
            createdAt: Timestamp.now(),
          };
          await addDoc(collection(db, "userNotifications"), adminNotificationData);

          // Dispatch FCM push alert
          return sendServerPushNotification({
            userId: adminUid,
            title: "Provider Wallet Deposit",
            body: `Provider ${providerName} added ${symbol}${finalCredit.toFixed(2)} to their wallet.`,
            href: '/admin/provider-withdrawals?tab=wallet_complaints',
            type: 'admin_provider_deposit_alert',
            variables: {
              providerName,
              amount: finalCredit.toFixed(2),
              balance: finalBalance.toFixed(2),
              currencySymbol: symbol
            }
          });
        });
        await Promise.allSettled(promises);
      }
    } catch (e) {
      console.error("Error sending admin deposit alert push:", e);
    }

    revalidatePath('/provider/wallet');
    return { 
      success: true, 
      message: `Successfully deposited ${symbol}${finalCredit.toFixed(2)} to your wallet.`,
      newBalance: finalBalance
    };
  } catch (error: any) {
    console.error("Error depositing to provider wallet:", error);
    return { success: false, message: error.message || "Deposit transaction failed." };
  }
}

// 4b. Verify pending Razorpay wallet deposit (used on app resume / auto-recovery)
export async function verifyPendingProviderWalletDepositAction(
  orderId: string,
  providerId: string,
  expectedAmount?: number
): Promise<{
  success: boolean;
  verified: boolean;
  alreadyCredited?: boolean;
  creditedNow?: boolean;
  paymentId?: string;
  amount?: number;
  newBalance?: number;
  message?: string;
}> {
  try {
    if (!orderId || !providerId) {
      return { success: false, verified: false, message: 'Invalid order or provider ID' };
    }

    // 1. Check if already recorded in providerWalletTransactions (e.g. credited via webhook)
    const txQuery = query(
      collection(db, 'providerWalletTransactions'),
      where('razorpay_order_id', '==', orderId)
    );
    const txSnap = await getDocs(txQuery);
    if (!txSnap.empty) {
      const txData = txSnap.docs[0].data() as any;
      const userRef = doc(db, 'users', providerId);
      const userSnap = await getDoc(userRef);
      const curBalance = userSnap.exists() ? Number(userSnap.data()?.providerWalletBalance || 0) : 0;
      return {
        success: true,
        verified: true,
        alreadyCredited: true,
        paymentId: txData.razorpay_payment_id || txData.razorpayPaymentId || undefined,
        amount: Number(txData.amount) || expectedAmount || 0,
        newBalance: curBalance,
        message: 'Deposit already credited to wallet',
      };
    }

    // 2. Query Razorpay API to check if the order has been paid
    const appConfigSnap = await adminDb.collection('webSettings').doc('applicationConfig').get();
    const appConfig = appConfigSnap.exists ? (appConfigSnap.data() as any) : null;
    const razorpayKeyId = appConfig?.razorpayKeyId || process.env.RAZORPAY_KEY_ID;
    const razorpayKeySecret = appConfig?.razorpayKeySecret || process.env.RAZORPAY_KEY_SECRET;

    if (!razorpayKeyId || !razorpayKeySecret) {
      return { success: false, verified: false, message: 'Razorpay configuration missing' };
    }

    const instance = new Razorpay({
      key_id: razorpayKeyId,
      key_secret: razorpayKeySecret,
    });

    const payments: any = await instance.orders.fetchPayments(orderId);
    const capturedPayment = payments?.items?.find((p: any) => p.status === 'captured' || p.status === 'authorized');

    if (capturedPayment) {
      const paymentAmount = capturedPayment.amount ? capturedPayment.amount / 100 : (expectedAmount || 0);
      const depositResult = await depositProviderWalletAction(providerId, paymentAmount, {
        razorpay_order_id: orderId,
        razorpay_payment_id: capturedPayment.id,
        payment_method: 'Razorpay',
      });

      const userRef = doc(db, 'users', providerId);
      const userSnap = await getDoc(userRef);
      const curBalance = userSnap.exists() ? Number(userSnap.data()?.providerWalletBalance || 0) : 0;

      return {
        success: true,
        verified: true,
        creditedNow: true,
        paymentId: capturedPayment.id,
        amount: paymentAmount,
        newBalance: curBalance,
        message: depositResult.message || 'Deposit confirmed successfully',
      };
    }

    return { success: false, verified: false, message: 'Payment not yet confirmed by Razorpay' };
  } catch (error: any) {
    console.error('Error verifying pending provider wallet deposit:', error);
    return { success: false, verified: false, message: error.message || 'Verification failed' };
  }
}

// 5. Manual wallet adjustment / refund (Admin) (MySQL)
export async function adjustProviderWalletAction(
  providerId: string,
  amount: number,
  type: 'deposit' | 'commission_deduction' | 'commission_refund' | 'manual_adjustment',
  description: string,
  bookingId?: string
) {
  try {
    const userDocRef = doc(db, 'users', providerId);
    const userSnap = await getDoc(userDocRef);
    if (!userSnap.exists()) {
      throw new Error("Provider user profile not found.");
    }
    
    const currentBalance = userSnap.data()?.providerWalletBalance || 0;
    const newBalance = currentBalance + amount;

    // Update MySQL user balance
    await updateDoc(userDocRef, { providerWalletBalance: newBalance });

    // Write ledger to MySQL
    await addDoc(collection(db, 'providerWalletTransactions'), {
      providerId,
      amount,
      type,
      bookingId: bookingId || null,
      description,
      timestamp: Timestamp.now(),
    });

    // Write in-app notification to MySQL
    await addDoc(collection(db, 'userNotifications'), {
      userId: providerId,
      title: amount >= 0 ? "Prepaid Wallet Credited" : "Prepaid Wallet Debited",
      message: `Your prepaid wallet has been adjusted by ${amount >= 0 ? '+' : ''}₹${amount.toFixed(2)}. Description: ${description}`,
      type: amount >= 0 ? 'success' : 'info',
      href: '/provider/wallet',
      read: false,
      createdAt: Timestamp.now(),
    });

    // Send push notification to the provider
    await sendServerPushNotification({
      userId: providerId,
      title: amount >= 0 ? "Wallet Adjusted!" : "Wallet Adjusted!",
      body: `Your prepaid wallet has been adjusted by ₹${amount.toFixed(2)}.`,
      href: '/provider/wallet',
      type: 'provider_wallet_refund',
      variables: {
        amount: amount.toFixed(2),
        reason: description,
        currencySymbol: '₹'
      }
    }).catch(e => console.error("Error sending manual adjustment push alert:", e));

    revalidatePath('/provider/wallet');
    return { success: true, message: "Wallet adjusted successfully." };
  } catch (error: any) {
    console.error("Error in adjustProviderWalletAction:", error);
    return { success: false, message: error.message || "Failed to adjust wallet." };
  }
}

// Helper to calculate provider commission fee
const calculateProviderFee = (bookingAmount: number, feeType?: string, feeValue?: number): number => {
  if (!feeType || !feeValue || feeValue <= 0) return 0;
  if (feeType === 'fixed') return feeValue;
  if (feeType === 'percentage') return (bookingAmount * feeValue) / 100;
  return 0;
};

// Check if payment method is Pay After Service (FixBro has only two payment methods: "Online" and "Pay After Service")
const isCashPayment = (method?: string): boolean => {
  if (!method) return true;
  return method.toLowerCase().trim() !== 'online';
};

// 6. Central server action to handle provider status updates with wallet validation (MySQL)
export async function updateBookingStatusByProviderAction(
  bookingId: string,
  providerId: string,
  newStatus: string,
  additionalCharges?: { name: string; amount: number }[],
  finalizedPaymentMethod?: string,
  enteredOtp?: string,
  isAdminOverride?: boolean
) {
  try {
    const bookingDocRef = doc(db, 'bookings', bookingId);
    const providerUserRef = doc(db, 'users', providerId);

    const bookingSnap = await getDoc(bookingDocRef);
    if (!bookingSnap.exists()) {
      throw new Error("Booking not found.");
    }
    const bookingData = bookingSnap.data() as any;

    const providerSnap = await getDoc(providerUserRef);
    if (!providerSnap.exists()) {
      throw new Error("Provider user document not found.");
    }
    const providerData = providerSnap.data() || {};

    const currentStatus = bookingData.status;
    const hasOnlineProof = !!(bookingData.razorpayPaymentId || bookingData.stripePaymentIntent || bookingData.stripeSessionId);
    const updateData: any = { 
      status: newStatus,
      updatedAt: Timestamp.now(),
    };

    // 1. Acceptance Checks & Wallet Deductions (Pay After Service)
    if (newStatus === 'ProviderAccepted') {
      const paymentMethod = finalizedPaymentMethod || bookingData.paymentMethod || 'Pay After Service';
      
      // Treat as cash (Pay After Service) unless there is verified online payment proof
      if (isCashPayment(paymentMethod) || !hasOnlineProof) {
        // Load settings and config
        const settings = await getProviderWalletSettingsAction();
        const configSnap = await getDoc(doc(db, 'webSettings', 'applicationConfig'));
        const appConfig = configSnap.exists() ? configSnap.data() as any : {};
        const decimals = appConfig?.currencyDecimalPoints !== undefined ? Number(appConfig.currencyDecimalPoints) : 2;
        const symbol = appConfig?.currencySymbol || "₹";

        const currentWalletBalance = providerData.providerWalletBalance || 0;

        if (currentWalletBalance < settings.minBalanceForJobs) {
          throw new Error(`Insufficient wallet balance. You must maintain at least ${symbol}${settings.minBalanceForJobs.toFixed(decimals)} in your prepaid wallet to accept cash jobs. Please top up your wallet.`);
        }

        // Daily Labour exact rule: customer hands total amount on-site. Admin markup fee + platform fee + tax auto-deducted from wallet.
        let totalDeduction = 0;
        let descriptionText = '';

        if (typeof bookingData.providerTotalEarnings === 'number' && bookingData.providerTotalEarnings > 0) {
          const providerEarnings = bookingData.providerTotalEarnings;
          totalDeduction = Math.max(0, (bookingData.totalAmount || 0) - providerEarnings);
          const adminFee = bookingData.adminMarkupFeeTotal || 0;
          const platFee = bookingData.platformFeeTotal || 0;
          const taxes = bookingData.taxAmount || 0;
          descriptionText = `Admin Markup (${symbol}${adminFee.toFixed(decimals)}) + Platform Fee (${symbol}${platFee.toFixed(decimals)}) + Tax (${symbol}${taxes.toFixed(decimals)}) auto-deducted for Pay After Service Booking #${bookingData.bookingId}`;
        } else {
          // Fallback legacy calculation
          const commissionBase = (bookingData.subTotal || 0) + (bookingData.visitingCharge || 0) - (bookingData.discountAmount || 0);
          const commission = calculateProviderFee(commissionBase, appConfig.providerFeeType, appConfig.providerFeeValue);
          const platformFeeVal = bookingData.platformFeeTotal || 0;
          const taxFeeVal = bookingData.taxAmount || 0;
          totalDeduction = commission + platformFeeVal + taxFeeVal;
          descriptionText = `Commission (${symbol}${commission.toFixed(decimals)}) + Platform Fee (${symbol}${platformFeeVal.toFixed(decimals)}) + Tax Fee (${symbol}${taxFeeVal.toFixed(decimals)}) auto-deducted for Pay After Service Booking #${bookingData.bookingId}`;
        }

        if (totalDeduction > 0) {
          // Deduct from wallet in MySQL
          await updateDoc(providerUserRef, { 
            providerWalletBalance: currentWalletBalance - totalDeduction 
          });

          // Write deduction ledger log in MySQL
          await addDoc(collection(db, 'providerWalletTransactions'), {
            providerId,
            amount: -totalDeduction,
            type: 'commission_deduction',
            bookingId,
            description: descriptionText,
            timestamp: Timestamp.now(),
          });

          updateData.commissionPaidFromWallet = true;
          updateData.walletCommissionAmount = totalDeduction;
        }
      }
    }

    // 2. Start Work: OTP verification & start timestamp
    if (newStatus === 'InProgressByProvider') {
      const provSettings = await getProviderDefaultSettingsAction();
      const requireOtp = provSettings?.requireOtpForJobStartComplete !== false;

      if (requireOtp && !isAdminOverride) {
        if (bookingData.startOtp) {
          if (!enteredOtp || enteredOtp.trim() !== String(bookingData.startOtp).trim()) {
            throw new Error("Invalid Start OTP. Please ask the customer for their 4-digit Start OTP to begin work.");
          }
        }
      }

      updateData.workStartedAt = Timestamp.now();
    }

    // 3. Complete Work: OTP verification, duration calculation, and earnings credit
    if (newStatus === "Completed") {
      const provSettings = await getProviderDefaultSettingsAction();
      const requireOtp = provSettings?.requireOtpForJobStartComplete !== false;

      if (requireOtp && !isAdminOverride) {
        if (bookingData.completeOtp) {
          if (!enteredOtp || enteredOtp.trim() !== String(bookingData.completeOtp).trim()) {
            throw new Error("Invalid Complete OTP. Please ask the customer for their 4-digit Complete OTP to finish work.");
          }
        }
      }

      const completedAt = Timestamp.now();
      updateData.workCompletedAt = completedAt;

      // Calculate worked duration
      const startedAt = bookingData.workStartedAt || updateData.workStartedAt;
      if (startedAt) {
        const startMs = getTimestampMillis(startedAt) || (typeof startedAt === 'object' && startedAt.toMillis ? startedAt.toMillis() : Date.parse(startedAt));
        const endMs = completedAt.toMillis ? completedAt.toMillis() : Date.now();
        if (startMs && endMs && endMs > startMs) {
          const diffMinutes = Math.floor((endMs - startMs) / 60000);
          const hours = Math.floor(diffMinutes / 60);
          const mins = diffMinutes % 60;
          updateData.workedDuration = `${hours}h ${mins}m`;
        } else {
          updateData.workedDuration = "1h 0m";
        }
      }

      if (currentStatus !== "Completed") {
        updateData.isReviewedByCustomer = false;
      }

      // Daily Labour has fixed daily rates — no additional charges popup/logic.
      // Online payment completion:
      if (hasOnlineProof || bookingData.paymentMethod === 'Online') {
        updateData.paymentMethod = 'Online';
        // Credit 100% of provider's set earnings to provider's withdrawable balance (Zero Commission)
        const providerEarnings = typeof bookingData.providerTotalEarnings === 'number' && bookingData.providerTotalEarnings > 0
          ? bookingData.providerTotalEarnings
          : (bookingData.subTotal || bookingData.totalAmount || 0);

        const currentWithdrawableBalance = providerData.withdrawableBalance || 0;
        await updateDoc(providerUserRef, {
          withdrawableBalance: currentWithdrawableBalance + providerEarnings,
          totalEarnings: (providerData.totalEarnings || 0) + providerEarnings,
        });

        await addDoc(collection(db, 'providerWalletTransactions'), {
          providerId,
          amount: providerEarnings,
          type: 'job_payment',
          bookingId,
          description: `Direct Daily Labour Earnings for Online Booking #${bookingData.bookingId} (100% withdrawable, 0% commission)`,
          timestamp: Timestamp.now(),
        });
      } else {
        updateData.paymentMethod = finalizedPaymentMethod || bookingData.paymentMethod || 'Pay After Service';
      }
    }

    await updateDoc(bookingDocRef, updateData);

    revalidatePath('/provider');
    revalidatePath(`/provider/booking/${bookingId}`);
    revalidatePath('/provider/my-jobs');
    revalidatePath('/provider/earnings');
    revalidatePath('/my-bookings');
    revalidatePath('/admin/bookings');
    try {
      await triggerRefresh('bookings');
      await triggerRefresh('global-cache');
    } catch (e) {}

    return { success: true };
  } catch (error: any) {
    console.error("Error in updateBookingStatusByProviderAction:", error);
    return { success: false, message: error.message || "Failed to update booking status." };
  }
}

export interface WalletComplaint {
  id: string;
  complaintId?: string | null;
  providerId: string;
  providerName: string;
  bookingId?: string | null;
  bookingHumanId?: string | null;
  transactionId?: string | null;
  message: string;
  amount: number;
  status: 'pending' | 'accepted' | 'rejected' | 'processed' | 'solved';
  createdAt: number;
  resolvedAt?: number;
  resolutionNotes?: string;
}

// 7. Submit a new wallet complaint (Provider) (MySQL)
export async function submitWalletComplaintAction(
  providerId: string,
  message: string,
  amount: number,
  transactionId: string,
  bookingId?: string | null
) {
  try {
    const configSnap = await getDoc(doc(db, 'webSettings', 'applicationConfig'));
    const appConfig = configSnap.exists() ? configSnap.data() as any : {};
    const decimals = appConfig?.currencyDecimalPoints !== undefined ? Number(appConfig.currencyDecimalPoints) : 2;
    const symbol = appConfig?.currencySymbol || "₹";

    const providerSnap = await getDoc(doc(db, 'users', providerId));
    const providerName = providerSnap.exists() ? (providerSnap.data()?.displayName || 'Provider') : 'Provider';

    let bookingHumanId = '';
    if (bookingId) {
      const bookingSnap = await getDoc(doc(db, 'bookings', bookingId));
      bookingHumanId = bookingSnap.exists() ? (bookingSnap.data()?.bookingId || bookingId) : bookingId;
    }

    // Check if complaint already exists for this transaction ID in MySQL
    const existing = await getDocs(
      query(
        collection(db, 'providerComplaints'),
        where('providerId', '==', providerId),
        where('transactionId', '==', transactionId),
        limit(1)
      )
    );

    if (!existing.empty) {
      return { success: false, message: "A complaint has already been submitted for this transaction." };
    }

    const complaintId = String(Math.floor(100000 + Math.random() * 900000));

    // Add complaint document to MySQL
    await addDoc(collection(db, 'providerComplaints'), {
      complaintId,
      providerId,
      providerName,
      bookingId: bookingId || null,
      bookingHumanId: bookingHumanId || null,
      transactionId,
      message,
      amount,
      status: 'pending',
      createdAt: Timestamp.now(),
    });

    // Notify Admins in MySQL
    const adminsSnapshot = await getDocs(query(collection(db, 'users'), where('role', '==', 'admin')));
    if (!adminsSnapshot.empty) {
      const promises = adminsSnapshot.docs.map(async (adminDoc) => {
        // Write notification to MySQL
        await addDoc(collection(db, 'userNotifications'), {
          userId: adminDoc.id,
          title: "New Wallet Complaint",
          message: `Provider ${providerName} submitted a dispute for transaction ${transactionId}${bookingHumanId ? ` (Booking #${bookingHumanId})` : ''}.`,
          type: 'admin_alert',
          href: '/admin/provider-withdrawals?tab=wallet_complaints',
          read: false,
          createdAt: Timestamp.now(),
        });
      });
      await Promise.allSettled(promises);

      // Trigger push alerts to admins asynchronously
      try {
        const pushPromises = adminsSnapshot.docs.map(adminDoc => 
          sendServerPushNotification({
            userId: adminDoc.id,
            title: "New Wallet Dispute Filed",
            body: `Provider ${providerName} filed a dispute for transaction ${transactionId}${bookingHumanId ? ` (Booking #${bookingHumanId})` : ''}.`,
            href: '/admin/provider-withdrawals?tab=wallet_complaints',
            type: 'admin_wallet_complaint_alert',
            variables: {
              providerName,
              bookingHumanId: bookingHumanId || 'None',
              amount: amount.toFixed(decimals),
              currencySymbol: symbol
            }
          })
        );
        await Promise.allSettled(pushPromises);
      } catch (err) {
        console.error("Error triggering admin dispute push notification:", err);
      }
    }

    return { success: true, message: "Complaint submitted successfully to admin." };
  } catch (error: any) {
    console.error("Error submitting wallet complaint:", error);
    return { success: false, message: error.message || "Failed to submit complaint." };
  }
}

// 8. Fetch pending wallet complaints (Admin) (MySQL)
export async function getPendingWalletComplaintsAction(): Promise<WalletComplaint[]> {
  try {
    const snap = await getDocs(query(collection(db, 'providerComplaints'), orderBy('createdAt', 'desc')));

    const complaints: WalletComplaint[] = [];
    snap.docs.forEach(docSnap => {
      const data = docSnap.data();
      complaints.push({
        id: docSnap.id,
        complaintId: data.complaintId || docSnap.id,
        providerId: data.providerId,
        providerName: data.providerName,
        bookingId: data.bookingId,
        bookingHumanId: data.bookingHumanId || data.bookingId,
        transactionId: data.transactionId || null,
        message: data.message,
        amount: data.amount || 0,
        status: data.status || 'pending',
        createdAt: getTimestampMillis(data.createdAt) || Date.now(),
        resolvedAt: data.resolvedAt ? getTimestampMillis(data.resolvedAt) : undefined,
        resolutionNotes: data.resolutionNotes,
      });
    });

    return complaints;
  } catch (error) {
    console.error("Error loading wallet complaints:", error);
    return [];
  }
}

// 8b. Fetch wallet complaints for a specific provider (MySQL)
export async function getProviderWalletComplaintsAction(providerId: string): Promise<WalletComplaint[]> {
  try {
    const snap = await getDocs(
      query(
        collection(db, 'providerComplaints'),
        where('providerId', '==', providerId),
        orderBy('createdAt', 'desc')
      )
    );

    const complaints: WalletComplaint[] = [];
    snap.docs.forEach(docSnap => {
      const data = docSnap.data();
      complaints.push({
        id: docSnap.id,
        complaintId: data.complaintId || docSnap.id,
        providerId: data.providerId,
        providerName: data.providerName,
        bookingId: data.bookingId,
        bookingHumanId: data.bookingHumanId || data.bookingId,
        transactionId: data.transactionId || null,
        message: data.message,
        amount: data.amount || 0,
        status: data.status || 'pending',
        createdAt: getTimestampMillis(data.createdAt) || Date.now(),
        resolvedAt: data.resolvedAt ? getTimestampMillis(data.resolvedAt) : undefined,
        resolutionNotes: data.resolutionNotes,
      });
    });

    return complaints;
  } catch (error) {
    console.error("Error loading provider complaints:", error);
    return [];
  }
}

// 9. Resolve wallet complaint (Admin manually refunds or dismisses) (MySQL)
export async function resolveWalletComplaintAction(
  complaintId: string,
  resolutionStatus: 'accepted' | 'rejected' | 'processed' | 'solved',
  refundAmount: number,
  resolutionNotes: string
) {
  try {
    const configSnap = await getDoc(doc(db, 'webSettings', 'applicationConfig'));
    const appConfig = configSnap.exists() ? configSnap.data() as any : {};
    const decimals = appConfig?.currencyDecimalPoints !== undefined ? Number(appConfig.currencyDecimalPoints) : 2;
    const symbol = appConfig?.currencySymbol || "₹";

    const complaintRef = doc(db, 'providerComplaints', complaintId);
    const compSnap = await getDoc(complaintRef);
    if (!compSnap.exists()) {
      throw new Error("Complaint record not found.");
    }
    const compData = compSnap.data() as any;
    if (compData.status !== 'pending') {
      throw new Error("This complaint has already been resolved.");
    }

    const providerId = compData.providerId;
    const providerUserRef = doc(db, 'users', providerId);

    const shouldRefund = (resolutionStatus === 'accepted' || resolutionStatus === 'solved');

    if (shouldRefund && refundAmount > 0) {
      const pSnap = await getDoc(providerUserRef);
      if (!pSnap.exists()) {
        throw new Error("Provider profile not found.");
      }
      
      const currentWalletBalance = pSnap.data()?.providerWalletBalance || 0;
      const newBalance = currentWalletBalance + refundAmount;
      
      // 1. Credit provider wallet in MySQL
      await updateDoc(providerUserRef, { providerWalletBalance: newBalance });

      // 2. Add refund ledger item in MySQL
      await addDoc(collection(db, 'providerWalletTransactions'), {
        providerId,
        amount: refundAmount,
        type: 'commission_refund',
        bookingId: compData.bookingId || null,
        description: `Dispute Refund (${resolutionStatus}): ${resolutionNotes}`,
        timestamp: Timestamp.now(),
      });

      // 3. Mark booking as refunded in MySQL if bookingId exists
      if (compData.bookingId) {
        const bookingRef = doc(db, 'bookings', compData.bookingId);
        await updateDoc(bookingRef, { commissionRefunded: true });
      }

      // 4. Send approval notification in MySQL
      await addDoc(collection(db, 'userNotifications'), {
        userId: providerId,
        title: `Dispute ${resolutionStatus === 'accepted' ? 'Accepted' : 'Solved'}`,
        message: `Your dispute (ID: ${compData.complaintId || compSnap.id}) was marked as ${resolutionStatus}. ${symbol}${refundAmount.toFixed(decimals)} refunded. Notes: ${resolutionNotes}`,
        type: 'success',
        href: '/provider/wallet',
        read: false,
        createdAt: Timestamp.now(),
      });
    } else {
      // Send notification in MySQL for rejected or processed without refund
      await addDoc(collection(db, 'userNotifications'), {
        userId: compData.providerId,
        title: `Dispute ${resolutionStatus === 'rejected' ? 'Rejected' : 'Processed'}`,
        message: `Your dispute (ID: ${compData.complaintId || compSnap.id}) was marked as ${resolutionStatus}. Notes: ${resolutionNotes}`,
        type: 'info',
        href: '/provider/wallet',
        read: false,
        createdAt: Timestamp.now(),
      });
    }

    // Mark complaint status in MySQL
    await updateDoc(complaintRef, {
      status: resolutionStatus,
      resolutionNotes,
      resolvedAt: Timestamp.now(),
    });

    // Send push notification to the provider
    try {
      if (shouldRefund && refundAmount > 0) {
        await sendServerPushNotification({
          userId: providerId,
          title: `Dispute ${resolutionStatus === 'accepted' ? 'Accepted' : 'Solved'}!`,
          body: `Your prepaid wallet has been credited with ${symbol}${refundAmount.toFixed(decimals)}. Status: ${resolutionStatus}`,
          href: '/provider/wallet',
          type: 'provider_wallet_refund',
          variables: {
            amount: refundAmount.toFixed(decimals),
            reason: `Dispute ${resolutionStatus}: ${resolutionNotes}`,
            currencySymbol: symbol
          }
        });
      } else {
        await sendServerPushNotification({
          userId: providerId,
          title: `Dispute Update`,
          body: `Your dispute was marked as ${resolutionStatus}. Notes: ${resolutionNotes}`,
          href: '/provider/wallet',
          type: 'withdrawal_status',
          variables: {
            status: resolutionStatus,
            amount: refundAmount.toFixed(decimals)
          }
        });
      }
    } catch (pushErr) {
      console.error("Error triggering resolve dispute push alert:", pushErr);
    }

    revalidatePath('/provider/wallet');
    revalidatePath('/admin/provider-withdrawals');
    return { success: true, message: `Dispute marked as ${resolutionStatus} successfully.` };
  } catch (error: any) {
    console.error("Error resolving wallet complaint:", error);
    return { success: false, message: error.message || "Failed to resolve complaint." };
  }
}

// 10. Server-side helper to send push notifications directly via admin.messaging()
export async function sendServerPushNotification(params: {
  userId: string;
  title: string;
  body: string;
  href?: string;
  icon?: string;
  sound?: string;
  type?: string;
  variables?: Record<string, string | number | undefined>;
}) {
  try {
    const { userId, title, body, href, icon, sound, type: customType, variables } = params;

    let finalTitle = title;
    let finalBody = body;

    // Check if push notification category is enabled
    const pushType = customType || 'other';
    if (pushType !== 'other') {
      const template = await getPushTemplate(pushType);
      if (!template.isEnabled) {
        console.log(`Push notification type "${pushType}" is disabled in settings. Skipping dispatch.`);
        return { success: true, message: 'Push notification is disabled.' };
      }

      // Replace placeholders
      if (template.subject && template.body) {
        const mergedVariables = {
          title,
          body,
          ...(variables || {})
        };
        finalTitle = replacePlaceholders(template.subject, mergedVariables);
        finalBody = replacePlaceholders(template.body, mergedVariables);
      }
    }

    // Get user's FCM tokens from Firestore (which has tokens)
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return { error: 'User not found' };
    }

    const userData = userDoc.data();
    const fcmTokensObj = userData?.fcmTokens || {};
    const tokens = Object.keys(fcmTokensObj);

    if (tokens.length === 0) {
      return { error: 'No FCM tokens found' };
    }

    // Send push
    const messaging = admin.messaging();
    const targetChannelId = sound === 'order' ? 'fixbro_new_bookings_channel_v3' : 'fixbro_general_channel_v3';
    const isOrderSound = sound === 'order';

    const messagePayload = {
      notification: {
        title: finalTitle,
        body: finalBody,
      },
      data: {
        title: finalTitle,
        body: finalBody,
        click_action: href || '/',
        url: href || '/',
        targetUrl: href || '/',
        icon: icon || '/android-chrome-192x192.png',
        sound: sound || 'default',
        channelKey: targetChannelId,
        channel_id: targetChannelId,
        priority: 'high',
        wakeUpScreen: 'true',
        fullScreenIntent: isOrderSound ? 'true' : 'false',
      },
      android: {
        priority: 'high' as const,
        ttl: 60 * 60 * 24 * 1000,
        notification: {
          title: finalTitle,
          body: finalBody,
          channelId: targetChannelId,
          icon: 'ic_notification',
          color: '#059669',
          sound: isOrderSound ? 'order_sound' : 'default',
          defaultSound: !isOrderSound,
          defaultVibrateTimings: true,
          priority: isOrderSound ? ('max' as const) : ('high' as const),
          visibility: 'public' as const,
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
        }
      },
      webpush: {
        headers: {
          Urgency: 'high',
        },
        notification: {
          title: finalTitle,
          body: finalBody,
          icon: icon || '/android-chrome-192x192.png',
          data: {
            url: href || '/',
          },
          requireInteraction: sound === 'order',
        },
        fcmOptions: {
          link: href || '/'
        }
      }
    };

    const response = await messaging.sendEachForMulticast({
      tokens,
      ...messagePayload,
    });

    return { success: true, response };
  } catch (error) {
    console.error("sendServerPushNotification error:", error);
    return { error };
  }
}

// 11. Delete wallet complaint (Admin only) (MySQL)
export async function deleteWalletComplaintAction(complaintId: string) {
  try {
    const complaintRef = doc(db, 'providerComplaints', complaintId);
    await deleteDoc(complaintRef);
    revalidatePath('/admin/provider-withdrawals');
    return { success: true, message: "Dispute complaint deleted successfully." };
  } catch (error: any) {
    console.error("Error deleting wallet complaint:", error);
    return { success: false, message: error.message || "Failed to delete complaint." };
  }
}

// 12. Recalculate and synchronize provider stats & earnings (MySQL)
export async function recalculateProviderStatsAction(providerId: string) {
  try {
    if (!providerId) {
      return { success: false, message: "Invalid provider ID." };
    }

    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfMonthStr = startOfMonth.toISOString().split('T')[0];

    const configSnap = await getDoc(doc(db, 'webSettings', 'applicationConfig'));
    const appConfig = configSnap.exists() ? (configSnap.data() as any) : {};

    const providerUserRef = doc(db, 'users', providerId);
    const providerUserSnap = await getDoc(providerUserRef);
    if (!providerUserSnap.exists()) {
      return { success: false, message: "Provider user not found." };
    }
    const firestoreUser = providerUserSnap.data() as any;

    const bookingsQuery = query(
      collection(db, "bookings"),
      where("providerId", "==", providerId),
      where("status", "==", "Completed")
    );
    const withdrawalsQuery = query(
      collection(db, "withdrawalRequests"),
      where("providerId", "==", providerId)
    );

    const [bookingsSnap, withdrawalsSnap] = await Promise.all([
      getDocs(bookingsQuery),
      getDocs(withdrawalsQuery)
    ]);

    let totalNetOnlineEarnings = 0;

    const mStats = {
      monthKey,
      gross: 0,
      commission: 0,
      cashCollected: 0,
      withdrawals: 0,
      onlineNet: 0,
      cashCommission: 0,
      cashNet: 0,
      onlineGross: 0,
      onlineCommission: 0,
      extraCharges: 0
    };

    bookingsSnap.docs.forEach(d => {
      const b = d.data() as any;
      const isCash = isCashPayment(b.paymentMethod);
      const bDate = b.scheduledDate || "";

      const baseGross = (b.subTotal || 0) + (b.visitingCharge || 0) - (b.discountAmount || 0);
      const extraCharges = (b.additionalCharges || []).reduce((sum: number, c: any) => sum + (Number(c.amount) || 0), 0);
      const totalBookingGross = baseGross + extraCharges;

      if (isCash) {
        const commission = calculateProviderFee(totalBookingGross, appConfig?.providerFeeType, appConfig?.providerFeeValue);
        const cashNet = totalBookingGross - commission;
        if (bDate >= startOfMonthStr) {
          mStats.gross += totalBookingGross;
          mStats.commission += commission;
          mStats.cashCollected += (b.totalAmount || totalBookingGross);
          mStats.cashCommission += commission;
          mStats.cashNet += cashNet;
          if (extraCharges > 0) {
            mStats.extraCharges = (mStats.extraCharges || 0) + extraCharges;
          }
        }
      } else {
        const onlineGross = baseGross;
        const onlineCommission = calculateProviderFee(onlineGross, appConfig?.providerFeeType, appConfig?.providerFeeValue);
        const onlineNet = onlineGross - onlineCommission;
        
        const extraCommission = extraCharges > 0 
          ? (appConfig?.providerFeeType === 'percentage' 
              ? calculateProviderFee(extraCharges, appConfig?.providerFeeType, appConfig?.providerFeeValue) 
              : (extraCharges * (appConfig?.providerExtraFeePercentage || 0)) / 100)
          : 0;

        totalNetOnlineEarnings += onlineNet;

        if (bDate >= startOfMonthStr) {
          mStats.gross += totalBookingGross;
          mStats.commission += (onlineCommission + extraCommission);
          mStats.onlineGross += onlineGross;
          mStats.onlineCommission += onlineCommission;
          mStats.onlineNet += onlineNet;
          if (extraCharges > 0) {
            mStats.cashCollected += extraCharges;
            mStats.cashCommission += extraCommission;
            mStats.cashNet += Math.max(0, extraCharges - extraCommission);
            mStats.extraCharges = (mStats.extraCharges || 0) + extraCharges;
          }
        }
      }
    });

    const withdrawalHistory = withdrawalsSnap.docs.map(d => d.data() as any);
    const visibleCompletedPayouts = withdrawalHistory
      .filter(req => req.status === 'completed')
      .reduce((sum, req) => sum + req.amount, 0);

    const storedTotalPaidOut = firestoreUser?.totalPaidOut || 0;
    const finalTotalPaidOut = Math.max(storedTotalPaidOut, visibleCompletedPayouts);

    const currentPendingAmount = withdrawalHistory
      .filter(req => ['processing', 'approved', 'pending'].includes(req.status))
      .reduce((sum, req) => sum + req.amount, 0);

    const withdrawalsThisMonth = withdrawalHistory
      .filter(req => {
        const reqMillis = getTimestampMillis(req.requestedAt);
        return reqMillis > 0 && reqMillis >= startOfMonth.getTime();
      })
      .reduce((sum, req) => sum + req.amount, 0);
    mStats.withdrawals = withdrawalsThisMonth;

    const realBalance = Math.max(0, totalNetOnlineEarnings - finalTotalPaidOut - currentPendingAmount);

    await updateDoc(providerUserRef, {
      withdrawableBalance: realBalance,
      totalPaidOut: finalTotalPaidOut,
      monthlyStats: mStats
    });

    revalidatePath('/admin/provider-withdrawals');
    revalidatePath('/provider/earnings');

    return { 
      success: true, 
      message: "Provider balance and earnings recalculated successfully.",
      withdrawableBalance: realBalance,
      monthlyStats: mStats
    };
  } catch (error: any) {
    console.error("Error in recalculateProviderStatsAction:", error);
    return { success: false, message: error.message || "Failed to recalculate provider stats." };
  }
}

// 13. Create Direct Payout from Admin (MySQL)
export async function createAdminDirectPayoutAction(params: {
  providerId: string;
  amount: number;
  method: 'bank_transfer' | 'upi' | 'cash' | 'amazon_gift_card';
  details?: {
    accountHolderName?: string;
    bankName?: string;
    accountNumber?: string;
    ifscCode?: string;
    upiId?: string;
    email?: string;
    notes?: string;
  };
  referenceNotes?: string;
}) {
  try {
    const { providerId, amount, method, details = {}, referenceNotes = '' } = params;
    const numAmount = Number(amount);
    if (!providerId || isNaN(numAmount) || numAmount <= 0) {
      return { success: false, message: "Valid provider and positive numeric amount are required." };
    }

    const providerUserRef = doc(db, 'users', providerId);
    const providerUserSnap = await getDoc(providerUserRef);
    if (!providerUserSnap.exists()) {
      return { success: false, message: "Provider user not found." };
    }
    const providerUser = providerUserSnap.data() as any;

    const requestData = {
      providerId,
      providerName: providerUser.displayName || "Provider",
      providerEmail: providerUser.email || "",
      amount: numAmount,
      method,
      details: {
        accountHolderName: details.accountHolderName || providerUser.displayName || "",
        bankName: details.bankName || "",
        accountNumber: details.accountNumber || "",
        ifscCode: details.ifscCode || "",
        upiId: details.upiId || "",
        email: details.email || "",
        notes: referenceNotes || "Direct Payout recorded by Admin",
      },
      status: 'completed',
      requestedAt: Timestamp.now(),
      processedAt: Timestamp.now(),
      adminNotes: referenceNotes || "Direct payout processed by Admin",
    };

    // 1. Write completed withdrawal request
    await addDoc(collection(db, 'withdrawalRequests'), requestData);

    // 2. Update user totals (withdrawableBalance & totalPaidOut)
    const currentTotalPaidOut = Number(providerUser.totalPaidOut) || 0;
    const currentBalance = Number(providerUser.withdrawableBalance) || 0;
    const newBalance = Math.max(0, currentBalance - numAmount);

    await updateDoc(providerUserRef, {
      totalPaidOut: currentTotalPaidOut + numAmount,
      withdrawableBalance: newBalance,
      withdrawalPending: false,
    });

    // 3. Write in-app notification to provider
    try {
      await addDoc(collection(db, 'userNotifications'), {
        userId: providerId,
        title: "Payout Received",
        message: `A direct payout of ₹${numAmount.toFixed(2)} has been recorded via ${method.replace('_', ' ').toUpperCase()}.${referenceNotes ? ` Reference: ${referenceNotes}` : ''}`,
        type: 'success',
        href: '/provider/withdrawal',
        read: false,
        createdAt: Timestamp.now(),
      });
    } catch (e) {
      console.warn("Could not send payout notification:", e);
    }

    // 4. Synchronize provider stats and earnings
    await recalculateProviderStatsAction(providerId);

    revalidatePath('/admin/provider-withdrawals');
    revalidatePath('/provider/earnings');
    revalidatePath('/provider/withdrawal');

    return {
      success: true,
      message: `Successfully recorded direct payout of ₹${numAmount.toFixed(2)} for ${providerUser.displayName || 'Provider'}.`
    };
  } catch (error: any) {
    console.error("Error in createAdminDirectPayoutAction:", error);
    return { success: false, message: error.message || "Failed to record direct payout." };
  }
}

// 14. Save Provider Withdrawal Method (MySQL/Firestore)
export async function saveProviderWithdrawalMethodAction(params: {
  providerId: string;
  method: {
    id?: string;
    type: 'bank_transfer' | 'upi' | 'amazon_gift_card' | 'other';
    title?: string;
    isDefault?: boolean;
    details: {
      accountHolderName?: string;
      bankName?: string;
      accountNumber?: string;
      ifscCode?: string;
      upiId?: string;
      email?: string;
    };
  };
}) {
  try {
    const { providerId, method } = params;
    if (!providerId || !method?.type) {
      return { success: false, message: "Provider ID and method type are required." };
    }

    const userRef = doc(db, 'users', providerId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      return { success: false, message: "Provider user not found." };
    }

    const userData = userSnap.data() as any;
    let existingMethods = (userData.savedWithdrawalMethods || []) as any[];

    const methodId = method.id || 'mth_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const isDefault = Boolean(method.isDefault) || existingMethods.length === 0;

    if (isDefault) {
      existingMethods = existingMethods.map(m => m.type === method.type ? { ...m, isDefault: false } : m);
    }

    const serializeMethod = (m: any) => ({
      id: String(m.id || ''),
      type: m.type,
      title: m.title || '',
      isDefault: Boolean(m.isDefault),
      details: {
        accountHolderName: m.details?.accountHolderName || '',
        bankName: m.details?.bankName || '',
        accountNumber: m.details?.accountNumber || '',
        ifscCode: m.details?.ifscCode || '',
        upiId: m.details?.upiId || '',
        email: m.details?.email || '',
      },
      createdAt: m.createdAt?.toDate ? m.createdAt.toDate().toISOString() : (m.createdAt?.seconds ? new Date(m.createdAt.seconds * 1000).toISOString() : (typeof m.createdAt === 'string' ? m.createdAt : new Date().toISOString()))
    });

    const newOrUpdatedMethod = {
      id: methodId,
      type: method.type,
      title: method.title?.trim() || (
        method.type === 'bank_transfer' 
          ? (method.details.bankName ? `${method.details.bankName} Account` : 'Bank Account')
          : method.type === 'upi'
          ? (method.details.upiId ? `UPI (${method.details.upiId})` : 'UPI ID')
          : (method.details.email ? `Amazon (${method.details.email})` : 'Gift Card')
      ),
      isDefault,
      details: {
        accountHolderName: method.details.accountHolderName?.trim() || '',
        bankName: method.details.bankName?.trim() || '',
        accountNumber: method.details.accountNumber?.trim() || '',
        ifscCode: method.details.ifscCode?.trim().toUpperCase() || '',
        upiId: method.details.upiId?.trim().toLowerCase() || '',
        email: method.details.email?.trim().toLowerCase() || '',
      },
      createdAt: new Date().toISOString(),
    };

    const existingIndex = existingMethods.findIndex(m => m.id === methodId);
    if (existingIndex >= 0) {
      existingMethods[existingIndex] = { ...existingMethods[existingIndex], ...newOrUpdatedMethod };
    } else {
      existingMethods.push(newOrUpdatedMethod);
    }

    const cleanMethods = existingMethods.map(serializeMethod);

    // Also update bankDetails on user if bank_transfer and bankDetails is missing or has empty account
    const updatePayload: any = {
      savedWithdrawalMethods: cleanMethods,
    };
    if (method.type === 'bank_transfer' && (!userData.bankDetails || !userData.bankDetails.accountNumber)) {
      updatePayload.bankDetails = {
        ...(userData.bankDetails || {}),
        accountHolderName: method.details.accountHolderName || '',
        bankName: method.details.bankName || '',
        accountNumber: method.details.accountNumber || '',
        ifscCode: method.details.ifscCode || '',
      };
    }

    await updateDoc(userRef, updatePayload);

    revalidatePath('/provider/withdrawal');
    revalidatePath('/admin/provider-withdrawals');

    return JSON.parse(JSON.stringify({ 
      success: true, 
      message: "Withdrawal method saved successfully.", 
      savedMethod: serializeMethod(newOrUpdatedMethod),
      methods: cleanMethods 
    }));
  } catch (error: any) {
    console.error("Error in saveProviderWithdrawalMethodAction:", error);
    return { success: false, message: error.message || "Failed to save withdrawal method." };
  }
}

// 15. Delete Provider Withdrawal Method (MySQL/Firestore)
export async function deleteProviderWithdrawalMethodAction(params: {
  providerId: string;
  methodId: string;
}) {
  try {
    const { providerId, methodId } = params;
    if (!providerId || !methodId) {
      return { success: false, message: "Provider ID and method ID are required." };
    }

    const userRef = doc(db, 'users', providerId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      return { success: false, message: "Provider user not found." };
    }

    const userData = userSnap.data() as any;
    const existingMethods = (userData.savedWithdrawalMethods || []) as any[];
    const serializeMethod = (m: any) => ({
      id: String(m.id || ''),
      type: m.type,
      title: m.title || '',
      isDefault: Boolean(m.isDefault),
      details: {
        accountHolderName: m.details?.accountHolderName || '',
        bankName: m.details?.bankName || '',
        accountNumber: m.details?.accountNumber || '',
        ifscCode: m.details?.ifscCode || '',
        upiId: m.details?.upiId || '',
        email: m.details?.email || '',
      },
      createdAt: m.createdAt?.toDate ? m.createdAt.toDate().toISOString() : (m.createdAt?.seconds ? new Date(m.createdAt.seconds * 1000).toISOString() : (typeof m.createdAt === 'string' ? m.createdAt : new Date().toISOString()))
    });

    const methodToDelete = existingMethods.find(m => m.id === methodId);
    const updatedMethods = existingMethods.filter(m => m.id !== methodId).map(serializeMethod);

    const updatePayload: any = {
      savedWithdrawalMethods: updatedMethods,
    };

    // If deleting profile_bank or if deleted method matches bankDetails, clear bankDetails so it doesn't resurrect
    if (
      methodId === 'profile_bank' ||
      (methodToDelete && methodToDelete.type === 'bank_transfer' && userData.bankDetails?.accountNumber === methodToDelete.details?.accountNumber) ||
      updatedMethods.filter(m => m.type === 'bank_transfer').length === 0
    ) {
      updatePayload.bankDetails = null;
    }

    // If deleting profile_upi or if deleted method matches bankDetails.upiId
    if (
      methodId === 'profile_upi' ||
      (methodToDelete && methodToDelete.type === 'upi' && userData.bankDetails?.upiId === methodToDelete.details?.upiId)
    ) {
      if (updatePayload.bankDetails !== null) {
        updatePayload.bankDetails = {
          ...(userData.bankDetails || {}),
          upiId: null,
        };
      }
    }

    await updateDoc(userRef, updatePayload);

    revalidatePath('/provider/withdrawal');
    revalidatePath('/admin/provider-withdrawals');

    return JSON.parse(JSON.stringify({ 
      success: true, 
      message: "Withdrawal method deleted successfully.", 
      methods: updatedMethods 
    }));
  } catch (error: any) {
    console.error("Error in deleteProviderWithdrawalMethodAction:", error);
    return { success: false, message: error.message || "Failed to delete withdrawal method." };
  }
}

