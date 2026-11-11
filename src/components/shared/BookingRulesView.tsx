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
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ShieldAlert,
  Wrench,
  MapPin,
  Clock,
  Ban,
  CheckCircle2,
  HeartHandshake,
  ShieldCheck,
  BookOpen,
} from 'lucide-react';
import type { ProviderDefaultSettings, ServiceGuidelineRule, GuidelineCategory } from '@/types/providerDefaultSettings';
import { getProviderDefaultSettingsAction } from '@/app/actions/providerDefaultSettingsActions';

interface BookingRulesViewProps {
  mode?: 'inline' | 'modal';
  isOpen?: boolean;
  onClose?: () => void;
  initialSettings?: ProviderDefaultSettings;
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

export default function BookingRulesView({
  mode = 'modal',
  isOpen = false,
  onClose,
  initialSettings,
}: BookingRulesViewProps) {
  const [settings, setSettings] = useState<ProviderDefaultSettings | null>(initialSettings || null);

  useEffect(() => {
    if (!settings) {
      getProviderDefaultSettingsAction()
        .then((data) => setSettings(data))
        .catch((err) => console.error("Error loading booking rules settings:", err));
    }
  }, [settings]);

  const title = settings?.cartRulesTitle || 'Daily Labour Booking Guidelines & Rules';
  const subtitle = settings?.cartRulesSubtitle || 'Important work guidelines and service expectations for daily labour bookings.';
  const activeRules = (settings?.rules || []).filter((r) => r.isActive !== false);

  const modalRulesListContent = (
    <div className="space-y-3">
      {activeRules.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground text-sm">
          Standard daily labour terms and conditions apply to this booking.
        </div>
      ) : (
        activeRules.map((rule, idx) => (
          <div
            key={rule.id || idx}
            className="bg-card border rounded-xl p-3.5 shadow-2xs space-y-1.5 transition-colors hover:border-primary/40"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center shrink-0">
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
  );

  if (mode === 'inline') {
    return (
      <Card className="rounded-2xl border border-border/70 bg-card overflow-hidden shadow-sm w-full">
        <CardHeader className="bg-muted/30 border-b border-border/50 p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base sm:text-lg font-bold text-foreground">
                  {title}
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  {subtitle}
                </CardDescription>
              </div>
            </div>
            {activeRules.length > 0 && (
              <Badge variant="outline" className="text-xs font-semibold px-2.5 py-1 w-fit bg-primary/5 text-primary border-primary/20">
                {activeRules.length} Guidelines
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 bg-muted/10">
          {activeRules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Standard daily labour terms and conditions apply to this booking.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
              {activeRules.map((rule, idx) => (
                <div
                  key={rule.id || idx}
                  className="bg-card border border-border/70 rounded-xl p-4 shadow-2xs hover:border-primary/40 hover:shadow-xs transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2.5">
                      <div className="flex items-start gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                          {getCategoryIcon(rule.category)}
                        </div>
                        <h4 className="text-sm font-bold text-foreground leading-snug">
                          {idx + 1}. {rule.title}
                        </h4>
                      </div>
                      {rule.category && (
                        <Badge
                          variant="outline"
                          className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 shrink-0 ${getCategoryBadgeClass(rule.category)}`}
                        >
                          {rule.category}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed pl-9">
                      {rule.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && onClose) onClose(); }}>
      <DialogContent className="max-w-xl w-[94vw] sm:w-full max-h-[85vh] sm:max-h-[88vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl">
        <div className="p-4 sm:p-5 border-b bg-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
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

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-muted/20">
          {modalRulesListContent}
        </div>

        <div className="p-3 sm:p-4 border-t bg-card flex justify-end">
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={onClose}
            className="text-xs font-semibold px-5"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
