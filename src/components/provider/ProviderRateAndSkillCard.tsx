"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  Award, 
  Coins, 
  Clock, 
  ShieldCheck, 
  AlertCircle, 
  Loader2, 
  XCircle, 
  TrendingUp,
  Sparkles,
  Info
} from "lucide-react";
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useApplicationConfig } from '@/hooks/useApplicationConfig';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, getDoc, collection, query, where, getDocs } from '@/lib/mysqlDb';
import type { ProviderApplication, RateAndSkillChangeRequest, FirestoreCategory } from '@/types/firestore';
import { 
  requestRateAndSkillChangeAction, 
  cancelRateAndSkillChangeAction 
} from '@/app/actions/rateAndSkillChangeActions';
import { cn } from "@/lib/utils";

export default function ProviderRateAndSkillCard() {
  const { user: providerUser } = useAuth();
  const { toast } = useToast();
  const { config: appConfig } = useApplicationConfig();
  const symbol = appConfig?.currencySymbol || '₹';
  const decimals = appConfig?.currencyDecimalPoints !== undefined ? appConfig.currencyDecimalPoints : 0;

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [providerApp, setProviderApp] = useState<ProviderApplication | null>(null);

  // Dynamic category and skill options from backend/admin setup
  const [categoryData, setCategoryData] = useState<FirestoreCategory | null>(null);
  const [skillOptions, setSkillOptions] = useState<{ id: string; label: string; minRate?: number; maxRate?: number }[]>([]);

  // Form State
  const [selectedLevel, setSelectedLevel] = useState<string>('Intermediate');
  const [dailyRateInput, setDailyRateInput] = useState<number>(1200);

  // Real-time listener for provider application so status updates instantly upon admin approval
  useEffect(() => {
    if (!providerUser?.uid) return;
    setIsLoading(true);
    const docRef = doc(db, "providerApplications", providerUser.uid);
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as ProviderApplication;
          setProviderApp(data);
          if (data.seniorityLevel) setSelectedLevel(data.seniorityLevel);
          if (data.dailyRate) setDailyRateInput(Number(data.dailyRate));
        }
        setIsLoading(false);
      },
      (error) => {
        console.error("Error subscribing to provider rate and skill data:", error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [providerUser?.uid]);

  // Load category and dynamic seniority rate rules
  useEffect(() => {
    if (!providerApp) return;

    let isMounted = true;
    async function loadCategoryAndSkills() {
      try {
        let cat: FirestoreCategory | null = null;
        if (providerApp?.workCategoryId) {
          const catSnap = await getDoc(doc(db, "adminCategories", providerApp.workCategoryId));
          if (catSnap.exists()) {
            cat = { id: catSnap.id, ...(catSnap.data() as any) };
          }
        }
        if (!cat && providerApp?.workCategoryName) {
          const q = query(collection(db, "adminCategories"), where("name", "==", providerApp.workCategoryName));
          const snap = await getDocs(q);
          if (!snap.empty) {
            cat = { id: snap.docs[0].id, ...(snap.docs[0].data() as any) };
          }
        }

        // Fetch global skill levels from providerControlOptions as fallback/source
        const skillLevelsSnap = await getDoc(doc(db, "providerControlOptions", "skillLevels"));
        const globalLevels: { id: string; label: string }[] = skillLevelsSnap.exists()
          ? (skillLevelsSnap.data().levels || [])
          : [];

        if (!isMounted) return;
        setCategoryData(cat);

        // Derive skill options based on category's configured seniorityRates
        const rawRates = cat?.seniorityRates;
        const rates: any[] = Array.isArray(rawRates)
          ? rawRates
          : (typeof rawRates === 'string' ? JSON.parse(rawRates || '[]') : []);

        let opts: { id: string; label: string; minRate?: number; maxRate?: number }[] = [];

        if (rates && rates.length > 0) {
          // Exactly the skill levels configured in the category with their respective rate bounds
          opts = rates.map((r: any) => ({
            id: r.skillLevelId || r.skillLevelLabel,
            label: r.skillLevelLabel || r.skillLevelId,
            minRate: typeof r.minRate === 'number' ? r.minRate : 500,
            maxRate: typeof r.maxRate === 'number' ? r.maxRate : 2500,
          }));
        } else if (globalLevels.length > 0) {
          opts = globalLevels.map((lvl) => ({
            id: lvl.id || lvl.label,
            label: lvl.label,
            minRate: 500,
            maxRate: 2500,
          }));
        } else {
          opts = [
            { id: 'Beginner', label: 'Beginner', minRate: 600, maxRate: 1000 },
            { id: 'Intermediate', label: 'Intermediate', minRate: 900, maxRate: 1400 },
            { id: 'Expert', label: 'Expert', minRate: 1200, maxRate: 1800 },
          ];
        }

        setSkillOptions(opts);
      } catch (err) {
        console.error("Error loading category and skill levels for provider:", err);
      }
    }

    loadCategoryAndSkills();
    return () => {
      isMounted = false;
    };
  }, [providerApp?.workCategoryId, providerApp?.workCategoryName]);

  const currentLevel = providerApp?.seniorityLevel || providerApp?.skillLevelLabel || 'Expert';
  const currentDailyRate = Number(providerApp?.dailyRate) || 1200;

  const pendingRequest = providerApp?.rateAndSkillChangeRequest?.status === 'pending'
    ? providerApp.rateAndSkillChangeRequest
    : null;

  // Active rate bounds resolution
  const chosenSkillOption = skillOptions.find(
    (o) => o.id === selectedLevel || o.label.toLowerCase() === selectedLevel.toLowerCase()
  );

  const rawCategoryRates = categoryData?.seniorityRates;
  const ratesList: any[] = Array.isArray(rawCategoryRates)
    ? rawCategoryRates
    : (typeof rawCategoryRates === 'string' ? JSON.parse(rawCategoryRates || '[]') : []);

  const activeRateRule = ratesList.find(
    (r: any) =>
      r.skillLevelId === selectedLevel ||
      (chosenSkillOption && r.skillLevelId === chosenSkillOption.id) ||
      (chosenSkillOption && r.skillLevelLabel && r.skillLevelLabel.trim().toLowerCase() === chosenSkillOption.label.trim().toLowerCase()) ||
      (r.skillLevelLabel && r.skillLevelLabel.trim().toLowerCase() === selectedLevel.trim().toLowerCase())
  );

  const minRate = activeRateRule?.minRate ?? chosenSkillOption?.minRate ?? 500;
  const maxRate = activeRateRule?.maxRate ?? chosenSkillOption?.maxRate ?? 2500;

  let realTimeError: string | null = null;
  if (dailyRateInput !== null && !isNaN(dailyRateInput)) {
    if (dailyRateInput < minRate) {
      realTimeError = `Daily rate cannot be less than ${symbol}${minRate}. Please enter at least ${symbol}${minRate}.`;
    } else if (dailyRateInput > maxRate) {
      realTimeError = `Daily rate cannot exceed ${symbol}${maxRate}. Please enter at most ${symbol}${maxRate}.`;
    }
  }

  const handleOpenDialog = () => {
    const cur = providerApp?.skillLevelId || providerApp?.skillLevelLabel || providerApp?.seniorityLevel || 'Expert';
    const matched = skillOptions.find(
      (o) =>
        o.id === cur ||
        o.label.toLowerCase() === cur.toLowerCase() ||
        (providerApp?.seniorityLevel && o.label.toLowerCase() === providerApp.seniorityLevel.toLowerCase()) ||
        (providerApp?.skillLevelLabel && o.label.toLowerCase() === providerApp.skillLevelLabel.toLowerCase())
    );

    const initialLevel = matched ? matched.id : (skillOptions[0]?.id || cur);
    setSelectedLevel(initialLevel);
    setDailyRateInput(currentDailyRate);
    setIsDialogOpen(true);
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!providerUser?.uid) return;

    if (!dailyRateInput || isNaN(dailyRateInput)) {
      toast({
        title: "Invalid Rate",
        description: "Please enter a valid daily wage rate.",
        variant: "destructive",
      });
      return;
    }

    if (dailyRateInput < minRate) {
      toast({
        title: "Daily Rate Too Low",
        description: `Daily rate cannot be less than ${symbol}${minRate} for ${chosenSkillOption?.label || selectedLevel}.`,
        variant: "destructive",
      });
      return;
    }

    if (dailyRateInput > maxRate) {
      toast({
        title: "Daily Rate Too High",
        description: `Daily rate cannot exceed ${symbol}${maxRate} for ${chosenSkillOption?.label || selectedLevel}.`,
        variant: "destructive",
      });
      return;
    }

    const skillLabel = chosenSkillOption ? chosenSkillOption.label : selectedLevel;

    setIsSubmitting(true);
    try {
      const res = await requestRateAndSkillChangeAction({
        providerId: providerUser.uid,
        newSeniorityLevel: skillLabel,
        newSkillLevelLabel: skillLabel,
        newDailyRate: dailyRateInput,
      });

      if (!res.success) {
        throw new Error(res.message);
      }

      toast({
        title: "Request Submitted",
        description: "Your new skill level and daily rate have been submitted for admin approval.",
      });
      setIsDialogOpen(false);
    } catch (err: any) {
      toast({
        title: "Submission Failed",
        description: err.message || "Could not submit change request.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!providerUser?.uid) return;
    setIsSubmitting(true);
    try {
      const res = await cancelRateAndSkillChangeAction(providerUser.uid);
      if (!res.success) {
        throw new Error(res.message);
      }
      toast({
        title: "Request Cancelled",
        description: "Your pending rate change request has been cancelled.",
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to cancel request.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="shadow-sm">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
          <span className="text-sm text-muted-foreground">Loading skill & rate details...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="shadow-sm border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-xl text-primary">
                <Award className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">Skill Level &amp; Daily Wage Rate</CardTitle>
                <CardDescription className="text-xs">
                  Your transparent expertise classification and daily earnings on FixBro.
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="font-semibold capitalize px-2.5 py-1 text-xs">
              {currentLevel}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 text-sm">
          {/* Current Live Values */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-xl bg-muted/40 border">
              <span className="text-xs text-muted-foreground font-medium block">Current Seniority Tier</span>
              <p className="text-lg font-bold text-foreground mt-0.5 flex items-center gap-1.5">
                <Award className="h-4 w-4 text-primary" />
                {currentLevel}
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
              <span className="text-xs text-muted-foreground font-medium block">Live Daily Wage Rate</span>
              <p className="text-lg font-extrabold text-emerald-600 mt-0.5 flex items-center gap-1.5">
                <Coins className="h-4 w-4" />
                {symbol}{currentDailyRate.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">/ full day</span>
              </p>
            </div>
          </div>

          {/* Pending Approval Banner */}
          {pendingRequest && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 text-amber-900 dark:text-amber-300 font-bold text-sm">
                  <Clock className="h-4 w-4 text-amber-600 animate-spin" />
                  <span>Update Request Pending Admin Approval</span>
                </div>
                <Badge className="bg-amber-600 text-white text-[10px] uppercase font-bold">
                  Pending Review
                </Badge>
              </div>
              <p className="text-xs text-amber-800 dark:text-amber-400">
                You requested to change your daily rate and seniority tier. For client safety and quality control, this update will go live across FixBro once approved by the administrator.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                <div className="p-2.5 rounded-lg bg-white/80 dark:bg-zinc-900 border">
                  <span className="text-[11px] text-muted-foreground block">Current (Live):</span>
                  <strong className="text-foreground">{pendingRequest.previousSeniorityLevel} — {symbol}{pendingRequest.previousDailyRate}/day</strong>
                </div>
                <div className="p-2.5 rounded-lg bg-white/80 dark:bg-zinc-900 border border-amber-300">
                  <span className="text-[11px] text-amber-700 dark:text-amber-300 font-semibold block">Requested (After Approval):</span>
                  <strong className="text-amber-900 dark:text-amber-200">{pendingRequest.newSeniorityLevel} — {symbol}{pendingRequest.newDailyRate}/day</strong>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancelRequest}
                  disabled={isSubmitting}
                  className="text-xs text-red-600 hover:text-red-700 border-red-200"
                >
                  {isSubmitting ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <XCircle className="mr-1 h-3.5 w-3.5" />}
                  Cancel Request
                </Button>
              </div>
            </div>
          )}

          {/* Rejected Banner if previously rejected */}
          {providerApp?.rateAndSkillChangeRequest?.status === 'rejected' && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 text-xs text-red-800 dark:text-red-300 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <strong>Previous request not approved:</strong> {providerApp.rateAndSkillChangeRequest.rejectionReason || 'Please contact admin for more information.'}
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex justify-end border-t pt-3">
          <Button
            onClick={handleOpenDialog}
            disabled={!!pendingRequest || isSubmitting}
            className="rounded-xl font-bold"
          >
            <TrendingUp className="mr-2 h-4 w-4" />
            Request Skill &amp; Rate Change
          </Button>
        </CardFooter>
      </Card>

      {/* Change Request Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[440px] rounded-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="h-5 w-5" />
              <DialogTitle className="text-lg">Update Skill Level &amp; Rate</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              Select your updated skill level and new daily rate. Upon submission, it will be sent to the FixBro admin team for verification before going live.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitRequest} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Choose Seniority / Skill Level</Label>
              <Select 
                value={selectedLevel} 
                onValueChange={(val) => {
                  setSelectedLevel(val);
                  // Adjust dailyRateInput if outside new skill level bounds
                  const newOpt = skillOptions.find(o => o.id === val || o.label.toLowerCase() === val.toLowerCase());
                  const newRule = ratesList.find((r: any) =>
                    r.skillLevelId === val ||
                    (newOpt && r.skillLevelId === newOpt.id) ||
                    (newOpt && r.skillLevelLabel && r.skillLevelLabel.trim().toLowerCase() === newOpt.label.trim().toLowerCase()) ||
                    (r.skillLevelLabel && r.skillLevelLabel.trim().toLowerCase() === val.trim().toLowerCase())
                  );
                  const nMin = newRule?.minRate ?? newOpt?.minRate ?? 500;
                  const nMax = newRule?.maxRate ?? newOpt?.maxRate ?? 2500;
                  if (dailyRateInput < nMin) setDailyRateInput(nMin);
                  else if (dailyRateInput > nMax) setDailyRateInput(nMax);
                }}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select level" />
                </SelectTrigger>
                <SelectContent>
                  {skillOptions.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="rateInput" className="text-xs font-semibold">
                  Requested Daily Wage Rate ({symbol})
                </Label>
                <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20 font-semibold">
                  Allowed: {symbol}{minRate} - {symbol}{maxRate}
                </Badge>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-muted-foreground font-semibold">{symbol}</span>
                <Input
                  id="rateInput"
                  type="number"
                  min={minRate}
                  max={maxRate}
                  step={1}
                  value={dailyRateInput}
                  onChange={(e) => setDailyRateInput(Number(e.target.value) || 0)}
                  className={cn(
                    "pl-8 rounded-xl font-semibold text-base",
                    realTimeError && "border-destructive focus-visible:ring-destructive"
                  )}
                  placeholder={activeRateRule ? String(activeRateRule.minRate) : "1200"}
                  required
                />
              </div>

              {/* Guidance / Instruction Message */}
              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 text-primary shrink-0" />
                <span>
                  Allowed rate is between {symbol}{minRate} and {symbol}{maxRate} for {chosenSkillOption?.label || selectedLevel} in {categoryData?.name || providerApp?.workCategoryName || 'this category'}. Please set your desired amount within this range.
                </span>
              </p>

              {/* Real-time Error Message */}
              {realTimeError && (
                <p className="text-xs font-semibold text-destructive flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  {realTimeError}
                </p>
              )}
            </div>

            <div className="p-3 bg-muted/40 rounded-xl border text-[11px] text-muted-foreground flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
              <span>
                FixBro reviews all rate updates to maintain competitive pricing and skill standards.
              </span>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isSubmitting}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !!realTimeError}
                className="rounded-xl font-bold"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit for Approval"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
