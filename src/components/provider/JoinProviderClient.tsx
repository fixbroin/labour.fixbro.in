"use client";

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { 
  CheckCircle2, ArrowRight, ShieldCheck, Clock, MapPin, 
  Sparkles, Wallet, Banknote, CreditCard, ChevronDown, 
  Search, Users, Star, Award, Compass, Power, Zap, 
  Building2, PhoneCall, HelpCircle, AlertTriangle, ShieldAlert,
  Calendar, FileText, UserCheck, AlertCircle
} from 'lucide-react';
import type { FirestoreCategory } from '@/types/firestore';
import type { JoinProviderPageSettings } from '@/types/joinProvider';
import { formatCurrency, cn } from '@/lib/utils';
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion";

interface JoinProviderClientProps {
  settings: JoinProviderPageSettings;
  categories: FirestoreCategory[];
  commissionPercentage: number;
  commissionType: string;
  minWalletBalance: number;
  currencySymbol: string;
  currencyCode: string;
}

export default function JoinProviderClient({
  settings,
  categories,
  commissionPercentage,
  commissionType,
  minWalletBalance,
  currencySymbol,
  currencyCode,
}: JoinProviderClientProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [simulatedEarnings, setSimulatedEarnings] = useState<number>(40000);
  const [isDemoOnline, setIsDemoOnline] = useState<boolean>(true);
  const [selectedRadiusKm, setSelectedRadiusKm] = useState<number>(settings.radiusDefaultKm || 10);

  // Dynamic token replacer helper
  const formatText = (text: string, categoryName?: string): string => {
    if (!text) return '';
    const commissionStr = commissionType === 'percentage' 
      ? `${commissionPercentage}%` 
      : `${currencySymbol}${commissionPercentage}`;
    
    return text
      .replace(/{commission}/g, commissionStr)
      .replace(/{currency}/g, currencySymbol)
      .replace(/{min_wallet_balance}/g, String(minWalletBalance))
      .replace(/{category}/g, categoryName || 'Service')
      .replace(/{penalty_percentage}/g, String(settings.penaltyPercentage ?? 100));
  };

  // Filter categories by search term
  const filteredCategories = useMemo(() => {
    if (!searchTerm.trim()) return categories;
    const term = searchTerm.toLowerCase().trim();
    return categories.filter(c => 
      c.name.toLowerCase().includes(term) || 
      (c.slug && c.slug.toLowerCase().includes(term))
    );
  }, [categories, searchTerm]);

  // Calculator math
  const calculatedCommission = commissionType === 'percentage'
    ? (simulatedEarnings * commissionPercentage) / 100
    : commissionPercentage;
  const netTakeHome = Math.max(0, simulatedEarnings - calculatedCommission);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary selection:text-white">
      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary/10 via-background to-background pt-12 pb-16 sm:pt-20 sm:pb-24 border-b border-border/50">
        {/* Decorative background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-primary/15 blur-[120px] rounded-full pointer-events-none -z-10" />

        <div className="container max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-3xl mx-auto space-y-6">
            {/* Hero Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/25 text-primary text-xs sm:text-sm font-bold shadow-sm">
              <Sparkles className="h-4 w-4 text-primary shrink-0 animate-pulse" />
              <span>{settings.heroBadge}</span>
            </div>

            {/* Main Headline H1 */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-headline font-black tracking-tight leading-[1.15] text-foreground">
              {formatText(settings.heroHeadline)}
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground leading-relaxed">
              {formatText(settings.heroSubtitle)}
            </p>

            {/* Primary Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
              <Link href={settings.heroCtaLink || "/provider-registration"} className="w-full sm:w-auto">
                <Button 
                  size="lg" 
                  className="w-full sm:w-auto h-12 px-8 text-base font-bold rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all gap-2"
                >
                  <span>{settings.heroCtaText}</span>
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <a href={settings.heroSecondaryCtaLink || "#category-jobs"} className="w-full sm:w-auto">
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="w-full sm:w-auto h-12 px-6 text-base font-semibold rounded-xl border-border/80 hover:bg-muted transition-all"
                >
                  {settings.heroSecondaryCtaText}
                </Button>
              </a>
            </div>

            {/* Key Trust Signals */}
            <div className="pt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="p-3 sm:p-4 rounded-xl bg-card border border-border/70 shadow-sm">
                <p className="text-xl sm:text-2xl font-black text-primary">{settings.stats.stat1Number}</p>
                <p className="text-xs text-muted-foreground font-medium mt-0.5">{settings.stats.stat1Label}</p>
              </div>
              <div className="p-3 sm:p-4 rounded-xl bg-card border border-border/70 shadow-sm">
                <p className="text-xl sm:text-2xl font-black text-green-600">{settings.stats.stat2Number}</p>
                <p className="text-xs text-muted-foreground font-medium mt-0.5">{settings.stats.stat2Label}</p>
              </div>
              <div className="p-3 sm:p-4 rounded-xl bg-card border border-border/70 shadow-sm">
                <p className="text-xl sm:text-2xl font-black text-foreground">{settings.stats.stat3Number}</p>
                <p className="text-xs text-muted-foreground font-medium mt-0.5">{settings.stats.stat3Label}</p>
              </div>
              <div className="p-3 sm:p-4 rounded-xl bg-card border border-border/70 shadow-sm">
                <p className="text-xl sm:text-2xl font-black text-emerald-600">{settings.stats.stat4Number}</p>
                <p className="text-xs text-muted-foreground font-medium mt-0.5">{settings.stats.stat4Label}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. RADIUS DISPATCH & FLEXIBILITY SECTION */}
      <section className="py-12 sm:py-20 bg-muted/20 border-b border-border/50">
        <div className="container max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14 space-y-2">
            <Badge variant="outline" className="text-primary border-primary/30 font-bold px-3 py-1">
              {settings.radiusSectionBadge}
            </Badge>
            <h2 className="text-2xl sm:text-4xl font-headline font-bold text-foreground">
              {settings.radiusSectionTitle}
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              {settings.radiusSectionDescription}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            {/* Card 1: Radius Matching */}
            <Card className="rounded-2xl border-border/80 shadow-md bg-card overflow-hidden flex flex-col justify-between">
              <CardHeader className="p-5 sm:p-7 space-y-3 pb-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                  <Compass className="h-6 w-6" />
                </div>
                <CardTitle className="text-xl sm:text-2xl font-bold font-headline text-foreground">
                  {settings.radiusCardTitle}
                </CardTitle>
                <CardDescription className="text-sm leading-relaxed text-muted-foreground">
                  {settings.radiusCardDescription}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 sm:p-7 pt-0 space-y-4">
                <div className="bg-primary/5 border border-primary/15 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-foreground">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-primary" /> Service Radius
                    </span>
                    <span className="text-primary font-mono text-base">{selectedRadiusKm} Kilometers</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[5, 10, 15].map((km) => (
                      <button
                        key={km}
                        type="button"
                        onClick={() => setSelectedRadiusKm(km)}
                        className={cn(
                          "py-2 px-3 rounded-lg text-xs font-bold transition-all border",
                          selectedRadiusKm === km 
                            ? "bg-primary text-white border-primary shadow-sm"
                            : "bg-background text-foreground border-border hover:bg-muted"
                        )}
                      >
                        {km} KM Radius
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    ✓ Only jobs within <strong>{selectedRadiusKm} KM</strong> of your address will be dispatched to your account.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Card 2: 1-Click Online/Offline Toggle Demo */}
            <Card className="rounded-2xl border-border/80 shadow-md bg-card overflow-hidden flex flex-col justify-between">
              <CardHeader className="p-5 sm:p-7 space-y-3 pb-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <Power className="h-6 w-6" />
                </div>
                <CardTitle className="text-xl sm:text-2xl font-bold font-headline text-foreground">
                  {settings.flexibilityCardTitle}
                </CardTitle>
                <CardDescription className="text-sm leading-relaxed text-muted-foreground">
                  {settings.flexibilityCardDescription}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 sm:p-7 pt-0 space-y-4">
                {/* Interactive Toggle Simulator */}
                <div className="bg-muted/40 border border-border/80 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Try Partner Status</p>
                      <p className="text-sm font-bold text-foreground mt-0.5">
                        {isDemoOnline ? "Ready for Customer Jobs" : "Personal Time / Other Work"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsDemoOnline(!isDemoOnline)}
                      className={cn(
                        "relative inline-flex h-9 w-20 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none shadow-sm",
                        isDemoOnline ? "bg-green-600" : "bg-neutral-300 dark:bg-neutral-700"
                      )}
                      aria-label="Toggle Online/Offline status"
                    >
                      <span
                        className={cn(
                          "pointer-events-none inline-block h-8 w-8 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out flex items-center justify-center text-[10px] font-black",
                          isDemoOnline ? "translate-x-11 text-green-700" : "translate-x-0 text-muted-foreground"
                        )}
                      >
                        {isDemoOnline ? "ON" : "OFF"}
                      </span>
                    </button>
                  </div>

                  <div className={cn(
                    "p-3 rounded-lg text-xs font-semibold flex items-center gap-2 border transition-all",
                    isDemoOnline 
                      ? "bg-green-50 text-green-800 border-green-200" 
                      : "bg-amber-50 text-amber-800 border-amber-200"
                  )}>
                    <div className={cn("w-2.5 h-2.5 rounded-full shrink-0 animate-ping", isDemoOnline ? "bg-green-600" : "bg-amber-500")} />
                    <span>
                      {isDemoOnline ? settings.flexibilityOnlineBadgeText : settings.flexibilityOfflineBadgeText}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    No forced shifts. Turn Offline whenever you have other commitments—no questions asked.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* 3. WORK EXPECTATIONS & AREA INDEXING */}
      <section className="py-12 sm:py-20 bg-background border-b border-border/50">
        <div className="container max-w-6xl mx-auto px-4 sm:px-6 space-y-10">
          <div className="text-center max-w-3xl mx-auto space-y-2">
            <Badge variant="outline" className="text-primary border-primary/30 font-bold px-3 py-1">
              {settings.expectationsBadge || "Work Expectations & Timelines"}
            </Badge>
            <h2 className="text-2xl sm:text-4xl font-headline font-bold text-foreground">
              {formatText(settings.expectationsTitle)}
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              {formatText(settings.expectationsDescription)}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="rounded-2xl border-border/80 shadow-sm bg-card p-6 sm:p-7 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <Clock className="h-6 w-6" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold font-headline text-foreground">
                {formatText(settings.expectationsPoint1Title)}
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {formatText(settings.expectationsPoint1Desc)}
              </p>
              <div className="pt-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300 px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-900/50">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  Area indexing by search engines takes natural ramp-up time
                </span>
              </div>
            </Card>

            <Card className="rounded-2xl border-border/80 shadow-sm bg-card p-6 sm:p-7 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold font-headline text-foreground">
                {formatText(settings.expectationsPoint2Title)}
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {formatText(settings.expectationsPoint2Desc)}
              </p>
              <div className="pt-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-900/50">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  100% verified customer requests delivered to your radius
                </span>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* 4. ONLINE/OFFLINE RESPONSIBILITY & STRICT CANCELLATION PENALTY */}
      <section className="py-12 sm:py-20 bg-destructive/5 border-b border-destructive/15">
        <div className="container max-w-6xl mx-auto px-4 sm:px-6 space-y-10">
          <div className="text-center max-w-3xl mx-auto space-y-2">
            <Badge variant="outline" className="text-destructive border-destructive/40 bg-destructive/10 font-bold px-3 py-1">
              {settings.penaltySectionBadge || "Strict Availability Policy"}
            </Badge>
            <h2 className="text-2xl sm:text-4xl font-headline font-bold text-foreground">
              {formatText(settings.penaltySectionTitle)}
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              {formatText(settings.penaltySectionDescription)}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Rule 1: 1 Day Advance */}
            <Card className="rounded-2xl border-border/80 shadow-sm bg-card p-6 sm:p-7 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <Calendar className="h-6 w-6" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold font-headline text-foreground">
                {formatText(settings.penaltyRule1Title)}
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {formatText(settings.penaltyRule1Desc)}
              </p>
              <div className="pt-2">
                <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-xs font-semibold text-foreground flex items-center gap-2">
                  <Power className="h-4 w-4 text-primary shrink-0" />
                  <span>No active bookings? You can turn <strong>OFF</strong> anytime instantly before you go anywhere.</span>
                </div>
              </div>
            </Card>

            {/* Rule 2: 100% Penalty */}
            <Card className="rounded-2xl border-destructive/30 shadow-md bg-card p-6 sm:p-7 space-y-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-destructive/10 rounded-full blur-2xl -z-0 pointer-events-none" />
              <div className="w-12 h-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold font-headline text-foreground">
                {formatText(settings.penaltyRule2Title)}
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {formatText(settings.penaltyRule2Desc)}
              </p>
              <div className="pt-2">
                <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/25 text-xs font-bold text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>Existing bookings must be completed. Refusing a booking while Online incurs a {settings.penaltyPercentage || 100}% penalty.</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* 5. COMMISSION, WITHDRAWALS & WALLET RULES */}
      <section className="py-12 sm:py-20 bg-muted/20 border-b border-border/50">
        <div className="container max-w-6xl mx-auto px-4 sm:px-6 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <Badge variant="outline" className="text-primary border-primary/30 font-bold px-3 py-1">
              {settings.commissionSectionBadge}
            </Badge>
            <h2 className="text-2xl sm:text-4xl font-headline font-bold text-foreground">
              {formatText(settings.commissionSectionTitle)}
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              {formatText(settings.commissionSectionDescription)}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Rule 1: Online Payments & 3-Day Withdrawals */}
            <div className="p-6 rounded-2xl bg-card border border-border/80 shadow-sm flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                  <CreditCard className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold font-headline text-foreground">
                  {formatText(settings.onlinePayoutTitle)}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {formatText(settings.onlinePayoutDescription)}
                </p>
              </div>
              <div className="pt-2 border-t border-border/60">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">
                  <Clock className="h-3.5 w-3.5" /> Request Withdrawal: Bank Credit in {settings.onlinePayoutTimelineDays || 3} Days
                </span>
              </div>
            </div>

            {/* Rule 2: Cash Payment (Pay After Service) */}
            <div className="p-6 rounded-2xl bg-card border border-border/80 shadow-sm flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-green-500/10 text-green-600 flex items-center justify-center">
                  <Banknote className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold font-headline text-foreground">
                  {formatText(settings.cashPaymentTitle)}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {formatText(settings.cashPaymentDescription)}
                </p>
              </div>
              <div className="pt-2 border-t border-border/60">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-green-700 bg-green-50 px-2.5 py-1 rounded-md">
                  <CheckCircle2 className="h-3.5 w-3.5" /> 100% Cash Direct in Your Hand
                </span>
              </div>
            </div>

            {/* Rule 3: Minimum Wallet Balance */}
            <div className="p-6 rounded-2xl bg-card border border-border/80 shadow-sm flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <Wallet className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold font-headline text-foreground">
                  {formatText(settings.walletRulesTitle)}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {formatText(settings.walletRulesDescription)}
                </p>
              </div>
              <div className="pt-2 border-t border-border/60">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-md">
                  <ShieldCheck className="h-3.5 w-3.5" /> Maintain {currencySymbol}{minWalletBalance} for Active Job Dispatch
                </span>
              </div>
            </div>
          </div>

          {/* Interactive Calculator */}
          <Card className="rounded-2xl border-primary/20 shadow-lg bg-gradient-to-br from-primary/5 via-card to-card p-6 sm:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-7 space-y-4">
                <Badge variant="outline" className="text-primary font-bold">Earnings Calculator</Badge>
                <h3 className="text-xl sm:text-2xl font-bold font-headline text-foreground">
                  Estimate Your Monthly Earnings with Fixbro
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Adjust the monthly job volume slider to see how much you take home after our transparent {commissionPercentage}% commission.
                </p>

                <div className="space-y-3 pt-3">
                  <div className="flex justify-between items-center text-sm font-bold">
                    <span>Monthly Work Value:</span>
                    <span className="text-lg text-primary font-mono font-black">{formatCurrency(simulatedEarnings, currencySymbol, 0, currencyCode)}</span>
                  </div>
                  <Slider 
                    value={[simulatedEarnings]} 
                    min={10000} 
                    max={150000} 
                    step={5000} 
                    onValueChange={(val) => setSimulatedEarnings(val[0])}
                    className="py-2"
                  />
                  <div className="flex justify-between text-[11px] text-muted-foreground font-mono">
                    <span>₹10,000</span>
                    <span>₹75,000</span>
                    <span>₹1,50,000</span>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-5 bg-background p-5 sm:p-6 rounded-2xl border border-border/80 shadow-md space-y-3">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Gross Job Value:</span>
                  <span className="font-semibold">{formatCurrency(simulatedEarnings, currencySymbol, 0, currencyCode)}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Platform Fee ({commissionPercentage}%):</span>
                  <span className="font-semibold text-destructive">- {formatCurrency(calculatedCommission, currencySymbol, 0, currencyCode)}</span>
                </div>
                <div className="pt-2 border-t border-dashed border-border" />
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-bold text-foreground">Your Net Payout:</span>
                  <span className="text-2xl font-black text-green-600 font-mono">
                    {formatCurrency(netTakeHome, currencySymbol, 0, currencyCode)}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground text-center pt-1">
                  * Calculated with Fixbro's {commissionPercentage}% partner commission rate.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* 4. DYNAMIC CATEGORY SHOWCASE & KEYWORDS (Matches User's Screenshots) */}
      <section id="category-jobs" className="py-12 sm:py-20 bg-muted/20 border-b border-border/50">
        <div className="container max-w-6xl mx-auto px-4 sm:px-6 space-y-8 sm:space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <Badge variant="outline" className="text-primary border-primary/30 font-bold px-3 py-1">
              {settings.categorySectionBadge}
            </Badge>
            <h2 className="text-2xl sm:text-4xl font-headline font-bold text-foreground">
              {settings.categorySectionTitle}
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              {settings.categorySectionDescription}
            </p>

            {/* Quick Search */}
            <div className="relative max-w-md mx-auto pt-3">
              <Search className="absolute left-3.5 top-5 h-4 w-4 text-muted-foreground" />
              <Input 
                type="text"
                placeholder="Search trade (e.g. Carpentry, TV Installation, Electrician)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-11 bg-background border-border rounded-xl shadow-sm"
              />
            </div>
          </div>

          {/* Category Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-6">
            {filteredCategories.map((category) => {
              const displayImageUrl = category.imageUrl && category.imageUrl.trim() !== '' 
                ? category.imageUrl 
                : '/default-image.png';

              return (
                <div 
                  key={category.id}
                  className="flex flex-col items-center p-4 rounded-2xl bg-card border border-border/70 hover:border-primary/40 hover:shadow-md transition-all duration-300 group text-center"
                >
                  {/* Circular Image Container matching user screenshots */}
                  <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-primary/5 p-2 border-2 border-border/80 group-hover:border-primary/50 transition-all duration-300 overflow-hidden shadow-inner flex items-center justify-center">
                    <AppImage
                      src={displayImageUrl}
                      alt={`${category.name} job work`}
                      fill
                      sizes="96px"
                      className="object-contain p-2 group-hover:scale-110 transition-transform duration-300"
                    />
                  </div>

                  {/* Category Name */}
                  <h4 className="font-bold text-sm sm:text-base text-foreground mt-3 group-hover:text-primary transition-colors line-clamp-1">
                    {category.name}
                  </h4>

                  {/* High-Intent SEO Keywords for Google Indexing */}
                  <div className="mt-2 space-y-0.5 w-full text-[11px] text-muted-foreground font-medium">
                    <p className="line-clamp-1 text-primary font-semibold text-xs">
                      {`${category.name} Job Near Me`}
                    </p>
                    <p className="line-clamp-1 text-[10px] text-muted-foreground">
                      {`${category.name} Work & Services`}
                    </p>
                  </div>

                  {/* Direct Registration CTA */}
                  <Link 
                    href={`/provider-registration?category=${encodeURIComponent(category.id)}`}
                    className="mt-3 w-full"
                  >
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="w-full text-xs h-8 font-bold rounded-lg group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-all"
                    >
                      Apply Now
                    </Button>
                  </Link>
                </div>
              );
            })}
          </div>

          {filteredCategories.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No categories found matching &quot;{searchTerm}&quot;. Try another trade keyword.
            </div>
          )}

          {/* SEO Local Jobs & Trade Searches Directory */}
          <div className="mt-8 p-5 sm:p-6 rounded-2xl bg-card border border-border/80 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-bold font-headline text-foreground flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary shrink-0" />
                  <span>Popular Local Trade Jobs Near You in Bangalore & India</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Direct job openings dispatched within your radius across all technician categories.
                </p>
              </div>
              <Badge variant="outline" className="text-xs text-primary border-primary/20 shrink-0 self-start sm:self-auto">
                Verified Customer Demand
              </Badge>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {categories.map((cat) => (
                <Link 
                  key={cat.id} 
                  href={`/provider-registration?category=${encodeURIComponent(cat.id)}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/40 hover:bg-primary/10 hover:text-primary hover:border-primary/30 border border-border/70 text-xs font-semibold text-foreground transition-all duration-200"
                >
                  <span>{`${cat.name} Job Near Me`}</span>
                  <span className="text-[10px] text-muted-foreground">• Apply</span>
                </Link>
              ))}
              <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-muted/20 border border-dashed border-border/70 text-xs font-medium text-muted-foreground">
                Doorstep Service Partner Work Bangalore
              </span>
              <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-muted/20 border border-dashed border-border/70 text-xs font-medium text-muted-foreground">
                Home Technician Jobs Near Me
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 7. 4 MANDATORY REGISTRATION STEPS */}
      <section className="py-12 sm:py-20 bg-background border-b border-border/50">
        <div className="container max-w-6xl mx-auto px-4 sm:px-6 space-y-10">
          <div className="text-center max-w-3xl mx-auto space-y-2">
            <Badge variant="outline" className="text-primary border-primary/30 font-bold px-3 py-1">
              {settings.stepsSectionBadge || "Mandatory Onboarding"}
            </Badge>
            <h2 className="text-2xl sm:text-4xl font-headline font-bold text-foreground">
              {formatText(settings.stepsSectionTitle)}
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              {formatText(settings.stepsSectionDescription)}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Step 1 */}
            <div className="p-5 sm:p-6 rounded-2xl bg-card border border-border/80 shadow-sm space-y-3 relative flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-9 h-9 rounded-xl bg-primary text-white text-sm font-black flex items-center justify-center shadow-md shadow-primary/20">
                    1
                  </span>
                  <span className="text-[10px] uppercase font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">Step 1</span>
                </div>
                <h3 className="font-bold text-base text-foreground font-headline">
                  {formatText(settings.step1Title)}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {formatText(settings.step1Desc)}
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="p-5 sm:p-6 rounded-2xl bg-card border border-border/80 shadow-sm space-y-3 relative flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-9 h-9 rounded-xl bg-primary text-white text-sm font-black flex items-center justify-center shadow-md shadow-primary/20">
                    2
                  </span>
                  <span className="text-[10px] uppercase font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">Step 2</span>
                </div>
                <h3 className="font-bold text-base text-foreground font-headline">
                  {formatText(settings.step2Title)}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {formatText(settings.step2Desc)}
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="p-5 sm:p-6 rounded-2xl bg-card border border-border/80 shadow-sm space-y-3 relative flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-9 h-9 rounded-xl bg-primary text-white text-sm font-black flex items-center justify-center shadow-md shadow-primary/20">
                    3
                  </span>
                  <span className="text-[10px] uppercase font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">Step 3</span>
                </div>
                <h3 className="font-bold text-base text-foreground font-headline">
                  {formatText(settings.step3Title)}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {formatText(settings.step3Desc)}
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="p-5 sm:p-6 rounded-2xl bg-card border border-border/80 shadow-sm space-y-3 relative flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-9 h-9 rounded-xl bg-primary text-white text-sm font-black flex items-center justify-center shadow-md shadow-primary/20">
                    4
                  </span>
                  <span className="text-[10px] uppercase font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">Step 4</span>
                </div>
                <h3 className="font-bold text-base text-foreground font-headline">
                  {formatText(settings.step4Title)}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {formatText(settings.step4Desc)}
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-primary/5 border border-primary/20 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
              <p className="text-xs sm:text-sm font-medium text-foreground">
                <strong>Mandatory Requirement:</strong> All 4 steps must be submitted. Verification is completed within 24-48 hours.
              </p>
            </div>
            <Link href={settings.heroCtaLink || "/provider-registration"} className="shrink-0 w-full sm:w-auto">
              <Button size="sm" className="w-full sm:w-auto font-bold gap-1.5 text-xs">
                Start Step 1 Now <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* 6. FAQS SECTION */}
      <section className="py-12 sm:py-20 bg-muted/20 border-b border-border/50">
        <div className="container max-w-4xl mx-auto px-4 sm:px-6 space-y-8">
          <div className="text-center space-y-2">
            <Badge variant="outline" className="text-primary border-primary/30 font-bold px-3 py-1">
              Got Questions?
            </Badge>
            <h2 className="text-2xl sm:text-4xl font-headline font-bold text-foreground">
              Frequently Asked Questions
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              Everything you need to know about joining, working, and getting paid with Fixbro.
            </p>
          </div>

          <Accordion type="single" collapsible className="w-full space-y-3">
            {settings.faqs.map((faq, index) => (
              <AccordionItem 
                key={index} 
                value={`faq-${index}`} 
                className="bg-card border border-border/80 rounded-xl px-4 py-1 shadow-sm"
              >
                <AccordionTrigger className="text-sm sm:text-base font-bold text-foreground text-left hover:no-underline">
                  {formatText(faq.question)}
                </AccordionTrigger>
                <AccordionContent className="text-xs sm:text-sm text-muted-foreground leading-relaxed pt-1 pb-3">
                  {formatText(faq.answer)}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* 7. BOTTOM CTA BANNER */}
      <section className="py-16 sm:py-24 bg-gradient-to-r from-primary to-primary/90 text-white relative overflow-hidden">
        <div className="container max-w-5xl mx-auto px-4 sm:px-6 text-center space-y-6 relative z-10">
          <h2 className="text-3xl sm:text-5xl font-black font-headline tracking-tight text-white">
            {settings.bottomCtaTitle}
          </h2>
          <p className="text-base sm:text-lg text-white/90 max-w-2xl mx-auto leading-relaxed">
            {settings.bottomCtaSubtitle}
          </p>
          <div className="pt-2">
            <Link href={settings.heroCtaLink || "/provider-registration"}>
              <Button 
                size="lg" 
                className="h-13 px-9 text-base sm:text-lg font-black bg-white text-primary hover:bg-white/95 rounded-2xl shadow-2xl transition-all gap-2"
              >
                <span>{settings.bottomCtaButtonText}</span>
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* 8. STICKY MOBILE BOTTOM BAR FOR CONVERSIONS */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-50 p-3 bg-background/95 backdrop-blur-md border-t border-border shadow-2xl flex items-center justify-between gap-3">
        <div className="flex-1">
          <p className="text-xs font-bold text-foreground">Join as Partner</p>
          <p className="text-[10px] text-green-600 font-semibold">Verified Jobs in Your Radius</p>
        </div>
        <Link href="/provider-registration" className="shrink-0">
          <Button size="sm" className="h-9 px-4 font-bold rounded-lg shadow-sm">
            Register Now
          </Button>
        </Link>
      </div>
    </div>
  );
}
