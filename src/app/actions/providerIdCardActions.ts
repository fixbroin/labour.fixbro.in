'use server';

import Razorpay from 'razorpay';
import { adminDb } from '@/lib/firebaseAdmin';
import { db } from '@/lib/mysqlDb';
import { doc, getDoc, setDoc, Timestamp } from '@/lib/mysqlDb';
import { revalidatePath } from 'next/cache';
import { triggerRefresh } from '@/lib/revalidateUtils';
import { getTimestampMillis } from '@/lib/utils';
import { 
  type ProviderIdCardSettings, 
  DEFAULT_ID_CARD_SETTINGS,
  type ProviderIdCardRecord,
  formatTechnicianId,
  formatIdNumber,
  generateUniqueIdCardNumber
} from '@/types/providerAreaAndId';
import type { ProviderApplication } from '@/types/firestore';

/**
 * Fetch provider ID card settings from database.
 */
export async function getProviderIdCardSettingsAction(): Promise<ProviderIdCardSettings> {
  try {
    const adminSnap = await adminDb.collection('appConfiguration').doc('provider_id_card').get();
    if (adminSnap.exists) {
      const data = adminSnap.data() as any;
      return {
        isIdCardEnabled: data.isIdCardEnabled !== false,
        downloadFee: Number(data.downloadFee ?? DEFAULT_ID_CARD_SETTINGS.downloadFee),
        validityYears: typeof data.validityYears === 'number' ? data.validityYears : DEFAULT_ID_CARD_SETTINGS.validityYears,
        validityMonths: typeof data.validityMonths === 'number' ? data.validityMonths : DEFAULT_ID_CARD_SETTINGS.validityMonths,
        signatoryName: String(data.signatoryName || DEFAULT_ID_CARD_SETTINGS.signatoryName),
        helplineNumber: String(data.helplineNumber || DEFAULT_ID_CARD_SETTINGS.helplineNumber),
        idNumberPrefix: String(data.idNumberPrefix ?? DEFAULT_ID_CARD_SETTINGS.idNumberPrefix),
        idNumberStartingSeq: Number(data.idNumberStartingSeq ?? DEFAULT_ID_CARD_SETTINGS.idNumberStartingSeq),
        lastAssignedSeq: typeof data.lastAssignedSeq === 'number' ? data.lastAssignedSeq : undefined,
        disclaimerText: String(
          data.disclaimerText && !data.disclaimerText.includes('FixBro') && !data.disclaimerText.includes('Fixbro')
            ? data.disclaimerText
            : DEFAULT_ID_CARD_SETTINGS.disclaimerText
        ),
      };
    }

    const docSnap = await getDoc(doc(db, 'appConfiguration', 'provider_id_card'));
    if (docSnap.exists()) {
      const data = docSnap.data() as any;
      return {
        isIdCardEnabled: data.isIdCardEnabled !== false,
        downloadFee: Number(data.downloadFee ?? DEFAULT_ID_CARD_SETTINGS.downloadFee),
        validityYears: typeof data.validityYears === 'number' ? data.validityYears : DEFAULT_ID_CARD_SETTINGS.validityYears,
        validityMonths: typeof data.validityMonths === 'number' ? data.validityMonths : DEFAULT_ID_CARD_SETTINGS.validityMonths,
        signatoryName: String(data.signatoryName || DEFAULT_ID_CARD_SETTINGS.signatoryName),
        helplineNumber: String(data.helplineNumber || DEFAULT_ID_CARD_SETTINGS.helplineNumber),
        idNumberPrefix: String(data.idNumberPrefix ?? DEFAULT_ID_CARD_SETTINGS.idNumberPrefix),
        idNumberStartingSeq: Number(data.idNumberStartingSeq ?? DEFAULT_ID_CARD_SETTINGS.idNumberStartingSeq),
        lastAssignedSeq: typeof data.lastAssignedSeq === 'number' ? data.lastAssignedSeq : undefined,
        disclaimerText: String(
          data.disclaimerText && !data.disclaimerText.includes('FixBro') && !data.disclaimerText.includes('Fixbro')
            ? data.disclaimerText
            : DEFAULT_ID_CARD_SETTINGS.disclaimerText
        ),
      };
    }

    return DEFAULT_ID_CARD_SETTINGS;
  } catch (error) {
    console.error("Error fetching provider ID card settings:", error);
    return DEFAULT_ID_CARD_SETTINGS;
  }
}

