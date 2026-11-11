
"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Loader2, ArrowLeft, MapPin, Phone, Mail, CalendarDays, Clock, UserCircle, ExternalLink, ListOrdered, AlertTriangle, DollarSign, PlayCircle, CheckCircle, XCircle, Wallet } from 'lucide-react';
import type { FirestoreBooking, BookingStatus, FirestoreNotification } from '@/types/firestore';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, Timestamp, updateDoc, getDoc, collection, query, where, getDocs, limit, addDoc } from '@/lib/mysqlDb';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useLoading } from '@/contexts/LoadingContext';
import { ADMIN_EMAIL } from '@/contexts/AuthContext';
import { getTimestampMillis, formatDateInTimezone, formatTimeInTimezone, cn, isCashPayment, hasOnlinePaymentProof, formatEndTimeDisplay } from '@/lib/utils';
import JobOtpVerificationModal from '@/components/provider/JobOtpVerificationModal';
import { useApplicationConfig } from '@/hooks/useApplicationConfig';
import { logUserActivity } from '@/lib/activityLogger';
import type { UserActivityEventType } from '@/types/firestore';
import { updateBookingStatusByProviderAction, getProviderWalletSettingsAction } from '@/app/actions/providerWalletActions';
import { getProviderDefaultSettingsAction } from '@/app/actions/providerDefaultSettingsActions';

const formatTimestampForDisplay = (timestamp?: any): string => {
  const millis = getTimestampMillis(timestamp);
  if (!millis) return 'N/A';
  const d = new Date(millis);
  return `${formatDateInTimezone(d, 'Asia/Kolkata')} ${formatTimeInTimezone(d, 'Asia/Kolkata')}`;
};

const formatDateForDisplay = (dateString: string | undefined): string => {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString.replace(/-/g, '/'));
        return formatDateInTimezone(date, 'Asia/Kolkata');
    } catch (e) { return dateString; }
};

const getDayCategory = (dateString: string | undefined): 'today' | 'tomorrow' | 'dayAfter' | 'later' => {
  if (!dateString) return 'later';
  try {
    const now = new Date();
    const todayStr = formatDateInTimezone(now, 'Asia/Kolkata', 'YYYY-MM-DD');
    
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const tomorrowStr = formatDateInTimezone(tomorrow, 'Asia/Kolkata', 'YYYY-MM-DD');

    const dayAfter = new Date(now);
    dayAfter.setDate(now.getDate() + 2);
    const dayAfterStr = formatDateInTimezone(dayAfter, 'Asia/Kolkata', 'YYYY-MM-DD');

    const cleanDateStr = dateString.split('T')[0];
    if (cleanDateStr === todayStr) return 'today';
    if (cleanDateStr === tomorrowStr) return 'tomorrow';
    if (cleanDateStr === dayAfterStr) return 'dayAfter';
    return 'later';
  } catch (e) {
    return 'later';
  }
};


