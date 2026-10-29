"use client";

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, RefreshCw, ExternalLink, CalendarDays, IndianRupee, Trash2, CheckCircle2, AlertTriangle, ShieldCheck, PackageSearch } from "lucide-react";
import type { FirestoreBooking, ProviderApplication, FirestoreUser, BookingStatus } from '@/types/firestore';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, getDocs, doc, getDoc, updateDoc, deleteDoc, Timestamp, deleteField, where } from '@/lib/mysqlDb';
import { useToast } from "@/hooks/use-toast";
import { useApplicationConfig } from '@/hooks/useApplicationConfig';
import { cn, formatCurrency, formatDateInTimezone, isCashPayment } from '@/lib/utils';
import { recalculateProviderStatsAction } from '@/app/actions/providerWalletActions';
import Link from 'next/link';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const calculateProviderFee = (bookingAmount: number, feeType?: string, feeValue?: number): number => {
  if (!feeType || !feeValue || feeValue <= 0) return 0;
  if (feeType === 'fixed') return feeValue;
  if (feeType === 'percentage') return (bookingAmount * feeValue) / 100;
  return 0;
};

const getStatusBadgeClass = (status: BookingStatus) => {
  switch (status) {
    case 'Completed': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30';
    case 'Confirmed': case 'ProviderAccepted': case 'AssignedToProvider': case 'InProgressByProvider': return 'bg-blue-500/10 text-blue-600 border-blue-500/30';
    case 'Pending Payment': case 'Rescheduled': return 'bg-orange-500/10 text-orange-600 border-orange-500/30';
    case 'Processing': return 'bg-purple-500/10 text-purple-600 border-purple-500/30';
    case 'Cancelled': case 'ProviderRejected': return 'bg-destructive/10 text-destructive border-destructive/30';
    default: return 'bg-muted text-muted-foreground border-border';
  }
};

