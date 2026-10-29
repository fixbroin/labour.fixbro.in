"use client";

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ShieldAlert, PhoneCall, AlertTriangle, Lock } from 'lucide-react';
import type { MarketplaceSettings } from '@/types/marketplace';

interface CallSafetyModalProps {
  isOpen: boolean;
  onClose: () => void;
  sellerName?: string;
  sellerPhone: string;
  listingTitle: string;
  listingType?: 'furniture' | 'rental';
  callerName?: string;
  callerPhone?: string;
  callerEmail?: string;
  onCallConfirmed?: (callerDetails: { name: string; phone: string; email: string }) => void;
  settings?: MarketplaceSettings;
}

export default function CallSafetyModal({
  isOpen,
  onClose,
  sellerName,
  sellerPhone,
  listingTitle,
  listingType = 'furniture',
  callerName = '',
  callerPhone = '',
  callerEmail = '',
  onCallConfirmed,
  settings,
}: CallSafetyModalProps) {
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAgreed(false);
    }
  }, [isOpen]);

  const handleCall = () => {
    if (onCallConfirmed) {
      onCallConfirmed({
        name: callerName?.trim() || 'FixBro User',
        phone: callerPhone?.trim() || '',
        email: callerEmail?.trim() || '',
      });
    }

    // Initiate phone dialer
    window.location.href = `tel:${sellerPhone}`;
    onClose();
  };

  const isFurniture = listingType === 'furniture';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md w-[95vw] sm:w-full p-4 sm:p-6 rounded-2xl bg-white dark:bg-card border-amber-200 dark:border-amber-900 shadow-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-left space-y-2.5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 sm:p-3 bg-amber-100 dark:bg-amber-950/60 rounded-xl text-amber-600 dark:text-amber-400 shrink-0">
              <ShieldAlert className="h-6 w-6 sm:h-7 sm:w-7" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold text-gray-900 dark:text-white leading-tight">
                {settings?.safetyWarningTitle || 'Safety Alert – Read Before Calling'}
              </DialogTitle>
              <p className="text-[11px] sm:text-xs text-amber-700 dark:text-amber-400 font-medium mt-0.5">
                Protect yourself from advance payment scams
              </p>
            </div>
          </div>

          <DialogDescription asChild>
            <div className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 space-y-2.5 pt-1">
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-xl p-3 space-y-1.5 text-xs sm:text-sm leading-relaxed">
                <p className="font-semibold text-amber-900 dark:text-amber-200 flex items-start gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>FixBro is a 100% free advertising platform. Anyone can post listings here.</span>
                </p>
                <ul className="space-y-1 pl-5 list-disc text-gray-700 dark:text-gray-300 text-[11px] sm:text-xs font-medium">
                  <li>
                    <strong className="text-red-600 dark:text-red-400">NEVER pay any advance money</strong> or token amount on phone, Google Pay, PhonePe, UPI, or QR codes.
                  </li>
                  <li>
                    <strong>Always visit the location in person</strong> and physically {isFurniture ? 'inspect the furniture' : 'inspect the rental property & documents'} before making any payment.
                  </li>
                  <li>
                    Whatever happens, FixBro is <strong>not responsible</strong> for financial loss. We only provide a free connection between buyers and sellers.
                  </li>
                </ul>
              </div>

              {/* Connecting With Seller Box */}
              <div className="bg-gray-50 dark:bg-muted/40 p-3 rounded-xl border text-xs space-y-1">
                <p className="text-gray-500 text-[11px]">Connecting you with:</p>
                <p className="font-bold text-gray-900 dark:text-white text-sm">
                  {sellerName ? `${sellerName}` : 'Seller / Property Owner'}
                </p>
                <p className="text-gray-500 truncate text-[11px]">For: {listingTitle}</p>
                <div className="pt-1 flex items-center gap-2 border-t mt-1.5 text-xs">
                  <span className="text-muted-foreground font-medium">Seller Phone:</span>
                  {agreed ? (
                    <span className="font-bold text-green-700 dark:text-green-400 tracking-wider">
                      {sellerPhone}
                    </span>
                  ) : (
                    <span className="font-mono text-gray-400 dark:text-gray-500 text-[11px] flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      •••••••••• (Hidden until agreement)
                    </span>
                  )}
                </div>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>

        {/* Checkbox agreement */}
        <label className="flex items-start gap-2.5 cursor-pointer p-2.5 rounded-xl border border-amber-200/60 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors mt-1">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
          />
          <span className="text-xs text-gray-800 dark:text-gray-200 select-none leading-relaxed">
            I understand that FixBro is a free open platform. I will <strong>never send advance money</strong> and will inspect directly in person.
          </span>
        </label>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="w-full sm:w-auto text-xs sm:text-sm rounded-xl"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleCall}
            disabled={!agreed}
            className={`w-full sm:flex-1 font-bold flex items-center justify-center gap-2 text-xs sm:text-sm rounded-xl transition-all shadow-sm ${
              agreed
                ? 'bg-green-600 hover:bg-green-700 text-white shadow-green-600/20'
                : 'bg-gray-200 dark:bg-muted text-gray-400 dark:text-gray-500 cursor-not-allowed opacity-75'
            }`}
          >
            {agreed ? (
              <>
                <PhoneCall className="h-4 w-4" />
                Proceed to Call ({sellerPhone})
              </>
            ) : (
              <>
                <Lock className="h-4 w-4 text-gray-400" />
                Check box to reveal number & call
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
