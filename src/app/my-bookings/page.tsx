
"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ListOrdered, PackageSearch, ArrowLeft, Loader2, Eye, Trash2, Download, Ban, UserCircle, Languages, Phone, AlertTriangle, Clock, KeyRound, ShieldCheck, CalendarDays, Users } from "lucide-react"; // Added Phone, CalendarDays, Users
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, Timestamp, getDoc, addDoc, getDocs, limit } from '@/lib/mysqlDb'; 
import type { FirestoreBooking, BookingStatus, GlobalWebSettings, ProviderApplication, FirestoreNotification } from '@/types/firestore'; 
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { generateInvoicePdf } from '@/lib/InvoicePdfForDownload'; 
import { useGlobalSettings } from "@/hooks/useGlobalSettings"; 
import { useApplicationConfig } from '@/hooks/useApplicationConfig';
import { useRouter } from "next/navigation";
import { useLoading } from '@/contexts/LoadingContext';
import { sendUserCancellationEmail, type UserCancellationEmailInput } from '@/ai/flows/sendUserCancellationEmailFlow';
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; 
import { Separator } from "@/components/ui/separator"; 
import AppImage from "@/components/ui/AppImage";
import { triggerPushNotification } from "@/lib/fcmUtils";
import { ADMIN_EMAIL } from "@/contexts/AuthContext";
import { getTimestampMillis, formatDateInTimezone, formatTimeInTimezone, formatCurrency, formatEndTimeDisplay } from "@/lib/utils";
import BookingRulesView from "@/components/shared/BookingRulesView";


export interface EnrichedProviderItem {
  serviceId: string;
  name: string;
  imageUrl: string;
  days: number;
  pricePerDay: number;
  totalPrice: number;
  categoryName?: string;
  skillLevel?: string;
  experience?: string;
  mobileNumber?: string;
  languages?: string[];
  providerDetails?: ProviderApplication;
}

// Enriched booking type to include provider details
interface EnrichedBooking extends FirestoreBooking {
    providerDetails?: ProviderApplication;
    enrichedProviders?: EnrichedProviderItem[];
}

const formatBookingTimestamp = (timestamp?: any): string => {
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
    } catch (e) {
        return dateString;
    }
};

const parseSlotToHHMM = (slot: string): { hours: number; minutes: number } | null => {
    const timeMatch = slot.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!timeMatch) return null;
    let hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    const period = timeMatch[3].toUpperCase();

    if (period === "PM" && hours < 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0; 
    return { hours, minutes };
};

const getStatusBadgeVariant = (status: BookingStatus) => {
    switch (status) {
      case 'Completed': return 'default';
      case 'Confirmed':
      case 'ProviderAccepted':
      case 'AssignedToProvider':
      case 'InProgressByProvider':
        return 'default'; 
      case 'Pending Payment':
      case 'Rescheduled':
      case 'Processing':
        return 'secondary';
      case 'Cancelled':
      case 'ProviderRejected':
        return 'destructive';
      default: return 'outline';
    }
  };

const getStatusBadgeClass = (status: BookingStatus) => {
    switch (status) {
        case 'Completed': return 'bg-green-500 hover:bg-green-600';
        case 'Confirmed':
        case 'ProviderAccepted':
        case 'AssignedToProvider':
        case 'InProgressByProvider':
            return 'bg-blue-500 hover:bg-blue-600';
        case 'Pending Payment':
        case 'Rescheduled':
            return 'bg-orange-500 hover:bg-orange-600';
        case 'Processing':
            return 'bg-purple-500 hover:bg-purple-600';
        case 'Cancelled':
        case 'ProviderRejected':
            return 'bg-red-600 hover:bg-red-700';
        default: return '';
    }
};


