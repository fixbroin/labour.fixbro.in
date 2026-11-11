
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tag, Eye, Loader2, PackageSearch, XCircle, Edit, Trash2, CalendarDays, Clock, UserCheck2, MoreHorizontal, Users, UserX, ListOrdered, ChevronDown, Search, MapPin, Phone, Mail, IndianRupee, History, PlusCircle, ShieldCheck, AlertTriangle, Check, ChevronsUpDown, Zap, Layers } from "lucide-react"; 
import type { FirestoreBooking, BookingStatus, BookingServiceItem, AppSettings, ProviderApplication, FirestoreNotification, MarketingAutomationSettings, ReferralSettings, FirestoreUser, Referral, DayAvailability } from '@/types/firestore';
import { db } from '@/lib/firebase';
import { triggerPushNotification } from '@/lib/fcmUtils';
import { 
  collection, 
 query, orderBy, onSnapshot, doc, updateDoc, Timestamp, deleteDoc, where, getDocs, deleteField, addDoc, getDoc, runTransaction, limit, startAfter, type QueryDocumentSnapshot } from '@/lib/mysqlDb';
import { useToast } from "@/hooks/use-toast";
import BookingDetailsModalContent from '@/components/admin/BookingDetailsModalContent';
import EditBookingModal from '@/components/admin/EditBookingModal';
import { openWhatsAppChooser } from '@/lib/whatsappUtils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { generateInvoicePdf as generateInvoicePdfForDownload } from '@/lib/invoiceGenerator'; 
import { useApplicationConfig } from '@/hooks/useApplicationConfig';
import { useGlobalSettings } from "@/hooks/useGlobalSettings";
import { recalculateProviderStatsAction, updateBookingStatusByProviderAction } from '@/app/actions/providerWalletActions';
import AssignProviderModal from '@/components/admin/AssignProviderModal'; 
import { Badge } from '@/components/ui/badge';
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { cn, formatDateInTimezone, formatTimeInTimezone, formatCurrency, getBookingScheduledTimestamp, formatEndTimeDisplay } from '@/lib/utils';
import AppImage from '@/components/ui/AppImage';
import { getDashboardData, getArchivedBookings, type DashboardData } from '@/lib/adminDashboardUtils';
import { triggerRefresh } from '@/lib/revalidateUtils';
import CompleteBookingDialog from '@/components/shared/CompleteBookingDialog';
import RescheduleBookingDialog from '@/components/shared/RescheduleBookingDialog';
import { useAdminStats } from '@/hooks/useAdminStats';
import { initializeBookingNumbers, resequenceBookingNumbers } from '@/lib/systemStatsUtils';
import { hasActionPermission } from '@/config/rbac';
import { useAuth } from '@/hooks/useAuth';
import PermissionGuard from '@/components/admin/PermissionGuard';

const statusOptions: BookingStatus[] = [
  "Pending Payment", "Confirmed", "AssignedToProvider", "ProviderAccepted", 
  "ProviderRejected", "InProgressByProvider", "Processing", "Completed", "Cancelled", "Rescheduled"
];

const formatDateForDisplay = (dateString: string | undefined): string => {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString.replace(/-/g, '/')); 
        return formatDateInTimezone(date);
    } catch (e) { return dateString; }
};

const getStatusBadgeVariant = (status: BookingStatus) => {
    switch (status) {
      case 'Completed': return 'default';
      case 'Confirmed': case 'ProviderAccepted': case 'AssignedToProvider': case 'InProgressByProvider': return 'default'; 
      case 'Pending Payment': case 'Rescheduled': case 'Processing': return 'secondary';
      case 'Cancelled': case 'ProviderRejected': return 'destructive';
      default: return 'outline';
    }
};

const getStatusBadgeClass = (status: BookingStatus) => {
    switch (status) {
        case 'Completed': return 'bg-green-500 text-white hover:bg-green-600';
        case 'Confirmed': case 'ProviderAccepted': case 'AssignedToProvider': case 'InProgressByProvider': return 'bg-blue-500 text-white hover:bg-blue-600';
        case 'Pending Payment': case 'Rescheduled': return 'bg-orange-500 text-white hover:bg-orange-600';
        case 'Processing': return 'bg-purple-500 text-white hover:bg-purple-600';
        case 'Cancelled': case 'ProviderRejected': return 'bg-red-500 text-white hover:bg-red-600';
        default: return '';
    }
};

const getCoverageBadge = (booking: FirestoreBooking) => {
    if (booking.coverageType === 'provider_match') {
        return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold">Provider Match</Badge>;
    }
    if (booking.coverageType === 'admin_only') {
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-bold flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Manual Dispatch</Badge>;
    }
    return null;
};

