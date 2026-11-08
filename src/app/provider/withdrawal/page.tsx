
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Loader2, Send, AlertTriangle, PackageSearch, History, Edit, Check, ChevronsUpDown, PlusCircle, Trash2, Building, Smartphone, Mail, CreditCard } from "lucide-react";
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, runTransaction, getDoc, addDoc, doc, Timestamp, getDocs, limit, updateDoc } from '@/lib/mysqlDb';
import type { WithdrawalSettings, WithdrawalRequest, WithdrawalMethodType, WithdrawalStatus, FirestoreNotification, FirestoreUser, FirestoreBooking, ProviderFeeType, SavedWithdrawalMethod } from '@/types/firestore';
import { saveProviderWithdrawalMethodAction, deleteProviderWithdrawalMethodAction } from '@/app/actions/providerWalletActions';
import { useAuth } from '@/hooks/useAuth';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { useApplicationConfig } from '@/hooks/useApplicationConfig';
import { ADMIN_EMAIL } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { getTimestampMillis, formatDateInTimezone, isCashPayment } from '@/lib/utils';
import { nanoid } from 'nanoid';
import { triggerPushNotification } from '@/lib/fcmUtils';

const withdrawalFormSchema = z.object({
  amount: z.coerce.number().positive("Withdrawal amount must be positive.").nullable(),
  method: z.string({ required_error: "Please select a withdrawal method." }),
  details: z.object({
    accountHolderName: z.string().optional(),
    bankName: z.string().optional(),
    accountNumber: z.string().optional(),
    confirmAccountNumber: z.string().optional(),
    ifscCode: z.string().optional(),
    upiId: z.string().optional(),
    email: z.string().optional(), // For Amazon Gift Card
  }),
}).refine(data => {
    if (data.method === 'bank_transfer') {
        if (!data.details.accountHolderName || !data.details.bankName || !data.details.accountNumber || !data.details.ifscCode) {
            return false;
        }
        if (data.details.accountNumber !== data.details.confirmAccountNumber) {
            return false;
        }
    }
    return true;
}, { 
    message: "Account numbers do not match.",
    path: ["details", "confirmAccountNumber"],
}).refine(data => data.method !== 'bank_transfer' || !!data.details.accountHolderName, {
    message: "Account holder name is required for bank transfer.",
    path: ["details", "accountHolderName"],
}).refine(data => data.method !== 'bank_transfer' || !!data.details.bankName, {
    message: "Bank name is required for bank transfer.",
    path: ["details", "bankName"],
}).refine(data => data.method !== 'bank_transfer' || !!data.details.accountNumber, {
    message: "Account number is required for bank transfer.",
    path: ["details", "accountNumber"],
}).refine(data => data.method !== 'bank_transfer' || !!data.details.ifscCode, {
    message: "IFSC code is required for bank transfer.",
    path: ["details", "ifscCode"],
}).refine(data => data.method !== 'upi' || (data.details.upiId && data.details.upiId.includes('@')), {
    message: "Please enter a valid UPI ID.",
    path: ["details", "upiId"],
}).refine(data => data.method !== 'amazon_gift_card' || (data.details.email && z.string().email().safeParse(data.details.email).success), {
    message: "A valid email is required for Amazon Gift Card.",
    path: ["details", "email"],
});


type WithdrawalFormData = z.infer<typeof withdrawalFormSchema>;

const formatDate = (timestamp?: any) => {
    const millis = getTimestampMillis(timestamp);
    if (!millis) return 'N/A';
    return formatDateInTimezone(new Date(millis), 'Asia/Kolkata');
};

const calculateProviderFee = (bookingAmount: number, feeType?: ProviderFeeType, feeValue?: number): number => {
    if (!feeType || !feeValue || feeValue <= 0) return 0;
    if (feeType === 'fixed') return feeValue;
    if (feeType === 'percentage') return (bookingAmount * feeValue) / 100;
    return 0;
};