/**
 * Save provider ID card settings.
 */
export async function saveProviderIdCardSettingsAction(
  settings: ProviderIdCardSettings
): Promise<{ success: boolean; message: string }> {
  try {
    const vYears = typeof settings.validityYears === 'number' ? Math.max(0, settings.validityYears) : 2;
    const vMonths = typeof settings.validityMonths === 'number' ? Math.min(11, Math.max(0, settings.validityMonths)) : 0;
    const cleanData: Record<string, any> = {
      isIdCardEnabled: Boolean(settings.isIdCardEnabled),
      downloadFee: Math.max(0, Number(settings.downloadFee || 0)),
      validityYears: (vYears === 0 && vMonths === 0) ? 2 : vYears,
      validityMonths: vMonths,
      signatoryName: String(settings.signatoryName || DEFAULT_ID_CARD_SETTINGS.signatoryName).trim(),
      helplineNumber: String(settings.helplineNumber || DEFAULT_ID_CARD_SETTINGS.helplineNumber).trim(),
      idNumberPrefix: String(settings.idNumberPrefix || '').trim(),
      idNumberStartingSeq: Math.max(1, Number(settings.idNumberStartingSeq || DEFAULT_ID_CARD_SETTINGS.idNumberStartingSeq)),
      disclaimerText: String(settings.disclaimerText || DEFAULT_ID_CARD_SETTINGS.disclaimerText).trim(),
      updatedAt: Timestamp.now(),
    };

    // Save directly via adminDb into MySQL
    await adminDb.collection('appConfiguration').doc('provider_id_card').set(cleanData, { merge: true });

    // Also persist via client SDK reference
    try {
      const docRef = doc(db, 'appConfiguration', 'provider_id_card');
      await setDoc(docRef, cleanData, { merge: true });
    } catch {
      // adminDb write already committed directly
    }

    revalidatePath('/admin/provider-controls');
    revalidatePath('/provider/id-card');
    revalidatePath('/admin/provider-id-cards');
    triggerRefresh('/admin/provider-controls');
    triggerRefresh('/provider/id-card');
    triggerRefresh('/admin/provider-id-cards');

    return { success: true, message: "ID card settings saved successfully." };
  } catch (error: any) {
    console.error("Error saving provider ID card settings:", error);
    return { success: false, message: error.message || "Failed to save ID card settings." };
  }
}

/**
 * Assign the next sequential ID card number (increases 1 by 1 from starting sequence).
 */
export async function assignSequentialIdCardNumber(
  providerId: string
): Promise<{ idCardNumber: string; idCardSeq: number }> {
  const docRef = adminDb.collection('providerApplications').doc(providerId);
  const snap = await docRef.get();
  const data = snap.exists ? (snap.data() as ProviderApplication) : null;

  const settings = await getProviderIdCardSettingsAction();
  const startSeq = Number(settings.idNumberStartingSeq || 1001);
  const prefix = settings.idNumberPrefix || '';

  // 1. If provider already has an assigned sequence >= startSeq, preserve it
  if (data?.idCardNumber && typeof data?.idCardSeq === 'number' && data.idCardSeq >= startSeq) {
    return {
      idCardNumber: data.idCardNumber,
      idCardSeq: data.idCardSeq,
    };
  }

  // 2. Scan all existing applications to find current highest assigned sequence
  const allAppsSnap = await adminDb.collection('providerApplications').get();
  let maxSeq = startSeq - 1;

  allAppsSnap.forEach((docSnap) => {
    if (docSnap.id === providerId) return;
    const appData = docSnap.data();
    if (typeof appData.idCardSeq === 'number' && appData.idCardSeq > maxSeq) {
      maxSeq = appData.idCardSeq;
    }
  });

  if (typeof settings.lastAssignedSeq === 'number' && settings.lastAssignedSeq > maxSeq) {
    maxSeq = settings.lastAssignedSeq;
  }

  const nextSeq = Math.max(startSeq, maxSeq + 1);
  const assignedNumber = formatIdNumber(nextSeq, startSeq, prefix);

  // Update lastAssignedSeq in settings
  await adminDb.collection('appConfiguration').doc('provider_id_card').set({
    lastAssignedSeq: nextSeq,
    updatedAt: Timestamp.now(),
  }, { merge: true });

  return {
    idCardNumber: assignedNumber,
    idCardSeq: nextSeq,
  };
}

