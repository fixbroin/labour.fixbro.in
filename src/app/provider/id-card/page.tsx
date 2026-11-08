"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Contact2, 
  Download, 
  FileText, 
  Image as ImageIcon, 
  ShieldCheck, 
  Lock, 
  Unlock, 
  Loader2, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  QrCode,
  Sparkles,
  Phone,
  Calendar,
  CreditCard,
  Plus
} from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter,
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useApplicationConfig } from '@/hooks/useApplicationConfig';
import { getTimestampMillis } from '@/lib/utils';
import { db } from '@/lib/firebase';
import { doc, getDoc } from '@/lib/mysqlDb';
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import type { ProviderApplication, FirestoreUser } from '@/types/firestore';
import { 
  getProviderIdCardSettingsAction, 
  unlockProviderIdCardAction, 
  verifyPendingIdCardUnlockAction,
  recordIdCardGenerationAction,
  trackIdCardDownloadAction,
} from '@/app/actions/providerIdCardActions';
import { isWebView } from '@/lib/webview-bridge';
import { 
  type ProviderIdCardSettings, 
  DEFAULT_ID_CARD_SETTINGS,
  formatIdNumber,
  generateUniqueIdCardNumber 
} from '@/types/providerAreaAndId';
import OfficialIdCardView from '@/components/shared/OfficialIdCardView';
import { 
  type IdCardRenderOptions, 
  renderFrontCardCanvas, 
  renderBackCardCanvas, 
  generatePvcPdf 
} from '@/lib/idCardRenderer';

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function ProviderIdCardPage() {
  const { user: providerUser } = useAuth();
  const { config: appConfig } = useApplicationConfig();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const symbol = appConfig?.currencySymbol || "₹";

  const [isLoading, setIsLoading] = useState(true);
  const [providerApp, setProviderApp] = useState<ProviderApplication | null>(null);
  const [userProfile, setUserProfile] = useState<FirestoreUser | null>(null);
  const [idCardSettings, setIdCardSettings] = useState<ProviderIdCardSettings>(DEFAULT_ID_CARD_SETTINGS);
  const [isPaying, setIsPaying] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [activeSide, setActiveSide] = useState<'front' | 'back'>('front');
  const [isGatewayDialogOpen, setIsGatewayDialogOpen] = useState(false);
  const [pendingUnlockVerifying, setPendingUnlockVerifying] = useState(false);
  const [unlockSuccessOpen, setUnlockSuccessOpen] = useState(false);

  // Canvas refs for 300 DPI exports
  const frontCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const backCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const loadData = useCallback(async () => {
    if (!providerUser?.uid) return;
    setIsLoading(true);
    try {
      const [settings, appSnap, userSnap] = await Promise.all([
        getProviderIdCardSettingsAction(),
        getDoc(doc(db, "providerApplications", providerUser.uid)),
        getDoc(doc(db, "users", providerUser.uid)),
      ]);

      setIdCardSettings(settings);

      if (appSnap.exists()) {
        const appData = appSnap.data() as ProviderApplication;
        setProviderApp(appData);
        if (appData.status === 'approved' && providerUser?.uid) {
          recordIdCardGenerationAction(providerUser.uid).then((res) => {
            if (res.success && res.idCardNumber) {
              setProviderApp(prev => prev ? { ...prev, idCardNumber: res.idCardNumber, idCardGenerated: true } : prev);
            }
          }).catch(console.error);
        }
      }
      if (userSnap.exists()) {
        setUserProfile(userSnap.data() as FirestoreUser);
      }
    } catch (error) {
      console.error("Error loading ID card data:", error);
      toast({
        title: "Error",
        description: "Failed to load provider credentials.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [providerUser?.uid, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle return from Stripe checkout
  useEffect(() => {
    const paymentParam = searchParams?.get('payment');
    const sessionId = searchParams?.get('session_id');
    const amountParam = searchParams?.get('amount');

    if (paymentParam === 'success' && sessionId && providerUser?.uid) {
      const verifyStripePayment = async () => {
        setIsPaying(true);
        try {
          const res = await fetch(`/api/stripe/verify-session?session_id=${sessionId}`);
          const data = await res.json();
          if (res.ok && data.success && (data.status === 'paid' || data.status === 'complete')) {
            const paidAmount = parseFloat(amountParam || '0');
            const unlockRes = await unlockProviderIdCardAction(providerUser.uid, {
              razorpay_payment_id: sessionId,
              amount: paidAmount,
            });
            if (unlockRes.success) {
              toast({ title: "Card Unlocked!", description: "Official PVC ID Card is now permanently unlocked." });
            }
          }
        } catch (e: any) {
          console.error("Stripe verify error:", e);
        } finally {
          setIsPaying(false);
          router.replace('/provider/id-card');
          loadData();
        }
      };
      verifyStripePayment();
    }
  }, [searchParams, providerUser?.uid, router, loadData]);

  // Provider Data formatting
  const isApproved = providerApp?.status === 'approved';
  const providerName = (providerApp?.fullName || userProfile?.displayName || providerUser?.displayName || 'Authorized Partner').toUpperCase();
  const categoryLabel = providerApp?.workCategoryName || 'Certified Technician';
  const profilePhotoUrl = providerApp?.profilePhotoUrl || userProfile?.photoURL || '';

  // Dates & Validity Period (Years & Months)
  const vYears = Number(idCardSettings.validityYears ?? 0);
  const vMonths = Number(idCardSettings.validityMonths ?? 0);
  const totalMonths = (vYears === 0 && vMonths === 0) ? 24 : (vYears * 12 + vMonths);

  const issueDateMillis = (providerApp as any)?.idCardUnlockedAt || (providerApp as any)?.idCardGeneratedAt
    ? (getTimestampMillis((providerApp as any).idCardUnlockedAt || (providerApp as any).idCardGeneratedAt) || Date.now())
    : Date.now();
  const issueDateObj = new Date(issueDateMillis);
  const issueDateStr = `${String(issueDateObj.getMonth() + 1).padStart(2, '0')}/${issueDateObj.getFullYear()}`;

  // Dynamically calculate validThru based on current admin validity setting (months & years)
  const expiryDateObj = new Date(issueDateObj.getTime());
  expiryDateObj.setMonth(expiryDateObj.getMonth() + totalMonths);
  const validThruStr = `${String(expiryDateObj.getMonth() + 1).padStart(2, '0')}/${expiryDateObj.getFullYear()}`;

  const isCardExpired = Boolean((providerApp as any)?.idCardExpiresAt && Date.now() > (getTimestampMillis((providerApp as any).idCardExpiresAt) || 0));

  const isUnlocked = Boolean(
    !isCardExpired && (
      idCardSettings.downloadFee === 0 || 
      (providerApp as any)?.idCardUnlocked
    )
  );

  // Sequential unique ID number formatted according to admin settings (e.g. prefix + sequential number)
  const uniqueIdNumber = providerApp?.idCardNumber || formatIdNumber(
    idCardSettings.idNumberStartingSeq,
    idCardSettings.idNumberStartingSeq,
    idCardSettings.idNumberPrefix
  );

  // Construct render options
  const cardRenderOptions: IdCardRenderOptions = {
    providerName,
    categoryName: categoryLabel,
    skillLevelLabel: providerApp?.skillLevelLabel || 'Skilled Professional',
    gender: providerApp?.gender || 'Male',
    dob: providerApp?.dob,
    idCardNumber: uniqueIdNumber,
    profilePhotoUrl,
    signatureUrl: providerApp?.signatureUrl || (providerApp as any)?.signatureImage || null,
    residentialAddress: providerApp?.address || providerApp?.workAreaAddress || 'Address on record',
    mobileNumber: providerApp?.mobileNumber || userProfile?.mobileNumber || providerUser?.phoneNumber || '',
    email: providerApp?.email || userProfile?.email || providerUser?.email || '',
    signatoryName: idCardSettings.signatoryName,
    issueDateStr,
    validThruStr,
    disclaimerText: idCardSettings.disclaimerText,
    verifyUrl: `https://labour.fixbro.in/verify/provider/${providerUser?.uid || ''}`,
  };

  // Auto-recovery & verification for pending ID card unlocks (resuming from UPI apps / PhonePe / GPay)
  const checkAndVerifyPendingUnlock = useCallback(async (retryCount = 0) => {
    if (!providerUser?.uid) return;
    let pendingRaw: string | null = null;
    try {
      pendingRaw = localStorage.getItem('fixbro_pending_id_card_unlock');
    } catch (e) {}

    if (!pendingRaw) return;

    let pending: { orderId: string; amount: number; providerId: string; timestamp: number } | null = null;
    try {
      pending = JSON.parse(pendingRaw);
    } catch (e) {
      try { localStorage.removeItem('fixbro_pending_id_card_unlock'); } catch(e) {}
      return;
    }

    if (!pending || !pending.orderId || pending.providerId !== providerUser.uid) return;

    // Discard stale pending records older than 3 minutes so old attempts never re-trigger
    if (Date.now() - pending.timestamp > 3 * 60 * 1000) {
      try { localStorage.removeItem('fixbro_pending_id_card_unlock'); } catch(e) {}
      setPendingUnlockVerifying(false);
      return;
    }

    setPendingUnlockVerifying(true);
    try {
      const res = await verifyPendingIdCardUnlockAction(pending.orderId, pending.providerId, pending.amount);
      if (res.success && res.verified) {
        try { localStorage.removeItem('fixbro_pending_id_card_unlock'); } catch(e) {}
        setUnlockSuccessOpen(true);
        await loadData();
        setPendingUnlockVerifying(false);
        setIsPaying(false);
        toast({ title: "Card Unlocked!", description: "Official PVC ID Card is now permanently unlocked." });
        return;
      }

      // Retry up to 2 times (3.6s total) in case Razorpay webhook arrives with 1-2s delay
      if (retryCount < 2) {
        setTimeout(() => {
          checkAndVerifyPendingUnlock(retryCount + 1);
        }, 1800);
      } else {
        // Payment was not completed or was cancelled: clean up localStorage so it NEVER shows popups again!
        try { localStorage.removeItem('fixbro_pending_id_card_unlock'); } catch(e) {}
        setPendingUnlockVerifying(false);
        setIsPaying(false);
      }
    } catch (err) {
      console.error("Error verifying pending ID card unlock:", err);
      try { localStorage.removeItem('fixbro_pending_id_card_unlock'); } catch(e) {}
      setPendingUnlockVerifying(false);
      setIsPaying(false);
    }
  }, [providerUser?.uid, loadData, toast]);

  // Periodic and event-driven check for ID card unlock return
  useEffect(() => {
    if (providerUser?.uid) {
      checkAndVerifyPendingUnlock();
    }

    const handleAppResume = () => {
      console.log("Provider App Resumed: checking pending ID card unlock...");
      checkAndVerifyPendingUnlock();
    };

    const handleNativeSuccess = (e: any) => {
      console.log("Native Razorpay Payment Success event received for ID card:", e?.detail);
      checkAndVerifyPendingUnlock();
    };

    const handleNativeError = () => {
      console.log("Provider ID Card: Native payment cancelled or failed");
      try { localStorage.removeItem('fixbro_pending_id_card_unlock'); } catch(e) {}
      setPendingUnlockVerifying(false);
      setIsPaying(false);
    };

    // Register global bridge hook invoked by Flutter webview_screen.dart
    (window as any).checkPendingRazorpayPayment = () => {
      checkAndVerifyPendingUnlock();
    };

    window.addEventListener('appResumedFromPayment', handleAppResume);
    window.addEventListener('nativePaymentSuccess', handleNativeSuccess);
    window.addEventListener('nativePaymentError', handleNativeError);

    return () => {
      window.removeEventListener('appResumedFromPayment', handleAppResume);
      window.removeEventListener('nativePaymentSuccess', handleNativeSuccess);
      window.removeEventListener('nativePaymentError', handleNativeError);
    };
  }, [providerUser?.uid, checkAndVerifyPendingUnlock]);

  // Razorpay Script Loader
  const loadRazorpayScript = () => new Promise((resolve) => {
    // If inside Flutter app webview or Razorpay is already available, never inject external script
    if (isWebView() || window.Razorpay) { resolve(true); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

  // 1. Razorpay Unlock Flow
  const handleRazorpayUnlock = async () => {
    if (!providerUser?.uid) return;
    setIsPaying(true);
    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        toast({ title: "Error", description: "Failed to initialize payment gateway.", variant: "destructive" });
        setIsPaying(false);
        return;
      }

      // Calculate subunit (paise for INR so ₹1 = 100 paise)
      const currencyCode = appConfig?.currencyCode || 'INR';
      const getCurrencySubunitDecimals = (cc: string): number => {
        const c = cc.toUpperCase();
        if (['JPY', 'KRW', 'CLP', 'VND', 'UGX'].includes(c)) return 0;
        if (['BHD', 'JOD', 'KWD', 'OMR', 'TND'].includes(c)) return 3;
        return 2;
      };
      const currencyDecimals = getCurrencySubunitDecimals(currencyCode);
      const feeAmount = Number(idCardSettings.downloadFee || 0);
      const amountInSubunit = Math.round(feeAmount * Math.pow(10, currencyDecimals));

      const orderRes = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountInSubunit,
          currency: currencyCode,
          receipt: `idcard_${providerUser.uid.substring(0, 10)}_${Date.now()}`,
          notes: {
            purpose: 'provider_id_card_unlock',
            type: 'provider_id_card_unlock',
            providerId: providerUser.uid,
            providerName,
            amount: feeAmount.toString(),
          }
        }),
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok || !orderData.success) {
        throw new Error(orderData.error || 'Failed to create payment order.');
      }

      // Persist pending ID card unlock state to localStorage
      try {
        localStorage.setItem('fixbro_pending_id_card_unlock', JSON.stringify({
          orderId: orderData.id,
          amount: feeAmount,
          providerId: providerUser.uid,
          timestamp: Date.now()
        }));
      } catch (storageErr) {
        console.warn("Could not save pending ID card unlock to localStorage:", storageErr);
      }

      const options = {
        key: appConfig?.razorpayKeyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Fixbro",
        description: `Official Indian ${categoryLabel} ID Card Unlock`,
        order_id: orderData.id,
        handler: async function (response: any) {
          try {
            setPendingUnlockVerifying(true);
            const verifyRes = await fetch('/api/razorpay/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            const verifyData = await verifyRes.json();
            if (verifyRes.ok && verifyData.success) {
              const unlockResult = await unlockProviderIdCardAction(providerUser.uid, {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                amount: feeAmount,
              });
              if (unlockResult.success) {
                try { localStorage.removeItem('fixbro_pending_id_card_unlock'); } catch(e) {}
                setUnlockSuccessOpen(true);
                toast({ title: "Unlocked!", description: "Official PVC ID Card is now permanently unlocked." });
                await loadData();
              } else {
                toast({ title: "Error", description: unlockResult.message, variant: "destructive" });
              }
            } else {
              await checkAndVerifyPendingUnlock();
            }
          } catch (e: any) {
            console.error("Handler error, falling back to pending verification:", e);
            await checkAndVerifyPendingUnlock();
          } finally {
            setIsPaying(false);
            setPendingUnlockVerifying(false);
          }
        },
        prefill: {
          name: providerName,
          email: providerUser.email || '',
          contact: providerApp?.mobileNumber || '',
        },
        theme: {
          color: "#0d9488",
        },
        modal: {
          ondismiss: function () {
            setIsPaying(false);
            // Check once; if unconfirmed, cleans up localStorage immediately
            setTimeout(() => {
              checkAndVerifyPendingUnlock(2);
            }, 1000);
          }
        }
      };

      const rzp = new window.Razorpay(options);
      if (typeof rzp.on === 'function') {
        rzp.on('payment.failed', () => {
          try { localStorage.removeItem('fixbro_pending_id_card_unlock'); } catch(e) {}
          setPendingUnlockVerifying(false);
          setIsPaying(false);
        });
      }
      rzp.open();
    } catch (err: any) {
      console.error("Payment unlock error:", err);
      toast({ title: "Payment Error", description: err.message || "Could not launch checkout.", variant: "destructive" });
      setIsPaying(false);
    }
  };

  // 2. Stripe Unlock Flow
  const handleStripeUnlock = async () => {
    if (!providerUser?.uid) return;
    setIsPaying(true);
    const amount = Number(idCardSettings.downloadFee || 0);
    try {
      const currencyCode = appConfig?.currencyCode || 'INR';
      const origin = typeof window !== 'undefined' ? window.location.origin : '';

      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'id_card_unlock',
          providerId: providerUser?.uid,
          amount: amount,
          currency: currencyCode,
          successUrl: `${origin}/provider/id-card?payment=success&session_id={CHECKOUT_SESSION_ID}&amount=${amount}`,
          cancelUrl: `${origin}/provider/id-card?payment=cancelled`,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to initiate Stripe session.');
      }

      const data = await res.json();
      router.push(data.url);
    } catch (err: any) {
      toast({ title: "Checkout Error", description: err.message || "Could not launch Stripe gateway.", variant: "destructive" });
      setIsPaying(false);
    }
  };

  // Primary payment button trigger: handles multiple gateways or direct selection
  const handlePaymentClick = async () => {
    if (!providerUser?.uid) return;
    const fee = Number(idCardSettings.downloadFee || 0);
    if (fee <= 0) {
      const res = await unlockProviderIdCardAction(providerUser.uid);
      if (res.success) {
        toast({ title: "Unlocked!", description: "ID card unlocked successfully." });
        await loadData();
      }
      return;
    }

    const razorpayEnabled = appConfig?.enableRazorpay !== false && !!appConfig?.razorpayKeyId;
    const stripeEnabled = appConfig?.enableStripe === true && !!appConfig?.stripePublishableKey;

    if (!razorpayEnabled && !stripeEnabled) {
      toast({ title: "Gateways Disabled", description: "Online payments are currently not available.", variant: "destructive" });
      return;
    }

    if (razorpayEnabled && stripeEnabled) {
      setIsGatewayDialogOpen(true);
      return;
    }

    if (stripeEnabled) {
      await handleStripeUnlock();
    } else {
      await handleRazorpayUnlock();
    }
  };

  // 1. Download Front Image
  const handleDownloadFrontPng = async () => {
    setIsExporting(true);
    try {
      const dataUrl = await renderFrontCardCanvas(cardRenderOptions, frontCanvasRef.current);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `Indian_${categoryLabel.replace(/\s+/g, '_')}_ID_Front_${uniqueIdNumber.replace(/\s+/g, '')}.png`;
      a.click();
      if (providerUser?.uid) {
        trackIdCardDownloadAction(providerUser.uid, 'front_png').catch(console.error);
      }
      toast({ title: "Downloaded!", description: "Front ID card image saved in 300 DPI high resolution." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to generate front image.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  // 2. Download Back Image
  const handleDownloadBackPng = async () => {
    setIsExporting(true);
    try {
      const dataUrl = await renderBackCardCanvas(cardRenderOptions, backCanvasRef.current);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `Indian_${categoryLabel.replace(/\s+/g, '_')}_ID_Back_${uniqueIdNumber.replace(/\s+/g, '')}.png`;
      a.click();
      if (providerUser?.uid) {
        trackIdCardDownloadAction(providerUser.uid, 'back_png').catch(console.error);
      }
      toast({ title: "Downloaded!", description: "Back ID card image saved in 300 DPI high resolution." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to generate back image.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  // 3. Download PVC Card Print-Ready PDF (CR80 Standard: 85.6mm x 53.98mm)
  const handleDownloadPdf = async () => {
    setIsExporting(true);
    try {
      const frontDataUrl = await renderFrontCardCanvas(cardRenderOptions, frontCanvasRef.current);
      const backDataUrl = await renderBackCardCanvas(cardRenderOptions, backCanvasRef.current);

      generatePvcPdf(
        frontDataUrl,
        backDataUrl,
        `FixBro_PVC_Card_${uniqueIdNumber.replace(/\s+/g, '')}.pdf`
      );

      if (providerUser?.uid) {
        trackIdCardDownloadAction(providerUser.uid, 'pdf').catch(console.error);
      }
      toast({ 
        title: "PVC Print PDF Downloaded!", 
        description: "Standard CR80 85.6mm x 54mm PDF ready for plastic ID card printers." 
      });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to generate PDF.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <ProtectedRoute>
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground font-medium">Generating official PVC ID credentials...</p>
        </div>
      </ProtectedRoute>
    );
  }

  // Not enabled in Admin Panel
  if (!idCardSettings.isIdCardEnabled) {
    return (
      <ProtectedRoute>
        <div className="max-w-2xl mx-auto text-center py-16 space-y-4">
          <div className="p-4 rounded-full bg-slate-100 text-slate-500 w-16 h-16 mx-auto flex items-center justify-center">
            <Lock className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">ID Card Generation Temporarily Paused</h2>
          <p className="text-sm text-muted-foreground">
            The administrator has temporarily paused official ID card downloads. Please check back later or contact administration.
          </p>
        </div>
      </ProtectedRoute>
    );
  }

  // Provider not yet approved
  if (!isApproved) {
    return (
      <ProtectedRoute>
        <div className="max-w-2xl mx-auto text-center py-16 space-y-4">
          <div className="p-4 rounded-full bg-amber-500/10 text-amber-600 w-16 h-16 mx-auto flex items-center justify-center border border-amber-500/20">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Application Verification Pending</h2>
          <p className="text-sm text-muted-foreground">
            Official PVC printable ID cards can only be generated for <strong>Approved & Background-Verified</strong> service partners. Your application status is currently: <span className="font-semibold text-primary capitalize">{providerApp?.status || 'Pending'}</span>.
          </p>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="max-w-4xl mx-auto space-y-8 pb-16">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Contact2 className="h-7 w-7 text-primary" />
              Indian {categoryLabel} ID Card
            </h1>
            <p className="text-sm text-muted-foreground">
              Aadhaar & PAN style professional identity card formatted for standard CR80 PVC plastic printers (85.6mm × 54mm).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={activeSide === 'front' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveSide('front')}
              className="text-xs font-semibold"
            >
              Front Side
            </Button>
            <Button
              variant={activeSide === 'back' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveSide('back')}
              className="text-xs font-semibold"
            >
              Back Side
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveSide(activeSide === 'front' ? 'back' : 'front')}
              className="text-xs flex items-center gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Flip Card
            </Button>
          </div>
        </div>

        {/* Live Interactive Card Preview (CR80 Standard Aspect Ratio) */}
        <div className="flex justify-center py-4">
          <OfficialIdCardView data={cardRenderOptions} activeSide={activeSide} />
        </div>

        {/* Hidden canvases for 300 DPI exports */}
        <canvas ref={frontCanvasRef} style={{ display: 'none' }} />
        <canvas ref={backCanvasRef} style={{ display: 'none' }} />

        {/* Unlock & Download Section */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  Printable PVC Card Downloads
                </CardTitle>
                <CardDescription className="text-xs">
                  Download standard ISO CR80 print files or individual 300 DPI images for PVC card printers.
                </CardDescription>
              </div>

              <div>
                {isCardExpired ? (
                  <Badge variant="destructive" className="px-3 py-1 flex items-center gap-1 text-xs font-semibold">
                    <AlertCircle className="h-3.5 w-3.5" /> Expired ({validThruStr})
                  </Badge>
                ) : isUnlocked ? (
                  <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 px-3 py-1 flex items-center gap-1 text-xs font-semibold">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Valid & Active
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-600 border-amber-500/40 px-3 py-1 flex items-center gap-1 text-xs font-semibold">
                    <Lock className="h-3.5 w-3.5" /> Locked ({symbol}{idCardSettings.downloadFee})
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            {isCardExpired ? (
              // Expired State - Requires Renewal
              <div className="rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50/60 dark:bg-rose-950/20 p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-lg bg-rose-500/15 text-rose-700 dark:text-rose-400 shrink-0">
                    <AlertCircle className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-bold text-foreground text-sm">
                      ID Card Expired on {validThruStr}
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Your official service partner ID card has completed its validity period. Please renew your card ({symbol}{idCardSettings.downloadFee}) to re-activate your validity and enable official high-res downloads.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    onClick={handlePaymentClick}
                    disabled={isPaying}
                    className="font-bold bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2 shadow-md"
                  >
                    {isPaying ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Pay {symbol}{idCardSettings.downloadFee} & Renew ID Card
                  </Button>
                </div>
              </div>
            ) : !isUnlocked ? (
              // Locked State - Requires Payment
              <div className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/20 p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400 shrink-0">
                    <Lock className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-bold text-foreground text-sm">
                      One-time ID Card Verification Fee: {symbol}{idCardSettings.downloadFee}
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      To download and print your official PVC card, an administrative processing fee of <strong>{symbol}{idCardSettings.downloadFee}</strong> is applicable. Once unlocked, you can download unlimited high-resolution PDF and PNG files anytime.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    onClick={handlePaymentClick}
                    disabled={isPaying}
                    className="font-bold bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2 shadow-md"
                  >
                    {isPaying ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Unlock className="h-4 w-4" />
                    )}
                    Pay {symbol}{idCardSettings.downloadFee} & Unlock ID Card
                  </Button>
                </div>
              </div>
            ) : (
              // Unlocked State - Download Buttons
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Option 1: PVC Print PDF */}
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 flex flex-col justify-between space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                        <FileText className="h-4 w-4 text-emerald-600" />
                        PVC Print PDF (CR80)
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Standard CR80 2-page print document (85.6mm × 54mm) ready for plastic ID card printers.
                      </p>
                    </div>
                    <Button
                      onClick={handleDownloadPdf}
                      disabled={isExporting}
                      className="w-full text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
                    >
                      {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                      Download PDF
                    </Button>
                  </div>

                  {/* Option 2: Front Side PNG */}
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 flex flex-col justify-between space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                        <ImageIcon className="h-4 w-4 text-sky-600" />
                        Front Side Image
                      </div>
                      <p className="text-xs text-muted-foreground">
                        300 DPI high-resolution front card PNG format (1012 × 638 pixels).
                      </p>
                    </div>
                    <Button
                      onClick={handleDownloadFrontPng}
                      disabled={isExporting}
                      variant="outline"
                      className="w-full text-xs font-semibold flex items-center gap-1.5"
                    >
                      {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                      Download Front PNG
                    </Button>
                  </div>

                  {/* Option 3: Back Side PNG */}
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 flex flex-col justify-between space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                        <ImageIcon className="h-4 w-4 text-indigo-600" />
                        Back Side Image
                      </div>
                      <p className="text-xs text-muted-foreground">
                        300 DPI high-resolution back card PNG with QR code and address details.
                      </p>
                    </div>
                    <Button
                      onClick={handleDownloadBackPng}
                      disabled={isExporting}
                      variant="outline"
                      className="w-full text-xs font-semibold flex items-center gap-1.5"
                    >
                      {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                      Download Back PNG
                    </Button>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-sky-50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-900/40 text-xs text-sky-800 dark:text-sky-300 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-sky-600 shrink-0" />
                  <span>
                    <strong>PVC Print Tip:</strong> Take the downloaded PDF to any local digital print shop or PVC card printer. It is pre-formatted to standard CR80 dimensions.
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gateway Selection Dialog (Matches Wallet Dialog) */}
      <Dialog open={isGatewayDialogOpen} onOpenChange={setIsGatewayDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-center text-teal-800">Select Payment Method</DialogTitle>
            <DialogDescription className="text-center text-xs text-muted-foreground">
              Choose your payment gateway to unlock your ID card ({symbol}{idCardSettings.downloadFee})
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            <Button 
              className="py-5 flex items-center justify-between text-left font-semibold text-sm border-2 border-teal-600/20 hover:border-teal-600 hover:bg-teal-50 rounded-xl h-auto w-full"
              variant="outline"
              onClick={async () => {
                setIsGatewayDialogOpen(false);
                await handleRazorpayUnlock();
              }}
            >
              <span className="flex flex-col">
                <span className="font-bold text-slate-800">Cards, UPI, NetBanking</span>
                <span className="text-xs text-muted-foreground font-normal mt-0.5">Instant checkout via Razorpay</span>
              </span>
              <CreditCard className="h-5 w-5 text-teal-600 ml-4 shrink-0" />
            </Button>

            <Button 
              className="py-5 flex items-center justify-between text-left font-semibold text-sm border-2 border-teal-600/20 hover:border-teal-600 hover:bg-teal-50 rounded-xl h-auto w-full"
              variant="outline"
              onClick={async () => {
                setIsGatewayDialogOpen(false);
                await handleStripeUnlock();
              }}
            >
              <span className="flex flex-col">
                <span className="font-bold text-slate-800">Stripe Checkout</span>
                <span className="text-xs text-muted-foreground font-normal mt-0.5">International cards, Link & Google Pay</span>
              </span>
              <CreditCard className="h-5 w-5 text-teal-600 ml-4 shrink-0" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Verifying ID Card Payment Processing Modal */}
      <Dialog 
        open={pendingUnlockVerifying} 
        onOpenChange={(open) => {
          if (!open) {
            try { localStorage.removeItem('fixbro_pending_id_card_unlock'); } catch(e) {}
            setPendingUnlockVerifying(false);
            setIsPaying(false);
          }
        }}
      >
        <DialogContent className="max-w-sm text-center p-6 sm:p-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal-50 mb-4">
            <Loader2 className="h-7 w-7 text-teal-600 animate-spin" />
          </div>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-center text-slate-900">Verifying Payment</DialogTitle>
            <DialogDescription className="text-center text-sm text-muted-foreground mt-2">
              Waiting for confirmation from your UPI app. If you cancelled or pressed back, you can dismiss this dialog below.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <Button
              variant="outline"
              size="sm"
              className="text-xs text-muted-foreground hover:text-red-600 rounded-lg"
              onClick={() => {
                try { localStorage.removeItem('fixbro_pending_id_card_unlock'); } catch(e) {}
                setPendingUnlockVerifying(false);
                setIsPaying(false);
              }}
            >
              Cancel / Dismiss
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ID Card Unlock Success Modal */}
      <Dialog open={unlockSuccessOpen} onOpenChange={(open) => { if (!open) setUnlockSuccessOpen(false); }}>
        <DialogContent className="max-w-md text-center p-6 sm:p-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 mb-4 animate-in zoom-in duration-300">
            <ShieldCheck className="h-10 w-10 text-emerald-600" />
          </div>
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center text-slate-900">Official ID Card Unlocked!</DialogTitle>
            <DialogDescription className="text-center text-sm text-muted-foreground mt-1">
              Congratulations! Your official work identity card is now permanently unlocked and available for download.
            </DialogDescription>
          </DialogHeader>
          <div className="my-5 p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
            <div className="flex items-center gap-2 text-sm text-emerald-700 font-semibold justify-center">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Lifetime Verified Work Credential</span>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs font-semibold"
                onClick={() => {
                  setUnlockSuccessOpen(false);
                  handleDownloadFrontPng();
                }}
              >
                <Download className="h-3.5 w-3.5 mr-1" />
                Front (PNG)
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs font-semibold"
                onClick={() => {
                  setUnlockSuccessOpen(false);
                  handleDownloadBackPng();
                }}
              >
                <Download className="h-3.5 w-3.5 mr-1" />
                Back (PNG)
              </Button>
            </div>
          </div>
          <DialogFooter className="sm:justify-center">
            <Button 
              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-5 text-base rounded-xl shadow-md transition-all active:scale-[0.99]"
              onClick={() => {
                setUnlockSuccessOpen(false);
                loadData();
              }}
            >
              Done & View Card
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ProtectedRoute>
  );
}