export default function MyBookingsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [myBookings, setMyBookings] = useState<EnrichedBooking[]>([]); // Use enriched type
  const [isLoadingBookings, setIsLoadingBookings] = useState(true);
  const [isCancelling, setIsCancelling] = useState<string | null>(null);
  const [isDownloadingInvoice, setIsDownloadingInvoice] = useState<string | null>(null);
  
  const { settings: globalCompanySettings, isLoading: isLoadingCompanySettings } = useGlobalSettings();
  const { config: appConfig, isLoading: isLoadingAppSettings } = useApplicationConfig();
  const symbol = appConfig?.currencySymbol || '₹';
  const decimals = appConfig?.currencyDecimalPoints !== undefined ? appConfig.currencyDecimalPoints : 2;
  const code = appConfig?.currencyCode || 'INR';
  const router = useRouter();
  const { showLoading } = useLoading();

  const formatBookingTimestamp = (timestamp?: any): string => {
    const millis = getTimestampMillis(timestamp);
    if (!millis) return 'N/A';
    return formatDateInTimezone(millis, appConfig.timezone, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const formatDateForDisplay = (dateString: string | undefined): string => {
      if (!dateString) return 'N/A';
      try {
          if (dateString.includes('-')) {
              const [y, m, d] = dateString.split('-').map(Number);
              const dateObj = new Date(y, m - 1, d);
              return formatDateInTimezone(dateObj, appConfig.timezone, { day: '2-digit', month: 'short', year: 'numeric' });
          }
          return formatDateInTimezone(dateString, appConfig.timezone, { day: '2-digit', month: 'short', year: 'numeric' });
      } catch (e) {
          return dateString;
      }
  };

  const [showCancellationDialog, setShowCancellationDialog] = useState(false);
  const [cancellationDialogContent, setCancellationDialogContent] = useState<{ title: string; description: React.ReactNode; actionText?: string; onAction?: () => void; showPayButton?: boolean; feeAmount?: number, feeType?: 'fixed' | 'percentage' } | null>(null);
  const [selectedBookingForCancel, setSelectedBookingForCancel] = useState<FirestoreBooking | null>(null);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);


  useEffect(() => {
    if (!user || authLoading) {
      if (!authLoading && !user) setIsLoadingBookings(false);
      return;
    }

    setIsLoadingBookings(true);
    const bookingsCollectionRef = collection(db, "bookings");
    const userEmail = user.email ? user.email.toLowerCase().trim() : null;

    // Trigger background cleanup of any stale unpaid online booking attempts
    fetch('/api/bookings/cancel-pending-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sweepStale: true }),
    }).catch(() => {});

    const processAndSetBookings = async (docs: any[]) => {
      const fetchedBookings = docs
        .map(docSnap => ({ 
          ...docSnap.data(),
          id: docSnap.id, 
        } as FirestoreBooking))
        .filter(booking => {
          // Never show abandoned unpaid Online payment attempts in customer's My Bookings
          const isOnline = (booking.paymentMethod || '').toLowerCase().trim() === 'online';
          const hasPaymentId = !!(
            booking.razorpayPaymentId ||
            (booking as any).stripePaymentIntent ||
            (booking as any).stripeSessionId
          );
          if (booking.status === 'Pending Payment' && isOnline && !hasPaymentId) {
            return false;
          }
          return true;
        });

      // Auto-link any matching email booking missing userId
      if (user.uid) {
        fetchedBookings.forEach(booking => {
          if (!booking.userId && booking.customerEmail && userEmail && booking.customerEmail.toLowerCase().trim() === userEmail && booking.id) {
            updateDoc(doc(db, "bookings", booking.id), { userId: user.uid }).catch(() => {});
          }
        });
      }

      // Enrich bookings with provider details AND service images if missing
      const enrichedPromises = fetchedBookings.map(async (booking): Promise<EnrichedBooking> => {
        const enrichedBooking: EnrichedBooking = { ...booking };

        // 1. Fetch Primary Provider Details
        if (booking.providerId) {
          try {
            const providerDocRef = doc(db, "providerApplications", booking.providerId);
            const providerDocSnap = await getDoc(providerDocRef);
            if (providerDocSnap.exists()) {
              enrichedBooking.providerDetails = providerDocSnap.data() as ProviderApplication;
            }
          } catch (error) {
            console.error(`Failed to fetch provider details for ID ${booking.providerId}`, error);
          }
        }

        // 2. Enrich all services/providers in booking.services
        const servicesList = booking.services || [];
        const enrichedProviders: EnrichedProviderItem[] = [];

        for (const service of servicesList) {
          const days = Math.max(1, service.quantity || 1);
          const pricePerDay = service.pricePerUnit || service.discountedPricePerUnit || 0;
          const totalPrice = pricePerDay * days;
          
          let pData: ProviderApplication | undefined;
          const targetId = (service as any).providerId || (service as any).providerUserId || service.serviceId;
          
          if (targetId) {
            if (enrichedBooking.providerDetails && (booking.providerId === targetId || (service as any).providerId === booking.providerId)) {
              pData = enrichedBooking.providerDetails;
            } else {
              try {
                const pSnap = await getDoc(doc(db, "providerApplications", targetId));
                if (pSnap.exists()) {
                  pData = pSnap.data() as ProviderApplication;
                }
              } catch (e) {
                // Ignore fallback to service data
              }
            }
          }

          if (!enrichedBooking.providerDetails && pData) {
            enrichedBooking.providerDetails = pData;
          }

          // Fallback image from adminServices if needed
          let finalImageUrl = pData?.profilePhotoUrl || service.imageUrl;
          if (!finalImageUrl && service.serviceId) {
            try {
              const serviceDocRef = doc(db, "adminServices", service.serviceId);
              const serviceDocSnap = await getDoc(serviceDocRef);
              if (serviceDocSnap.exists()) {
                finalImageUrl = serviceDocSnap.data()?.imageUrl;
              }
            } catch (err) {}
          }

          enrichedProviders.push({
            serviceId: service.serviceId,
            name: pData?.fullName || service.name || 'Daily Labour Provider',
            imageUrl: finalImageUrl || '/default-image.png',
            days,
            pricePerDay,
            totalPrice,
            categoryName: pData?.workCategoryName || (service as any).categoryName || '',
            skillLevel: pData?.skillLevelLabel || (pData as any)?.seniorityLevel || (service as any).skillLevel || '',
            experience: pData?.experienceLevelLabel || (pData as any)?.experienceYearsLabel || (service as any).experience || '',
            mobileNumber: pData?.mobileNumber || (service as any).mobileNumber || '',
            languages: pData?.languagesSpokenLabels || (service as any).languages || [],
            providerDetails: pData,
          });
        }

        enrichedBooking.enrichedProviders = enrichedProviders;
        return enrichedBooking;
      });
      
      const resolvedBookings = await Promise.all(enrichedPromises);
      setMyBookings(resolvedBookings);
      setIsLoadingBookings(false);
    };

    const q = query(
      bookingsCollectionRef,
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    let isSubscribed = true;

    const fetchAllUserBookings = async () => {
      try {
        const uidSnap = await getDocs(q);
        const bookingMap = new Map<string, any>();
        uidSnap.docs.forEach(d => bookingMap.set(d.id, d));

        // If user has email, also query by customerEmail to catch any legacy/unlinked bookings
        if (userEmail) {
          try {
            const emailQuery = query(
              bookingsCollectionRef,
              where("customerEmail", "==", userEmail),
              orderBy("createdAt", "desc"),
              limit(50)
            );
            const emailSnap = await getDocs(emailQuery);
            emailSnap.docs.forEach(d => bookingMap.set(d.id, d));
          } catch (e) {
            console.warn("Could not query bookings by email:", e);
          }
        }

        const combinedDocs = Array.from(bookingMap.values());
        combinedDocs.sort((a, b) => {
          const aTime = getTimestampMillis(a.data()?.createdAt) || 0;
          const bTime = getTimestampMillis(b.data()?.createdAt) || 0;
          return bTime - aTime;
        });

        if (isSubscribed) {
          await processAndSetBookings(combinedDocs);
        }
      } catch (error) {
        console.error("Error fetching user bookings: ", error);
        if (isSubscribed) {
          toast({ title: "Error", description: "Could not fetch your bookings.", variant: "destructive" });
          setIsLoadingBookings(false);
        }
      }
    };

    fetchAllUserBookings();

    const unsubscribe = onSnapshot(q, () => {
      fetchAllUserBookings();
    }, (error) => {
      console.error("Error in bookings onSnapshot: ", error);
    });

    return () => {
      isSubscribed = false;
      unsubscribe();
    };
  }, [user, authLoading, toast]);


  const calculateCancellationEligibility = (booking: FirestoreBooking) => {
    if (!appConfig.enableCancellationPolicy) {
      return { eligibleForFree: true, message: "Cancellation policy is currently disabled. Free cancellation allowed.", fee: 0, feeType: 'fixed' as 'fixed' | 'percentage', isFinalWindow: false };
    }

    // Assuming booking.scheduledDate is YYYY-MM-DD from Firestore
    const [year, month, day] = booking.scheduledDate.split('-').map(Number);
    const serviceDate = new Date(year, month - 1, day); // Month is 0-indexed

    const slotTime = booking.scheduledTimeSlot;
    
    const timeParts = parseSlotToHHMM(slotTime);
    if (!timeParts) {
      console.error("Invalid time slot format:", slotTime);
      return { eligibleForFree: false, message: "Could not parse service time. Please contact support.", fee: appConfig.cancellationFeeValue || 0, feeType: appConfig.cancellationFeeType || 'fixed', isFinalWindow: false };
    }

    const serviceStartTime = new Date(serviceDate);
    serviceStartTime.setHours(timeParts.hours, timeParts.minutes, 0, 0);

    const now = new Date();
    const diffMs = serviceStartTime.getTime() - now.getTime();

    // 1. Check final restricted window (e.g., 3 hours before service start)
    const finalHours = appConfig.finalCancellationHours || 0;
    const finalMinutes = appConfig.finalCancellationMinutes || 0;
    const totalFinalWindowMs = ((finalHours * 60) + finalMinutes) * 60 * 1000;

    if (appConfig.enableFinalCancellationWindow && diffMs < totalFinalWindowMs) {
      return {
        eligibleForFree: false,
        message: "You are cancelling within the final restricted window.",
        fee: 100, // 100% cancellation charge
        feeType: 'percentage' as 'fixed' | 'percentage',
        isFinalWindow: true
      };
    }

    if (diffMs <= 0) { 
      return { eligibleForFree: false, message: "Service time has already passed or is too soon to cancel.", fee: appConfig.cancellationFeeValue || 0, feeType: appConfig.cancellationFeeType || 'fixed', isFinalWindow: false };
    }

    const freeWindowDays = appConfig.freeCancellationDays || 0;
    const freeWindowHours = appConfig.freeCancellationHours || 0;
    const freeWindowMinutes = appConfig.freeCancellationMinutes || 0;
    const totalFreeWindowMs = ((freeWindowDays * 24 * 60) + (freeWindowHours * 60) + freeWindowMinutes) * 60 * 1000;

    const fee = appConfig.cancellationFeeValue || 0;
    const feeType = appConfig.cancellationFeeType || 'fixed';

    if (diffMs >= totalFreeWindowMs) {
      let windowMessage = "";
      if (freeWindowDays > 0) windowMessage += `${freeWindowDays} day(s) `;
      if (freeWindowHours > 0) windowMessage += `${freeWindowHours} hour(s) `;
      if (freeWindowMinutes > 0) windowMessage += `${freeWindowMinutes} minute(s) `;
      if (windowMessage.trim() === "") windowMessage = "the configured window";
      else windowMessage = windowMessage.trim();
      
      return { eligibleForFree: true, message: `You are eligible for free cancellation as you are cancelling ${windowMessage} before the service.`, fee: 0, feeType, isFinalWindow: false };
    } else {
      return { eligibleForFree: false, message: "You are outside the free cancellation window.", fee, feeType, isFinalWindow: false };
    }
  };

  const openCancellationDialog = (booking: FirestoreBooking) => {
    setSelectedBookingForCancel(booking);
    const eligibility = calculateCancellationEligibility(booking);
    let feeAmount = 0;
    let feeDisplay = "";
    let finalRefundAmount = 0;

    if (!eligibility.eligibleForFree) {
        if (eligibility.feeType === 'percentage') {
            feeAmount = (booking.totalAmount * eligibility.fee) / 100;
            feeDisplay = `${eligibility.fee}% (${formatCurrency(feeAmount, symbol, decimals, code)})`;
        } else {
            feeAmount = eligibility.fee;
            feeDisplay = formatCurrency(feeAmount, symbol, decimals, code);
        }
        finalRefundAmount = (booking.totalAmount || 0) - feeAmount;
    }
    
    const proceedWithCancellation = async () => {
        if (!booking.id || !user) return;
        setIsCancelling(booking.id);
        const bookingDocRef = doc(db, "bookings", booking.id);
        try {
            await updateDoc(bookingDocRef, { 
                status: "Cancelled" as BookingStatus, 
                updatedAt: Timestamp.now(),
                cancellationFeeCharged: feeAmount,
                refundableAmount: booking.paymentMethod === 'Online' ? finalRefundAmount : 0,
                cancellationRefundStatus: booking.paymentMethod === 'Online' ? (finalRefundAmount > 0 ? 'Pending' : 'N/A') : 'N/A'
            });
            
            // 1. Create and send notification to USER
            const userNotificationData: FirestoreNotification = {
              userId: user.uid,
              title: "Booking Cancelled",
              message: `Your booking ${booking.bookingId} has been successfully cancelled.`,
              type: 'error',
              href: '/my-bookings',
              read: false,
              createdAt: Timestamp.now(),
            };
            await addDoc(collection(db, "userNotifications"), userNotificationData);
            triggerPushNotification({
              userId: user.uid,
              title: userNotificationData.title,
              body: userNotificationData.message,
              href: userNotificationData.href
            });

            // 2. Create and send notification to ADMIN
            try {
              const usersRef = collection(db, "users");
              const adminQuery = query(usersRef, where("email", "==", ADMIN_EMAIL), limit(1));
              const adminSnapshot = await getDocs(adminQuery);
              if (!adminSnapshot.empty) {
                const adminUid = adminSnapshot.docs[0].id;
                const adminNotificationData: FirestoreNotification = {
                  userId: adminUid,
                  title: "Booking Cancelled by User",
                  message: `Booking ${booking.bookingId} was cancelled by ${user.displayName || user.email}.`,
                  type: 'admin_alert',
                  href: `/admin/bookings`,
                  read: false,
                  createdAt: Timestamp.now(),
                };
                await addDoc(collection(db, "userNotifications"), adminNotificationData);
                triggerPushNotification({
                  userId: adminUid,
                  title: adminNotificationData.title,
                  body: adminNotificationData.message,
                  href: adminNotificationData.href
                });
              }
            } catch (err) {
              console.error("Error notifying admin about user cancellation:", err);
            }

            toast({ title: "Booking Cancelled", description: "Your booking has been successfully cancelled." });
            
            // Trigger post-process API for WhatsApp, Stats, etc.
            fetch('/api/bookings/post-process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bookingDocId: booking.id, cancelledBy: 'user' }),
            }).catch(err => console.error("Error triggering post-process after cancellation:", err));

            // Send cancellation email using the NEW dedicated flow
            const emailInput: UserCancellationEmailInput = {
                bookingId: booking.bookingId,
                customerName: booking.customerName,
                customerEmail: booking.customerEmail,
                paymentMethod: booking.paymentMethod,
                paidAmount: booking.paymentMethod === 'Online' ? booking.totalAmount : 0,
                cancellationFee: feeAmount,
                refundableAmount: finalRefundAmount,
                siteName: globalCompanySettings?.websiteName || "Fixbro",
                smtpHost: appConfig.smtpHost,
                smtpPort: appConfig.smtpPort,
                smtpUser: appConfig.smtpUser,
                smtpPass: appConfig.smtpPass,
                senderEmail: appConfig.senderEmail,
                currencySymbol: symbol,
            };
            try {
  await sendUserCancellationEmail(emailInput);
                    } catch (emailError) {
  console.error("Cancellation email failed:", emailError);
   }

        } catch (error) {
            toast({ title: "Error", description: "Could not cancel booking.", variant: "destructive" });
        } finally {
            setIsCancelling(null);
            setShowCancellationDialog(false);
        }
    };
    
    const proceedToPayCancellationFee = () => {
        if (!booking.id) return;
        showLoading();
        localStorage.setItem('bookingIdForCancellationFee', booking.id); 
        localStorage.setItem('cancellationFeeAmount', feeAmount.toFixed(2));
        router.push(`/checkout/payment?reason=cancellation_fee&booking_id=${booking.bookingId}`);
        setShowCancellationDialog(false);
    };

    if (eligibility.eligibleForFree) {
      setCancellationDialogContent({
        title: "Confirm Free Cancellation",
        description: <p>{eligibility.message}</p>,
        actionText: "Confirm Cancellation",
        onAction: proceedWithCancellation,
      });
    } else { 
      if (eligibility.isFinalWindow) {
        if (booking.paymentMethod !== 'Online' || booking.status === 'Pending Payment') {
          setCancellationDialogContent({
            title: "Restricted Cancellation Window",
            description: (
              <>
                <p>Cancellations made within the final restricted window before service start incur a <strong>100% cancellation fee</strong>.</p>
                <p className="mt-2 text-destructive font-semibold">You must pay the full booking amount of <strong>{feeDisplay}</strong> as a cancellation fee to proceed.</p>
              </>
            ),
            actionText: "Pay Cancellation Fee",
            onAction: proceedToPayCancellationFee,
          });
        } else { // Paid online
          setCancellationDialogContent({
            title: "No Refund Allowed",
            description: (
              <>
                <p>Cancellations made within the final restricted window before service start incur a <strong>100% cancellation fee</strong>.</p>
                <p className="mt-2 text-destructive font-semibold">No refund (₹0) will be returned as the full booking amount has been charged.</p>
              </>
            ),
            actionText: "Confirm Cancellation (No Refund)",
            onAction: proceedWithCancellation,
          });
        }
      } else if (booking.paymentMethod !== 'Online' || booking.status === 'Pending Payment') {
        setCancellationDialogContent({
          title: "Cancellation Fee Applies",
          description: (
            <>
              <p>{eligibility.message} A cancellation fee of <strong>{feeDisplay}</strong> will apply.</p>
              <p className="mt-2 font-semibold">You must pay the cancellation fee to proceed with cancellation.</p>
            </>
          ),
          actionText: "Pay Cancellation Fee",
          onAction: proceedToPayCancellationFee,
        });
      } else { // Paid online
        setCancellationDialogContent({
          title: "Confirm Cancellation with Fee",
          description: (
            <>
              <p>{eligibility.message} A cancellation fee of <strong>{feeDisplay}</strong> will be deducted.</p>
              <p className="mt-2">The remaining amount will be refunded to your original payment method (refunds may take 5-7 business days).</p>
            </>
          ),
          actionText: "Confirm & Accept Fee",
          onAction: proceedWithCancellation,
        });
      }
    }
    setShowCancellationDialog(true);
  };


  const canBeCancelledByRule = (status: BookingStatus) => {
    return status === "Pending Payment" || status === "Confirmed" || status === "Rescheduled" || status === "AssignedToProvider" || status === "ProviderAccepted" || status === "InProgressByProvider";
  };

  const shouldShowProviderDetails = (status: BookingStatus) => {
    const hiddenStatuses: BookingStatus[] = ["Completed", "Cancelled", "ProviderRejected", "Pending Payment"];
    return !hiddenStatuses.includes(status);
  };

  const handleDownloadInvoice = async (booking: FirestoreBooking) => {
    if (!booking.id) {
      toast({ title: "Error", description: "Booking data is incomplete for invoice.", variant: "destructive"});
      return;
    }
    setIsDownloadingInvoice(booking.id);
    try {
      const companyDetailsForInvoice = {
        name: globalCompanySettings?.websiteName || "Fixbro.in",
        address: globalCompanySettings?.address || "#44 G S Palya Road Konappana Agrahara Electronic City Phase 2 -560100",
        contactEmail: globalCompanySettings?.contactEmail || "support@fixbro.in",
        contactMobile: globalCompanySettings?.contactMobile || "+91-7353113455",
        logoUrl: globalCompanySettings?.logoUrl || undefined,
        timezone: appConfig?.timezone || "Asia/Kolkata",
        currencySymbol: appConfig?.currencySymbol || "₹",
        dateFormat: appConfig?.dateFormat,
      };
      await generateInvoicePdf(booking, companyDetailsForInvoice);
    } catch (error) {
      console.error("Error generating invoice:", error);
      toast({ title: "Invoice Error", description: "Could not generate the invoice PDF.", variant: "destructive"});
    } finally {
      setIsDownloadingInvoice(null);
    }
  };

  if (authLoading || isLoadingBookings || isLoadingCompanySettings || isLoadingAppSettings) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
        <p className="mt-2 text-muted-foreground">Loading your bookings...</p>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl md:text-4xl font-headline font-semibold text-foreground">
            My Bookings
          </h1>
          <Link href="/" passHref className="hidden sm:block">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
            </Button>
          </Link>
        </div>

        {myBookings.length === 0 ? (
          <div className="text-center py-12">
            <PackageSearch className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-2xl font-semibold mb-2">No Bookings Yet</h2>
            <p className="text-muted-foreground mb-6">You haven't made any bookings with Fixbro.</p>
            <Link href="/categories" passHref>
              <Button>Book Daily Labour</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {myBookings.map((booking, index) => {
              const providers: EnrichedProviderItem[] = (booking.enrichedProviders && booking.enrichedProviders.length > 0)
                ? booking.enrichedProviders
                : (booking.services || []).map((s) => ({
                    serviceId: s.serviceId,
                    name: s.name,
                    imageUrl: s.imageUrl || '/default-image.png',
                    days: Math.max(1, s.quantity || 1),
                    pricePerDay: s.pricePerUnit || s.discountedPricePerUnit || 0,
                    totalPrice: (s.pricePerUnit || s.discountedPricePerUnit || 0) * Math.max(1, s.quantity || 1),
                    categoryName: (s as any).categoryName || booking.providerDetails?.workCategoryName || '',
                    skillLevel: (s as any).skillLevel || booking.providerDetails?.skillLevelLabel || (booking.providerDetails as any)?.seniorityLevel || '',
                    experience: (s as any).experience || booking.providerDetails?.experienceLevelLabel || '',
                    mobileNumber: (s as any).mobileNumber || booking.providerDetails?.mobileNumber || '',
                    languages: (s as any).languages || booking.providerDetails?.languagesSpokenLabels || [],
                    providerDetails: booking.providerDetails,
                  }));

              const hasMultipleProviders = providers.length > 1;
              const totalDays = providers.reduce((sum, p) => sum + p.days, 0);

              return (
                <Card key={booking.id} className="shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                  <div className="flex flex-col md:flex-row">
                    {/* Service Image Section / Booked Providers List */}
                    {hasMultipleProviders ? (
                      <div className="w-full md:w-96 lg:w-[420px] p-3.5 bg-muted/10 border-b md:border-b-0 md:border-r border-border/40 flex flex-col justify-start gap-3 shrink-0">
                        <div className="flex justify-between items-center pb-2 border-b border-border/40">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-primary" />
                            <span className="text-xs sm:text-sm font-bold text-foreground uppercase tracking-wider">
                              Booked Providers ({providers.length})
                            </span>
                          </div>
                          <Badge variant="secondary" className="text-[11px] font-bold bg-primary/10 text-primary border border-primary/20">
                            {totalDays} {totalDays === 1 ? 'Day Total' : 'Days Total'}
                          </Badge>
                        </div>
                        <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                          {providers.map((p, pIdx) => (
                            <div key={p.serviceId || pIdx} className="p-3 border rounded-xl bg-background shadow-2xs hover:border-primary/30 transition-colors flex flex-col gap-2">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="relative h-12 w-12 rounded-lg overflow-hidden bg-muted shrink-0 border">
                                    <AppImage 
                                      src={p.imageUrl || "/default-image.png"} 
                                      alt={p.name}
                                      fill
                                      className="object-cover"
                                    />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-bold text-xs sm:text-sm truncate text-foreground" title={p.name}>{p.name}</p>
                                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                      {p.categoryName && (
                                        <span className="text-[10px] text-muted-foreground font-medium">{p.categoryName}</span>
                                      )}
                                      {p.skillLevel && (
                                        <Badge variant="outline" className="text-[9px] px-1 py-0 font-semibold bg-emerald-50 text-emerald-700 border-emerald-200">
                                          {p.skillLevel}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="font-bold text-xs text-foreground">{formatCurrency(p.totalPrice, symbol, decimals, code)}</p>
                                  <p className="text-[10px] text-muted-foreground">({formatCurrency(p.pricePerDay, symbol, decimals, code)} / day)</p>
                                </div>
                              </div>
                              
                              <div className="flex items-center justify-between pt-1 border-t border-border/30 text-xs">
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md">
                                  <CalendarDays className="h-3 w-3 text-primary" />
                                  Booked for {p.days} {p.days === 1 ? 'Day' : 'Days'}
                                </span>
                                <span className="text-[11px] text-muted-foreground font-medium">
                                  1 Person • {p.days} {p.days === 1 ? 'Day' : 'Days'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="relative w-full aspect-square md:w-80 md:h-auto bg-muted shrink-0 overflow-hidden group">
                        <AppImage 
                          src={providers[0]?.imageUrl || "/default-image.png"} 
                          alt={providers[0]?.name || "Provider Image"}
                          fill
                          priority={index === 0}
                          className="object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30 pointer-events-none" />
                        <div className="absolute top-3 left-3">
                          <Badge className="bg-primary/95 text-white font-bold text-xs shadow-md border-0 flex items-center gap-1.5 px-2.5 py-1">
                            <CalendarDays className="h-3.5 w-3.5" />
                            Booked for {providers[0]?.days || 1} {(providers[0]?.days || 1) === 1 ? 'Day' : 'Days'}
                          </Badge>
                        </div>
                        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between text-white">
                          <div>
                            <p className="text-xs opacity-90 font-medium">Daily Wage Rate</p>
                            <p className="text-lg font-bold">
                              {formatCurrency(providers[0]?.pricePerDay || booking.totalAmount, symbol, decimals, code)}
                              <span className="text-xs font-normal opacity-85"> / day</span>
                            </p>
                          </div>
                          {providers[0]?.skillLevel && (
                            <Badge variant="outline" className="bg-black/40 text-white border-white/40 text-[10px]">
                              {providers[0].skillLevel}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex-1 flex flex-col">
                      <CardHeader>
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                          <div>
                            <CardTitle className="text-xl font-headline flex items-center gap-2 flex-wrap">
                              {hasMultipleProviders 
                                ? `Daily Labour Booking (${providers.length} Providers)` 
                                : (providers[0]?.name || "Daily Labour Booking")
                              }
                              {hasMultipleProviders && (
                                <Badge variant="secondary" className="text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                                  {totalDays} Total Days
                                </Badge>
                              )}
                            </CardTitle>
                            {hasMultipleProviders && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {providers.map(p => `${p.name} (${p.days}d)`).join(' • ')}
                              </p>
                            )}
                          </div>
                          <Badge variant={getStatusBadgeVariant(booking.status)} className={`capitalize text-xs w-fit ${getStatusBadgeClass(booking.status)}`}>
                              {booking.status}
                          </Badge>
                        </div>
                        <CardDescription>Booking ID: {booking.bookingId}</CardDescription>
                      </CardHeader>
                    <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm flex-grow">
                  <div>
                    <p className="text-muted-foreground">Scheduled Date</p>
                    <p className="font-medium">{formatDateForDisplay(booking.scheduledDate)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Time Slot</p>
                    <p className="font-medium">{booking.scheduledTimeSlot}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-emerald-600 font-semibold">End Time</p>
                    <p className="font-bold text-emerald-700">
                      {formatEndTimeDisplay(booking.estimatedEndTime, booking.scheduledTimeSlot)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total Duration</p>
                    <p className="font-semibold text-foreground flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5 text-primary" />
                      {hasMultipleProviders 
                        ? `${totalDays} Total Days (${providers.length} Persons)`
                        : `${providers[0]?.days || 1} ${(providers[0]?.days || 1) === 1 ? 'Day' : 'Days'} (1 Person)`
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total Amount</p>
                    <p className="font-bold text-foreground text-base">{formatCurrency(booking.totalAmount, symbol, decimals, code)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Payment Method</p>
                    <p className="font-medium">
                      {(booking.paymentMethod === 'Online' || !!booking.razorpayPaymentId || !!booking.stripePaymentIntent || !!booking.stripeSessionId) ? 'Online' : 'Pay After Service'}
                    </p>
                  </div>
                  {booking.dailyTimeline && booking.dailyTimeline.length > 1 && (
                    <div className="sm:col-span-2 md:col-span-3 py-2.5 px-3 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/50 rounded-xl space-y-2 text-sm text-muted-foreground my-1">
                      <p className="font-bold text-xs text-blue-800 dark:text-blue-300 uppercase tracking-wider flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Day-by-Day Work Schedule
                      </p>
                      <div className="space-y-1.5 pl-1">
                        {booking.dailyTimeline.map((item: any, idx: number) => (
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
                    <div className="sm:col-span-2 md:col-span-3 py-2.5 px-3 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/50 rounded-xl space-y-1.5 text-xs text-muted-foreground my-1">
                      <p className="font-bold text-[10px] text-amber-800 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Includes Gaps / Holidays
                      </p>
                      <div className="space-y-1 pl-1">
                        {booking.interveningBreaks.map((item: any, idx: number) => (
                          <div key={idx} className="flex items-start gap-2">
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
                  <div className="sm:col-span-2 md:col-span-3">
                    <p className="text-muted-foreground">Booked On</p>
                    <p className="font-medium">{formatBookingTimestamp(booking.createdAt)}</p>
                  </div>

                  {/* Dual OTP Job Security Box for Customers */}
                  {(booking.status === 'Confirmed' || booking.status === 'AssignedToProvider' || booking.status === 'ProviderAccepted') && booking.startOtp && (
                    <div className="sm:col-span-2 md:col-span-3 p-3.5 bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <KeyRound className="h-4 w-4 text-emerald-600" />
                          <span className="font-bold text-sm text-emerald-800 dark:text-emerald-300">Job Start OTP</span>
                        </div>
                        <p className="text-xs text-emerald-700 dark:text-emerald-400">
                          Share this 4-digit code with your daily labour provider when they arrive on-site to begin work.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 px-4 py-2 rounded-lg border border-emerald-300 shadow-sm shrink-0">
                        <span className="text-xl font-mono font-extrabold tracking-widest text-emerald-600">{booking.startOtp}</span>
                      </div>
                    </div>
                  )}

                  {booking.status === 'InProgressByProvider' && (
                    <div className="sm:col-span-2 md:col-span-3 p-3.5 bg-blue-50/80 dark:bg-blue-950/30 border border-blue-300 dark:border-blue-800 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <KeyRound className="h-4 w-4 text-blue-600" />
                          <span className="font-bold text-sm text-blue-800 dark:text-blue-300">Job Completion OTP</span>
                          <Badge variant="outline" className="bg-blue-100 text-blue-700 text-[10px] uppercase font-bold border-blue-300">
                            Work In Progress
                          </Badge>
                        </div>
                        <p className="text-xs text-blue-700 dark:text-blue-400">
                          Share this code with your provider ONLY when all scheduled work is fully completed.
                        </p>
                        {booking.workStartedAt && (
                          <p className="text-[11px] text-muted-foreground pt-0.5">
                            Work started: {formatBookingTimestamp(booking.workStartedAt)}
                          </p>
                        )}
                      </div>
                      {booking.completeOtp && (
                        <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 px-4 py-2 rounded-lg border border-blue-300 shadow-sm shrink-0">
                          <span className="text-xl font-mono font-extrabold tracking-widest text-blue-600">{booking.completeOtp}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {booking.status === 'Completed' && (booking.workedDuration || booking.workStartedAt) && (
                    <div className="sm:col-span-2 md:col-span-3 p-3 bg-muted/40 border rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4 text-primary" />
                        <span>Work Duration: <strong className="text-foreground">{booking.workedDuration || 'Full Day'}</strong></span>
                      </div>
                      {booking.workStartedAt && booking.workCompletedAt && (
                        <span className="text-muted-foreground">
                          ({formatTimeInTimezone(new Date(getTimestampMillis(booking.workStartedAt)), 'Asia/Kolkata')} – {formatTimeInTimezone(new Date(getTimestampMillis(booking.workCompletedAt)), 'Asia/Kolkata')})
                        </span>
                      )}
                    </div>
                  )}

                  {shouldShowProviderDetails(booking.status) && (
                    hasMultipleProviders ? (
                      <div className="sm:col-span-2 md:col-span-3 pt-4 border-t space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-md font-semibold text-foreground flex items-center gap-2">
                            <Users className="h-4 w-4 text-primary" /> Your Assigned Providers ({providers.length})
                          </h4>
                          <span className="text-xs text-muted-foreground font-medium">
                            {totalDays} {totalDays === 1 ? 'Working Day Total' : 'Working Days Total'}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                          {providers.map((p, idx) => (
                            <div key={p.serviceId || idx} className="p-3.5 rounded-xl border bg-muted/20 hover:bg-muted/30 transition-colors">
                              {/* Mobile View */}
                              <div className="sm:hidden space-y-2.5">
                                {/* Line 1: Avatar + Name + Badges + Days */}
                                <div className="flex items-start gap-3">
                                  <Avatar className="h-12 w-12 shrink-0 border shadow-2xs">
                                    <AvatarImage src={p.imageUrl || undefined} alt={p.name} />
                                    <AvatarFallback><UserCircle className="h-6 w-6" /></AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-1">
                                      <p className="font-bold text-base text-foreground leading-tight truncate">{p.name}</p>
                                      <Badge variant="secondary" className="text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 shrink-0">
                                        {p.days} {p.days === 1 ? 'Day' : 'Days'}
                                      </Badge>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                      {p.categoryName && (
                                        <Badge variant="secondary" className="text-[10px] font-semibold px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200">
                                          {p.categoryName}
                                        </Badge>
                                      )}
                                      {p.skillLevel && (
                                        <Badge variant="outline" className="text-[10px] font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200">
                                          {p.skillLevel}
                                        </Badge>
                                      )}
                                      {p.experience && (
                                        <Badge variant="outline" className="text-[10px] font-semibold px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200">
                                          {p.experience}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Line 2: Languages */}
                                {p.languages && p.languages.length > 0 && (
                                  <div className="pt-0.5">
                                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                      <Languages className="h-3.5 w-3.5 text-primary shrink-0"/> 
                                      <span>{p.languages.join(', ')}</span>
                                    </p>
                                  </div>
                                )}

                                {/* Line 3: Call Button */}
                                {p.mobileNumber && (
                                  <div className="pt-1">
                                    {booking.status === 'AssignedToProvider' ? (
                                      <Button variant="outline" size="sm" className="w-full text-xs font-semibold py-2" disabled title="Awaiting provider acceptance">
                                        <Phone className="mr-2 h-4 w-4" /> Call {p.name.split(' ')[0]} (Awaiting Accept)
                                      </Button>
                                    ) : (
                                      <a href={`tel:${p.mobileNumber}`} className="block w-full">
                                        <Button variant="outline" size="sm" className="w-full text-xs font-semibold py-2">
                                          <Phone className="mr-2 h-4 w-4 text-emerald-600" /> Call {p.name.split(' ')[0]}
                                        </Button>
                                      </a>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Desktop View */}
                              <div className="hidden sm:flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3.5">
                                  <Avatar className="h-14 w-14 shrink-0 border shadow-2xs">
                                    <AvatarImage src={p.imageUrl || undefined} alt={p.name} />
                                    <AvatarFallback><UserCircle className="h-7 w-7" /></AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className="font-bold text-base text-foreground">{p.name}</p>
                                      <Badge variant="secondary" className="text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                                        {p.days} {p.days === 1 ? 'Day Booked' : 'Days Booked'}
                                      </Badge>
                                      {p.categoryName && (
                                        <Badge variant="secondary" className="text-[10px] font-semibold px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200">
                                          {p.categoryName}
                                        </Badge>
                                      )}
                                      {p.skillLevel && (
                                        <Badge variant="outline" className="text-[10px] font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200">
                                          {p.skillLevel}
                                        </Badge>
                                      )}
                                      {p.experience && (
                                        <Badge variant="outline" className="text-[10px] font-semibold px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200">
                                          {p.experience}
                                        </Badge>
                                      )}
                                    </div>
                                    {p.languages && p.languages.length > 0 && (
                                      <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                                        <Languages className="h-3.5 w-3.5 text-primary shrink-0"/> 
                                        <span>{p.languages.join(', ')}</span>
                                      </p>
                                    )}
                                  </div>
                                </div>
                                {p.mobileNumber && (
                                  <div className="shrink-0">
                                    {booking.status === 'AssignedToProvider' ? (
                                      <Button variant="outline" size="sm" disabled title="Awaiting provider acceptance">
                                        <Phone className="mr-2 h-4 w-4" /> Call {p.name.split(' ')[0]} (Awaiting)
                                      </Button>
                                    ) : (
                                      <a href={`tel:${p.mobileNumber}`}>
                                        <Button variant="outline" size="sm">
                                          <Phone className="mr-2 h-4 w-4 text-emerald-600" /> Call {p.name.split(' ')[0]}
                                        </Button>
                                      </a>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      (booking.providerDetails || providers[0]) && (
                        <div className="sm:col-span-2 md:col-span-3 pt-4 border-t">
                          <div className="flex items-center justify-between mb-2.5">
                            <h4 className="text-md font-semibold text-foreground">Your Provider</h4>
                            <Badge variant="secondary" className="text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                              {providers[0]?.days || 1} {(providers[0]?.days || 1) === 1 ? 'Day Booked' : 'Days Booked'}
                            </Badge>
                          </div>
                          
                          {/* Mobile View Layout (Line 1: Name + Badges, Line 2: Languages, Line 3: Call Button) */}
                          <div className="sm:hidden space-y-2.5">
                            {/* Line 1: Avatar + Name (Full Width) & Badges */}
                            <div className="flex items-start gap-3">
                              <Avatar className="h-12 w-12 shrink-0 border shadow-2xs">
                                <AvatarImage src={booking.providerDetails?.profilePhotoUrl || providers[0]?.imageUrl || undefined} alt={booking.providerDetails?.fullName || providers[0]?.name} />
                                <AvatarFallback><UserCircle className="h-6 w-6" /></AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-base text-foreground leading-tight">{booking.providerDetails?.fullName || providers[0]?.name}</p>
                                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                  {(booking.providerDetails?.workCategoryName || providers[0]?.categoryName) && (
                                    <Badge variant="secondary" className="text-[10px] font-semibold px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200">
                                      {booking.providerDetails?.workCategoryName || providers[0]?.categoryName}
                                    </Badge>
                                  )}
                                  {(booking.providerDetails?.skillLevelLabel || (booking.providerDetails as any)?.seniorityLevel || providers[0]?.skillLevel) && (
                                    <Badge variant="outline" className="text-[10px] font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      {booking.providerDetails?.skillLevelLabel || (booking.providerDetails as any)?.seniorityLevel || providers[0]?.skillLevel}
                                    </Badge>
                                  )}
                                  {(booking.providerDetails?.experienceLevelLabel || (booking.providerDetails as any)?.experienceYearsLabel || (booking.providerDetails as any)?.experience || providers[0]?.experience) && (
                                    <Badge variant="outline" className="text-[10px] font-semibold px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200">
                                      {booking.providerDetails?.experienceLevelLabel || (booking.providerDetails as any)?.experienceYearsLabel || (booking.providerDetails as any)?.experience || providers[0]?.experience}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Line 2: Languages */}
                            {((booking.providerDetails?.languagesSpokenLabels && booking.providerDetails.languagesSpokenLabels.length > 0) || (providers[0]?.languages && providers[0].languages.length > 0)) && (
                              <div className="pt-0.5">
                                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                  <Languages className="h-3.5 w-3.5 text-primary shrink-0"/> 
                                  <span>{(booking.providerDetails?.languagesSpokenLabels || providers[0]?.languages || []).join(', ')}</span>
                                </p>
                              </div>
                            )}

                            {/* Line 3: Call Button (Full Width on mobile) */}
                            {(booking.providerDetails?.mobileNumber || providers[0]?.mobileNumber) && (
                              <div className="pt-1">
                                {booking.status === 'AssignedToProvider' ? (
                                  <Button variant="outline" size="sm" className="w-full text-xs font-semibold py-2" disabled title="Awaiting provider acceptance">
                                    <Phone className="mr-2 h-4 w-4" /> Call (Awaiting Accept)
                                  </Button>
                                ) : (
                                  <a href={`tel:${booking.providerDetails?.mobileNumber || providers[0]?.mobileNumber}`} className="block w-full">
                                    <Button variant="outline" size="sm" className="w-full text-xs font-semibold py-2">
                                      <Phone className="mr-2 h-4 w-4 text-emerald-600" /> Call Provider
                                    </Button>
                                  </a>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Desktop View Layout */}
                          <div className="hidden sm:flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3.5">
                              <Avatar className="h-14 w-14 shrink-0 border shadow-2xs">
                                <AvatarImage src={booking.providerDetails?.profilePhotoUrl || providers[0]?.imageUrl || undefined} alt={booking.providerDetails?.fullName || providers[0]?.name} />
                                <AvatarFallback><UserCircle className="h-7 w-7" /></AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-bold text-base text-foreground">{booking.providerDetails?.fullName || providers[0]?.name}</p>
                                  {(booking.providerDetails?.workCategoryName || providers[0]?.categoryName) && (
                                    <Badge variant="secondary" className="text-[10px] font-semibold px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200">
                                      {booking.providerDetails?.workCategoryName || providers[0]?.categoryName}
                                    </Badge>
                                  )}
                                  {(booking.providerDetails?.skillLevelLabel || (booking.providerDetails as any)?.seniorityLevel || providers[0]?.skillLevel) && (
                                    <Badge variant="outline" className="text-[10px] font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      {booking.providerDetails?.skillLevelLabel || (booking.providerDetails as any)?.seniorityLevel || providers[0]?.skillLevel}
                                    </Badge>
                                  )}
                                  {(booking.providerDetails?.experienceLevelLabel || (booking.providerDetails as any)?.experienceYearsLabel || (booking.providerDetails as any)?.experience || providers[0]?.experience) && (
                                    <Badge variant="outline" className="text-[10px] font-semibold px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200">
                                      {booking.providerDetails?.experienceLevelLabel || (booking.providerDetails as any)?.experienceYearsLabel || (booking.providerDetails as any)?.experience || providers[0]?.experience}
                                    </Badge>
                                  )}
                                </div>
                                {((booking.providerDetails?.languagesSpokenLabels && booking.providerDetails.languagesSpokenLabels.length > 0) || (providers[0]?.languages && providers[0].languages.length > 0)) && (
                                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                                    <Languages className="h-3.5 w-3.5 text-primary shrink-0"/> 
                                    <span>{(booking.providerDetails?.languagesSpokenLabels || providers[0]?.languages || []).join(', ')}</span>
                                  </p>
                                )}
                              </div>
                            </div>
                            {(booking.providerDetails?.mobileNumber || providers[0]?.mobileNumber) && (
                              <div className="shrink-0">
                                {booking.status === 'AssignedToProvider' ? (
                                  <Button variant="outline" size="sm" disabled title="Awaiting provider acceptance">
                                    <Phone className="mr-2 h-4 w-4" /> Call (Awaiting Accept)
                                  </Button>
                                ) : (
                                  <a href={`tel:${booking.providerDetails?.mobileNumber || providers[0]?.mobileNumber}`}>
                                    <Button variant="outline" size="sm">
                                      <Phone className="mr-2 h-4 w-4 text-emerald-600" /> Call
                                    </Button>
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    )
                  )}
                  </CardContent>
                  <CardFooter className="flex flex-col sm:flex-row justify-end items-stretch sm:items-center gap-2 pb-6">

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto text-xs font-semibold gap-1.5"
                    onClick={() => setIsRulesModalOpen(true)}
                  >
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Booking Rules
                  </Button>

                  {booking.status === "Completed" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto"
                      onClick={() => handleDownloadInvoice(booking)}
                      disabled={isDownloadingInvoice === booking.id}
                    >
                      {isDownloadingInvoice === booking.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
                      Download Invoice
                    </Button>
                  )}
                  {canBeCancelledByRule(booking.status) && (
                    <Button 
                        variant="destructive" 
                        size="sm" 
                        className="w-full sm:w-auto"
                        onClick={() => openCancellationDialog(booking)}
                        disabled={isCancelling === booking.id}
                    >
                        {isCancelling === booking.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Ban className="mr-1 h-4 w-4" />}
                        Cancel Booking
                    </Button>
                  )}
                  </CardFooter>
                  </div>
                  </div>
                  </Card>
              );
            })}

          </div>
        )}
      </div>
      {cancellationDialogContent && (
        <AlertDialog open={showCancellationDialog} onOpenChange={setShowCancellationDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{cancellationDialogContent.title}</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div>{cancellationDialogContent.description}</div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => { setShowCancellationDialog(false); setSelectedBookingForCancel(null);}}>No</AlertDialogCancel>
              {cancellationDialogContent.onAction && (
                <AlertDialogAction onClick={cancellationDialogContent.onAction} className={cancellationDialogContent.title.toLowerCase().includes("fee") && !cancellationDialogContent.title.toLowerCase().includes("free") ? "bg-destructive hover:bg-destructive/90" : ""}>
                  {cancellationDialogContent.actionText || "Confirm"}
                </AlertDialogAction>
              )}
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Booking Guidelines & Rules Modal */}
      <BookingRulesView
        mode="modal"
        isOpen={isRulesModalOpen}
        onClose={() => setIsRulesModalOpen(false)}
      />
    </ProtectedRoute>
  );
}