/**
 * Record when a verified provider views/generates their ID card for the first time.
 * Also assigns or updates a unique ID card number sequentially.
 */
export async function recordIdCardGenerationAction(
  providerId: string
): Promise<{ success: boolean; message: string; idCardNumber?: string }> {
  try {
    if (!providerId) return { success: false, message: "Missing provider ID" };

    const docRef = adminDb.collection('providerApplications').doc(providerId);
    const snap = await docRef.get();
    if (!snap.exists) return { success: false, message: "Application not found" };

    const data = snap.data() as ProviderApplication;
    const settings = await getProviderIdCardSettingsAction();
    const { idCardNumber, idCardSeq } = await assignSequentialIdCardNumber(providerId);

    const vYears = Number(settings.validityYears || 0);
    const vMonths = Number(settings.validityMonths || 0);
    const totalMonths = (vYears === 0 && vMonths === 0) ? 24 : (vYears * 12 + vMonths);
    const expDate = new Date();
    expDate.setMonth(expDate.getMonth() + totalMonths);

    const updatePayload: Record<string, any> = {
      idCardGenerated: true,
      idCardGeneratedAt: data.idCardGeneratedAt || Timestamp.now(),
      idCardExpiresAt: data.idCardExpiresAt || Timestamp.fromDate(expDate),
      idCardNumber,
      idCardSeq,
      updatedAt: Timestamp.now(),
    };

    await docRef.set(updatePayload, { merge: true });
    try {
      await setDoc(doc(db, 'providerApplications', providerId), updatePayload, { merge: true });
    } catch {
      // adminDb committed
    }

    revalidatePath('/admin/provider-id-cards');
    return { success: true, message: "ID card generation recorded", idCardNumber };
  } catch (error: any) {
    console.error("Error recording ID card generation:", error);
    return { success: false, message: error.message || "Failed to record generation" };
  }
}

/**
 * Delete / reset a generated provider ID card so they can regenerate afresh with current settings.
 */
export async function deleteOrResetProviderIdCardAction(
  providerId: string
): Promise<{ success: boolean; message: string }> {
  try {
    if (!providerId) return { success: false, message: "Missing provider ID" };

    const clearPayload: Record<string, any> = {
      idCardNumber: null,
      idCardSeq: null,
      idCardGenerated: false,
      idCardGeneratedAt: null,
      idCardUnlocked: false,
      idCardUnlockedAt: null,
      idCardExpiresAt: null,
      idCardPaymentId: null,
      idCardOrderId: null,
      idCardPaidAmount: 0,
      idCardDownloadCount: 0,
      idCardPdfDownloadCount: 0,
      idCardFrontPngDownloadCount: 0,
      idCardBackPngDownloadCount: 0,
      idCardLastDownloadedAt: null,
      idCardDownloads: [],
      updatedAt: Timestamp.now(),
    };

    await adminDb.collection('providerApplications').doc(providerId).set(clearPayload, { merge: true });
    try {
      await setDoc(doc(db, 'providerApplications', providerId), clearPayload, { merge: true });
    } catch {
      // adminDb committed
    }

    revalidatePath('/admin/provider-id-cards');
    revalidatePath('/provider/id-card');
    triggerRefresh('/admin/provider-id-cards');
    triggerRefresh('/provider/id-card');

    return { success: true, message: "Provider ID card reset successfully. Provider can now regenerate." };
  } catch (error: any) {
    console.error("Error resetting ID card:", error);
    return { success: false, message: error.message || "Failed to reset card" };
  }
}

