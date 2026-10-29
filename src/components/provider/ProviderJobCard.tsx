
"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle, PlayCircle, ExternalLink, Tag, Clock, Wallet, CalendarDays } from "lucide-react";
import type { FirestoreBooking } from '@/types/firestore';
import { Badge } from '@/components/ui/badge';
import { useLoading } from '@/contexts/LoadingContext';
import AppImage from '@/components/ui/AppImage';
import { formatDateInTimezone, formatTimeInTimezone, cn, isCashPayment, hasOnlinePaymentProof } from '@/lib/utils';
import { useApplicationConfig } from '@/hooks/useApplicationConfig';
import { useMemo } from 'react';

interface ProviderJobCardProps {
  job: FirestoreBooking;
  type: 'new' | 'ongoing' | 'completed';
  queuePosition?: number;
  onAccept?: (bookingId: string) => void;
  onReject?: (bookingId: string) => void;
  onStartWork?: (bookingId: string) => void;
  onCompleteWork?: (bookingId: string) => void;
  isProcessingAction?: boolean;
  providerWalletBalance?: number;
  minBalanceForJobs?: number;
}

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

const getQueueBadge = (pos?: number) => {
  if (!pos) return null;
  if (pos === 1) {
    return (
      <Badge className="bg-red-600 text-white hover:bg-red-700 font-extrabold text-[11px] px-2.5 py-0.5 shadow-sm border border-red-400">
        🥇 #1 DUE FIRST
      </Badge>
    );
  }
  if (pos === 2) {
    return (
      <Badge className="bg-amber-600 text-white hover:bg-amber-700 font-extrabold text-[11px] px-2.5 py-0.5 shadow-sm border border-amber-400">
        🥈 #2 DUE NEXT
      </Badge>
    );
  }
  if (pos === 3) {
    return (
      <Badge className="bg-yellow-600 text-white hover:bg-yellow-700 font-extrabold text-[11px] px-2.5 py-0.5 shadow-sm border border-yellow-400">
        🥉 #3 DUE THIRD
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="font-bold text-[11px] px-2.5 py-0.5 bg-background">
      #{pos} DUE
    </Badge>
  );
};

const getStatusBadgeVariant = (status: FirestoreBooking['status']) => {
    switch (status) {
      case 'Completed': return 'default';
      case 'Confirmed':
      case 'ProviderAccepted':
      case 'InProgressByProvider':
      case 'AssignedToProvider':
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

const getStatusBadgeClass = (status: FirestoreBooking['status']) => {
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

const ProviderJobCard: React.FC<ProviderJobCardProps> = ({
  job,
  type,
  queuePosition,
  onAccept,
  onReject,
  onStartWork,
  onCompleteWork,
  isProcessingAction,
  providerWalletBalance = 0,
  minBalanceForJobs = 50
}) => {
  const { showLoading } = useLoading();
  const router = useRouter();
  const isJobCompleted = job.status === 'Completed';

  const { config: appConfig } = useApplicationConfig();
  const providerFeeType = appConfig?.providerFeeType || 'percentage';
  const providerFeeValue = Number(appConfig?.providerFeeValue || 0);

  const getCommission = (amount: number, feeType: string, feeVal: number) => {
    if (feeType === 'percentage') {
      return (amount * feeVal) / 100;
    }
    return feeVal;
  };

  const isCash = hasOnlinePaymentProof(job) ? false : isCashPayment(job.paymentMethod);
  const paymentMethod = isCash ? 'Pay After Service' : 'Online';
  const providerGross = (job.subTotal || 0) + (job.visitingCharge || 0) - (job.discountAmount || 0);
  const requiredCommission = isCash ? (getCommission(providerGross, providerFeeType, providerFeeValue) + (job.platformFeeTotal || 0) + (job.taxAmount || 0)) : 0;
  const isLowBalance = (type === 'new' || job.status === 'AssignedToProvider') && 
    providerWalletBalance < Math.max(minBalanceForJobs, requiredCommission);
  const isAccepted = job.status !== 'AssignedToProvider' && job.status !== 'Rescheduled';
  const decimals = appConfig?.currencyDecimalPoints !== undefined ? Number(appConfig.currencyDecimalPoints) : 2;
  const symbol = appConfig?.currencySymbol || "₹";
  const extraChargesTotal = (job.additionalCharges || []).reduce((sum, c) => sum + Number(c.amount || 0), 0);
  const displayTotal = isCash ? (job.totalAmount || 0) : (providerGross + extraChargesTotal);

  const dayCat = useMemo(() => !isJobCompleted ? getDayCategory(job.scheduledDate) : 'later', [job.scheduledDate, isJobCompleted]);

  const cardBorderClass = useMemo(() => {
    if (isJobCompleted) return "border-l-4 border-l-gray-400";
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
  }, [dayCat, isJobCompleted]);

  const dateBoxClass = useMemo(() => {
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
  }, [dayCat]);

  const dayCategoryBadge = useMemo(() => {
    if (isJobCompleted) return null;
    switch (dayCat) {
      case 'today':
        return <Badge className="bg-red-600 text-white font-black text-[10px] uppercase tracking-wider animate-pulse">🚨 TODAY - URGENT</Badge>;
      case 'tomorrow':
        return <Badge className="bg-amber-600 text-white font-bold text-[10px] uppercase tracking-wider">⏰ TOMORROW</Badge>;
      case 'dayAfter':
        return <Badge className="bg-emerald-600 text-white font-bold text-[10px] uppercase tracking-wider">📅 IN 2 DAYS</Badge>;
      default:
        return null;
    }
  }, [dayCat, isJobCompleted]);

  const handleViewDetailsClick = async (e: React.MouseEvent) => {
    if (type === 'new' && onAccept) {
      e.preventDefault();
      showLoading();
      await onAccept(job.id!);
      router.push(`/provider/booking/${job.id}`);
    } else {
      showLoading();
    }
  };
  
  const handleWhatsAppClick = async (e: React.MouseEvent, mobileNumber: string) => {
    e.stopPropagation();
    if (type === 'new' && onAccept) {
      showLoading();
      await onAccept(job.id!);
    }
    const sanitizedPhone = mobileNumber.replace(/\D/g, '');
    const internationalPhone = sanitizedPhone.startsWith('91') ? sanitizedPhone : `91${sanitizedPhone}`;
    const message = encodeURIComponent(`Hi ${job.customerName}, I'm your Fixbro provider for booking #${job.bookingId}.`);
    window.open(`https://wa.me/${internationalPhone}?text=${message}`, '_blank');
  };

  return (
    <Card className={cn("shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden", cardBorderClass)}>
      <CardHeader className="pb-3">
        {(queuePosition || dayCategoryBadge) && (
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {queuePosition && getQueueBadge(queuePosition)}
            {dayCategoryBadge}
          </div>
        )}
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg font-semibold">{job.services.map(s => s.name).join(', ')}</CardTitle>
           <Badge variant={getStatusBadgeVariant(job.status)} className={`capitalize text-xs ${getStatusBadgeClass(job.status)}`}>
            {job.status.replace(/([A-Z])/g, ' $1').replace('Provider ', '')}
          </Badge>
        </div>
        <CardDescription className="text-xs">
          ID: {job.bookingId} | Customer: {isJobCompleted ? "[Hidden for Privacy]" : isLowBalance ? "[Locked - Add Money to Reveal]" : !isAccepted ? "[Hidden until Accepted]" : job.customerName}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm space-y-1">
        <div className="border-b pb-2 mb-2">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Services Included:</p>
          <ul className="list-disc pl-4 text-xs space-y-1">
            {job.services.map((service, idx) => (
              <li key={idx}>
                <span className="font-medium text-foreground">{service.name}</span> (x{service.quantity}) - {symbol}{((service.pricePerUnit || 0) * service.quantity).toFixed(decimals)}
              </li>
            ))}
          </ul>
        </div>

        {/* Highlighted Date & Time Slot Box */}
        <div className={cn("p-3 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 my-3 transition-all", dateBoxClass)}>
          <div className="flex items-center gap-2 font-bold text-xs sm:text-sm">
            <CalendarDays className="h-4 w-4 shrink-0" />
            <span>Date: {formatDateForDisplay(job.scheduledDate)}</span>
          </div>
          <div className="flex items-center gap-1.5 font-extrabold text-xs sm:text-sm bg-background/90 px-3 py-1.5 rounded-xl border shadow-2xs text-foreground">
            <Clock className="h-4 w-4 text-primary shrink-0" />
            <span>Slot: {job.scheduledTimeSlot}</span>
          </div>
        </div>

        {job.estimatedEndTime && (
          <p className="text-green-600 font-medium">
            <strong>Ends:</strong> {formatDateInTimezone(new Date(job.estimatedEndTime), 'Asia/Kolkata')} {formatTimeInTimezone(new Date(job.estimatedEndTime), 'Asia/Kolkata')}
          </p>
        )}
        <p><strong>Address:</strong> {isJobCompleted ? "[Hidden for Privacy]" : `${job.addressLine1}${job.addressLine2 ? `, ${job.addressLine2}` : ''}, ${job.city}`}</p>
        <div className="flex items-center gap-2">
            <strong>Contact:</strong>
            {isJobCompleted ? (
              <span>[Hidden for Privacy]</span>
            ) : isLowBalance ? (
              <span>[Locked]</span>
            ) : !isAccepted ? (
              <span>[Hidden until Accepted]</span>
            ) : (
              <>
                <a href={`tel:${job.customerPhone}`} className="text-primary hover:underline font-medium">{job.customerPhone}</a>
                {job.customerPhone && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => handleWhatsAppClick(e, job.customerPhone!)}
                    title="Chat on WhatsApp"
                  >
                    <AppImage src="/whatsapp.png" alt="WhatsApp Icon" width={18} height={18} />
                    <span className="sr-only">Chat on WhatsApp</span>
                  </Button>
                )}
              </>
            )}
        </div>

        <div className="flex flex-col gap-1 pt-2 border-t mt-2">
          <p className="text-xs text-muted-foreground flex justify-between">
            <span>Service Charge:</span>
            <span className="font-bold text-foreground">{symbol}{(job.subTotal || 0).toFixed(decimals)}</span>
          </p>
          {job.visitingCharge !== undefined && job.visitingCharge > 0 && (
            <p className="text-xs text-muted-foreground flex justify-between">
              <span>Visiting Charge:</span>
              <span className="font-bold text-foreground">+{symbol}{(job.visitingCharge || 0).toFixed(decimals)}</span>
            </p>
          )}
          {job.discountAmount !== undefined && job.discountAmount > 0 && (
            <p className="text-xs text-muted-foreground flex justify-between text-emerald-600 font-semibold">
              <span>Discount:</span>
              <span className="font-bold">-{symbol}{job.discountAmount.toFixed(decimals)}</span>
            </p>
          )}
          {extraChargesTotal > 0 && (
            <p className="text-xs text-muted-foreground flex justify-between text-emerald-600 font-semibold">
              <span>Extra Charges Added:</span>
              <span className="font-bold">+{symbol}{extraChargesTotal.toFixed(decimals)}</span>
            </p>
          )}
          {isCash && job.platformFeeTotal !== undefined && job.platformFeeTotal > 0 && (
            <p className="text-xs text-muted-foreground flex justify-between text-amber-600">
              <span>Platform Fee (Collect from Customer):</span>
              <span className="font-bold">+{symbol}{(job.platformFeeTotal || 0).toFixed(decimals)}</span>
            </p>
          )}
          {isCash && job.taxAmount !== undefined && job.taxAmount > 0 && (
            <p className="text-xs text-muted-foreground flex justify-between text-amber-600">
              <span>Tax (Collect from Customer):</span>
              <span className="font-bold">+{symbol}{(job.taxAmount || 0).toFixed(decimals)}</span>
            </p>
          )}
          <p className="text-xs font-black flex justify-between border-t border-dashed pt-1 text-primary">
            <span>Total Customer Pays:</span>
            <span>{symbol}{displayTotal.toFixed(decimals)}</span>
          </p>
          <p className="text-xs text-muted-foreground flex justify-between mt-1 pt-1 border-t border-muted/50">
            <span>Payment Method:</span>
            <span className="font-semibold text-foreground">{paymentMethod}</span>
          </p>
          {extraChargesTotal > 0 && (
            <div className="mt-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-snug">
              {!isCash ? (
                <span>
                  <strong>Online Payment:</strong> {symbol}{providerGross.toFixed(decimals)} paid online. Additional charges of <strong>{symbol}{extraChargesTotal.toFixed(decimals)}</strong> collected in cash by you.
                </span>
              ) : (
                <span>
                  <strong>Pay After Service:</strong> Total <strong>{symbol}{displayTotal.toFixed(decimals)}</strong> (including {symbol}{extraChargesTotal.toFixed(decimals)} additional charges) collected by you.
                </span>
              )}
            </div>
          )}
        </div>

        {isLowBalance && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3 rounded-xl font-bold flex flex-col gap-1 mt-2 text-left">
            <div className="flex items-center gap-1">
              <span>⚠️</span>
              <span>Low Wallet Balance</span>
            </div>
            <p className="font-semibold text-[11px] leading-snug">
              Add money to accept this booking. Minimum balance required: {appConfig?.currencySymbol || "₹"}{Math.max(minBalanceForJobs, requiredCommission).toFixed(decimals)}
            </p>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col sm:flex-row justify-end gap-2 pt-3">
        {isLowBalance ? (
          <>
            <Button variant="outline" size="sm" className="w-full sm:w-auto text-xs" disabled>
              <ExternalLink className="mr-1 h-3.5 w-3.5"/>View Details
            </Button>
            <Button size="sm" variant="destructive" className="w-full sm:w-auto text-xs" disabled>
              <XCircle className="mr-1 h-3.5 w-3.5"/>Reject
            </Button>
            <Button size="sm" className="w-full sm:w-auto text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold" asChild>
              <Link href="/provider/wallet">
                <Wallet className="mr-1 h-3.5 w-3.5"/>Top Up Wallet
              </Link>
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" size="sm" className="w-full sm:w-auto text-xs" asChild>
              <Link href={`/provider/booking/${job.id}`} onClick={handleViewDetailsClick}>
                <ExternalLink className="mr-1 h-3.5 w-3.5"/>View Details
              </Link>
            </Button>
            {type === 'new' && onAccept && onReject && (
              <>
                <Button 
                  size="sm" 
                  onClick={() => onReject(job.id!)} 
                  variant="destructive" 
                  disabled={isProcessingAction} 
                  className="w-full sm:w-auto text-xs"
                >
                  {isProcessingAction ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin"/> Rejecting...
                    </>
                  ) : (
                    <>
                      <XCircle className="mr-1.5 h-3.5 w-3.5"/> Reject
                    </>
                  )}
                </Button>
                <Button 
                  size="sm" 
                  onClick={() => onAccept(job.id!)} 
                  disabled={isProcessingAction} 
                  className="w-full sm:w-auto text-xs"
                >
                  {isProcessingAction ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin"/> Accepting...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-1.5 h-3.5 w-3.5"/> Accept
                    </>
                  )}
                </Button>
              </>
            )}
          </>
        )}
        {type === 'ongoing' && job.status === 'ProviderAccepted' && onStartWork && (
          <Button 
            size="sm" 
            onClick={() => onStartWork(job.id!)} 
            disabled={isProcessingAction} 
            className="w-full text-xs"
          >
            {isProcessingAction ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin"/> Starting Work...
              </>
            ) : (
              <>
                <PlayCircle className="mr-1.5 h-3.5 w-3.5"/> Start Work
              </>
            )}
          </Button>
        )}
        {type === 'ongoing' && job.status === 'InProgressByProvider' && onCompleteWork && (
          <Button 
            size="sm" 
            onClick={() => onCompleteWork(job.id!)} 
            disabled={isProcessingAction} 
            className="w-full text-xs bg-green-600 hover:bg-green-700"
          >
            {isProcessingAction ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin"/> Completing...
              </>
            ) : (
              <>
                <CheckCircle className="mr-1.5 h-3.5 w-3.5"/> Mark Complete
              </>
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default ProviderJobCard;
