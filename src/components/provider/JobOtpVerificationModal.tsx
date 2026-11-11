"use client";

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, ShieldCheck, Loader2, PlayCircle, CheckCircle2 } from "lucide-react";

interface JobOtpVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerify: (otp: string) => Promise<boolean | void>;
  bookingId: string;
  customerName?: string;
  actionType: 'start' | 'complete';
  isProcessing?: boolean;
}

export default function JobOtpVerificationModal({
  isOpen,
  onClose,
  onVerify,
  bookingId,
  customerName,
  actionType,
  isProcessing = false,
}: JobOtpVerificationModalProps) {
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setOtp('');
      setError(null);
      setSubmitting(false);
    }
  }, [isOpen]);

  const isStart = actionType === 'start';

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length < 4) {
      setError('Please enter the full 4-digit OTP provided by the customer.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await onVerify(cleanOtp);
      if (res !== false) {
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || 'Invalid OTP. Please check with customer.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !submitting && !isProcessing) onClose(); }}>
      <DialogContent className="sm:max-w-[420px] rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className={`p-2 rounded-xl ${isStart ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'}`}>
              <KeyRound className="h-5 w-5" />
            </div>
            <DialogTitle className="text-lg font-bold">
              {isStart ? 'Customer Start OTP' : 'Customer Complete OTP'}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            {isStart
              ? `Ask ${customerName ? customerName : 'the customer'} for the 4-digit Start OTP shown on their screen to begin work for Booking #${bookingId}.`
              : `Ask ${customerName ? customerName : 'the customer'} for the 4-digit Complete OTP to officially finish work for Booking #${bookingId}.`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-3">
          <div className="space-y-2 text-center">
            <Label htmlFor="otpInput" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Enter 4-Digit OTP Code
            </Label>
            <div className="flex justify-center">
              <Input
                id="otpInput"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                autoFocus
                disabled={submitting || isProcessing}
                value={otp}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setOtp(val);
                  setError(null);
                }}
                placeholder="• • • •"
                className="w-48 text-center text-3xl font-mono font-extrabold tracking-[0.5em] py-6 h-14 rounded-xl border-2 focus-visible:ring-primary shadow-xs"
              />
            </div>
            {error && (
              <p className="text-xs text-red-600 font-semibold mt-1">
                {error}
              </p>
            )}
          </div>

          <div className="p-3 bg-muted/40 rounded-xl border text-[11px] text-muted-foreground flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>
              {isStart
                ? 'Your working hours start calculating immediately upon OTP verification.'
                : 'Zero commission will be deducted. Net earnings will be credited directly to your account.'}
            </span>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting || isProcessing}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || isProcessing || otp.length < 4}
              className={`rounded-xl font-bold ${isStart ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
            >
              {(submitting || isProcessing) ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : isStart ? (
                <>
                  <PlayCircle className="mr-2 h-4 w-4" />
                  Verify & Start Work
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Verify & Complete Job
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