export default function BookingFeesBreakdownTab() {
  const { config: appConfig } = useApplicationConfig();
  const symbol = appConfig?.currencySymbol || '₹';
  const decimals = appConfig?.currencyDecimalPoints !== undefined ? Number(appConfig.currencyDecimalPoints) : 2;
  const code = appConfig?.currencyCode || 'INR';

  const [bookings, setBookings] = useState<FirestoreBooking[]>([]);
  const [providerMap, setProviderMap] = useState<Record<string, { name: string; email: string }>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [paymentFilter, setPaymentFilter] = useState<string>('All');
  const [recalculatingProviderId, setRecalculatingProviderId] = useState<string | null>(null);
  const [isDeletingBookingId, setIsDeletingBookingId] = useState<string | null>(null);
  const { toast } = useToast();

  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch bookings
      const bookingsSnap = await getDocs(query(collection(db, "bookings"), orderBy("createdAt", "desc")));
      const fetchedBookings = bookingsSnap.docs.map(d => ({ ...d.data(), id: d.id } as FirestoreBooking));
      setBookings(fetchedBookings);

      // 2. Fetch providers to map names and emails
      const providersSnap = await getDocs(query(collection(db, "providerApplications"), where("status", "==", "approved")));
      const pMap: Record<string, { name: string; email: string }> = {};
      providersSnap.docs.forEach(d => {
        const data = d.data() as ProviderApplication;
        if (data.userId) {
          pMap[data.userId] = {
            name: data.fullName || 'Provider',
            email: data.email || 'N/A'
          };
        }
      });

      // Also map from users collection in case some user IDs aren't in applications
      const usersSnap = await getDocs(query(collection(db, "users"), where("role", "==", "provider")));
      usersSnap.docs.forEach(d => {
        const u = d.data() as FirestoreUser;
        if (!pMap[d.id]) {
          pMap[d.id] = {
            name: u.displayName || 'Provider',
            email: u.email || 'N/A'
          };
        }
      });

      setProviderMap(pMap);
    } catch (err) {
      console.error("Error loading booking fees breakdown:", err);
      toast({ title: "Error", description: "Failed to load booking fees data.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRecalculateProvider = async (providerId: string, providerName: string) => {
    setRecalculatingProviderId(providerId);
    try {
      const res = await recalculateProviderStatsAction(providerId);
      if (res.success) {
        toast({ title: "Balance Synchronized", description: `Successfully recalculated earnings for ${providerName}.` });
        await loadData();
      } else {
        toast({ title: "Recalculation Failed", description: res.message, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to recalculate balance.", variant: "destructive" });
    } finally {
      setRecalculatingProviderId(null);
    }
  };

  const handleUnassignAndRecalculate = async (booking: FirestoreBooking) => {
    if (!booking.id) return;
    setIsDeletingBookingId(booking.id);
    try {
      const oldProviderId = booking.providerId;
      // Unassign booking from provider & set status to Confirmed
      const bookingRef = doc(db, "bookings", booking.id);
      await updateDoc(bookingRef, {
        providerId: deleteField(),
        status: "Confirmed",
        updatedAt: Timestamp.now()
      });

      if (oldProviderId) {
        await recalculateProviderStatsAction(oldProviderId);
      }

      toast({ title: "Booking Unassigned", description: `Booking ${booking.bookingId} unassigned from provider and earnings recalculated.` });
      await loadData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to unassign booking.", variant: "destructive" });
    } finally {
      setIsDeletingBookingId(null);
    }
  };

  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      const providerInfo = b.providerId ? providerMap[b.providerId] : null;
      const searchLower = searchTerm.toLowerCase().trim();

      const bookingIdMatch = (b.bookingId || '').toLowerCase().includes(searchLower) || (b.bookingNumber?.toString() || '').includes(searchLower);
      const providerMatch = providerInfo
        ? (providerInfo.name.toLowerCase().includes(searchLower) || providerInfo.email.toLowerCase().includes(searchLower))
        : false;

      const matchesSearch = !searchTerm.trim() || bookingIdMatch || providerMatch;
      const matchesStatus = statusFilter === 'All' || b.status === statusFilter;

      const isCash = isCashPayment(b.paymentMethod);
      const matchesPayment = paymentFilter === 'All' || (paymentFilter === 'Cash' && isCash) || (paymentFilter === 'Online' && !isCash);

      return matchesSearch && matchesStatus && matchesPayment;
    });
  }, [bookings, providerMap, searchTerm, statusFilter, paymentFilter]);

  return (
    <Card className="border-none shadow-sm bg-card/60 backdrop-blur-md">
      <CardHeader className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40">
        <div>
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <IndianRupee className="h-5 w-5 text-primary" />
            Booking Fees & Earnings Breakdown
          </CardTitle>
          <CardDescription>
            Audit individual booking fees, provider net shares, and trigger automatic earnings recalculations.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={isLoading} className="shrink-0 rounded-full font-bold">
          <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
          Refresh Audit Data
        </Button>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by Provider, Email or Booking ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 text-xs h-9"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs h-9 px-3 border rounded-md bg-background font-medium focus:ring-1 focus:ring-primary"
            >
              <option value="All">All Statuses</option>
              <option value="Completed">Completed</option>
              <option value="AssignedToProvider">Assigned To Provider</option>
              <option value="ProviderAccepted">Provider Accepted</option>
              <option value="InProgressByProvider">In Progress</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Cancelled">Cancelled</option>
            </select>

            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="text-xs h-9 px-3 border rounded-md bg-background font-medium focus:ring-1 focus:ring-primary"
            >
              <option value="All">All Payment Types</option>
              <option value="Online">Online Payments</option>
              <option value="Cash">Pay After Service (Cash)</option>
            </select>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground font-medium">Loading booking fees breakdown...</p>
          </div>
        ) : filteredBookings.length > 0 ? (
          <div className="border rounded-2xl overflow-hidden shadow-xs">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="font-bold text-xs">Booking ID / Date</TableHead>
                  <TableHead className="font-bold text-xs">Provider</TableHead>
                  <TableHead className="font-bold text-xs">Payment Method</TableHead>
                  <TableHead className="font-bold text-xs text-right">Gross Amount</TableHead>
                  <TableHead className="font-bold text-xs text-right">Admin Fee</TableHead>
                  <TableHead className="font-bold text-xs text-right">Provider Share</TableHead>
                  <TableHead className="font-bold text-xs text-center">Status</TableHead>
                  <TableHead className="font-bold text-xs text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBookings.map((b) => {
                  const providerInfo = b.providerId ? providerMap[b.providerId] : null;
                  const isCash = isCashPayment(b.paymentMethod);
                  const baseGross = (b.subTotal || 0) + (b.visitingCharge || 0) - (b.discountAmount || 0);
                  const extraCharges = (b.additionalCharges || []).reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
                  const totalGross = baseGross + extraCharges;
                  const adminFee = calculateProviderFee(totalGross, appConfig?.providerFeeType, appConfig?.providerFeeValue);
                  const providerNetShare = Math.max(0, totalGross - adminFee);
                  const statusClass = getStatusBadgeClass(b.status);
                  const formattedDate = formatDateInTimezone(new Date(b.scheduledDate?.replace(/-/g, '/') || Date.now()), appConfig?.timezone || 'Asia/Kolkata', appConfig?.dateFormat);

                  return (
                    <TableRow key={b.id || b.bookingId} className="hover:bg-muted/30">
                      <TableCell className="py-3">
                        <div>
                          <p className="font-bold text-xs text-foreground">#{b.bookingId}</p>
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <CalendarDays className="h-3 w-3 text-primary shrink-0" />
                            {formattedDate}
                          </p>
                        </div>
                      </TableCell>

                      <TableCell className="py-3">
                        {b.providerId && providerInfo ? (
                          <div>
                            <p className="font-semibold text-xs text-foreground">{providerInfo.name}</p>
                            <p className="text-[11px] text-muted-foreground">{providerInfo.email}</p>
                          </div>
                        ) : b.providerId ? (
                          <div>
                            <p className="font-semibold text-xs text-foreground">ID: {b.providerId.substring(0, 8)}...</p>
                            <p className="text-[11px] text-muted-foreground">Provider Assigned</p>
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-amber-600 bg-amber-500/10 border-amber-200">
                            Unassigned
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell className="py-3">
                        <Badge variant="outline" className={cn("text-[10px] font-bold px-2 py-0.5", isCash ? "bg-orange-500/10 text-orange-600 border-orange-200" : "bg-emerald-500/10 text-emerald-600 border-emerald-200")}>
                          {isCash ? "Pay After Service" : "Online"}
                        </Badge>
                      </TableCell>

                      <TableCell className="py-3 text-right font-bold text-xs text-foreground">
                        {formatCurrency(totalGross, symbol, decimals, code)}
                      </TableCell>

                      <TableCell className="py-3 text-right font-semibold text-xs text-amber-600">
                        {formatCurrency(adminFee, symbol, decimals, code)}
                      </TableCell>

                      <TableCell className="py-3 text-right font-black text-xs text-emerald-600">
                        {formatCurrency(providerNetShare, symbol, decimals, code)}
                      </TableCell>

                      <TableCell className="py-3 text-center">
                        <Badge variant="outline" className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border", statusClass)}>
                          {b.status.replace(/([A-Z])/g, ' $1').trim()}
                        </Badge>
                      </TableCell>

                      <TableCell className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {b.providerId && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-[11px] font-bold px-2 text-primary border-primary/30 hover:bg-primary/10"
                              onClick={() => handleRecalculateProvider(b.providerId!, providerInfo?.name || 'Provider')}
                              disabled={recalculatingProviderId === b.providerId}
                              title="Recalculate and sync this provider's earnings balance"
                            >
                              {recalculatingProviderId === b.providerId ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <RefreshCw className="h-3 w-3" />
                              )}
                              <span className="hidden sm:inline ml-1">Sync</span>
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            asChild
                            title="View Booking Details"
                          >
                            <Link href={`/admin/bookings?search=${encodeURIComponent(b.bookingId)}&openBookingId=${encodeURIComponent(b.bookingId)}`} target="_blank">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                          </Button>

                          {b.providerId && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                  title="Unassign from Provider & Recalculate"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Unassign Provider from Booking?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will unassign Provider "{providerInfo?.name || b.providerId}" from Booking #{b.bookingId}, reset status to Confirmed, and automatically recalculate the provider's earnings and withdrawable balance.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleUnassignAndRecalculate(b)}
                                    className="bg-destructive hover:bg-destructive/90"
                                  >
                                    Unassign & Sync
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 px-4 border rounded-2xl bg-muted/10 text-center">
            <PackageSearch className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <h4 className="text-sm font-bold text-foreground">No bookings found</h4>
            <p className="text-xs text-muted-foreground max-w-sm mt-1">No booking matches the selected search filters.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