export default function ProviderBookingDetailsPage() {
  const params = useParams();
  const bookingId = params.bookingId as string;
  const router = useRouter();
  const { toast } = useToast();
  const { config: appConfig } = useApplicationConfig();
  const symbol = appConfig?.currencySymbol || "₹";
  const { user: providerUser, isLoading: authIsLoading } = useAuth();
  const { showLoading } = useLoading();

  const [booking, setBooking] = useState<FirestoreBooking | null>(null);
  const [isLoadingBooking, setIsLoadingBooking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<BookingStatus | null>(null);
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
  const [otpActionType, setOtpActionType] = useState<'start' | 'complete'>('start');
  const [requireOtpSetting, setRequireOtpSetting] = useState(true);
  const [providerWalletBalance, setProviderWalletBalance] = useState<number | null>(null);
  const [minBalanceForJobs, setMinBalanceForJobs] = useState<number | null>(null);
  const [isWalletLoaded, setIsWalletLoaded] = useState(false);

  useEffect(() => {
    getProviderDefaultSettingsAction()
      .then((settings) => {
        if (typeof settings?.requireOtpForJobStartComplete === 'boolean') {
          setRequireOtpSetting(settings.requireOtpForJobStartComplete);
        }
      })
      .catch(() => {});
  }, []);

  const providerFeeType = appConfig?.providerFeeType || 'percentage';
  const providerFeeValue = Number(appConfig?.providerFeeValue || 0);
  const getCommission = (amount: number, feeType: string, feeVal: number) => {
    if (feeType === 'percentage') return (amount * feeVal) / 100;
    return feeVal;
  };
  const isCash = hasOnlinePaymentProof(booking) ? false : isCashPayment(booking?.paymentMethod);
  const paymentMethod = isCash ? 'Pay After Service' : 'Online';
  const providerGross = (booking?.subTotal || 0) + (booking?.visitingCharge || 0) - (booking?.discountAmount || 0);
  const providerRateEarnings = (booking?.providerTotalEarnings && booking.providerTotalEarnings > 0)
    ? booking.providerTotalEarnings
    : (booking?.subTotal || 0);
  const walletDeduction = Math.max(0, (booking?.totalAmount || 0) - providerRateEarnings);
  const requiredCommission = isCash ? walletDeduction : 0;
  const isLowBalance = booking && providerWalletBalance !== null && minBalanceForJobs !== null ? (booking.status === 'AssignedToProvider' || booking.status === 'Rescheduled') && 
    providerWalletBalance < Math.max(minBalanceForJobs || 0, requiredCommission) : false;
  const isAccepted = booking?.status !== 'AssignedToProvider' && booking?.status !== 'Rescheduled';
  const decimals = appConfig?.currencyDecimalPoints !== undefined ? Number(appConfig.currencyDecimalPoints) : 2;
  const extraChargesTotal = (booking?.additionalCharges || []).reduce((sum, c) => sum + Number(c.amount || 0), 0);
  const displayTotal = isCash ? (booking?.totalAmount || 0) : providerRateEarnings;

  const updateBookingStatus = async (
    newStatus: BookingStatus, 
    additionalCharges?: {name: string, amount: number}[], 
    finalizedPaymentMethod?: string,
    enteredOtp?: string
  ) => {
    if (!booking?.id || !providerUser) return;
    setIsProcessingAction(true);
    setProcessingStatus(newStatus);
    try {
      const result = await updateBookingStatusByProviderAction(
        booking.id,
        providerUser.uid,
        newStatus,
        additionalCharges,
        finalizedPaymentMethod,
        enteredOtp
      );

      if (!result.success) {
        throw new Error(result.message);
      }

      // Optimistically update local booking state immediately
      setBooking(prev => {
        if (!prev) return null;
        const updated: FirestoreBooking = {
          ...prev,
          status: newStatus,
          ...(newStatus === 'InProgressByProvider' && { workStartedAt: Timestamp.now() }),
          ...(newStatus === 'Completed' && { workCompletedAt: Timestamp.now() }),
          updatedAt: Timestamp.now(),
        };
        if (finalizedPaymentMethod) {
          updated.paymentMethod = finalizedPaymentMethod;
        }
        return updated;
      });

      // Log provider activity
      if (providerUser) {
        let eventType: UserActivityEventType = 'providerAcceptJob';
        if (newStatus === 'ProviderRejected') {
          eventType = 'providerRejectJob';
        } else if (newStatus === 'InProgressByProvider') {
          eventType = 'providerStartWork';
        } else if (newStatus === 'Completed') {
          eventType = 'providerCompleteWork';
        }
        logUserActivity(
          eventType,
          {
            bookingId: booking.bookingId || bookingId,
            bookingDocId: booking.id,
            status: newStatus,
          },
          providerUser.uid,
          null,
          providerUser.displayName
        ).catch(e => console.error("Error logging provider activity:", e));
      }

      toast({
        title: "Success",
        description: newStatus === 'InProgressByProvider' ? "Work started successfully!" : newStatus === 'Completed' ? "Job completed successfully!" : "Status updated.",
      });
    } catch (err: any) {
      toast({
        title: "Action Failed",
        description: err.message || "Could not update status.",
        variant: "destructive",
      });
      throw err;
    } finally {
      setIsProcessingAction(false);
      setProcessingStatus(null);
    }
  };

  const handleStartWorkClick = () => {
    if (requireOtpSetting) {
      setOtpActionType('start');
      setIsOtpModalOpen(true);
    } else {
      updateBookingStatus('InProgressByProvider');
    }
  };

  const handleCompleteWorkClick = () => {
    if (requireOtpSetting) {
      setOtpActionType('complete');
      setIsOtpModalOpen(true);
    } else {
      updateBookingStatus('Completed');
    }
  };

  const handleVerifyOtp = async (enteredOtp: string) => {
    const targetStatus = otpActionType === 'start' ? 'InProgressByProvider' : 'Completed';
    await updateBookingStatus(targetStatus, undefined, undefined, enteredOtp);
  };

  useEffect(() => {
    if (!providerUser || authIsLoading) return;
    
    // Fetch provider wallet balance
    const userDocRef = doc(db, 'users', providerUser.uid);
    const balancePromise = getDoc(userDocRef).then(snap => {
      if (snap.exists()) {
        setProviderWalletBalance(snap.data()?.providerWalletBalance || 0);
      } else {
        setProviderWalletBalance(0);
      }
    }).catch(err => {
      console.error("Error loading wallet balance:", err);
      setProviderWalletBalance(0);
    });

    // Fetch minimum balance setting
    const settingsPromise = getProviderWalletSettingsAction().then(settings => {
      setMinBalanceForJobs(settings.minBalanceForJobs);
    }).catch(err => {
      console.error("Error loading wallet settings:", err);
      setMinBalanceForJobs(50);
    });

    Promise.all([balancePromise, settingsPromise]).finally(() => {
      setIsWalletLoaded(true);
    });
  }, [providerUser, authIsLoading]);

  // Auto-Accept or Redirect based on balance when booking loads
  useEffect(() => {
    if (!booking || isLoadingBooking || isProcessingAction) return;
    if (!isWalletLoaded || providerWalletBalance === null || minBalanceForJobs === null) return;

    const isAssigned = booking.status === 'AssignedToProvider' || booking.status === 'Rescheduled';
    if (isAssigned) {
      const requiredAmount = Math.max(minBalanceForJobs, requiredCommission);

      if (providerWalletBalance < requiredAmount) {
        // Redirect provider back to dashboard with error toast
        toast({
          title: "Prepaid Balance Low",
          description: `You need a minimum balance of ${symbol}${requiredAmount.toFixed(decimals)} to accept/view this job.`,
          variant: "destructive"
        });
        router.replace('/provider');
      } else {
        // Auto-accept immediately and deduct commission
        updateBookingStatus('ProviderAccepted');
      }
    }
  }, [booking, isLoadingBooking, isWalletLoaded, providerWalletBalance, minBalanceForJobs, requiredCommission, decimals, symbol, router, toast]);

  useEffect(() => {
    if (!bookingId || !providerUser) {
      if(!authIsLoading && !providerUser) router.push('/auth/login');
      setIsLoadingBooking(false);
      return;
    }

    setIsLoadingBooking(true);
    const bookingDocRef = doc(db, "bookings", bookingId);

    const unsubscribe = onSnapshot(bookingDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as FirestoreBooking;
        if (data.providerId === providerUser.uid) {
          setBooking({ ...data, id: docSnap.id });
          setError(null);
        } else {
          setError("You are not authorized to view this booking.");
          setBooking(null);
          toast({ title: "Access Denied", description: "This booking is not assigned to you.", variant: "destructive" });
        }
      } else {
        setError("Booking not found.");
        setBooking(null);
        toast({ title: "Not Found", description: `Booking with ID ${bookingId} not found.`, variant: "destructive" });
      }
      setIsLoadingBooking(false);
    }, (err) => {
      console.error("Error fetching booking details:", err);
      setError("Failed to load booking details.");
      setIsLoadingBooking(false);
      toast({ title: "Error", description: "Could not fetch booking details.", variant: "destructive" });
    });

    return () => unsubscribe();

  }, [bookingId, providerUser, authIsLoading, router, toast]);
  
  const handleViewOnMap = () => {
    if (booking?.latitude && booking?.longitude) {
      const url = `https://www.google.com/maps?q=${booking.latitude},${booking.longitude}`;
      window.open(url, '_blank');
    }
  };
  
  const handleNavigateBack = () => {
    showLoading();
    router.back();
  }




  if (isLoadingBooking || authIsLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-3 text-muted-foreground">Loading booking details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10">
        <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Error</h2>
        <p className="text-destructive-foreground bg-destructive/10 p-3 rounded-md">{error}</p>
        <Button onClick={handleNavigateBack} className="mt-6" variant="outline">Go Back</Button>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="text-center py-10">
        <ListOrdered className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Booking Not Found</h2>
        <p className="text-muted-foreground">The requested booking could not be loaded.</p>
        <Button onClick={handleNavigateBack} className="mt-6" variant="outline">Go Back</Button>
      </div>
    );
  }

  const isJobCompleted = booking.status === 'Completed';
  const dayCat = !isJobCompleted ? getDayCategory(booking.scheduledDate) : 'later';

  const dateBoxClass = 
    dayCat === 'today' ? "border-2 border-red-500/70 bg-red-500/10 text-red-800 dark:text-red-300" :
    dayCat === 'tomorrow' ? "border-2 border-amber-500/70 bg-amber-500/10 text-amber-900 dark:text-amber-300" :
    dayCat === 'dayAfter' ? "border-2 border-emerald-500/70 bg-emerald-500/10 text-emerald-900 dark:text-emerald-300" :
    "border-2 border-primary/40 bg-primary/5 text-primary";



  return (
    <div className="max-w-3xl mx-auto">
      <Button onClick={handleNavigateBack} variant="outline" size="sm" className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
      </Button>

      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex justify-between items-start">
            <CardTitle className="text-2xl font-headline">Booking Details</CardTitle>
            <Badge variant={
              booking.status === 'Completed' ? 'default' :
              booking.status === 'ProviderAccepted' || booking.status === 'InProgressByProvider' ? 'default' :
              booking.status === 'AssignedToProvider' || booking.status === 'Rescheduled' ? 'secondary' :
              'outline'
            } className={`capitalize text-sm ${
              booking.status === 'ProviderAccepted' || booking.status === 'InProgressByProvider' ? 'bg-blue-500 text-white' :
              booking.status === 'Completed' ? 'bg-green-500 text-white' : 
              booking.status === 'Rescheduled' ? 'bg-orange-500 text-white' : ''
            }`}>
              {booking.status.replace(/([A-Z])/g, ' $1').replace('Provider ','')}
            </Badge>
          </div>
          <CardDescription>ID: {booking.bookingId}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          
          <section>
            <h3 className="text-lg font-semibold mb-2 flex items-center"><UserCircle className="mr-2 text-primary"/>Customer Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <p><strong>Name:</strong> {isJobCompleted ? "[Hidden for Privacy]" : isLowBalance ? "[Locked - Add Money to Reveal]" : !isAccepted ? "[Hidden until Accepted]" : booking.customerName}</p>
              <p className="flex items-center gap-1"><strong>Email:</strong> {isJobCompleted ? "[Hidden for Privacy]" : isLowBalance ? "[Locked]" : !isAccepted ? "[Hidden until Accepted]" : (booking.customerEmail || 'N/A')}</p>
              <p className="flex items-center gap-1"><strong>Phone:</strong> {isJobCompleted ? "[Hidden for Privacy]" : isLowBalance ? "[Locked]" : !isAccepted ? "[Hidden until Accepted]" : (
                <a href={`tel:${booking.customerPhone}`} className="text-primary hover:underline font-medium">{booking.customerPhone}</a>
              )}</p>
            </div>
          </section>
          <Separator />
          <section>
            <h3 className="text-lg font-semibold mb-2 flex items-center"><MapPin className="mr-2 text-primary"/>Service Address</h3>
            <div className="text-sm space-y-0.5">
              {isJobCompleted ? (
                <p className="text-muted-foreground italic">[Hidden for Privacy]</p>
              ) : (
                <>
                  <p>{booking.addressLine1}</p>
                  {booking.addressLine2 && <p>{booking.addressLine2}</p>}
                  <p>{booking.city}, {booking.state} - {booking.pincode}</p>
                </>
              )}
            </div>
            {!isJobCompleted && !isLowBalance && isAccepted && booking.latitude && booking.longitude && (
                <div className="pt-2">
                  <Button 
                      variant="default" 
                      size="sm" 
                      onClick={handleViewOnMap} 
                      className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white font-semibold flex items-center justify-center gap-2 rounded-xl h-10 px-4 text-xs"
                  >
                      View on Google Maps <ExternalLink className="h-3.5 w-3.5"/>
                  </Button>
                </div>
            )}
          </section>
          <Separator />
          <section>
            <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
              <h3 className="text-lg font-semibold flex items-center"><CalendarDays className="mr-2 text-primary"/>Schedule</h3>
              {!isJobCompleted && dayCat === 'today' && <Badge className="bg-red-600 text-white font-black text-xs uppercase tracking-wider animate-pulse">🚨 TODAY - URGENT</Badge>}
              {!isJobCompleted && dayCat === 'tomorrow' && <Badge className="bg-amber-600 text-white font-bold text-xs uppercase tracking-wider">⏰ TOMORROW</Badge>}
              {!isJobCompleted && dayCat === 'dayAfter' && <Badge className="bg-emerald-600 text-white font-bold text-xs uppercase tracking-wider">📅 IN 2 DAYS</Badge>}
            </div>

            <div className={cn("p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all", dateBoxClass)}>
              <div className="flex items-center gap-2.5 font-black text-sm sm:text-base">
                <CalendarDays className="h-5 w-5 shrink-0 text-primary" />
                <span>Date: {formatDateForDisplay(booking.scheduledDate)}</span>
              </div>
              <div className="flex items-center gap-2 font-extrabold text-sm sm:text-base bg-background/90 px-3.5 py-2 rounded-xl border shadow-2xs text-foreground">
                <Clock className="h-5 w-5 text-primary shrink-0" />
                <span>Time Slot: {booking.scheduledTimeSlot}</span>
              </div>
            </div>

            <p className="text-emerald-600 font-bold text-sm mt-3 flex items-center gap-1.5">
              <Clock className="h-4 w-4 shrink-0" />
              <span>End Time: {formatEndTimeDisplay(booking.estimatedEndTime, booking.scheduledTimeSlot)}</span>
            </p>

            {booking.dailyTimeline && booking.dailyTimeline.length > 1 && (
              <div className="mt-4 py-2.5 px-3 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/50 rounded-xl space-y-2 text-sm text-muted-foreground max-w-xl">
                <p className="font-bold text-xs text-blue-800 dark:text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> Day-by-Day Work Schedule
                </p>
                <div className="space-y-1.5 pl-1">
                  {booking.dailyTimeline.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap text-sm py-1.5 border-b border-border/20 last:border-0">
                      <span className="font-semibold text-foreground/80">{item.dateLabel}</span>
                      <span className="font-semibold bg-primary/10 text-primary px-2.5 py-0.5 rounded-full text-xs whitespace-nowrap">
                        {item.startTime} - {item.endTime}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {booking.interveningBreaks && booking.interveningBreaks.length > 0 && (
              <div className="mt-4 py-2.5 px-3 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/50 rounded-xl space-y-1.5 text-xs text-muted-foreground max-w-xl">
                <p className="font-bold text-[10px] text-amber-800 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Includes Gaps / Holidays
                </p>
                <div className="space-y-1 pl-1">
                  {booking.interveningBreaks.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs">
                      <div className={`mt-1.5 h-1.5 w-1.5 rounded-full ${item.type === 'holiday' ? 'bg-red-500' : item.type === 'partial' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                      <div className="text-muted-foreground text-xs">
                        <span className="font-semibold text-foreground/80">{item.dateLabel}</span>
                        {item.timeLabel && <span className="ml-1">({item.timeLabel})</span>}
                        <span className="ml-1.5 font-medium text-muted-foreground/80">— {item.reason}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
          <Separator />
          <section>
            <h3 className="text-lg font-semibold mb-2 flex items-center"><ListOrdered className="mr-2 text-primary"/>Services Booked</h3>
            <ul className="space-y-1 text-sm list-disc list-inside">
              {booking.services.map(service => (
                <li key={service.serviceId}>{service.name} (Qty: {service.quantity}) - {symbol}{service.pricePerUnit.toFixed(decimals)} each</li>
              ))}
            </ul>
          </section>
          <Separator/>
           <section>
            <h3 className="text-lg font-semibold mb-2 flex items-center"><DollarSign className="mr-2 text-primary"/>Earnings & Payment Details</h3>
            {!isCash ? (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 space-y-2.5">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground font-medium">Payment Status:</span>
                  <Badge className="bg-emerald-600 text-white font-bold">Paid Online (Prepaid)</Badge>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-emerald-200/60">
                  <span className="font-bold text-foreground">Your Net Earnings (100% Withdrawable):</span>
                  <span className="font-extrabold text-2xl text-emerald-600">
                    {symbol}{providerRateEarnings.toFixed(decimals)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Zero commission deducted. The customer prepaid online via FixBro. This full amount is credited directly to your withdrawable balance once work is completed.
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-muted/40 border space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-foreground">Total Cash to Collect from Customer:</span>
                  <span className="font-extrabold text-xl text-primary">{symbol}{(booking.totalAmount || 0).toFixed(decimals)}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center text-xs text-muted-foreground">
                  <span>Your Daily Labour Net Earnings:</span>
                  <span className="font-bold text-foreground">{symbol}{providerRateEarnings.toFixed(decimals)}</span>
                </div>
                {walletDeduction > 0 && (
                  <div className="flex justify-between items-center text-xs text-amber-700 dark:text-amber-400">
                    <span>Admin Markup & Platform Fees (Auto-Deducted from Wallet):</span>
                    <span className="font-bold">-{symbol}{walletDeduction.toFixed(decimals)}</span>
                  </div>
                )}
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 text-xs text-amber-900 dark:text-amber-300 leading-relaxed">
                  <strong>Pay After Service Notice:</strong> Customer will pay you {symbol}{(booking.totalAmount || 0).toFixed(decimals)} in cash/UPI upon completion. The platform fee &amp; markup (-{symbol}{walletDeduction.toFixed(decimals)}) is auto-deducted from your prepaid wallet balance.
                </div>
              </div>
            )}
           </section>

          {booking.notes && !isJobCompleted && (
            <>
              <Separator />
              <section>
                <h3 className="text-lg font-semibold mb-2">Customer Notes</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{booking.notes}</p>
              </section>
            </>
          )}
           <Separator />
           <div className="text-xs text-muted-foreground space-y-1">
             <p>Booked On: {formatTimestampForDisplay(booking.createdAt)}</p>
             {booking.updatedAt && <p>Last Updated: {formatTimestampForDisplay(booking.updatedAt)}</p>}
             {booking.workStartedAt && (
               <p className="text-foreground font-medium flex items-center gap-1.5 pt-1">
                 <Clock className="h-3.5 w-3.5 text-primary" />
                 Work Started: {formatTimestampForDisplay(booking.workStartedAt)}
                 {booking.workCompletedAt && ` | Finished: ${formatTimestampForDisplay(booking.workCompletedAt)}`}
                 {booking.workedDuration && ` (Duration: ${booking.workedDuration})`}
               </p>
             )}
           </div>
           {isLowBalance && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3 rounded-xl font-bold flex flex-col gap-1.5 mt-2">
                <div className="flex items-center gap-1.5">
                  <span>⚠️</span>
                  <span>Low Wallet Balance</span>
                </div>
                <p className="font-semibold text-xs leading-snug">
                  Add money to accept this booking. Minimum balance required: {symbol}{Math.max(minBalanceForJobs || 0, requiredCommission).toFixed(decimals)}
                </p>
              </div>
            )}
        </CardContent>
        {/* Action Buttons Footer */}
        <CardFooter className="flex flex-col sm:flex-row justify-end gap-3 bg-muted/20 border-t p-3">
            {(booking.status === 'AssignedToProvider' || booking.status === 'Rescheduled') && (
                <>
                    <Button 
                        variant="destructive" 
                        onClick={() => updateBookingStatus('ProviderRejected')} 
                        disabled={isProcessingAction || isLowBalance}
                        className="w-full sm:w-auto"
                    >
                        {isProcessingAction && processingStatus === 'ProviderRejected' ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Rejecting...
                          </>
                        ) : (
                          <>
                            <XCircle className="mr-2 h-4 w-4" />
                            Reject Booking
                          </>
                        )}
                    </Button>
                    {isLowBalance ? (
                      <Button className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold" asChild>
                        <Link href="/provider/wallet">
                          <Wallet className="mr-2 h-4 w-4" />
                          Top Up Wallet
                        </Link>
                      </Button>
                    ) : (
                      <Button 
                          onClick={() => updateBookingStatus('ProviderAccepted')} 
                          disabled={isProcessingAction}
                          className="w-full sm:w-auto"
                      >
                          {isProcessingAction && processingStatus === 'ProviderAccepted' ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Accepting...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Accept Booking
                            </>
                          )}
                      </Button>
                    )}
                </>
            )}

            {booking.status === 'ProviderAccepted' && (
                <Button 
                    onClick={handleStartWorkClick} 
                    disabled={isProcessingAction}
                    className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
                >
                    {isProcessingAction && processingStatus === 'InProgressByProvider' ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Starting Work...
                      </>
                    ) : (
                      <>
                        <PlayCircle className="mr-2 h-4 w-4" />
                        Start Work
                      </>
                    )}
                </Button>
            )}

            {booking.status === 'InProgressByProvider' && (
                <Button 
                    onClick={handleCompleteWorkClick} 
                    disabled={isProcessingAction}
                    className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
                >
                    {isProcessingAction && processingStatus === 'Completed' ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Completing...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Mark as Complete
                      </>
                    )}
                </Button>
            )}
        </CardFooter>
      </Card>

      {booking && (
        <JobOtpVerificationModal
          isOpen={isOtpModalOpen}
          onClose={() => setIsOtpModalOpen(false)}
          onVerify={handleVerifyOtp}
          bookingId={booking.bookingId}
          customerName={booking.customerName}
          actionType={otpActionType}
          isProcessing={isProcessingAction}
        />
      )}
    </div>
  );
}