/**
 * Unlock ID card download for an approved provider (e.g. after payment or if free).
 */
export async function unlockProviderIdCardAction(
  providerId: string,
  paymentDetails?: { razorpay_order_id?: string; razorpay_payment_id?: string; amount?: number }
): Promise<{ success: boolean; message: string }> {
  try {
    const settings = await getProviderIdCardSettingsAction();
    const docRef = adminDb.collection('providerApplications').doc(providerId);
    const snap = await docRef.get();
    const data = snap.exists ? (snap.data() as ProviderApplication) : null;
    const { idCardNumber, idCardSeq } = await assignSequentialIdCardNumber(providerId);

    const vYears = Number(settings.validityYears || 0);
    const vMonths = Number(settings.validityMonths || 0);
    const totalMonths = (vYears === 0 && vMonths === 0) ? 24 : (vYears * 12 + vMonths);
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + totalMonths);

    const updatePayload: Record<string, any> = {
      idCardUnlocked: true,
      idCardUnlockedAt: Timestamp.now(),
      idCardExpiresAt: Timestamp.fromDate(expiryDate),
      idCardGenerated: true,
      idCardGeneratedAt: data?.idCardGeneratedAt || Timestamp.now(),
      idCardNumber,
      idCardSeq,
    };

    if (paymentDetails?.razorpay_payment_id) {
      updatePayload.idCardPaymentId = paymentDetails.razorpay_payment_id;
      updatePayload.idCardOrderId = paymentDetails.razorpay_order_id || null;
      updatePayload.idCardPaidAmount = Number(paymentDetails.amount ?? 0);
    } else {
      updatePayload.idCardPaidAmount = 0;
    }

    await docRef.set(updatePayload, { merge: true });

    try {
      await setDoc(doc(db, 'providerApplications', providerId), updatePayload, { merge: true });
    } catch {
      // adminDb already saved
    }

    revalidatePath('/provider/id-card');
    revalidatePath('/admin/provider-id-cards');
    triggerRefresh('/provider/id-card');
    triggerRefresh('/admin/provider-id-cards');

    return { success: true, message: "Official ID card unlocked successfully!" };
  } catch (error: any) {
    console.error("Error unlocking provider ID card:", error);
    return { success: false, message: error.message || "Failed to unlock ID card." };
  }
}

/**
 * Verify pending Razorpay ID card unlock order (auto-recovery upon returning from UPI / app resume).
 */
export async function verifyPendingIdCardUnlockAction(
  orderId: string,
  providerId: string,
  expectedAmount?: number
): Promise<{
  success: boolean;
  verified: boolean;
  alreadyUnlocked?: boolean;
  unlockedNow?: boolean;
  paymentId?: string;
  amount?: number;
  message?: string;
}> {
  try {
    if (!orderId || !providerId) {
      return { success: false, verified: false, message: 'Invalid order or provider ID' };
    }

    // 1. Check if ID card is already unlocked in providerApplications
    const docRef = adminDb.collection('providerApplications').doc(providerId);
    const docSnap = await docRef.get();
    if (docSnap.exists) {
      const pData = docSnap.data();
      if (pData?.idCardUnlocked) {
        return {
          success: true,
          verified: true,
          alreadyUnlocked: true,
          paymentId: pData.idCardPaymentId || undefined,
          amount: Number(pData.idCardPaymentAmount) || expectedAmount || 0,
          message: 'Official ID card is already unlocked.',
        };
      }
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
      const unlockRes = await unlockProviderIdCardAction(providerId, {
        razorpay_order_id: orderId,
        razorpay_payment_id: capturedPayment.id,
        amount: paymentAmount,
      });

      return {
        success: true,
        verified: true,
        unlockedNow: true,
        paymentId: capturedPayment.id,
        amount: paymentAmount,
        message: unlockRes.message || 'Official ID card unlocked successfully.',
      };
    }

    return { success: false, verified: false, message: 'Payment not yet confirmed by Razorpay' };
  } catch (error: any) {
    console.error('Error verifying pending ID card unlock:', error);
    return { success: false, verified: false, message: error.message || 'Verification failed' };
  }
}

