"use client";

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  ShieldAlert,
  Wrench,
  MapPin,
  Clock,
  Award,
  Ban,
  CheckCircle2,
  FileCheck,
  HeartHandshake,
  ShieldCheck,
  ArrowRight,
  AlertTriangle,
  Info,
} from 'lucide-react';
import type { ProviderDefaultSettings, ServiceGuidelineRule, GuidelineCategory } from '@/types/providerDefaultSettings';

interface CartBookingRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  settings?: ProviderDefaultSettings;
}

const getCategoryIcon = (category?: GuidelineCategory) => {
  switch (category) {
    case 'scope':
      return <Wrench className="h-4 w-4 text-amber-500" />;
    case 'location':
      return <MapPin className="h-4 w-4 text-blue-500" />;
    case 'hours':
      return <Clock className="h-4 w-4 text-emerald-500" />;
    case 'conduct':
      return <HeartHandshake className="h-4 w-4 text-pink-500" />;
    case 'payment':
      return <Ban className="h-4 w-4 text-rose-500" />;
    case 'refund':
      return <CheckCircle2 className="h-4 w-4 text-teal-500" />;
    case 'safety':
      return <ShieldAlert className="h-4 w-4 text-red-500" />;
    default:
      return <ShieldCheck className="h-4 w-4 text-primary" />;
  }
};

const getCategoryBadgeClass = (category?: GuidelineCategory) => {
  switch (category) {
    case 'scope':
      return 'border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300';
    case 'location':
      return 'border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300';
    case 'hours':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300';
    case 'conduct':
      return 'border-pink-200 bg-pink-50 text-pink-700 dark:bg-pink-950/40 dark:text-pink-300';
    case 'payment':
      return 'border-rose-200 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300';
    case 'refund':
      return 'border-teal-200 bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300';
    case 'safety':
      return 'border-red-200 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-300';
  }
};

export default function CartBookingRulesModal({
  isOpen,
  onClose,
  onConfirm,
  settings,
}: CartBookingRulesModalProps) {
  const [hasAgreed, setHasAgreed] = useState(false);

  const title = settings?.cartRulesTitle || 'Daily Labour Booking Guidelines & Rules';
  const subtitle = settings?.cartRulesSubtitle || 'Please review and accept our daily labour service terms before proceeding to checkout.';
  const agreementText = settings?.cartRulesAgreementText || 'I have read, understood, and agree to these daily labour guidelines & terms.';
  const activeRules = (settings?.rules || []).filter((r) => r.isActive !== false);

  const handleAgreeAndProceed = () => {
    if (!hasAgreed) return;
    onConfirm();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-xl w-[94vw] sm:w-full max-h-[85vh] sm:max-h-[88vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b bg-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold text-foreground leading-tight">
                {title}
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5 leading-snug">
                {subtitle}
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Scrollable Rules List - 80% to 90% mobile height friendly */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 bg-muted/20">
          {activeRules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Standard daily labour service terms apply.
            </div>
          ) : (
            activeRules.map((rule, idx) => (
              <div
                key={rule.id || idx}
                className="bg-card border rounded-xl p-3 sm:p-3.5 shadow-sm space-y-1.5 transition-colors hover:border-primary/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                      {getCategoryIcon(rule.category)}
                    </div>
                    <h4 className="text-xs sm:text-sm font-bold text-foreground">
                      {idx + 1}. {rule.title}
                    </h4>
                  </div>
                  {rule.category && (
                    <Badge variant="outline" className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0 ${getCategoryBadgeClass(rule.category)}`}>
                      {rule.category}
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed pl-8">
                  {rule.description}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Modal Footer with Agreement Checkbox and Action Buttons */}
        <div className="p-4 sm:p-5 border-t bg-card space-y-4">
          <div className="flex items-start gap-2.5 bg-muted/40 p-3 rounded-xl border cursor-pointer" onClick={() => setHasAgreed(!hasAgreed)}>
            <Checkbox
              id="rules-agree-checkbox"
              checked={hasAgreed}
              onCheckedChange={(checked) => setHasAgreed(checked === true)}
              className="mt-0.5 h-4 w-4"
            />
            <Label
              htmlFor="rules-agree-checkbox"
              className="text-xs sm:text-sm text-foreground font-medium leading-snug cursor-pointer select-none"
            >
              {agreementText}
            </Label>
          </div>

          <div className="flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs font-semibold px-4"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!hasAgreed}
              onClick={handleAgreeAndProceed}
              className="gap-2 text-xs font-bold px-5 shadow-sm bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50"
            >
              <span>Agree &amp; Proceed</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