function WithdrawalPageContent() {
  const { user: providerUser, firestoreUser, isLoading: authIsLoading } = useAuth();
  const { config: appConfig, isLoading: isLoadingAppConfig } = useApplicationConfig();
  const symbol = appConfig?.currencySymbol || "₹";
  const { toast } = useToast();
  const decimals = appConfig?.currencyDecimalPoints !== undefined ? Number(appConfig.currencyDecimalPoints) : 2;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [withdrawalHistory, setWithdrawalHistory] = useState<WithdrawalRequest[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [completedBookings, setCompletedBookings] = useState<FirestoreBooking[]>([]);
  const [editingRequest, setEditingRequest] = useState<WithdrawalRequest | null>(null);

  const [withdrawalSettings, setWithdrawalSettings] = useState<WithdrawalSettings | null>(null);
  const [isMethodPickerOpen, setIsMethodPickerOpen] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isManageMethodsOpen, setIsManageMethodsOpen] = useState(false);

  const withdrawableBalance = useMemo(() => {
    return firestoreUser?.withdrawableBalance || 0;
  }, [firestoreUser?.withdrawableBalance]);


  const form = useForm<WithdrawalFormData>({
    resolver: zodResolver(withdrawalFormSchema),
    defaultValues: {
      amount: 0,
      method: undefined,
      details: { accountHolderName: firestoreUser?.displayName || "", bankName: "", accountNumber: "", confirmAccountNumber: "", ifscCode: "", upiId: "", email: firestoreUser?.email || "" },
    },
  });

  const baseSavedMethods = useMemo(() => {
    // If user has savedWithdrawalMethods array defined (even if empty []), respect it!
    if (Array.isArray((firestoreUser as any)?.savedWithdrawalMethods)) {
      return (firestoreUser as any).savedWithdrawalMethods as SavedWithdrawalMethod[];
    }
    // Only if savedWithdrawalMethods is strictly undefined (legacy users who haven't saved methods yet):
    const bd = (firestoreUser as any)?.bankDetails;
    if (bd && (bd.accountNumber || bd.upiId)) {
      const synthetic: SavedWithdrawalMethod[] = [];
      if (bd.accountNumber) {
        synthetic.push({
          id: 'profile_bank',
          type: 'bank_transfer',
          title: bd.bankName ? `${bd.bankName} Account` : 'Profile Bank A/C',
          isDefault: true,
          details: {
            accountHolderName: bd.accountHolderName || firestoreUser?.displayName || '',
            bankName: bd.bankName || '',
            accountNumber: bd.accountNumber || '',
            ifscCode: bd.ifscCode || '',
          }
        });
      }
      if (bd.upiId) {
        synthetic.push({
          id: 'profile_upi',
          type: 'upi',
          title: `UPI (${bd.upiId})`,
          isDefault: !bd.accountNumber,
          details: {
            upiId: bd.upiId,
          }
        });
      }
      return synthetic;
    }
    return [];
  }, [firestoreUser]);

  const [localSavedMethods, setLocalSavedMethods] = useState<SavedWithdrawalMethod[] | null>(null);

  useEffect(() => {
    setLocalSavedMethods(baseSavedMethods);
  }, [baseSavedMethods]);

  const savedMethods = localSavedMethods ?? baseSavedMethods;

  // Manage / Add Methods Dialog State
  const [newMethodType, setNewMethodType] = useState<WithdrawalMethodType>('bank_transfer');
  const [bankNickname, setBankNickname] = useState('');
  const [upiNickname, setUpiNickname] = useState('');
  const [giftCardNickname, setGiftCardNickname] = useState('');
  const [newAccountHolderName, setNewAccountHolderName] = useState('');
  const [newBankName, setNewBankName] = useState('');
  const [newAccountNumber, setNewAccountNumber] = useState('');
  const [newConfirmAccountNumber, setNewConfirmAccountNumber] = useState('');
  const [newIfscCode, setNewIfscCode] = useState('');
  const [newUpiId, setNewUpiId] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newIsDefault, setNewIsDefault] = useState(false);
  const [isSavingMethod, setIsSavingMethod] = useState(false);

  // Main withdrawal form saved method selection
  const [selectedSavedMethodId, setSelectedSavedMethodId] = useState<string | null>(null);
  const [saveMethodForFuture, setSaveMethodForFuture] = useState(true);
  const [methodErrors, setMethodErrors] = useState<Record<string, string>>({});

  const clearMethodError = (field: string) => {
    if (methodErrors[field]) {
      setMethodErrors((prev) => {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      });
    }
  };

  const applySavedMethodToForm = useCallback((method: SavedWithdrawalMethod) => {
    if (method.type === 'bank_transfer') {
      form.setValue("details.accountHolderName", method.details.accountHolderName || "");
      form.setValue("details.bankName", method.details.bankName || "");
      form.setValue("details.accountNumber", method.details.accountNumber || "");
      form.setValue("details.confirmAccountNumber", method.details.accountNumber || "");
      form.setValue("details.ifscCode", method.details.ifscCode || "");
    } else if (method.type === 'upi') {
      form.setValue("details.upiId", method.details.upiId || "");
    } else if (method.type === 'amazon_gift_card') {
      form.setValue("details.email", method.details.email || "");
    }
  }, [form]);

  const handleSaveNewMethod = async () => {
    if (!providerUser?.uid) return;

    const errors: Record<string, string> = {};
    let firstErrorId: string | null = null;

    if (newMethodType === 'bank_transfer') {
      if (!newAccountHolderName.trim()) {
        errors.accountHolderName = "Account holder name is required for bank transfer.";
        if (!firstErrorId) firstErrorId = "add-method-account-holder-name";
      }
      if (!newBankName.trim()) {
        errors.bankName = "Bank name is required for bank transfer.";
        if (!firstErrorId) firstErrorId = "add-method-bank-name";
      }
      if (!newAccountNumber.trim()) {
        errors.accountNumber = "Account number is required for bank transfer.";
        if (!firstErrorId) firstErrorId = "add-method-account-number";
      }
      if (!newConfirmAccountNumber.trim()) {
        errors.confirmAccountNumber = "Please confirm your account number.";
        if (!firstErrorId) firstErrorId = "add-method-confirm-account-number";
      } else if (newAccountNumber.trim() !== newConfirmAccountNumber.trim()) {
        errors.confirmAccountNumber = "Account numbers do not match.";
        if (!firstErrorId) firstErrorId = "add-method-confirm-account-number";
      }
      if (!newIfscCode.trim()) {
        errors.ifscCode = `${appConfig?.customBankFields?.[0]?.name || "IFSC code"} is required.`;
        if (!firstErrorId) firstErrorId = "add-method-ifsc-code";
      }
    } else if (newMethodType === 'upi') {
      if (!newUpiId.trim()) {
        errors.upiId = "UPI ID is required.";
        if (!firstErrorId) firstErrorId = "add-method-upi-id";
      } else if (!newUpiId.includes('@')) {
        errors.upiId = "Please enter a valid UPI ID (e.g. name@bank).";
        if (!firstErrorId) firstErrorId = "add-method-upi-id";
      }
    } else if (newMethodType === 'amazon_gift_card') {
      if (!newEmail.trim()) {
        errors.email = "Email is required for Amazon Gift Card.";
        if (!firstErrorId) firstErrorId = "add-method-email";
      } else if (!z.string().email().safeParse(newEmail.trim()).success) {
        errors.email = "Please enter a valid email address.";
        if (!firstErrorId) firstErrorId = "add-method-email";
      }
    }

    if (Object.keys(errors).length > 0) {
      setMethodErrors(errors);
      toast({
        title: "Incomplete Details",
        description: newMethodType === 'bank_transfer'
          ? (errors.confirmAccountNumber === "Account numbers do not match." ? "Account numbers do not match." : "Please fill all bank account fields.")
          : newMethodType === 'upi'
          ? "Please enter a valid UPI ID."
          : "Please enter a valid email address.",
        variant: "destructive"
      });
      if (firstErrorId) {
        setTimeout(() => {
          const el = document.getElementById(firstErrorId!);
          if (el) {
            el.focus();
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 50);
      }
      return;
    }
    setMethodErrors({});

    const currentNickname = (
      newMethodType === 'bank_transfer' ? bankNickname :
      newMethodType === 'upi' ? upiNickname :
      giftCardNickname
    ).trim();

    setIsSavingMethod(true);
    try {
      const res = await saveProviderWithdrawalMethodAction({
        providerId: providerUser.uid,
        method: {
          type: newMethodType,
          title: currentNickname,
          isDefault: newIsDefault,
          details: {
            accountHolderName: newAccountHolderName.trim(),
            bankName: newBankName.trim(),
            accountNumber: newAccountNumber.trim(),
            ifscCode: newIfscCode.trim(),
            upiId: newUpiId.trim(),
            email: newEmail.trim(),
          }
        }
      });

      if (res.success) {
        toast({ title: "Success", description: "Withdrawal method saved successfully." });
        if (res.methods) {
          setLocalSavedMethods(res.methods);
        }
        if (newMethodType === 'bank_transfer') setBankNickname('');
        if (newMethodType === 'upi') setUpiNickname('');
        if (newMethodType === 'amazon_gift_card') setGiftCardNickname('');
        setNewAccountHolderName('');
        setNewBankName('');
        setNewAccountNumber('');
        setNewConfirmAccountNumber('');
        setNewIfscCode('');
        setNewUpiId('');
        setNewEmail('');
        setNewIsDefault(false);
        setMethodErrors({});
      } else {
        toast({ title: "Failed", description: res.message, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to save method.", variant: "destructive" });
    } finally {
      setIsSavingMethod(false);
    }
  };
  
  useEffect(() => {
    if (firestoreUser && !editingRequest) {
        const bankDetails = (firestoreUser as any).bankDetails || {};
        form.reset({
            amount: 0,
            method: undefined,
            details: {
                email: firestoreUser.email || "",
                accountHolderName: bankDetails.accountHolderName || firestoreUser.displayName || "",
                bankName: bankDetails.bankName || "",
                accountNumber: bankDetails.accountNumber || "",
                confirmAccountNumber: bankDetails.accountNumber || "",
                ifscCode: bankDetails.ifscCode || (bankDetails.customFields && Object.values(bankDetails.customFields)[0]) || "",
                upiId: "",
            },
        });
    }
  }, [firestoreUser, editingRequest, form]);

   useEffect(() => {
    if (editingRequest) {
        form.reset({
            amount: editingRequest.amount,
            method: editingRequest.method,
            details: {
                accountHolderName: editingRequest.details.accountHolderName || firestoreUser?.displayName || "",
                bankName: editingRequest.details.bankName || "",
                accountNumber: editingRequest.details.accountNumber || "",
                confirmAccountNumber: editingRequest.details.accountNumber || "",
                ifscCode: editingRequest.details.ifscCode || "",
                upiId: editingRequest.details.upiId || "",
                email: editingRequest.details.email || firestoreUser?.email || "",
            },
        });
    }
  }, [editingRequest, form, firestoreUser]);
  
  useEffect(() => {
    const settingsDocRef = doc(db, "appConfiguration", "withdrawal_provider");
    const unsubscribeSettings = onSnapshot(settingsDocRef, (docSnap) => {
        if (docSnap.exists()) {
            setWithdrawalSettings(docSnap.data() as WithdrawalSettings);
        } else {
            setWithdrawalSettings(null); // Or some default settings
        }
        setIsLoadingSettings(false);
    }, (error) => {
        console.error("Error fetching withdrawal settings:", error);
        setIsLoadingSettings(false);
    });

    if (!providerUser?.uid) {
        setIsLoadingHistory(false);
        return () => unsubscribeSettings();
    }
    setIsLoadingHistory(true);
    
    const bookingsQuery = query(collection(db, "bookings"), where("providerId", "==", providerUser.uid), where("status", "==", "Completed"));
    const withdrawalsQuery = query(collection(db, "withdrawalRequests"), where("providerId", "==", providerUser.uid), orderBy("requestedAt", "desc"));
    
    const unsubBookings = onSnapshot(bookingsQuery, (snapshot) => setCompletedBookings(snapshot.docs.map(doc => ({...doc.data(), id: doc.id} as FirestoreBooking))));
    const unsubWithdrawals = onSnapshot(withdrawalsQuery, (snapshot) => { setWithdrawalHistory(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as WithdrawalRequest))); setIsLoadingHistory(false); });

    return () => {
        unsubscribeSettings();
        unsubBookings();
        unsubWithdrawals();
    };
  }, [providerUser?.uid]);

  const watchedMethod = form.watch("method");

  // Auto-pick default saved method when method changes
  useEffect(() => {
    if (!watchedMethod || editingRequest) return;
    const matching = savedMethods.filter(m => m.type === watchedMethod);
    if (matching.length > 0) {
      const def = matching.find(m => m.isDefault) || matching[0];
      setSelectedSavedMethodId(def.id);
      applySavedMethodToForm(def);
    } else {
      setSelectedSavedMethodId('manual');
    }
  }, [watchedMethod, savedMethods, editingRequest, applySavedMethodToForm]);

  const handleEditRequest = (request: WithdrawalRequest) => {
    setEditingRequest(request);
    const formElement = document.getElementById('withdrawal-form-card');
    if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const scrollToField = (id: string) => {
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) {
        el.focus();
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 50);
  };

  const onInvalid = (errors: FieldErrors<WithdrawalFormData>) => {
    let firstErrorId: string | null = null;
    let toastTitle = "Validation Error";
    let toastDescription = "Please check the highlighted fields.";

    if (errors.amount) {
      firstErrorId = "withdrawal-amount-input";
      toastTitle = "Invalid Amount";
      toastDescription = (errors.amount.message as string) || "Please enter a valid withdrawal amount.";
    } else if (errors.method) {
      firstErrorId = "withdrawal-method-trigger";
      toastTitle = "Method Required";
      toastDescription = (errors.method.message as string) || "Please select a withdrawal method.";
    } else if (errors.details) {
      const details = errors.details as any;
      if (details.confirmAccountNumber) {
        firstErrorId = "details-confirm-account-number";
        toastDescription = details.confirmAccountNumber.message || "Please confirm your account number.";
      } else if (details.accountNumber) {
        firstErrorId = "details-account-number";
        toastDescription = details.accountNumber.message || "Account number is required.";
      } else if (details.bankName) {
        firstErrorId = "details-bank-name";
        toastDescription = details.bankName.message || "Bank name is required.";
      } else if (details.accountHolderName) {
        firstErrorId = "details-account-holder-name";
        toastDescription = details.accountHolderName.message || "Account holder name is required.";
      } else if (details.ifscCode) {
        firstErrorId = "details-ifsc-code";
        toastDescription = details.ifscCode.message || `${appConfig?.customBankFields?.[0]?.name || "IFSC code"} is required.`;
      } else if (details.upiId) {
        firstErrorId = "details-upi-id";
        toastDescription = details.upiId.message || "Please enter a valid UPI ID.";
      } else if (details.email) {
        firstErrorId = "details-email";
        toastDescription = details.email.message || "A valid email is required for Amazon Gift Card.";
      }
    }

    if (firstErrorId) {
      scrollToField(firstErrorId);
    } else {
      setTimeout(() => {
        const anyInvalid = document.querySelector('[aria-invalid="true"]') as HTMLElement | null;
        if (anyInvalid) {
          anyInvalid.focus();
          anyInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);
    }

    toast({
      title: toastTitle,
      description: toastDescription,
      variant: "destructive"
    });
  };

  const onSubmit = async (data: WithdrawalFormData) => {
    if (!providerUser || !firestoreUser) return;

    const scrollToAmount = () => {
      scrollToField("withdrawal-amount-input");
    };

    if (!data.amount || data.amount <= 0) {
      form.setError("amount", { message: "Withdrawal amount must be positive." });
      scrollToAmount();
      toast({
        title: "Invalid Amount",
        description: "Please enter a positive withdrawal amount.",
        variant: "destructive"
      });
      return;
    }
    
    if (!editingRequest && firestoreUser.withdrawalPending) {
      toast({ title: "Request Pending", description: "You already have a withdrawal request being processed.", variant: "destructive"});
      return;
    }

    setIsSubmitting(true);
    
    if (!withdrawalSettings?.isWithdrawalEnabled) {
      toast({ title: "Withdrawals Disabled", description: "Withdrawals are currently disabled by the admin.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }
    
    const effectiveBalance = editingRequest ? withdrawableBalance + editingRequest.amount : withdrawableBalance;
    if (data.amount > effectiveBalance) {
      const msg = `Amount exceeds your balance of ${symbol}${effectiveBalance.toFixed(decimals)}`;
      form.setError("amount", { message: msg });
      scrollToAmount();
      toast({
        title: "Insufficient Balance",
        description: `${msg}. You entered ${symbol}${data.amount}.`,
        variant: "destructive"
      });
      setIsSubmitting(false);
      return;
    }

    const minAmount = withdrawalSettings?.minWithdrawalAmount || 0;
    if (data.amount < minAmount) { 
      const msg = `Minimum withdrawal is ${symbol}${minAmount}`;
      form.setError("amount", { message: msg });
      scrollToAmount();
      toast({
        title: "Minimum Amount Required",
        description: `${msg}. You entered ${symbol}${data.amount}.`,
        variant: "destructive"
      });
      setIsSubmitting(false);
      return;
    }

    try {
        const { confirmAccountNumber, ...detailsToSave } = data.details; 

        if (editingRequest) {
            await runTransaction(db, async (transaction) => {
                const userDocRef = doc(db, "users", providerUser.uid);
                const userDoc = await transaction.get(userDocRef);
                if (!userDoc.exists()) throw new Error("Provider user document not found.");
                
                const currentBalance = userDoc.data().withdrawableBalance || 0;
                // Add back the old amount, subtract the new amount
                const newBalance = currentBalance + editingRequest.amount - data.amount!;
                if (newBalance < 0) throw new Error("Insufficient balance for this update.");

                // Update monthly stats withdrawals
                const now = new Date();
                const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                const stats = userDoc.data().monthlyStats || { monthKey, gross: 0, commission: 0, cashCollected: 0, withdrawals: 0, onlineNet: 0, cashCommission: 0 };
                if (stats.monthKey === monthKey) {
                    stats.withdrawals = (stats.withdrawals || 0) - editingRequest.amount + data.amount!;
                }

                const requestDocRef = doc(db, "withdrawalRequests", editingRequest.id!);
                transaction.update(requestDocRef, {
                    amount: data.amount,
                    method: data.method as WithdrawalMethodType,
                    details: detailsToSave,
                    status: 'pending',
                    requestedAt: Timestamp.now(), 
                    adminNotes: null, 
                });
                transaction.update(userDocRef, { 
                    withdrawableBalance: newBalance, 
                    withdrawalPending: true,
                    monthlyStats: stats
                });
            });
            toast({ title: "Request Re-submitted", description: "Your withdrawal request has been updated and sent for review."});
            setEditingRequest(null);
        } else {
            const newRequestData: Omit<WithdrawalRequest, 'id'> = {
                providerId: providerUser.uid, providerName: firestoreUser.displayName || "N/A", providerEmail: firestoreUser.email || "N/A",
                amount: data.amount, method: data.method as WithdrawalMethodType, details: detailsToSave, status: 'pending', requestedAt: Timestamp.now(),
            };
            await runTransaction(db, async (transaction) => {
                const userDocRef = doc(db, "users", providerUser.uid);
                const userDoc = await transaction.get(userDocRef);
                if (!userDoc.exists()) throw new Error("Provider user document not found.");
                
                const currentBalance = userDoc.data().withdrawableBalance || 0;
                if (currentBalance < data.amount!) throw new Error("Insufficient balance.");

                // Update monthly stats withdrawals
                const now = new Date();
                const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                const stats = userDoc.data().monthlyStats || { monthKey, gross: 0, commission: 0, cashCollected: 0, withdrawals: 0, onlineNet: 0, cashCommission: 0 };
                if (stats.monthKey === monthKey) {
                    stats.withdrawals = (stats.withdrawals || 0) + data.amount!;
                }

                const newRequestRef = doc(collection(db, "withdrawalRequests"));
                transaction.set(newRequestRef, newRequestData);
                transaction.update(userDocRef, { 
                    withdrawableBalance: currentBalance - data.amount!,
                    withdrawalPending: true,
                    monthlyStats: stats
                });
            });
            toast({ title: "Request Submitted", description: "Your withdrawal request is being processed."});
        }
        
        const adminQuery = query(collection(db, "users"), where("email", "==", ADMIN_EMAIL), limit(1));
        const adminSnapshot = await getDocs(adminQuery);
        if (!adminSnapshot.empty) {
            const adminUid = adminSnapshot.docs[0].id;
            const adminNotification: FirestoreNotification = {
                userId: adminUid,
                title: editingRequest ? "Withdrawal Request Re-submitted" : "New Withdrawal Request",
                message: `${firestoreUser.displayName || 'A provider'} requested ${symbol}${data.amount.toFixed(decimals)}.`,
                type: 'admin_alert', href: `/admin/provider-withdrawals`, read: false, createdAt: Timestamp.now(),
            };
            await addDoc(collection(db, "userNotifications"), adminNotification);
            
            triggerPushNotification({
                userId: adminUid,
                title: adminNotification.title,
                body: adminNotification.message,
                href: adminNotification.href,
                sound: 'default'
            }).catch(pushErr => console.error("Error sending admin withdrawal push:", pushErr));
        }
        form.reset();
        if (selectedSavedMethodId === 'manual' && saveMethodForFuture && providerUser?.uid) {
            saveProviderWithdrawalMethodAction({
                providerId: providerUser.uid,
                method: {
                    type: data.method as any,
                    isDefault: true,
                    details: detailsToSave,
                }
            }).catch(e => console.warn("Failed to auto-save method:", e));
        }
    } catch (error) {
        toast({ title: "Error", description: (error as Error).message, variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };

  const renderMethodFields = () => {
    switch (watchedMethod) {
      case 'bank_transfer': return (
        <>
          <FormField control={form.control} name="details.accountHolderName" render={({ field }) => (<FormItem><FormLabel>Account Holder Name</FormLabel><FormControl><Input id="details-account-holder-name" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
          <FormField control={form.control} name="details.bankName" render={({ field }) => (<FormItem><FormLabel>Bank Name</FormLabel><FormControl><Input id="details-bank-name" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
          <FormField control={form.control} name="details.accountNumber" render={({ field }) => (<FormItem><FormLabel>Account Number</FormLabel><FormControl><Input id="details-account-number" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
          <FormField control={form.control} name="details.confirmAccountNumber" render={({ field }) => (<FormItem><FormLabel>Confirm Account Number</FormLabel><FormControl><Input id="details-confirm-account-number" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
          <FormField control={form.control} name="details.ifscCode" render={({ field }) => {
            const firstCustomField = appConfig?.customBankFields?.[0];
            const bankCodeLabel = firstCustomField?.name || "IFSC Code";
            const bankPlaceholder = firstCustomField?.placeholder || "e.g., SBIN0001234";
            return (
              <FormItem>
                <FormLabel>{bankCodeLabel}</FormLabel>
                <FormControl>
                  <Input 
                    id="details-ifsc-code"
                    placeholder={bankPlaceholder} 
                    {...field} 
                    value={field.value ?? ""} 
                    onChange={(e) => {
                      const type = firstCustomField?.type || 'alphanumeric';
                      const rawVal = e.target.value;
                      let formattedVal = rawVal;
                      if (type === 'alphanumeric' || type === 'text') {
                        formattedVal = rawVal.toUpperCase();
                      }
                      field.onChange(formattedVal);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            );
          }} />
        </>
      );
      case 'upi': return (<FormField control={form.control} name="details.upiId" render={({ field }) => (<FormItem><FormLabel>UPI ID</FormLabel><FormControl><Input id="details-upi-id" placeholder="yourname@okhdfc" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />);
      case 'amazon_gift_card': return (<FormField control={form.control} name="details.email" render={({ field }) => (<FormItem><FormLabel>Email for Gift Card</FormLabel><FormControl><Input id="details-email" type="email" placeholder="your@email.com" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />);
      default: return null;
    }
  };
  
  if (authIsLoading || isLoadingAppConfig || isLoadingHistory || isLoadingSettings) {
      return <div className="flex justify-center items-center h-64"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }
  
  const getStatusBadgeVariant = (status: WithdrawalStatus): any => ({'pending': 'secondary', 'approved': 'default', 'processing': 'default', 'completed': 'default', 'rejected': 'destructive', 're_submit': 'destructive'})[status] || 'outline';
  const getStatusBadgeClass = (status: WithdrawalStatus): string => {
    const classes: Record<string, string> = {'approved': 'bg-blue-500 hover:bg-blue-600', 'completed': 'bg-green-500 hover:bg-green-600'};
    return classes[status] || '';
  };

  return (
    <div className="p-2 md:p-8 space-y-6 max-w-7xl mx-auto">
      <Card id="withdrawal-form-card">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle>{editingRequest ? "Re-submit Withdrawal Request" : "Request a Withdrawal"}</CardTitle>
              <CardDescription>
                {editingRequest ? "Please correct your details and re-submit the request." : `Transfer your available earnings. Minimum withdrawal is ${symbol}${withdrawalSettings?.minWithdrawalAmount || 0}.`}
              </CardDescription>
            </div>
            <Button
              type="button"
              onClick={() => setIsManageMethodsOpen(true)}
              className="w-full sm:w-auto rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-xs h-9 justify-center shrink-0 flex items-center gap-1.5 transition-all shadow-xs"
            >
              <PlusCircle className="h-4 w-4 text-primary-foreground" />
              <span>Add Withdrawal Method</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
            <div className="p-4 bg-green-500/10 border-green-500/30 border rounded-lg text-center">
                <p className="text-sm text-green-700 font-medium">Available to Withdraw</p>
                <p className="text-3xl font-bold text-green-600">{symbol}{withdrawableBalance.toFixed(decimals)}</p>
            </div>
        </CardContent>
        {withdrawalSettings?.isWithdrawalEnabled ? (
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit, onInvalid)}>
                <CardContent className="space-y-4">
                    {!editingRequest && firestoreUser?.withdrawalPending && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Request Already Pending</AlertTitle><AlertDescription>You have a withdrawal request being processed.</AlertDescription></Alert>}
                    <FormField control={form.control} name="amount" render={({ field }) => (<FormItem><FormLabel>Amount to Withdraw ({symbol})</FormLabel><FormControl><Input id="withdrawal-amount-input" type="number" placeholder={`Available: ${symbol}${withdrawableBalance.toFixed(decimals)}`} {...field} value={field.value ?? ""} disabled={isSubmitting || (firestoreUser?.withdrawalPending && !editingRequest)} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="method" render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className="mb-2">Withdrawal Method</FormLabel>
                        <Dialog open={isMethodPickerOpen} onOpenChange={setIsMethodPickerOpen}>
                          <DialogTrigger asChild>
                            <Button
                              id="withdrawal-method-trigger"
                              variant="outline"
                              role="combobox"
                              className={cn(
                                "w-full justify-between text-left font-normal h-10 rounded-xl border bg-background hover:bg-muted/50 hover:text-foreground hover:border-primary/50 transition-all group",
                                !field.value && "text-muted-foreground"
                              )}
                              disabled={isSubmitting || (firestoreUser?.withdrawalPending && !editingRequest)}
                              type="button"
                            >
                              <span>
                                {field.value === "bank_transfer" && "Bank Transfer"}
                                {field.value === "upi" && "UPI"}
                                {field.value === "amazon_gift_card" && "Amazon Gift Card"}
                                {!field.value && "Select a method"}
                              </span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50 group-hover:opacity-100 transition-all" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="w-[calc(100%-6px)] sm:max-w-[425px]">
                            <DialogHeader>
                              <DialogTitle>Select Withdrawal Method</DialogTitle>
                              <DialogDescription>
                                Choose one of the enabled withdrawal methods.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="py-4">
                              <ScrollArea className="h-[200px] rounded-md border p-2">
                                <div className="space-y-1">
                                  {withdrawalSettings?.enabledMethods?.bank_transfer && (
                                    <Button
                                      variant={field.value === "bank_transfer" ? "secondary" : "ghost"}
                                      className="w-full justify-start text-left h-auto py-2.5 px-3 relative"
                                      onClick={() => {
                                        field.onChange("bank_transfer");
                                        setIsMethodPickerOpen(false);
                                      }}
                                      type="button"
                                    >
                                      <span className="text-sm font-medium">Bank Transfer</span>
                                      {field.value === "bank_transfer" && (
                                        <Check className="absolute right-3 top-3 h-4 w-4 text-green-500" />
                                      )}
                                    </Button>
                                  )}
                                  {withdrawalSettings?.enabledMethods?.upi && (
                                    <Button
                                      variant={field.value === "upi" ? "secondary" : "ghost"}
                                      className="w-full justify-start text-left h-auto py-2.5 px-3 relative"
                                      onClick={() => {
                                        field.onChange("upi");
                                        setIsMethodPickerOpen(false);
                                      }}
                                      type="button"
                                    >
                                      <span className="text-sm font-medium">UPI</span>
                                      {field.value === "upi" && (
                                        <Check className="absolute right-3 top-3 h-4 w-4 text-green-500" />
                                      )}
                                    </Button>
                                  )}
                                  {withdrawalSettings?.enabledMethods?.amazon_gift_card && (
                                    <Button
                                      variant={field.value === "amazon_gift_card" ? "secondary" : "ghost"}
                                      className="w-full justify-start text-left h-auto py-2.5 px-3 relative"
                                      onClick={() => {
                                        field.onChange("amazon_gift_card");
                                        setIsMethodPickerOpen(false);
                                      }}
                                      type="button"
                                    >
                                      <span className="text-sm font-medium">Amazon Gift Card</span>
                                      {field.value === "amazon_gift_card" && (
                                        <Check className="absolute right-3 top-3 h-4 w-4 text-green-500" />
                                      )}
                                    </Button>
                                  )}
                                  {Object.values(withdrawalSettings?.enabledMethods || {}).every(v => !v) && (
                                    <div className="p-4 text-center text-sm text-muted-foreground">
                                      No withdrawal methods enabled.
                                    </div>
                                  )}
                                </div>
                              </ScrollArea>
                            </div>
                          </DialogContent>
                        </Dialog>
                        <FormMessage />
                      </FormItem>
                    )}/>
                    {watchedMethod && (
                      <div className="space-y-4 p-4 border rounded-xl bg-card">
                        {/* Saved Accounts for this Method */}
                        {savedMethods.filter(m => m.type === watchedMethod).length > 0 && (
                          <div className="space-y-2 pb-3 border-b">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs font-bold text-foreground">
                                Select Saved {watchedMethod === 'bank_transfer' ? 'Bank Account' : watchedMethod === 'upi' ? 'UPI ID' : 'Gift Card Email'}
                              </Label>
                              <button
                                type="button"
                                onClick={() => {
                                  setNewMethodType(watchedMethod as any);
                                  setIsManageMethodsOpen(true);
                                }}
                                className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1"
                              >
                                <PlusCircle className="h-3.5 w-3.5" />
                                Add Another
                              </button>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {savedMethods.filter(m => m.type === watchedMethod).map((sm) => {
                                const isSelected = selectedSavedMethodId === sm.id;
                                return (
                                  <button
                                    key={sm.id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedSavedMethodId(sm.id);
                                      applySavedMethodToForm(sm);
                                    }}
                                    className={cn(
                                      "p-3 rounded-xl border text-left transition-all relative flex flex-col gap-1",
                                      isSelected
                                        ? "border-primary bg-primary/5 ring-1 ring-primary shadow-xs"
                                        : "border-border hover:bg-muted/50 bg-background"
                                    )}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-bold text-xs text-foreground truncate">
                                        {sm.type === 'bank_transfer' ? '🏦 ' : sm.type === 'upi' ? '📱 ' : '🎁 '}
                                        {sm.title}
                                      </span>
                                      {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                                    </div>
                                    <div className="text-xs text-muted-foreground truncate">
                                      {sm.type === 'bank_transfer' && (
                                        <span>{sm.details.bankName} ••••{sm.details.accountNumber?.slice(-4)} ({sm.details.ifscCode})</span>
                                      )}
                                      {sm.type === 'upi' && (
                                        <span>{sm.details.upiId}</span>
                                      )}
                                      {sm.type === 'amazon_gift_card' && (
                                        <span>{sm.details.email}</span>
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                              
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedSavedMethodId('manual');
                                  form.setValue("details.accountHolderName", firestoreUser?.displayName || "");
                                  form.setValue("details.bankName", "");
                                  form.setValue("details.accountNumber", "");
                                  form.setValue("details.confirmAccountNumber", "");
                                  form.setValue("details.ifscCode", "");
                                  form.setValue("details.upiId", "");
                                  form.setValue("details.email", firestoreUser?.email || "");
                                }}
                                className={cn(
                                  "p-3 rounded-xl border text-left transition-all flex flex-col justify-center items-center gap-1 border-dashed",
                                  selectedSavedMethodId === 'manual'
                                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                                    : "border-muted-foreground/30 hover:border-primary/50 bg-muted/20"
                                )}
                              >
                                <span className="text-xs font-semibold text-foreground">+ Enter Different Account</span>
                                <span className="text-[10px] text-muted-foreground">Type custom details for this request</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Input Fields */}
                        <div className="space-y-4">
                          {renderMethodFields()}
                        </div>

                        {/* Quick Save Checkbox if user entered manually */}
                        {selectedSavedMethodId === 'manual' && (
                          <div className="pt-2 flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="save-method-checkbox"
                              checked={saveMethodForFuture}
                              onChange={(e) => setSaveMethodForFuture(e.target.checked)}
                              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <label htmlFor="save-method-checkbox" className="text-xs font-medium text-muted-foreground cursor-pointer">
                              Save this account for my future withdrawals
                            </label>
                          </div>
                        )}
                      </div>
                    )}
                </CardContent>
                <CardFooter className="flex-col items-start gap-4">
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        <Button type="submit" className="w-full sm:w-auto" disabled={isSubmitting || (firestoreUser?.withdrawalPending && !editingRequest)}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} {editingRequest ? "Re-submit Request" : "Submit Request"}
                        </Button>
                        {editingRequest && (<Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => { setEditingRequest(null); form.reset();}}>Cancel Edit</Button>)}
                    </div>
                </CardFooter>
                </form>
            </Form>
        ) : (
             <CardContent>
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Withdrawals Disabled</AlertTitle>
                    <AlertDescription>Withdrawals are currently disabled by the admin.</AlertDescription>
                </Alert>
            </CardContent>
        )}
      </Card>
      
      <Card>
          <CardHeader><CardTitle className="flex items-center"><History className="mr-2 h-5 w-5"/>Withdrawal History</CardTitle></CardHeader>
          <CardContent>{isLoadingHistory ? <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin mx-auto"/></div> : withdrawalHistory.length === 0 ? <div className="text-center py-10"><PackageSearch className="mx-auto h-12 w-12 text-muted-foreground mb-3" /><p className="text-muted-foreground">No withdrawal requests made yet.</p></div> : <Table><TableHeader><TableRow><TableHead>Amount</TableHead><TableHead>Method</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{withdrawalHistory.map(req => (<TableRow key={req.id}>
            <TableCell className="font-semibold">{symbol}{req.amount.toFixed(decimals)}</TableCell>
            <TableCell className="capitalize">{req.method.replace('_', ' ')}</TableCell>
            <TableCell className="text-xs">{formatDate(req.requestedAt)}</TableCell>
            <TableCell>
                {req.status === 're_submit' ? (
                    <Button variant="destructive" size="sm" onClick={() => handleEditRequest(req)}>
                        <Edit className="mr-1 h-3 w-3" /> Re-submit
                    </Button>
                ) : (
                    <Badge variant={getStatusBadgeVariant(req.status)} className={`capitalize ${getStatusBadgeClass(req.status)}`}>{req.status}</Badge>
                )}
                {req.adminNotes && (req.status === 'rejected' || req.status === 're_submit') && <p className="text-xs text-destructive mt-1 max-w-xs">{req.adminNotes}</p>}
            </TableCell>
          </TableRow>))}</TableBody></Table>}</CardContent>
      </Card>

      {/* MANAGE / ADD WITHDRAWAL METHOD MODAL */}
      <Dialog open={isManageMethodsOpen} onOpenChange={(open) => { setIsManageMethodsOpen(open); if (!open) setMethodErrors({}); }}>
        <DialogContent className="sm:max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <CreditCard className="h-5 w-5 text-primary" />
              Manage Withdrawal Methods
            </DialogTitle>
            <DialogDescription className="text-xs">
              Add multiple bank accounts, UPI IDs, or gift card emails to easily select them during withdrawals.
            </DialogDescription>
          </DialogHeader>

          {/* List of currently saved accounts */}
          <div className="space-y-4 py-2">
            {/* Method Type Picker Tabs at the TOP */}
            <div className="grid grid-cols-3 gap-1.5">
              {withdrawalSettings?.enabledMethods?.bank_transfer && (
                <button
                  type="button"
                  onClick={() => {
                    setNewMethodType('bank_transfer');
                    setMethodErrors({});
                  }}
                  className={cn(
                    "py-2.5 px-2 text-xs font-bold rounded-xl border text-center transition-all flex items-center justify-center gap-1.5",
                    newMethodType === 'bank_transfer'
                      ? "bg-primary text-primary-foreground border-primary shadow-xs"
                      : "bg-muted/30 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span>🏦</span> Bank
                </button>
              )}
              {withdrawalSettings?.enabledMethods?.upi && (
                <button
                  type="button"
                  onClick={() => {
                    setNewMethodType('upi');
                    setMethodErrors({});
                  }}
                  className={cn(
                    "py-2.5 px-2 text-xs font-bold rounded-xl border text-center transition-all flex items-center justify-center gap-1.5",
                    newMethodType === 'upi'
                      ? "bg-primary text-primary-foreground border-primary shadow-xs"
                      : "bg-muted/30 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span>📱</span> UPI
                </button>
              )}
              {withdrawalSettings?.enabledMethods?.amazon_gift_card && (
                <button
                  type="button"
                  onClick={() => {
                    setNewMethodType('amazon_gift_card');
                    setMethodErrors({});
                  }}
                  className={cn(
                    "py-2.5 px-2 text-xs font-bold rounded-xl border text-center transition-all flex items-center justify-center gap-1.5",
                    newMethodType === 'amazon_gift_card'
                      ? "bg-primary text-primary-foreground border-primary shadow-xs"
                      : "bg-muted/30 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span>🎁</span> Gift Card
                </button>
              )}
            </div>

            {/* List of currently saved accounts FOR SELECTED METHOD ONLY */}
            <div>
              {(() => {
                const activeSavedMethods = savedMethods.filter((sm) => sm.type === newMethodType);
                const methodLabel = newMethodType === 'bank_transfer' ? 'Bank Accounts' : newMethodType === 'upi' ? 'UPI IDs' : 'Gift Cards';
                return (
                  <>
                    <div className="flex justify-between items-center mb-1.5">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Saved {methodLabel}
                      </Label>
                      <span className="text-[11px] text-muted-foreground">{activeSavedMethods.length} saved</span>
                    </div>
                    {activeSavedMethods.length === 0 ? (
                      <div className="p-3.5 rounded-xl border border-dashed text-center text-xs text-muted-foreground bg-muted/20">
                        No saved {methodLabel.toLowerCase()} yet. Add one below.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {activeSavedMethods.map((sm) => (
                          <div key={sm.id} className="p-3 rounded-xl border bg-card flex justify-between items-center gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-xs text-foreground truncate">
                                  {sm.type === 'bank_transfer' ? '🏦 ' : sm.type === 'upi' ? '📱 ' : '🎁 '}
                                  {sm.title}
                                </span>
                                {sm.isDefault && (
                                  <Badge variant="outline" className="text-[9px] py-0 h-4 bg-primary/10 text-primary border-primary/20">
                                    Default
                                  </Badge>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground truncate">
                                {sm.type === 'bank_transfer' && `${sm.details.bankName || 'Bank'} • A/C ${sm.details.accountNumber} • IFSC ${sm.details.ifscCode}`}
                                {sm.type === 'upi' && `UPI ID: ${sm.details.upiId}`}
                                {sm.type === 'amazon_gift_card' && `Email: ${sm.details.email}`}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={async () => {
                                if (!providerUser?.uid) return;
                                // Optimistically remove from UI
                                setLocalSavedMethods((prev) => (prev ? prev.filter(m => m.id !== sm.id) : []));
                                if (selectedSavedMethodId === sm.id) {
                                  setSelectedSavedMethodId(null);
                                }
                                const res = await deleteProviderWithdrawalMethodAction({
                                  providerId: providerUser.uid,
                                  methodId: sm.id
                                });
                                if (res.success) {
                                  toast({ title: "Method Removed", description: "Withdrawal account deleted." });
                                  if (res.methods) {
                                    setLocalSavedMethods(res.methods);
                                  }
                                } else {
                                  setLocalSavedMethods(baseSavedMethods);
                                  toast({ title: "Failed", description: res.message, variant: "destructive" });
                                }
                              }}
                              className="h-8 w-8 text-destructive hover:bg-destructive/10 shrink-0"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            <div className="pt-3 border-t space-y-3">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Add New {newMethodType === 'bank_transfer' ? 'Bank Account' : newMethodType === 'upi' ? 'UPI ID' : 'Gift Card'}
              </Label>

              {/* Form Inputs */}
              <div className="space-y-2.5">
                {newMethodType === 'bank_transfer' && (
                  <>
                    <div>
                      <Label htmlFor="add-method-bank-nickname" className="text-xs font-semibold">Bank Nickname (Optional)</Label>
                      <Input
                        id="add-method-bank-nickname"
                        placeholder="e.g. Salary HDFC, Personal SBI, Savings A/C"
                        value={bankNickname}
                        onChange={(e) => setBankNickname(e.target.value)}
                        className="h-9 text-xs rounded-xl"
                      />
                    </div>
                    <div>
                      <Label htmlFor="add-method-account-holder-name" className={cn("text-xs font-semibold", methodErrors.accountHolderName && "text-destructive")}>
                        Account Holder Name
                      </Label>
                      <Input
                        id="add-method-account-holder-name"
                        placeholder="Name on bank account"
                        value={newAccountHolderName}
                        onChange={(e) => {
                          setNewAccountHolderName(e.target.value);
                          clearMethodError('accountHolderName');
                        }}
                        className={cn(
                          "h-9 text-xs rounded-xl",
                          methodErrors.accountHolderName && "border-destructive focus-visible:ring-destructive"
                        )}
                      />
                      {methodErrors.accountHolderName && (
                        <p className="text-[11px] font-medium text-destructive mt-1">{methodErrors.accountHolderName}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="add-method-bank-name" className={cn("text-xs font-semibold", methodErrors.bankName && "text-destructive")}>
                        Bank Name
                      </Label>
                      <Input
                        id="add-method-bank-name"
                        placeholder="e.g. HDFC Bank, SBI, ICICI"
                        value={newBankName}
                        onChange={(e) => {
                          setNewBankName(e.target.value);
                          clearMethodError('bankName');
                        }}
                        className={cn(
                          "h-9 text-xs rounded-xl",
                          methodErrors.bankName && "border-destructive focus-visible:ring-destructive"
                        )}
                      />
                      {methodErrors.bankName && (
                        <p className="text-[11px] font-medium text-destructive mt-1">{methodErrors.bankName}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="add-method-account-number" className={cn("text-xs font-semibold", methodErrors.accountNumber && "text-destructive")}>
                        Account Number
                      </Label>
                      <Input
                        id="add-method-account-number"
                        placeholder="Enter bank account number"
                        value={newAccountNumber}
                        onChange={(e) => {
                          setNewAccountNumber(e.target.value);
                          clearMethodError('accountNumber');
                        }}
                        className={cn(
                          "h-9 text-xs rounded-xl",
                          methodErrors.accountNumber && "border-destructive focus-visible:ring-destructive"
                        )}
                      />
                      {methodErrors.accountNumber && (
                        <p className="text-[11px] font-medium text-destructive mt-1">{methodErrors.accountNumber}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="add-method-confirm-account-number" className={cn("text-xs font-semibold", methodErrors.confirmAccountNumber && "text-destructive")}>
                        Confirm Account Number
                      </Label>
                      <Input
                        id="add-method-confirm-account-number"
                        placeholder="Re-enter bank account number"
                        value={newConfirmAccountNumber}
                        onChange={(e) => {
                          setNewConfirmAccountNumber(e.target.value);
                          clearMethodError('confirmAccountNumber');
                        }}
                        className={cn(
                          "h-9 text-xs rounded-xl",
                          methodErrors.confirmAccountNumber && "border-destructive focus-visible:ring-destructive"
                        )}
                      />
                      {methodErrors.confirmAccountNumber && (
                        <p className="text-[11px] font-medium text-destructive mt-1">{methodErrors.confirmAccountNumber}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="add-method-ifsc-code" className={cn("text-xs font-semibold", methodErrors.ifscCode && "text-destructive")}>
                        {appConfig?.customBankFields?.[0]?.name || "IFSC Code"}
                      </Label>
                      <Input
                        id="add-method-ifsc-code"
                        placeholder={appConfig?.customBankFields?.[0]?.placeholder || "e.g. HDFC0001234"}
                        value={newIfscCode}
                        onChange={(e) => {
                          setNewIfscCode(e.target.value.toUpperCase());
                          clearMethodError('ifscCode');
                        }}
                        className={cn(
                          "h-9 text-xs rounded-xl",
                          methodErrors.ifscCode && "border-destructive focus-visible:ring-destructive"
                        )}
                      />
                      {methodErrors.ifscCode && (
                        <p className="text-[11px] font-medium text-destructive mt-1">{methodErrors.ifscCode}</p>
                      )}
                    </div>
                  </>
                )}

                {newMethodType === 'upi' && (
                  <>
                    <div>
                      <Label htmlFor="add-method-upi-nickname" className="text-xs font-semibold">UPI Nickname (Optional)</Label>
                      <Input
                        id="add-method-upi-nickname"
                        placeholder="e.g. Personal GPay, PhonePe Business, Paytm"
                        value={upiNickname}
                        onChange={(e) => setUpiNickname(e.target.value)}
                        className="h-9 text-xs rounded-xl"
                      />
                    </div>
                    <div>
                      <Label htmlFor="add-method-upi-id" className={cn("text-xs font-semibold", methodErrors.upiId && "text-destructive")}>
                        UPI ID
                      </Label>
                      <Input
                        id="add-method-upi-id"
                        placeholder="e.g. yourname@okhdfc"
                        value={newUpiId}
                        onChange={(e) => {
                          setNewUpiId(e.target.value);
                          clearMethodError('upiId');
                        }}
                        className={cn(
                          "h-9 text-xs rounded-xl",
                          methodErrors.upiId && "border-destructive focus-visible:ring-destructive"
                        )}
                      />
                      {methodErrors.upiId && (
                        <p className="text-[11px] font-medium text-destructive mt-1">{methodErrors.upiId}</p>
                      )}
                    </div>
                  </>
                )}

                {newMethodType === 'amazon_gift_card' && (
                  <>
                    <div>
                      <Label htmlFor="add-method-giftcard-nickname" className="text-xs font-semibold">Gift Card Nickname (Optional)</Label>
                      <Input
                        id="add-method-giftcard-nickname"
                        placeholder="e.g. Personal Amazon, Shopping Email"
                        value={giftCardNickname}
                        onChange={(e) => setGiftCardNickname(e.target.value)}
                        className="h-9 text-xs rounded-xl"
                      />
                    </div>
                    <div>
                      <Label htmlFor="add-method-email" className={cn("text-xs font-semibold", methodErrors.email && "text-destructive")}>
                        Email for Gift Card
                      </Label>
                      <Input
                        id="add-method-email"
                        type="email"
                        placeholder="e.g. yourname@gmail.com"
                        value={newEmail}
                        onChange={(e) => {
                          setNewEmail(e.target.value);
                          clearMethodError('email');
                        }}
                        className={cn(
                          "h-9 text-xs rounded-xl",
                          methodErrors.email && "border-destructive focus-visible:ring-destructive"
                        )}
                      />
                      {methodErrors.email && (
                        <p className="text-[11px] font-medium text-destructive mt-1">{methodErrors.email}</p>
                      )}
                    </div>
                  </>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="new-is-default"
                    checked={newIsDefault}
                    onChange={(e) => setNewIsDefault(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <label htmlFor="new-is-default" className="text-xs text-muted-foreground cursor-pointer">
                    Set as default withdrawal account
                  </label>
                </div>

                <Button
                  type="button"
                  onClick={handleSaveNewMethod}
                  disabled={isSavingMethod}
                  className="w-full mt-2 font-bold rounded-xl"
                >
                  {isSavingMethod ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                  Save Withdrawal Method
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ProviderWithdrawalPage() {
    return (
        <ProtectedRoute>
            <WithdrawalPageContent />
        </ProtectedRoute>
    );
}