/**
 * Track an ID card download event (PDF, Front Image, or Back Image).
 */
export async function trackIdCardDownloadAction(
  providerId: string,
  downloadType: 'pdf' | 'front_png' | 'back_png'
): Promise<{ success: boolean; downloadCount: number }> {
  try {
    if (!providerId) throw new Error("Missing provider ID");

    const docRef = adminDb.collection('providerApplications').doc(providerId);
    const snap = await docRef.get();
    if (!snap.exists) throw new Error("Provider record not found");

    const data = snap.data() as ProviderApplication;
    const currentTotal = Number(data.idCardDownloadCount || 0);
    const currentPdf = Number(data.idCardPdfDownloadCount || 0);
    const currentFront = Number(data.idCardFrontPngDownloadCount || 0);
    const currentBack = Number(data.idCardBackPngDownloadCount || 0);
    const downloadsHistory = Array.isArray(data.idCardDownloads) ? [...data.idCardDownloads] : [];

    const newTotal = currentTotal + 1;
    const newPdf = currentPdf + (downloadType === 'pdf' ? 1 : 0);
    const newFront = currentFront + (downloadType === 'front_png' ? 1 : 0);
    const newBack = currentBack + (downloadType === 'back_png' ? 1 : 0);

    const now = Date.now();
    downloadsHistory.unshift({
      type: downloadType,
      downloadedAt: now,
      id: `${downloadType}_${now}`,
    });

    // Keep the latest 50 download log items to prevent uncontrolled doc growth
    const trimmedHistory = downloadsHistory.slice(0, 50);

    const updatePayload: Record<string, any> = {
      idCardGenerated: true,
      idCardDownloadCount: newTotal,
      idCardPdfDownloadCount: newPdf,
      idCardFrontPngDownloadCount: newFront,
      idCardBackPngDownloadCount: newBack,
      idCardLastDownloadedAt: Timestamp.now(),
      idCardDownloads: trimmedHistory,
      updatedAt: Timestamp.now(),
    };

    await docRef.set(updatePayload, { merge: true });

    try {
      await setDoc(doc(db, 'providerApplications', providerId), updatePayload, { merge: true });
    } catch {
      // adminDb committed
    }

    revalidatePath('/admin/provider-id-cards');
    return { success: true, downloadCount: newTotal };
  } catch (error: any) {
    console.error("Error tracking ID card download:", error);
    return { success: false, downloadCount: 0 };
  }
}

/**
 * Fetch all provider records who generated, unlocked, or are eligible for ID cards.
 */