const getQueueBadge = (pos?: number) => {
  if (!pos) return null;
  if (pos === 1) {
    return (
      <Badge className="bg-red-600 text-white hover:bg-red-700 font-extrabold text-[11px] px-2.5 py-0.5 shadow-sm border border-red-400 whitespace-nowrap">
        🥇 #1 DUE FIRST
      </Badge>
    );
  }
  if (pos === 2) {
    return (
      <Badge className="bg-amber-600 text-white hover:bg-amber-700 font-extrabold text-[11px] px-2.5 py-0.5 shadow-sm border border-amber-400 whitespace-nowrap">
        🥈 #2 DUE NEXT
      </Badge>
    );
  }
  if (pos === 3) {
    return (
      <Badge className="bg-yellow-600 text-white hover:bg-yellow-700 font-extrabold text-[11px] px-2.5 py-0.5 shadow-sm border border-yellow-400 whitespace-nowrap">
        🥉 #3 DUE THIRD
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="font-bold text-[10px] px-2 py-0.5 bg-background border-muted-foreground/30 text-foreground whitespace-nowrap">
      #{pos} DUE
    </Badge>
  );
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

const getDayCategoryBadge = (dayCat: 'today' | 'tomorrow' | 'dayAfter' | 'later', isCompleted: boolean) => {
  if (isCompleted) return null;
  switch (dayCat) {
    case 'today':
      return <Badge className="bg-red-600 text-white font-black text-[10px] uppercase tracking-wider animate-pulse border-red-500 shadow-sm flex items-center gap-1 whitespace-nowrap">🚨 TODAY - URGENT</Badge>;
    case 'tomorrow':
      return <Badge className="bg-amber-600 text-white font-bold text-[10px] uppercase tracking-wider border-amber-500 shadow-sm flex items-center gap-1 whitespace-nowrap">⏰ TOMORROW</Badge>;
    case 'dayAfter':
      return <Badge className="bg-emerald-600 text-white font-bold text-[10px] uppercase tracking-wider border-emerald-500 shadow-sm flex items-center gap-1 whitespace-nowrap">📅 IN 2 DAYS</Badge>;
    default:
      return null;
  }
};

const getDayBorderClass = (dayCat: 'today' | 'tomorrow' | 'dayAfter' | 'later', isCompleted: boolean) => {
  if (isCompleted) return "border-l-4 border-l-gray-400";
  switch (dayCat) {
    case 'today':
      return "border-l-4 border-l-red-600 border-red-200 dark:border-red-950 bg-red-500/5 shadow-red-100/50";
    case 'tomorrow':
      return "border-l-4 border-l-amber-500 border-amber-200 dark:border-amber-950 bg-amber-500/5 shadow-amber-100/50";
    case 'dayAfter':
      return "border-l-4 border-l-emerald-500 border-emerald-200 dark:border-emerald-950 bg-emerald-500/5 shadow-emerald-100/50";
    default:
      return "border-l-4 border-l-primary/60 border-border";
  }
};

const getDayDateBoxClass = (dayCat: 'today' | 'tomorrow' | 'dayAfter' | 'later') => {
  switch (dayCat) {
    case 'today':
      return "border-2 border-red-500/70 bg-red-500/10 text-red-800 dark:text-red-300";
    case 'tomorrow':
      return "border-2 border-amber-500/70 bg-amber-500/10 text-amber-900 dark:text-amber-300";
    case 'dayAfter':
      return "border-2 border-emerald-500/70 bg-emerald-500/10 text-emerald-900 dark:text-emerald-300";
    default:
      return "border-2 border-primary/40 bg-primary/5 text-primary";
  }
};

const getPaymentBadgeClass = (method: string | undefined, status: string, booking?: any) => {
    const hasVerifiedOnlineProof = !!(booking?.razorpayPaymentId || booking?.stripePaymentIntent || booking?.stripeSessionId);
    const isMarkedOnline = (method || '').toLowerCase().trim() === 'online';

    if (hasVerifiedOnlineProof) {
      return 'bg-green-50 text-green-700 border-green-200 hover:bg-green-50';
    }
    if (isMarkedOnline && !hasVerifiedOnlineProof) {
      return 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-50';
    }
    if (status === 'Completed') return 'bg-green-50 text-green-700 border-green-200 hover:bg-green-50';
    return 'bg-red-50 text-red-700 border-red-200 hover:bg-red-50';
};

const getPaymentLabel = (method: string | undefined, status: string, booking?: any) => {
    const hasVerifiedOnlineProof = !!(booking?.razorpayPaymentId || booking?.stripePaymentIntent || booking?.stripeSessionId);
    const isMarkedOnline = (method || '').toLowerCase().trim() === 'online';
    const hasExtra = booking?.additionalCharges && booking.additionalCharges.length > 0;

    if (hasVerifiedOnlineProof) {
      if (status === 'Completed') {
        return hasExtra ? 'Paid (Online + Extra Cash)' : 'Paid (Online)';
      }
      return hasExtra ? 'Online + Extra Cash' : 'Online';
    }
    if (isMarkedOnline && !hasVerifiedOnlineProof) {
      return status === 'Completed' ? 'Pay After Service (No Online TXN)' : 'Unpaid (Online Abandoned)';
    }
    return status === 'Completed' ? 'Paid (Pay After Service)' : 'Pay After Service';
};

const PAGE_SIZE = 10;

function getBookingTimestampMillis(b: FirestoreBooking): number {
  const dateStr = b.scheduledDate || (b as any).bookingDate;
  const timeStr = b.scheduledTimeSlot || (b as any).bookingTime;

  if (dateStr) {
    try {
      const dateParts = dateStr.split('-').map(Number);
      if (dateParts.length === 3) {
        let timeHours = 12;
        let timeMinutes = 0;
        if (timeStr) {
          const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
          if (match) {
            let h = parseInt(match[1], 10);
            const m = parseInt(match[2], 10);
            const ampm = match[3]?.toUpperCase();
            if (ampm === 'PM' && h < 12) h += 12;
            if (ampm === 'AM' && h === 12) h = 0;
            timeHours = h;
            timeMinutes = m;
          }
        }
        return new Date(dateParts[0], dateParts[1] - 1, dateParts[2], timeHours, timeMinutes).getTime();
      }
    } catch (e) {}
  }
  if (b.createdAt) {
    if (typeof (b.createdAt as any)._seconds === 'number') {
      return (b.createdAt as any)._seconds * 1000;
    }
    if (b.createdAt instanceof Date) {
      return (b.createdAt as Date).getTime();
    }
  }
  return 0;
}

export default function AdminBookingsPage() {
  const { stats } = useAdminStats();
  const { adminPermissions, user } = useAuth();
  const [bookings, setBookings] = useState<FirestoreBooking[]>([]);
  const [displayLimit, setDisplayLimit] = useState(50);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<BookingStatus | "All">("All");
  const [filterCategory, setFilterCategory] = useState<string>("All");
  const [isFilterCategoryPickerOpen, setIsFilterCategoryPickerOpen] = useState(false);

  // Category and Provider metadata
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [serviceCategoryMap, setServiceCategoryMap] = useState<Record<string, string>>({});
  const [categoryNameMap, setCategoryNameMap] = useState<Record<string, string>>({});
  const [providerNames, setProviderNames] = useState<Record<string, string>>({});

  const searchParams = useSearchParams();
  const urlSearch = searchParams?.get('search') || '';
  const urlOpenBookingId = searchParams?.get('openBookingId') || searchParams?.get('bookingId') || '';

  const [searchTerm, setSearchTerm] = useState(urlSearch || urlOpenBookingId || "");
  const { toast } = useToast();
  const router = useRouter();
  const [selectedBooking, setSelectedBooking] = useState<FirestoreBooking | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const { config: appConfig, isLoading: isLoadingAppSettings } = useApplicationConfig();

  // Load category hierarchy & provider names
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [catsSnap, subCatsSnap, servicesSnap, providersSnap] = await Promise.all([
          getDocs(collection(db, "adminCategories")),
          getDocs(collection(db, "adminSubCategories")),
          getDocs(collection(db, "adminServices")),
          getDocs(collection(db, "providerApplications")),
        ]);

        const cNameMap: Record<string, string> = {};
        const catList: { id: string; name: string }[] = [];
        catsSnap.docs.forEach(d => {
          const data = d.data();
          cNameMap[d.id] = data.name;
          catList.push({ id: d.id, name: data.name });
        });

        const subToCatMap: Record<string, string> = {};
        subCatsSnap.docs.forEach(d => {
          const data = d.data();
          if (data.parentId && cNameMap[data.parentId]) {
            subToCatMap[d.id] = cNameMap[data.parentId];
          }
        });

        const sToCatMap: Record<string, string> = {};
        servicesSnap.docs.forEach(d => {
          const data = d.data();
          if (data.subCategoryId && subToCatMap[data.subCategoryId]) {
            sToCatMap[d.id] = subToCatMap[data.subCategoryId];
          } else if (data.parentCategoryId && cNameMap[data.parentCategoryId]) {
            sToCatMap[d.id] = cNameMap[data.parentCategoryId];
          }
        });

        const pMap: Record<string, string> = {};
        providersSnap.docs.forEach(doc => {
          const d = doc.data();
          pMap[doc.id] = d.fullName || d.name || d.mobileNumber || 'Provider';
        });

        setCategories(catList);
        setCategoryNameMap(cNameMap);
        setServiceCategoryMap(sToCatMap);
        setProviderNames(pMap);
      } catch (err) {
        console.error("Error loading booking metadata (categories/providers):", err);
      }
    };

    fetchMetadata();
  }, []);

  useEffect(() => {
    fetch('/api/bookings/cancel-pending-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sweepStale: true }),
    })
      .then(res => res.json())
      .then(data => {
        if (data?.deletedCount > 0) {
          setRefreshTrigger(prev => prev + 1);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if ((urlSearch || urlOpenBookingId) && !searchTerm) {
      setSearchTerm(urlSearch || urlOpenBookingId);
    }
  }, [urlSearch, urlOpenBookingId]);

  useEffect(() => {
    if (!urlOpenBookingId) return;

    if (bookings.length > 0) {
      const target = bookings.find(b => 
        b.bookingId === urlOpenBookingId || 
        b.id === urlOpenBookingId || 
        b.bookingNumber?.toString() === urlOpenBookingId
      );
      if (target) {
        setSelectedBooking(target);
        setIsDetailsModalOpen(true);
        setTimeout(() => {
          const el = document.getElementById(`booking-row-${target.id || target.bookingId}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 300);
        return;
      }
    }

    // Fallback: direct fetch if booking is not in current in-memory list
    if (!isLoading) {
      (async () => {
        try {
          const directDoc = await getDoc(doc(db, "bookings", urlOpenBookingId));
          if (directDoc.exists()) {
            const data = { ...directDoc.data(), id: directDoc.id } as FirestoreBooking;
            setSelectedBooking(data);
            setIsDetailsModalOpen(true);
            return;
          }

          const q = query(collection(db, "bookings"), where("bookingId", "==", urlOpenBookingId), limit(1));
          const qSnap = await getDocs(q);
          if (!qSnap.empty) {
            const data = { ...qSnap.docs[0].data(), id: qSnap.docs[0].id } as FirestoreBooking;
            setSelectedBooking(data);
            setIsDetailsModalOpen(true);
          }
        } catch (e) {
          console.error("Error fetching single booking for modal:", e);
        }
      })();
    }
  }, [urlOpenBookingId, bookings, isLoading]);
  const symbol = appConfig?.currencySymbol || 'â‚¹';
  const decimals = appConfig?.currencyDecimalPoints !== undefined ? appConfig.currencyDecimalPoints : 2;
  const code = appConfig?.currencyCode || 'INR';

  const formatDateForDisplay = useCallback((dateString: string | undefined): string => {
    if (!dateString) return 'N/A';
    // For YYYY-MM-DD strings, we want to treat them as local to the business timezone
    if (dateString.includes('-')) {
        const [y, m, d] = dateString.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        return formatDateInTimezone(dateObj, appConfig.timezone);
    }
    return formatDateInTimezone(dateString, appConfig.timezone);
  }, [appConfig.timezone]);

  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [bookingToAssign, setBookingToAssign] = useState<FirestoreBooking | null>(null);

  const [isCompleteDialogOpen, setIsCompleteDialogOpen] = useState(false);
  const [bookingToComplete, setBookingToComplete] = useState<FirestoreBooking | null>(null);

  const [isRescheduleDialogOpen, setIsRescheduleDialogOpen] = useState(false);
  const [bookingToReschedule, setBookingToReschedule] = useState<FirestoreBooking | null>(null);
  const [bookingToChangeStatus, setBookingToChangeStatus] = useState<FirestoreBooking | null>(null);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [isFilterStatusPickerOpen, setIsFilterStatusPickerOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [bookingToEditId, setBookingToEditId] = useState<string | null>(null);

  const handleSyncIDs = async () => {
    setIsSyncing(true);
    try {
      const result = await resequenceBookingNumbers();
      if (result.success) {
        toast({ title: "Sync Complete", description: `Successfully re-sequenced ${result.count} bookings.` });
        await triggerRefresh('global-cache');
        setRefreshTrigger(prev => prev + 1);
      } else {
        toast({ title: "Sync Failed", description: result.error, variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleInitialize = async () => {
    setIsInitializing(true);
    try {
      const result = await initializeBookingNumbers();
      if (result.success) {
        toast({ title: "Initialization Complete", description: `Successfully assigned Booking IDs to ${result.count} bookings.` });
        await triggerRefresh('global-cache');
        setRefreshTrigger(prev => prev + 1);
      } else {
        toast({ title: "Initialization Failed", description: result.error, variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setIsInitializing(false);
    }
  };

  const handleWhatsAppClick = (booking: FirestoreBooking) => {
    if (booking.customerPhone) {
      const message = `Hi ${booking.customerName}, I'm contacting you from Fixbro regarding your booking #${booking.bookingId}.`;
      openWhatsAppChooser(booking.customerPhone, message);
    }
  };

  useEffect(() => {
    setDisplayLimit(50);
    if (searchTerm.trim().length > 0) {
      const delayDebounceFn = setTimeout(async () => {
        setIsLoading(true);
        try {
          const bookingsRef = collection(db, "bookings");
          const term = searchTerm.trim();
          const lowerTerm = term.toLowerCase();
          const upperTerm = term.toUpperCase();
          const capitalizedTerm = term.charAt(0).toUpperCase() + term.slice(1);
          
          // 1. Exact Match for Doc ID (fastest)
          const docRef = doc(db, "bookings", term);
          const docSnap = await getDoc(docRef);
          
          let results: FirestoreBooking[] = [];
          if (docSnap.exists()) {
            results.push({ ...docSnap.data(), id: docSnap.id } as FirestoreBooking);
          }

          // 2. Range Queries for prefix matching
          const queries = [
            query(bookingsRef, where("bookingId", ">=", upperTerm), where("bookingId", "<=", upperTerm + '\uf8ff')),
            query(bookingsRef, where("bookingId", ">=", term), where("bookingId", "<=", term + '\uf8ff')),
            query(bookingsRef, where("customerName", ">=", term), where("customerName", "<=", term + '\uf8ff')),
            query(bookingsRef, where("customerName", ">=", capitalizedTerm), where("customerName", "<=", capitalizedTerm + '\uf8ff')),
            query(bookingsRef, where("customerPhone", ">=", term), where("customerPhone", "<=", term + '\uf8ff')),
          ];

          // Phone variations and bookingNumber matching
          if (/^\d+$/.test(term)) {
            const numTerm = parseInt(term, 10);
            queries.push(query(bookingsRef, where("bookingNumber", "==", numTerm)));
            queries.push(query(bookingsRef, where("customerPhone", ">=", `91${term}`), where("customerPhone", "<=", `91${term}` + '\uf8ff')));
            queries.push(query(bookingsRef, where("customerPhone", ">=", `+91${term}`), where("customerPhone", "<=", `+91${term}` + '\uf8ff')));
            
            if (term.startsWith('91') && term.length > 2) {
              const without91 = term.substring(2);
              queries.push(query(bookingsRef, where("customerPhone", ">=", without91), where("customerPhone", "<=", without91 + '\uf8ff')));
            }
          }

          const snapShots = await Promise.all(queries.map(q => getDocs(q)));
          snapShots.forEach(snap => snap.docs.forEach(ds => results.push({ ...ds.data(), id: ds.id } as FirestoreBooking)));
          
          const uniqueResults = Array.from(new Map(results.map(b => [b.id, b])).values());
          setBookings(uniqueResults);
          setHasMore(false);
        } catch (error) { 
          console.error("Search error:", error); 
        } finally { 
          setIsLoading(false); 
        }
      }, 400);
      return () => clearTimeout(delayDebounceFn);
    } else {
// ... existing fetchInitialBookings logic
// ... (I'll keep the rest as it was but ensure the return is consistent)
      const fetchInitialBookings = async () => {
        setIsLoading(true);
        try {
          const q = query(collection(db, "bookings"), orderBy("bookingNumber", "desc"));
          const snapshot = await getDocs(q);
          setBookings(snapshot.docs.map(docSnap => ({ ...docSnap.data(), id: docSnap.id } as FirestoreBooking)));
          setHasMore(false);
        } catch (error) {
          console.error("Error fetching bookings:", error);
          toast({ title: "Error", description: "Failed to load bookings.", variant: "destructive" });
        } finally {
          setIsLoading(false);
        }
      };
      fetchInitialBookings();
    }
  }, [searchTerm, toast, refreshTrigger]);

  const loadMoreBookings = async () => {
    if (isLoadingMore || !hasMore || searchTerm.trim().length > 0 || !lastDoc) return;
    setIsLoadingMore(true);
    try {
      const bookingsCollectionRef = collection(db, "bookings");
      const q = query(
        bookingsCollectionRef, 
        orderBy("createdAt", "desc"), 
        startAfter(lastDoc), 
        limit(PAGE_SIZE)
      );
      
      const querySnapshot = await getDocs(q);
      const newBookings = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id, 
      } as FirestoreBooking));
      
      if (newBookings.length > 0) {
        setBookings(prev => [...prev, ...newBookings]);
        setLastDoc(querySnapshot.docs[querySnapshot.docs.length - 1]);
        setHasMore(querySnapshot.docs.length === PAGE_SIZE);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Error loading more bookings:", error);
      toast({ title: "Error", description: "Failed to load more bookings.", variant: "destructive" });
    } finally {
      setIsLoadingMore(false);
    }
  };

  const getBookingCategory = useCallback((b: FirestoreBooking): string => {
    if (b.workCategoryId && categoryNameMap[b.workCategoryId]) {
      return categoryNameMap[b.workCategoryId];
    }
    if (b.services && b.services.length > 0) {
      for (const s of b.services) {
        if (s.serviceId && serviceCategoryMap[s.serviceId]) {
          return serviceCategoryMap[s.serviceId];
        }
      }
    }
    return 'General Service';
  }, [categoryNameMap, serviceCategoryMap]);

  const filteredBookings = useMemo(() => {
    let filtered = bookings;
    
    // 1. Status Filter
    if (filterStatus !== "All") {
      filtered = filtered.filter(b => b.status === filterStatus);
    }

    // 2. Category Filter
    if (filterCategory !== "All") {
      filtered = filtered.filter(b => getBookingCategory(b) === filterCategory);
    }
    
    // 3. Client-side Search Filter (for instant refinement)
    if (searchTerm.trim()) {
      const lowerSearch = searchTerm.toLowerCase().trim();
      const normalizedSearchPhone = lowerSearch.replace(/\D/g, '').replace(/^91/, '');
      
      filtered = filtered.filter(b => {
        const idMatch = (b.bookingId || '').toLowerCase().includes(lowerSearch);
        const nameMatch = (b.customerName || '').toLowerCase().includes(lowerSearch);
        
        const userPhone = (b.customerPhone || '').replace(/\D/g, '').replace(/^91/, '');
        const phoneMatch = normalizedSearchPhone ? userPhone.includes(normalizedSearchPhone) : false;

        const numberMatch = b.bookingNumber?.toString() === lowerSearch;
        const categoryMatch = getBookingCategory(b).toLowerCase().includes(lowerSearch);
        
        return idMatch || nameMatch || phoneMatch || numberMatch || categoryMatch;
      });
    }
    
    return [...filtered].sort((a, b) => {
      const isACompleted = a.status === 'Completed' || a.status === 'Cancelled' || a.status === 'ProviderRejected';
      const isBCompleted = b.status === 'Completed' || b.status === 'Cancelled' || b.status === 'ProviderRejected';

      if (!isACompleted && isBCompleted) return -1;
      if (isACompleted && !isBCompleted) return 1;

      if (!isACompleted && !isBCompleted) {
        // Active bookings: sort chronologically (earliest scheduled timestamp first)
        const timeA = getBookingScheduledTimestamp(a);
        const timeB = getBookingScheduledTimestamp(b);
        if (timeA !== timeB) return timeA - timeB;
        // Same time slot: tie-break by bookingNumber ascending (earliest created booking first)
        const numA = Number(a.bookingNumber) || 0;
        const numB = Number(b.bookingNumber) || 0;
        if (numA !== numB) return numA - numB;
        return getBookingTimestampMillis(a) - getBookingTimestampMillis(b);
      } else {
        // Completed/Cancelled bookings: sort newest scheduled/completed first
        const timeA = getBookingScheduledTimestamp(a);
        const timeB = getBookingScheduledTimestamp(b);
        if (timeA !== timeB) return timeB - timeA;
        return (Number(b.bookingNumber) || 0) - (Number(a.bookingNumber) || 0);
      }
    });
  }, [bookings, filterStatus, filterCategory, searchTerm, getBookingCategory]);

  // Active chronological queue map (#1, #2, #3...)
  const activeQueueMap = useMemo(() => {
    const map = new Map<string, number>();
    let activeIndex = 0;
    filteredBookings.forEach(b => {
      const isCompleted = b.status === 'Completed' || b.status === 'Cancelled' || b.status === 'ProviderRejected';
      if (!isCompleted) {
        activeIndex += 1;
        map.set(b.id || b.bookingId, activeIndex);
      }
    });
    return map;
  }, [filteredBookings]);

  // Concurrent bookings sharing identical scheduled date and time slot
  const slotStatsMap = useMemo(() => {
    const groups = new Map<string, string[]>();
    filteredBookings.forEach(b => {
      const isCompleted = b.status === 'Completed' || b.status === 'Cancelled' || b.status === 'ProviderRejected';
      if (!isCompleted && b.scheduledDate && b.scheduledTimeSlot) {
        const cleanDate = b.scheduledDate.split('T')[0];
        const cleanSlot = b.scheduledTimeSlot.trim().toLowerCase();
        const key = `${cleanDate}_${cleanSlot}`;
        const list = groups.get(key) || [];
        list.push(b.id || b.bookingId);
        groups.set(key, list);
      }
    });

    const stats = new Map<string, { totalInSlot: number; slotIndex: number }>();
    groups.forEach((ids) => {
      if (ids.length > 1) {
        ids.forEach((id, idx) => {
          stats.set(id, { totalInSlot: ids.length, slotIndex: idx + 1 });
        });
      }
    });
    return stats;
  }, [filteredBookings]);

  const handleStatusChange = async (booking: FirestoreBooking, newStatus: BookingStatus, additionalCharges?: {name: string, amount: number}[], finalizedPaymentMethod?: string) => {
    if (!booking.id) return;

    if (newStatus === 'Completed' && !finalizedPaymentMethod) {
        setBookingToComplete(booking);
        setIsCompleteDialogOpen(true);
        return;
    }

    if (newStatus === 'Rescheduled') {
        setBookingToReschedule(booking);
        setIsRescheduleDialogOpen(true);
        return;
    }

    setIsUpdatingStatus(booking.id);
    try {
      const updateData: any = { status: newStatus, updatedAt: Timestamp.now() };
      if (newStatus === "AssignedToProvider") {
        updateData.isProviderNotified = false; // Force re-notification
      }
      if (newStatus === "Completed") {
        if (booking.status !== "Completed") {
          updateData.isReviewedByCustomer = false;
        }
        if (additionalCharges && additionalCharges.length > 0) {
            updateData.additionalCharges = additionalCharges;
            const extraTotal = additionalCharges.reduce((sum, c) => sum + c.amount, 0);
            updateData.totalAmount = (booking.totalAmount || 0) + extraTotal;
            updateData.additionalChargesPaymentMethod = 'Pay After Service';
        }
        if (finalizedPaymentMethod) updateData.paymentMethod = finalizedPaymentMethod;
      }

      if ((newStatus === "Completed" || newStatus === "InProgressByProvider") && booking.providerId) {
        const result = await updateBookingStatusByProviderAction(
          booking.id,
          booking.providerId,
          newStatus,
          additionalCharges,
          finalizedPaymentMethod,
          undefined,
          true // Admin override to start/complete without requiring customer OTP
        );
        if (!result.success) {
          throw new Error(result.message || `Failed to update booking to ${newStatus}.`);
        }
      } else {
        await updateDoc(doc(db, "bookings", booking.id), updateData);
      }

      // Trigger automatic recalculation for provider stats if provider was set
      if (booking.providerId) {
        recalculateProviderStatsAction(booking.providerId).catch(err => console.error("Error recalculating provider stats:", err));
      }

      // Manually update local state to reflect changes immediately
      setBookings(prev => prev.map(b => b.id === booking.id ? { ...b, ...updateData } : b));
      if (selectedBooking?.id === booking.id) {
        setSelectedBooking(prev => prev ? { ...prev, ...updateData } : null);
      }

      await triggerRefresh('bookings');
      fetch('/api/bookings/post-process', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookingDocId: booking.id }), }).catch(err => console.error(err));
      toast({ title: "Success", description: `Booking is now ${newStatus}.` });
      setIsCompleteDialogOpen(false);
      setBookingToComplete(null);
    } catch (error) { console.error(error); toast({ title: "Update Failed", variant: "destructive" }); } finally { setIsUpdatingStatus(null); }
  };

  const handleDeleteBooking = async (booking: FirestoreBooking) => {
    if (!booking.id) return;
    setIsDeleting(booking.id);
    try {
      await deleteDoc(doc(db, "bookings", booking.id));
      
      // Delete promo code usage record if it exists
      if (booking.discountCode) {
        try {
          await deleteDoc(doc(db, "promoCodeUsage", `usage_${booking.id}`));
          
          // Decrement promo code usesCount if promo code exists
          const promoQuery = await getDocs(query(collection(db, "adminPromoCodes"), where("code", "==", booking.discountCode)));
          if (!promoQuery.empty) {
            const promoDoc = promoQuery.docs[0];
            await updateDoc(doc(db, "adminPromoCodes", promoDoc.id), {
              usesCount: Math.max(0, (promoDoc.data().usesCount || 0) - 1)
            });
          }
          await triggerRefresh('promo-usage');
        } catch (e) {
          console.error("Error updating promo code usage on booking delete:", e);
        }
      }

      // Manually update local state to remove the deleted booking immediately
      setBookings(prev => prev.filter(b => b.id !== booking.id));
      if (selectedBooking?.id === booking.id) {
        setIsDetailsModalOpen(false);
        setSelectedBooking(null);
      }

      // DECREMENT STATS
      const statsUpdates: any = {};
      if (booking.isStatsTracked) {
        statsUpdates.totalBookings = 1;
      }
      if (booking.isCompletionStatsTracked && booking.status === 'Completed') {
        statsUpdates.completedBookings = 1;
        statsUpdates.totalRevenue = booking.totalAmount || 0;
      }
      
      if (Object.keys(statsUpdates).length > 0) {
        user?.getIdToken().then(token => {
          fetch('/api/admin/stats/decrement', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(statsUpdates),
          }).catch(err => console.error("Error decrementing stats:", err));
        });
      }

      await triggerRefresh('bookings');
      toast({ title: "Deleted", description: "Record removed." });
    } catch (err) { toast({ title: "Error", variant: "destructive" }); } finally { setIsDeleting(null); }
  };

  const handleConfirmAssignment = async (bookingId: string, providerId: string, providerName: string) => {
    setIsUpdatingStatus(bookingId);
    try {
      const targetBooking = bookings.find(b => b.id === bookingId);
      const oldProviderId = targetBooking?.providerId;

      const updateData = { 
        providerId, 
        status: "AssignedToProvider" as BookingStatus, 
        isProviderNotified: false, // RESET so post-process notifies the new provider
        updatedAt: Timestamp.now() 
      };
      await updateDoc(doc(db, "bookings", bookingId), updateData);
      
      // Recalculate stats for old provider if different
      if (oldProviderId && oldProviderId !== providerId) {
        recalculateProviderStatsAction(oldProviderId).catch(err => console.error("Error syncing old provider stats:", err));
      }
      // Recalculate stats for new provider
      recalculateProviderStatsAction(providerId).catch(err => console.error("Error syncing new provider stats:", err));

      // Manually update local state to reflect changes immediately
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, ...updateData } : b));
      if (selectedBooking?.id === bookingId) {
        setSelectedBooking(prev => prev ? { ...prev, ...updateData } : null);
      }

      await triggerRefresh('bookings');
      fetch('/api/bookings/post-process', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookingDocId: bookingId }) });
      toast({ title: "Assigned", description: `Assigned to ${providerName}.` });
      setIsAssignModalOpen(false);
    } catch (err) { toast({ title: "Failed", variant: "destructive" }); } finally { setIsUpdatingStatus(null); }
  };

  const handleUnassignProvider = async (booking: FirestoreBooking) => {
    if (!booking.id) return;
    setIsUpdatingStatus(booking.id);
    try {
      const oldProviderId = booking.providerId;

      const updateData = { 
        providerId: deleteField(), 
        status: "Confirmed" as BookingStatus, 
        isProviderNotified: false,
        autoDispatchBypassed: true,
        updatedAt: Timestamp.now() 
      };
      await updateDoc(doc(db, "bookings", booking.id), updateData);
      
      if (oldProviderId) {
        recalculateProviderStatsAction(oldProviderId).catch(err => console.error("Error syncing unassigned provider stats:", err));
      }
      
      // Notify the provider they have been unassigned
      if (booking.providerId) {
        try {
          const providerNotificationData: Omit<FirestoreNotification, 'id'> = {
            userId: booking.providerId,
            title: "Job Unassigned",
            message: `You have been unassigned from booking ${booking.bookingId}.`,
            type: 'info',
            href: '/provider',
            read: false,
            createdAt: Timestamp.now(),
          };
          await addDoc(collection(db, "userNotifications"), providerNotificationData);

          triggerPushNotification({
            userId: booking.providerId,
            title: "Job Unassigned",
            body: `You have been unassigned from booking ${booking.bookingId}.`,
            href: '/provider'
          });
        } catch (notifErr) {
          console.error("Error creating unassign notification for provider:", notifErr);
        }
      }

      // Update local state to reflect changes immediately
      setBookings(prev => prev.map(b => b.id === booking.id ? { ...b, providerId: undefined, status: "Confirmed", isProviderNotified: false, autoDispatchBypassed: true } : b));
      if (selectedBooking?.id === booking.id) {
        setSelectedBooking(prev => prev ? { ...prev, providerId: undefined, status: "Confirmed", isProviderNotified: false, autoDispatchBypassed: true } : null);
      }

      await triggerRefresh('bookings');
      fetch('/api/bookings/post-process', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookingDocId: booking.id }) });
      toast({ title: "Unassigned", description: "Provider has been unassigned successfully." });
    } catch (err) { 
      toast({ title: "Failed to unassign", variant: "destructive" }); 
    } finally { 
      setIsUpdatingStatus(null); 
    }
  };

  const handleRescheduleConfirm = async (newDate: string, newSlot: string, newEndTime: string) => {
    if (!bookingToReschedule?.id) return;
    
    setIsUpdatingStatus(bookingToReschedule.id);
    try {
        const updateData = {
            status: "Rescheduled" as BookingStatus,
            scheduledDate: newDate,
            scheduledTimeSlot: newSlot,
            estimatedEndTime: newEndTime,
            previousScheduledDate: bookingToReschedule.scheduledDate,
            previousScheduledTimeSlot: bookingToReschedule.scheduledTimeSlot,
            updatedAt: Timestamp.now()
        };

        await updateDoc(doc(db, "bookings", bookingToReschedule.id), updateData);

        // Update local state
        setBookings(prev => prev.map(b => b.id === bookingToReschedule.id ? { ...b, ...updateData } : b));
        
        await triggerRefresh('bookings');
        fetch('/api/bookings/post-process', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ bookingDocId: bookingToReschedule.id }) 
        });

        toast({ title: "Success", description: "Booking rescheduled successfully." });
        setIsRescheduleDialogOpen(false);
        setBookingToReschedule(null);
    } catch (error) {
        console.error("Reschedule failed:", error);
        toast({ title: "Error", description: "Failed to reschedule booking.", variant: "destructive" });
    } finally {
        setIsUpdatingStatus(null);
    }
  };

  const renderBookingCard = (booking: FirestoreBooking) => {
    const isCompleted = booking.status === 'Completed' || booking.status === 'Cancelled' || booking.status === 'ProviderRejected';
    const queuePos = !isCompleted ? activeQueueMap.get(booking.id || booking.bookingId) : undefined;
    const dayCat = !isCompleted ? getDayCategory(booking.scheduledDate) : 'later';
    const concurrentInfo = slotStatsMap.get(booking.id || booking.bookingId);
    const categoryName = getBookingCategory(booking);
    const providerName = booking.providerId ? (providerNames[booking.providerId] || 'Assigned Provider') : null;
    const cardBorder = getDayBorderClass(dayCat, isCompleted);
    const dateBoxStyle = getDayDateBoxClass(dayCat);

    return (
      <Card key={booking.id} className={cn("mb-4 border-l-4 shadow-md overflow-hidden transition-all", cardBorder)}>
        <CardHeader className="p-4 bg-muted/20 pb-3 space-y-2">
          {/* Priority, Urgency & Category Badges Row */}
          {(queuePos || dayCat !== 'later' || concurrentInfo || categoryName) && (
            <div className="flex flex-wrap items-center gap-1.5 pb-1">
              {queuePos && getQueueBadge(queuePos)}
              {getDayCategoryBadge(dayCat, isCompleted)}
              {concurrentInfo && (
                <Badge className="bg-purple-600 text-white font-extrabold text-[10px] px-2 py-0.5 shadow-sm border border-purple-400 animate-pulse flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  Concurrent: #{concurrentInfo.slotIndex} of {concurrentInfo.totalInSlot}
                </Badge>
              )}
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold flex items-center gap-1 ml-auto">
                <Tag className="h-2.5 w-2.5" />
                {categoryName}
              </Badge>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {/* Row 1: Booking Number & ID */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black bg-primary text-white px-2 py-0.5 rounded-lg shadow-sm">
                #{booking.bookingNumber || '...'}
              </span>
              <CardTitle className="text-sm font-mono text-primary font-bold">{booking.bookingId}</CardTitle>
            </div>
            
            {/* Row 2: Dispatch/Coverage Badge & Status Badge side-by-side */}
            <div className="flex items-center gap-2 flex-wrap">
              {getCoverageBadge(booking)}
              <Badge className={cn("capitalize px-3 py-0.5 font-bold shadow-sm", getStatusBadgeClass(booking.status))}>
                {booking.status}
              </Badge>
            </div>

            {/* Row 3: Customer Name */}
            <div className="text-sm font-bold text-foreground pt-0.5">{booking.customerName}</div>
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-3 text-sm">
          {/* Provider Booked / Requested */}
          <div className="border-b pb-2 mb-2">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Provider Booked / Requested:</p>
            <ul className="list-disc pl-4 text-xs space-y-0.5">
              {booking.services.map((service, idx) => (
                <li key={idx}>
                  <span className="font-medium text-foreground">{service.name}</span> (x{service.quantity})
                </li>
              ))}
            </ul>
          </div>

          {/* Highlighted Date & Time Slot Box */}
          <div className={cn("p-3 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 my-2 transition-all", !isCompleted ? dateBoxStyle : "bg-muted/40 border border-muted")}>
            <div className="flex items-center gap-2 font-bold text-xs sm:text-sm">
              <CalendarDays className="h-4 w-4 shrink-0" />
              <span>Date: {formatDateForDisplay(booking.scheduledDate)}</span>
            </div>
            <div className="flex items-center gap-1.5 font-extrabold text-xs sm:text-sm bg-background/90 px-3 py-1.5 rounded-xl border shadow-2xs text-foreground">
              <Clock className="h-4 w-4 text-primary shrink-0" />
              <span>Slot: {booking.scheduledTimeSlot}</span>
            </div>
          </div>

          <div className="text-[10px] font-black flex items-center text-emerald-600 bg-emerald-500/10 px-2 py-1 rounded-md w-fit">
            <Clock className="h-3 w-3 mr-1.5" />End Time: {formatEndTimeDisplay(booking.estimatedEndTime, booking.scheduledTimeSlot)}
          </div>

          {/* Provider Assignment Status Banner */}
          <div>
            {booking.providerId ? (
              <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-900">
                <div className="flex items-center gap-1.5">
                  <UserCheck2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>Provider: <strong>{providerName}</strong></span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between text-xs font-bold text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-300 dark:border-amber-900">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>🚨 Provider Requested (Unassigned)</span>
                </div>
              </div>
            )}
          </div>

          {/* Customer Contact & Amount Box */}
          <div className="space-y-2 bg-muted/10 p-2.5 rounded-xl border border-muted/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-medium">
                <Phone className="h-4 w-4 text-primary" /> 
                <a href={`tel:${booking.customerPhone}`} className="text-primary hover:underline">{booking.customerPhone}</a>
                {booking.customerPhone && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-primary/10" onClick={() => handleWhatsAppClick(booking)} title="Chat on WhatsApp">
                    <AppImage src="/whatsapp.png" alt="WhatsApp" width={18} height={18} />
                  </Button>
                )}
              </div>
              <div className="font-black text-base text-foreground flex items-center gap-1">
                <span>{symbol}</span>
                {booking.totalAmount.toLocaleString()}
              </div>
            </div>
            <div className="flex justify-between items-center text-xs py-1 border-t border-muted/30 mt-1 pt-1">
              <span className="text-muted-foreground">Payment:</span>
              <Badge variant="outline" className={cn("text-[10px] font-bold uppercase tracking-tighter", getPaymentBadgeClass(booking.paymentMethod, booking.status, booking))}>{getPaymentLabel(booking.paymentMethod, booking.status, booking)}</Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground break-all mt-1">
              <Mail className="h-3.5 w-3.5 text-primary" /> {booking.customerEmail}
            </div>
          </div>

          <div className="pt-1">
            <PermissionGuard moduleId="bookings" action="write" fallback={
              <div className="w-full h-10 flex items-center justify-center bg-muted/30 rounded-lg">
                <Badge className={cn("capitalize px-4 py-0.5 font-bold", getStatusBadgeClass(booking.status))}>{booking.status}</Badge>
              </div>
            }>
              <Button
                type="button"
                variant="outline"
                className="w-full h-10 font-bold shadow-sm bg-background border-muted justify-between"
                onClick={() => {
                  setBookingToChangeStatus(booking);
                  setIsStatusDialogOpen(true);
                }}
                disabled={isUpdatingStatus === booking.id}
              >
                <div className="flex-1 flex justify-center">
                  <Badge className={cn("capitalize px-4 py-0.5 font-bold", getStatusBadgeClass(booking.status))}>
                    {isUpdatingStatus === booking.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : booking.status}
                  </Badge>
                </div>
                <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50 ml-2" />
              </Button>
            </PermissionGuard>
          </div>
        </CardContent>
        <CardFooter className="p-4 pt-0 gap-2 flex flex-wrap">
          <Button variant="outline" size="sm" className="flex-1 font-bold h-9" onClick={() => { setSelectedBooking(booking); setIsDetailsModalOpen(true); }}>Details</Button>
          <PermissionGuard moduleId="bookings" action="write">
            <Button variant="outline" size="sm" className="flex-1 font-bold h-9" onClick={() => { setBookingToEditId(booking.id || null); setIsEditModalOpen(true); }}>Edit</Button>
          </PermissionGuard>
          <PermissionGuard moduleId="bookings" action="write">
            <Button variant="default" size="sm" className="flex-1 font-bold h-9" onClick={() => { setBookingToAssign(booking); setIsAssignModalOpen(true); }} disabled={["Completed", "Cancelled"].includes(booking.status)}>
              {booking.providerId ? "Reassign" : "Assign"}
            </Button>
          </PermissionGuard>
          {booking.providerId && (
            <PermissionGuard moduleId="bookings" action="write">
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1 font-bold h-9 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20 shadow-sm" 
                onClick={() => handleUnassignProvider(booking)}
                disabled={isUpdatingStatus === booking.id || ["Completed", "Cancelled"].includes(booking.status)}
              >
                Unassign
              </Button>
            </PermissionGuard>
          )}
          <PermissionGuard moduleId="bookings" action="delete">
            <AlertDialog>
              <AlertDialogTrigger asChild><Button variant="destructive" size="sm" className="h-9 px-3 bg-red-600 hover:bg-red-700 text-white shadow-sm transition-colors" disabled={isDeleting === booking.id}><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
              <AlertDialogContent className="w-[90vw] rounded-2xl"><AlertDialogHeader><AlertDialogTitle className="font-bold">Delete Booking?</AlertDialogTitle><AlertDialogDescription>Remove #{booking.bookingId} from system?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteBooking(booking)} className="bg-destructive hover:bg-destructive/90 rounded-xl">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
            </AlertDialog>
          </PermissionGuard>
        </CardFooter>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><h1 className="text-3xl font-bold flex items-center"><ListOrdered className="mr-2 h-8 w-8 text-primary" /> Manage Bookings</h1><p className="text-muted-foreground">Real-time service management dashboard.</p></div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button 
            variant="outline" 
            className="h-10 border-2 border-primary/20 text-primary font-bold hover:bg-primary hover:text-white transition-all duration-300"
            onClick={handleSyncIDs}
            disabled={isSyncing}
          >
            {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
            Sync Booking IDs
          </Button>
          <PermissionGuard moduleId="bookings" action="create">
            <Button onClick={() => router.push('/admin/bookings/create')} className="bg-primary h-10 font-bold">
              <PlusCircle className="mr-2 h-4 w-4" /> Create Booking
            </Button>
          </PermissionGuard>
          <div className="relative w-full sm:w-64 group">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input 
              placeholder="ID, Name, Phone, # Number..." 
              className="pl-9 pr-9 h-10 w-full bg-background border-muted/50 focus-visible:ring-primary/20 shadow-sm" 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors" 
                onClick={() => setSearchTerm('')}
              >
                <XCircle className="h-4 w-4 text-muted-foreground"/>
              </Button>
            )}
          </div>
          <Dialog open={isFilterStatusPickerOpen} onOpenChange={setIsFilterStatusPickerOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="h-10 sm:w-44 bg-background font-bold justify-between"
                type="button"
              >
                <span>{filterStatus === "All" ? "All Statuses" : filterStatus}</span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[calc(100%-6px)] sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Filter Status</DialogTitle>
                <DialogDescription>
                  Filter bookings list by their current status.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <ScrollArea className="h-[300px] rounded-md border p-2">
                  <div className="space-y-1">
                    <Button
                      variant={filterStatus === "All" ? "secondary" : "ghost"}
                      className="w-full justify-start text-left h-auto py-2.5 px-3 relative"
                      onClick={() => {
                        setFilterStatus("All");
                        setIsFilterStatusPickerOpen(false);
                      }}
                      type="button"
                    >
                      <span className="text-sm font-medium">All Statuses</span>
                      {filterStatus === "All" && (
                        <Check className="absolute right-3 top-3 h-4 w-4 text-green-500" />
                      )}
                    </Button>
                    {statusOptions.map((s) => (
                      <Button
                        key={s}
                        variant={filterStatus === s ? "secondary" : "ghost"}
                        className="w-full justify-start text-left h-auto py-2.5 px-3 relative"
                        onClick={() => {
                          setFilterStatus(s as BookingStatus);
                          setIsFilterStatusPickerOpen(false);
                        }}
                        type="button"
                      >
                        <span className="text-sm font-medium">{s}</span>
                        {filterStatus === s && (
                          <Check className="absolute right-3 top-3 h-4 w-4 text-green-500" />
                        )}
                      </Button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </DialogContent>
          </Dialog>

          {/* Category Filter Dialog */}
          <Dialog open={isFilterCategoryPickerOpen} onOpenChange={setIsFilterCategoryPickerOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="h-10 sm:w-44 bg-background font-bold justify-between"
                type="button"
              >
                <span className="truncate">{filterCategory === "All" ? "All Categories" : filterCategory}</span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[calc(100%-6px)] sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Filter by Category</DialogTitle>
                <DialogDescription>
                  Filter bookings by service category (e.g. Plumbing, Electrician).
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <ScrollArea className="h-[300px] rounded-md border p-2">
                  <div className="space-y-1">
                    <Button
                      variant={filterCategory === "All" ? "secondary" : "ghost"}
                      className="w-full justify-start text-left h-auto py-2.5 px-3 relative"
                      onClick={() => {
                        setFilterCategory("All");
                        setIsFilterCategoryPickerOpen(false);
                      }}
                      type="button"
                    >
                      <span className="text-sm font-medium">All Categories</span>
                      {filterCategory === "All" && (
                        <Check className="absolute right-3 top-3 h-4 w-4 text-green-500" />
                      )}
                    </Button>
                    {categories.map((c) => (
                      <Button
                        key={c.id}
                        variant={filterCategory === c.name ? "secondary" : "ghost"}
                        className="w-full justify-start text-left h-auto py-2.5 px-3 relative"
                        onClick={() => {
                          setFilterCategory(c.name);
                          setIsFilterCategoryPickerOpen(false);
                        }}
                        type="button"
                      >
                        <span className="text-sm font-medium">{c.name}</span>
                        {filterCategory === c.name && (
                          <Check className="absolute right-3 top-3 h-4 w-4 text-green-500" />
                        )}
                      </Button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card><CardContent className="p-0">
          {isLoading ? ( <div className="py-20 text-center"><Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" /><p className="text-sm text-muted-foreground">Syncing Database...</p></div>
          ) : filteredBookings.length === 0 ? ( <div className="text-center py-20"><PackageSearch className="h-10 w-10 text-muted-foreground mx-auto mb-4" /><h3 className="text-lg font-semibold">No bookings found</h3></div>
          ) : (
            <><div className="hidden md:block">
                <Table><TableHeader><TableRow><TableHead className="w-[75px] text-center">Queue</TableHead><TableHead className="w-[120px]">ID</TableHead><TableHead>Customer</TableHead><TableHead className="min-w-[190px]">Date & Time Slot</TableHead><TableHead>Payment</TableHead><TableHead className="max-w-[220px]">Category & Services</TableHead><TableHead className="text-right">Amount ({symbol})</TableHead></TableRow></TableHeader>
                <TableBody>
                  {filteredBookings.slice(0, displayLimit).map((b) => {
                    const isCompleted = b.status === 'Completed' || b.status === 'Cancelled' || b.status === 'ProviderRejected';
                    const queuePos = !isCompleted ? activeQueueMap.get(b.id || b.bookingId) : undefined;
                    const dayCat = !isCompleted ? getDayCategory(b.scheduledDate) : 'later';
                    const concurrentInfo = slotStatsMap.get(b.id || b.bookingId);
                    const categoryName = getBookingCategory(b);
                    const providerName = b.providerId ? (providerNames[b.providerId] || 'Assigned Provider') : null;
                    const dateBoxStyle = getDayDateBoxClass(dayCat);

                    return (
                      <React.Fragment key={b.id}>
                        <TableRow 
                          id={`booking-row-${b.id || b.bookingId}`} 
                          className={cn(
                            "hover:bg-muted/30 transition-colors border-b-0",
                            !isCompleted && dayCat === 'today' && "border-l-4 border-l-red-600 bg-red-500/[0.03]",
                            !isCompleted && dayCat === 'tomorrow' && "border-l-4 border-l-amber-500 bg-amber-500/[0.03]",
                            !isCompleted && dayCat === 'dayAfter' && "border-l-4 border-l-emerald-500 bg-emerald-500/[0.02]"
                          )}
                        >
                          <TableCell className="text-center align-top pt-3">
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-[10px] font-black bg-primary/10 text-primary px-2 py-0.5 rounded-md text-center">
                                #{b.bookingNumber || '...'}
                              </span>
                              {queuePos && (
                                <div className="mt-0.5">
                                  {getQueueBadge(queuePos)}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="align-top pt-3">
                            <div className="font-mono text-xs font-bold text-primary">{b.bookingId}</div>
                            <div className="mt-1">{getCoverageBadge(b)}</div>
                          </TableCell>
                          <TableCell className="align-top pt-3">
                            <div className="font-bold text-sm">{b.customerName}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-xs text-muted-foreground">
                                <a href={`tel:${b.customerPhone}`} className="hover:underline">{b.customerPhone}</a>
                              </span>
                              {b.customerPhone && (
                                <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-primary/10" onClick={() => handleWhatsAppClick(b)} title="WhatsApp">
                                  <AppImage src="/whatsapp.png" alt="WA" width={14} height={14} />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="align-top pt-3">
                            <div className="space-y-1.5">
                              {/* Urgency & Concurrent badges */}
                              <div className="flex flex-wrap items-center gap-1">
                                {getDayCategoryBadge(dayCat, isCompleted)}
                                {concurrentInfo && (
                                  <Badge className="bg-purple-600 text-white font-extrabold text-[9px] px-1.5 py-0.5 shadow-sm border border-purple-400 animate-pulse flex items-center gap-0.5 whitespace-nowrap">
                                    <Zap className="h-2.5 w-2.5" />
                                    Slot #{concurrentInfo.slotIndex} of {concurrentInfo.totalInSlot}
                                  </Badge>
                                )}
                              </div>
                              <div className={cn("p-2 rounded-xl text-xs font-bold transition-all", !isCompleted ? dateBoxStyle : "bg-muted/40 border border-muted")}>
                                <div className="flex items-center gap-1.5">
                                  <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                                  <span>{formatDateForDisplay(b.scheduledDate)}</span>
                                </div>
                                <div className="flex items-center gap-1.5 mt-1 font-extrabold text-foreground">
                                  <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                                  <span>{b.scheduledTimeSlot}</span>
                                </div>
                              </div>
                                <div className="text-[10px] font-black flex items-center text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full w-fit">
                                  <Clock className="h-3 w-3 mr-1" />End Time: {formatEndTimeDisplay(b.estimatedEndTime, b.scheduledTimeSlot)}
                                </div>
                            </div>
                          </TableCell>
                          <TableCell className="align-top pt-3">
                            <Badge variant="outline" className={cn("text-[10px] font-bold uppercase tracking-tighter shadow-sm", getPaymentBadgeClass(b.paymentMethod, b.status, b))}>
                              {getPaymentLabel(b.paymentMethod, b.status, b)}
                            </Badge>
                          </TableCell>
                          <TableCell className="align-top pt-3 max-w-[220px]">
                            <div className="space-y-1.5">
                              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold flex items-center gap-1 w-fit">
                                <Tag className="h-2.5 w-2.5" />
                                {categoryName}
                              </Badge>
                              <div className="text-xs font-medium text-foreground line-clamp-2">
                                {b.services.map(s => `${s.name} (x${s.quantity})`).join(', ')}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="align-top pt-3 text-right pr-6 font-black text-lg">
                            {formatCurrency(b.totalAmount, symbol, decimals, code)}
                          </TableCell>
                        </TableRow>
                        <TableRow className="hover:bg-transparent border-t-0 border-b border-border/50">
                          <TableCell colSpan={7} className="py-2.5 px-4 bg-muted/10">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="flex flex-wrap items-center gap-3">
                                <PermissionGuard moduleId="bookings" action="write" fallback={
                                  <div className="h-9 px-4 flex items-center bg-muted/30 rounded-md">
                                    <Badge className={cn("capitalize px-3 py-0.5", getStatusBadgeClass(b.status))}>{b.status}</Badge>
                                  </div>
                                }>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="h-9 w-44 bg-background font-bold text-xs shadow-sm justify-between"
                                    onClick={() => {
                                      setBookingToChangeStatus(b);
                                      setIsStatusDialogOpen(true);
                                    }}
                                    disabled={isUpdatingStatus === b.id}
                                  >
                                    <Badge className={cn("capitalize px-3 py-0.5", getStatusBadgeClass(b.status))}>{b.status}</Badge>
                                    <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50 ml-1" />
                                  </Button>
                                </PermissionGuard>

                                {/* Provider Assignment Status Banner */}
                                {b.providerId ? (
                                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-900 shadow-2xs">
                                    <UserCheck2 className="h-3.5 w-3.5 text-emerald-600" />
                                    <span>Provider: <strong>{providerName}</strong></span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-900 shadow-2xs">
                                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                                    <span>🚨 Unassigned - Needs Provider</span>
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                <PermissionGuard moduleId="bookings" action="write">
                                  <Button variant="default" size="sm" className="h-9 px-4 font-bold shadow-sm" onClick={() => { setBookingToAssign(b); setIsAssignModalOpen(true); }} disabled={["Completed", "Cancelled"].includes(b.status)}>
                                    <Users className="mr-1.5 h-4 w-4" /> {b.providerId ? "Reassign" : "Assign Provider"}
                                  </Button>
                                </PermissionGuard>
                                {b.providerId && (
                                  <PermissionGuard moduleId="bookings" action="write">
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      className="h-9 px-4 font-bold text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20 shadow-sm" 
                                      onClick={() => handleUnassignProvider(b)}
                                      disabled={isUpdatingStatus === b.id || ["Completed", "Cancelled"].includes(b.status)}
                                    >
                                      <UserX className="mr-1.5 h-4 w-4" /> Unassign
                                    </Button>
                                  </PermissionGuard>
                                )}
                                <Button variant="outline" size="sm" className="h-9 px-4 font-bold" onClick={() => { setSelectedBooking(b); setIsDetailsModalOpen(true); }}>Details</Button>
                                <PermissionGuard moduleId="bookings" action="write">
                                  <Button variant="outline" size="sm" className="h-9 px-4 font-bold" onClick={() => { setBookingToEditId(b.id || null); setIsEditModalOpen(true); }}>Edit</Button>
                                </PermissionGuard>
                                <PermissionGuard moduleId="bookings" action="delete">
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="destructive" size="sm" className="h-9 px-3 bg-red-600 hover:bg-red-700 text-white shadow-sm transition-colors" disabled={isDeleting === b.id}>
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader><AlertDialogTitle>Delete?</AlertDialogTitle><AlertDialogDescription>Remove #{b.bookingId}?</AlertDialogDescription></AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteBooking(b)} className="bg-destructive">Delete</AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </PermissionGuard>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      </React.Fragment>
                    );
                  })}
                </TableBody></Table>
                </div>
                <div className="md:hidden p-4 space-y-4">
                {filteredBookings.slice(0, displayLimit).map((b) => renderBookingCard(b))}
              </div>
              {filteredBookings.length > displayLimit && (
                <div className="p-8 text-center border-t border-muted/40 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
                  <div>
                    Showing first {Math.min(displayLimit, filteredBookings.length)} of {filteredBookings.length} bookings.
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setDisplayLimit((prev: number) => prev + 50)}>
                      Load More (+50)
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setDisplayLimit(filteredBookings.length)}>
                      Load All ({filteredBookings.length})
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {selectedBooking && (<Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}><DialogContent aria-describedby={undefined} className="max-w-3xl w-[90vw] max-h-[90vh] flex flex-col p-0"><DialogHeader className="p-3 pb-4 border-b"><DialogTitle>Details: {selectedBooking.bookingId}</DialogTitle></DialogHeader><div className="overflow-y-auto flex-grow p-3"><BookingDetailsModalContent booking={selectedBooking} /></div><div className="p-3 border-t flex justify-end"><DialogClose asChild><Button variant="outline">Close</Button></DialogClose></div></DialogContent></Dialog>)}
      {bookingToAssign && (<AssignProviderModal isOpen={isAssignModalOpen} onClose={() => { setIsAssignModalOpen(false); setBookingToAssign(null); }} booking={bookingToAssign} onAssignConfirm={handleConfirmAssignment} />)}
      {bookingToComplete && (<CompleteBookingDialog isOpen={isCompleteDialogOpen} onClose={() => { setIsCompleteDialogOpen(false); setBookingToComplete(null); }} onConfirm={(charges, pMethod) => handleStatusChange(bookingToComplete, 'Completed', charges, pMethod)} booking={bookingToComplete} originalAmount={bookingToComplete.totalAmount} currentPaymentMethod={bookingToComplete.paymentMethod || "Pay After Service"} isProcessing={isUpdatingStatus === bookingToComplete.id} isAdmin={true} />)}
      {bookingToReschedule && (<RescheduleBookingDialog isOpen={isRescheduleDialogOpen} onClose={() => { setIsRescheduleDialogOpen(false); setBookingToReschedule(null); }} booking={bookingToReschedule} onRescheduleComplete={(newDate, newSlot, newEndTime) => handleRescheduleConfirm(newDate, newSlot, newEndTime)} />)}
      {bookingToChangeStatus && (
        <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
          <DialogContent className="w-[calc(100%-6px)] sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Change Booking Status</DialogTitle>
              <DialogDescription>
                Select a new status for Booking ID: {bookingToChangeStatus.bookingId}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <ScrollArea className="h-[300px] rounded-md border p-2">
                <div className="space-y-1">
                  {statusOptions.map((s) => (
                    <Button
                      key={s}
                      variant={bookingToChangeStatus.status === s ? "secondary" : "ghost"}
                      className="w-full justify-start text-left h-auto py-2.5 px-3 relative"
                      onClick={() => {
                        handleStatusChange(bookingToChangeStatus, s as BookingStatus);
                        setIsStatusDialogOpen(false);
                        setBookingToChangeStatus(null);
                      }}
                      type="button"
                    >
                      <span className="text-sm font-medium">{s}</span>
                      {bookingToChangeStatus.status === s && (
                        <Check className="absolute right-3 top-3 h-4 w-4 text-green-500" />
                      )}
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </DialogContent>
        </Dialog>
      )}
      <EditBookingModal
        bookingId={bookingToEditId}
        isOpen={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        onSuccess={() => setRefreshTrigger(prev => prev + 1)}
      />
    </div>
  );
}
