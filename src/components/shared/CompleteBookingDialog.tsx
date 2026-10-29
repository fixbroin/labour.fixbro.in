
"use client";

import React, { useState } from 'react';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, 
  DialogDescription, DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, CheckCircle2, Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useApplicationConfig } from '@/hooks/useApplicationConfig';
import { formatCurrency, isCashPayment, hasOnlinePaymentProof, cn } from '@/lib/utils';
import type { FirestoreBooking } from '@/types/firestore';

interface AdditionalCharge {
  name: string;
  amount: number;
}

interface CompleteBookingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (charges: AdditionalCharge[], paymentMethod: string) => void;
  booking?: FirestoreBooking | null;
  originalAmount: number;
  currentPaymentMethod: string;
  isProcessing: boolean;
  isAdmin?: boolean;
}

export default function CompleteBookingDialog({ 
  isOpen, 
  onClose, 
  onConfirm, 
  booking,
  originalAmount,
  currentPaymentMethod,
  isProcessing,
  isAdmin = false
}: CompleteBookingDialogProps) {
  const { config: appConfig } = useApplicationConfig();
  const symbol = appConfig?.currencySymbol || '₹';
  const decimals = appConfig?.currencyDecimalPoints !== undefined ? appConfig.currencyDecimalPoints : 2;
  const code = appConfig?.currencyCode || 'INR';
  const [charges, setCharges] = useState<AdditionalCharge[]>([]);
  
  const paymentMethodName = booking?.paymentMethod || currentPaymentMethod || 'Pay After Service';
  const hasOnlineProof = hasOnlinePaymentProof(booking);
  const isPrepaidOnline = hasOnlineProof || !isCashPayment(paymentMethodName);

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>(() => {
    return isPrepaidOnline ? 'Online' : 'Pay After Service';
  });

  React.useEffect(() => {
    if (isOpen) {
      setSelectedPaymentMethod(isPrepaidOnline ? 'Online' : 'Pay After Service');
      setCharges([]);
    }
  }, [isOpen, isPrepaidOnline]);

  const addCharge = () => {
    setCharges([...charges, { name: "", amount: 0 }]);
  };

  const removeCharge = (index: number) => {
    setCharges(charges.filter((_, i) => i !== index));
  };

  const updateCharge = (index: number, field: keyof AdditionalCharge, value: string) => {
    const newCharges = [...charges];
    if (field === 'amount') {
      newCharges[index].amount = parseFloat(value) || 0;
    } else {
      newCharges[index].name = value;
    }
    setCharges(newCharges);
  };

  const additionalTotal = charges.reduce((sum, c) => sum + c.amount, 0);

  // Financial components from booking (matching ProviderJobCard logic)
  const subTotal = booking ? (booking.subTotal || 0) : originalAmount;
  const visitingCharge = booking?.visitingCharge || 0;
  const discountAmount = booking?.discountAmount || 0;
  const platformFeeTotal = booking?.platformFeeTotal || 0;
  const taxAmount = booking?.taxAmount || 0;

  // Gross service amount for provider (Service + Visiting - Discount)
  const providerGross = subTotal + visitingCharge - discountAmount;

  // Total amount to collect
  // For online paid: Customer already paid online, so provider collects ONLY additional extra charges!
  // For pay after service: Provider collects full total (booking totalAmount + additional extra charges)
  const finalCashTotal = isPrepaidOnline ? additionalTotal : ((booking?.totalAmount || originalAmount) + additionalTotal);
  const adminFinalTotal = (booking?.totalAmount || originalAmount) + additionalTotal;

  const handleConfirm = () => {
    const validCharges = charges.filter(c => c.name.trim() !== "" && c.amount > 0);
    const finalMethod = isAdmin ? selectedPaymentMethod : (isPrepaidOnline ? "Online" : "Pay After Service");
    onConfirm(validCharges, finalMethod);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isProcessing && onClose()}>
      <DialogContent className="sm:max-w-[450px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Complete Booking
          </DialogTitle>
          <DialogDescription>
            {isAdmin
              ? "Review booking charges, select or confirm payment mode, and complete the job."
              : isPrepaidOnline 
                ? "Review the service details and add any additional charges if applicable."
                : "Review the service details and collect the payment from the customer."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Admin Payment Method Selector */}
          {isAdmin && (
            <div className="space-y-2 bg-muted/40 p-3.5 rounded-xl border border-border/70">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Booking Payment Method
                </Label>
                {hasOnlineProof ? (
                  <span className="text-[11px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200">
                    ✓ Verified Online Payment
                  </span>
                ) : (
                  <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    Pay After Service
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button
                  type="button"
                  variant={selectedPaymentMethod === 'Online' ? 'default' : 'outline'}
                  size="sm"
                  className={cn(
                    "h-9 font-bold text-xs rounded-lg transition-all",
                    selectedPaymentMethod === 'Online' 
                      ? "bg-green-600 hover:bg-green-700 text-white shadow-sm" 
                      : "hover:bg-muted text-foreground"
                  )}
                  onClick={() => setSelectedPaymentMethod('Online')}
                >
                  Online (Prepaid)
                </Button>
                <Button
                  type="button"
                  variant={selectedPaymentMethod === 'Pay After Service' ? 'default' : 'outline'}
                  size="sm"
                  className={cn(
                    "h-9 font-bold text-xs rounded-lg transition-all",
                    selectedPaymentMethod === 'Pay After Service' 
                      ? "bg-primary hover:bg-primary/90 text-white shadow-sm" 
                      : "hover:bg-muted text-foreground"
                  )}
                  onClick={() => setSelectedPaymentMethod('Pay After Service')}
                >
                  Pay After Service
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground pt-0.5 leading-snug">
                {selectedPaymentMethod === 'Online'
                  ? (additionalTotal > 0 
                      ? "Customer prepaid the base booking online. The additional charges will be marked as Pay After Service."
                      : "Customer prepaid the full booking online. Status will be marked as Paid (Online).")
                  : "Customer will pay the full amount (base + additional charges) on-site as Pay After Service."}
              </p>
            </div>
          )}

          {/* Charges Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Additional Charges (Optional)</Label>
              <Button type="button" variant="outline" size="sm" onClick={addCharge} className="h-7 px-2 text-xs">
                <Plus className="h-3 w-3 mr-1" /> Add Charge
              </Button>
            </div>

            <div className="space-y-2">
                {charges.map((charge, index) => (
                <div key={index} className="flex gap-2 items-center">
                    <Input 
                        placeholder="Item name" 
                        value={charge.name}
                        onChange={(e) => updateCharge(index, 'name', e.target.value)}
                        className="h-9 text-sm"
                    />
                    <div className="w-28 relative">
                        <span className="absolute left-2.5 top-2 text-sm text-muted-foreground">{symbol}</span>
                        <Input 
                            type="number" 
                            placeholder="0" 
                            value={charge.amount || ""}
                            onChange={(e) => updateCharge(index, 'amount', e.target.value)}
                            className="h-9 pl-7 text-sm"
                        />
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeCharge(index)} className="h-9 w-9 text-destructive">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
                ))}
            </div>
          </div>

          {/* Summary Box */}
          <div className="bg-primary/5 p-4 rounded-2xl space-y-2 border border-primary/10">
            {isAdmin ? (
              // Admin View
              <div className="space-y-1.5 text-xs sm:text-sm">
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Base Service Amount:</span>
                  <span className="font-semibold text-foreground">{formatCurrency(originalAmount, symbol, decimals, code)}</span>
                </div>
                <div className="flex justify-between items-center text-xs pb-1">
                  <span className="text-muted-foreground">Base Payment Status:</span>
                  <span className={cn(
                    "font-bold px-2 py-0.5 rounded text-[11px]",
                    selectedPaymentMethod === 'Online' 
                      ? "bg-green-100 text-green-800 border border-green-200" 
                      : "bg-amber-100 text-amber-800 border border-amber-200"
                  )}>
                    {selectedPaymentMethod === 'Online' ? "Paid Online" : "Pay After Service"}
                  </span>
                </div>
                {additionalTotal > 0 && (
                  <div className="flex justify-between items-center text-xs sm:text-sm text-green-700 font-bold pt-1 border-t border-dashed">
                    <span>Additional Charges (Pay After Service):</span>
                    <span>+ {formatCurrency(additionalTotal, symbol, decimals, code)}</span>
                  </div>
                )}
                <Separator className="my-1.5 opacity-50" />
                <div className="flex justify-between text-base sm:text-lg font-black text-primary">
                  <span>Total Booking Bill:</span>
                  <span>{formatCurrency(adminFinalTotal, symbol, decimals, code)}</span>
                </div>
                {selectedPaymentMethod === 'Online' && additionalTotal > 0 && (
                  <p className="text-[11px] text-muted-foreground pt-0.5 leading-tight">
                    * Core booking is settled online. Additional charges ({formatCurrency(additionalTotal, symbol, decimals, code)}) will be collected by provider as Pay After Service.
                  </p>
                )}
              </div>
            ) : isPrepaidOnline ? (
              // Online Paid Provider View (Platform fee & tax are completely hidden from provider)
              <div className="space-y-1.5 text-xs sm:text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Service Amount:</span>
                  <span className="font-medium text-foreground">
                    {formatCurrency(booking ? providerGross : originalAmount, symbol, decimals, code)}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs text-green-700 font-semibold bg-green-50 p-2 rounded-lg border border-green-200">
                  <span>Payment Status:</span>
                  <span>✓ Paid Online by Customer</span>
                </div>

                {additionalTotal > 0 && (
                  <div className="flex justify-between text-amber-600 font-bold pt-1 border-t border-dashed">
                    <span>Additional Charges Added:</span>
                    <span>+ {formatCurrency(additionalTotal, symbol, decimals, code)}</span>
                  </div>
                )}

                <Separator className="my-1.5 opacity-50" />
                <div className="flex justify-between text-base sm:text-lg font-black text-primary">
                  <span>Total to Collect from Customer:</span>
                  <span className={additionalTotal > 0 ? "text-amber-600" : "text-green-600"}>
                    {formatCurrency(additionalTotal, symbol, decimals, code)}
                  </span>
                </div>
                {additionalTotal > 0 ? (
                  <p className="text-[11px] text-muted-foreground leading-tight pt-1">
                    Collect only the additional charges from the customer. Applicable commission on extra work will be auto-deducted from your prepaid wallet.
                  </p>
                ) : (
                  <p className="text-[11px] text-green-700 font-medium leading-tight">
                    Entire payment was completed online. No payment collection required from the customer.
                  </p>
                )}
              </div>
            ) : (
              // Pay After Service Provider View (Platform fee and tax are VISIBLE to collect from customer)
              <div className="space-y-1 text-xs sm:text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Service Charge:</span>
                  <span className="font-semibold text-foreground">
                    {formatCurrency(booking ? subTotal : originalAmount, symbol, decimals, code)}
                  </span>
                </div>

                {booking && visitingCharge > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Visiting Charge:</span>
                    <span className="font-semibold text-foreground">
                      + {formatCurrency(visitingCharge, symbol, decimals, code)}
                    </span>
                  </div>
                )}

                {booking && platformFeeTotal > 0 && (
                  <div className="flex justify-between text-amber-600">
                    <span>Platform Fee (Collect from Customer):</span>
                    <span className="font-bold">
                      + {formatCurrency(platformFeeTotal, symbol, decimals, code)}
                    </span>
                  </div>
                )}

                {booking && taxAmount > 0 && (
                  <div className="flex justify-between text-amber-600">
                    <span>Tax (Collect from Customer):</span>
                    <span className="font-bold">
                      + {formatCurrency(taxAmount, symbol, decimals, code)}
                    </span>
                  </div>
                )}

                {booking && discountAmount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount:</span>
                    <span className="font-semibold">
                      - {formatCurrency(discountAmount, symbol, decimals, code)}
                    </span>
                  </div>
                )}

                {additionalTotal > 0 && (
                  <div className="flex justify-between text-amber-600 font-bold pt-1 border-t border-dashed">
                    <span>Additional Charges:</span>
                    <span>+ {formatCurrency(additionalTotal, symbol, decimals, code)}</span>
                  </div>
                )}

                <Separator className="my-1.5 opacity-50" />
                <div className="flex justify-between text-base sm:text-lg font-black text-primary">
                  <span>Total to Collect from Customer:</span>
                  <span>{formatCurrency(finalCashTotal, symbol, decimals, code)}</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-tight pt-0.5">
                  Collect total payment from the customer. Platform fee, tax, and commission will be settled via your prepaid wallet.
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isProcessing} className="rounded-xl">Cancel</Button>
          <Button onClick={handleConfirm} disabled={isProcessing} className="bg-green-600 hover:bg-green-700 rounded-xl flex-1 h-11 font-bold">
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Completing Job...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Confirm Completion
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