export async function getProvidersWithIdCardsAction(): Promise<ProviderIdCardRecord[]> {
  try {
    const [snap, settings] = await Promise.all([
      adminDb.collection('providerApplications').get(),
      getProviderIdCardSettingsAction(),
    ]);

    const records: ProviderIdCardRecord[] = [];

    snap.forEach((docSnap) => {
      const data = docSnap.data() as ProviderApplication;
      if (data.status === 'approved') {
        const isGenerated = Boolean(
          data.idCardGenerated || 
          data.idCardUnlocked || 
          (data.idCardDownloadCount && data.idCardDownloadCount > 0)
        );

        const generatedAtMillis = getTimestampMillis(data.idCardGeneratedAt);
        const unlockedAtMillis = getTimestampMillis(data.idCardUnlockedAt);
        const lastDownloadedMillis = getTimestampMillis(data.idCardLastDownloadedAt);

        const safeDownloads = Array.isArray(data.idCardDownloads) 
          ? data.idCardDownloads.map((d: any) => ({
              type: (d.type === 'front_png' || d.type === 'back_png' ? d.type : 'pdf') as 'pdf' | 'front_png' | 'back_png',
              downloadedAt: typeof d.downloadedAt === 'number' ? d.downloadedAt : (getTimestampMillis(d.downloadedAt) || Date.now()),
              id: d.id ? String(d.id) : undefined,
            }))
          : [];

        // Only set assigned ID number if already generated in database
        const idCardNumber = data.idCardNumber ? String(data.idCardNumber) : undefined;

        records.push({
          providerId: docSnap.id,
          fullName: String(data.fullName || 'Service Provider'),
          mobileNumber: data.mobileNumber ? String(data.mobileNumber) : undefined,
          email: data.email ? String(data.email) : undefined,
          profilePhotoUrl: data.profilePhotoUrl ? String(data.profilePhotoUrl) : undefined,
          signatureUrl: data.signatureUrl ? String(data.signatureUrl) : undefined,
          workCategoryName: data.workCategoryName ? String(data.workCategoryName) : undefined,
          skillLevelLabel: data.skillLevelLabel ? String(data.skillLevelLabel) : undefined,
          workAreaAddress: data.workAreaAddress ? String(data.workAreaAddress) : undefined,
          residentialAddress: data.address ? String(data.address) : undefined,
          gender: data.gender ? String(data.gender) : 'Male',
          dob: data.dob ? String(data.dob) : undefined,
          age: data.age ? Number(data.age) : undefined,
          idCardNumber,
          idCardSeq: typeof data.idCardSeq === 'number' ? data.idCardSeq : undefined,
          technicianId: formatTechnicianId(docSnap.id),
          status: data.status,
          idCardGenerated: isGenerated,
          idCardGeneratedAt: generatedAtMillis,
          idCardUnlocked: Boolean(data.idCardUnlocked),
          idCardUnlockedAt: unlockedAtMillis,
          idCardExpiresAt: getTimestampMillis(data.idCardExpiresAt),
          idCardPaymentId: data.idCardPaymentId ? String(data.idCardPaymentId) : null,
          idCardOrderId: data.idCardOrderId ? String(data.idCardOrderId) : null,
          idCardPaidAmount: Number(data.idCardPaidAmount || 0),
          idCardDownloadCount: Number(data.idCardDownloadCount || 0),
          idCardPdfDownloadCount: Number(data.idCardPdfDownloadCount || 0),
          idCardFrontPngDownloadCount: Number(data.idCardFrontPngDownloadCount || 0),
          idCardBackPngDownloadCount: Number(data.idCardBackPngDownloadCount || 0),
          idCardLastDownloadedAt: lastDownloadedMillis,
          idCardDownloads: safeDownloads,
        });
      }
    });

    // Sort: providers with generated/unlocked/downloaded cards first, then by last downloaded or unlocked
    records.sort((a, b) => {
      if (a.idCardGenerated && !b.idCardGenerated) return -1;
      if (!a.idCardGenerated && b.idCardGenerated) return 1;
      const timeA = a.idCardLastDownloadedAt || a.idCardUnlockedAt || a.idCardGeneratedAt || 0;
      const timeB = b.idCardLastDownloadedAt || b.idCardUnlockedAt || b.idCardGeneratedAt || 0;
      return timeB - timeA;
    });

    return JSON.parse(JSON.stringify(records));
  } catch (error) {
    console.error("Error fetching providers with ID cards:", error);
    return [];
  }
}

/**
 * Public provider ID card verification action.
 * Looks up provider details cleanly without exposing sensitive private data.
 */
export async function getPublicProviderVerificationAction(idOrNumber: string): Promise<{
  found: boolean;
  provider?: {
    id: string;
    fullName: string;
    workCategoryName: string;
    skillLevelLabel?: string;
    idCardNumber: string;
    profilePhotoUrl?: string;
    gender?: string;
    dob?: string;
    age?: number;
    issueDateStr: string;
    validThruStr: string;
    isExpired: boolean;
    isActive: boolean;
    status: string;
    city?: string;
  };
  message?: string;
}> {
  try {
    if (!idOrNumber) return { found: false, message: "Invalid ID card request" };

    const cleanQuery = decodeURIComponent(idOrNumber).trim();
    let targetDoc: any = null;
    let providerId = cleanQuery;

    // 1. Direct document lookup by providerId
    const directSnap = await adminDb.collection('providerApplications').doc(cleanQuery).get();
    if (directSnap.exists) {
      targetDoc = directSnap.data();
      providerId = directSnap.id;
    } else {
      // 2. Try searching by idCardNumber or unspaced idCardNumber
      const normalizedQuery = cleanQuery.replace(/\s+/g, '').toLowerCase();
      const allAppsSnap = await adminDb.collection('providerApplications').get();
      allAppsSnap.forEach((docSnap) => {
        const d = docSnap.data();
        const storedNum = String(d.idCardNumber || '').replace(/\s+/g, '').toLowerCase();
        if (storedNum && storedNum === normalizedQuery) {
          targetDoc = d;
          providerId = docSnap.id;
        }
      });
    }

    if (!targetDoc) {
      return { found: false, message: "No official service partner record found for this ID." };
    }

    const settings = await getProviderIdCardSettingsAction();
    const assignedNumber = targetDoc.idCardNumber || formatIdNumber(settings.idNumberStartingSeq, settings.idNumberStartingSeq, settings.idNumberPrefix);

    const issueMillis = getTimestampMillis(targetDoc.idCardUnlockedAt || targetDoc.idCardGeneratedAt || targetDoc.submittedAt || targetDoc.createdAt) || Date.now();
    const issueDate = new Date(issueMillis);
    const issueDateStr = `${String(issueDate.getMonth() + 1).padStart(2, '0')}/${issueDate.getFullYear()}`;

    // Calculate expiry date based on current admin validity setting (months & years)
    const vYears = Number(settings.validityYears || 0);
    const vMonths = Number(settings.validityMonths || 0);
    const totalMonths = (vYears === 0 && vMonths === 0) ? 24 : (vYears * 12 + vMonths);
    const expDate = new Date(issueMillis);
    expDate.setMonth(expDate.getMonth() + totalMonths);
    const expiryMillis = expDate.getTime();
    const expiryDate = new Date(expiryMillis);
    const validThruStr = `${String(expiryDate.getMonth() + 1).padStart(2, '0')}/${expiryDate.getFullYear()}`;

    const isExpired = Date.now() > expiryMillis;
    const isApproved = targetDoc.status === 'approved';
    const isActive = isApproved && !isExpired;

    return {
      found: true,
      provider: {
        id: providerId,
        fullName: targetDoc.fullName || 'Service Professional',
        workCategoryName: targetDoc.workCategoryName || 'Certified Technician',
        skillLevelLabel: targetDoc.skillLevelLabel || 'Skilled Professional',
        idCardNumber: assignedNumber,
        profilePhotoUrl: targetDoc.profilePhotoUrl || '',
        gender: targetDoc.gender || 'Male',
        dob: targetDoc.dob || undefined,
        age: targetDoc.age || undefined,
        issueDateStr,
        validThruStr,
        isExpired,
        isActive,
        status: !isApproved ? (targetDoc.status || 'inactive') : isExpired ? 'expired' : 'active',
        city: targetDoc.workAreaAddress || targetDoc.address || '',
      }
    };
  } catch (error: any) {
    console.error("Error in public provider verification:", error);
    return { found: false, message: error.message || "Failed to retrieve verification details." };
  }
}
