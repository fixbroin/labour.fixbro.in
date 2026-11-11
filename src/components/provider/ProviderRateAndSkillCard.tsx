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
  CheckCircle2, 
  XCircle, 
  ArrowRight,
  TrendingUp,
  Sparkles
} from "lucide-react";
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from '@/lib/mysqlDb';
import type { ProviderApplication, RateAndSkillChangeRequest } from '@/types/firestore';
import { 
  requestRateAndSkillChangeAction, 
  cancelRateAndSkillChangeAction 
} from '@/app/actions/rateAndSkillChangeActions';

const SENIORITY_LEVEL_OPTIONS = [
  { id: 'Fresher', label: 'Fresher / Helper' },
  { id: 'Intermediate', label: 'Intermediate' },
  { id: 'Advanced', label: 'Advanced' },
  { id: 'Senior', label: 'Senior' },
  { id: 'Expert', label: 'Expert' },
];

export default function ProviderRateAndSkillCard() {
  const { user: providerUser } = useAuth();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [providerApp, setProviderApp] = useState<ProviderApplication | null>(null);

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

  const currentLevel = providerApp?.seniorityLevel || providerApp?.skillLevelLabel || 'Fresher';
  const currentDailyRate = Number(providerApp?.dailyRate) || 1200;

  const pendingRequest = providerApp?.rateAndSkillChangeRequest?.status === 'pending'
    ? providerApp.rateAndSkillChangeRequest
    : null;

  const handleOpenDialog = () => {
    setSelectedLevel(currentLevel);
    setDailyRateInput(currentDailyRate);
    setIsDialogOpen(true);
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!providerUser?.uid) return;

    if (!dailyRateInput || dailyRateInput < 100) {
      toast({
        title: "Invalid Rate",
        description: "Please enter a valid daily wage rate (minimum ₹100).",
        variant: "destructive",
      });
      return;
    }

    const matchedOption = SENIORITY_LEVEL_OPTIONS.find(o => o.id === selectedLevel);
    const skillLabel = matchedOption ? matchedOption.label : selectedLevel;

    setIsSubmitting(true);
    try {
      const res = await requestRateAndSkillChangeAction({
        providerId: providerUser.uid,
        newSeniorityLevel: selectedLevel,
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
                <CardTitle className="text-lg">Skill Level & Daily Wage Rate</CardTitle>
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
                ₹{currentDailyRate} <span className="text-xs font-normal text-muted-foreground">/ full day</span>
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
                  <strong className="text-foreground">{pendingRequest.previousSeniorityLevel} — ₹{pendingRequest.previousDailyRate}/day</strong>
                </div>
                <div className="p-2.5 rounded-lg bg-white/80 dark:bg-zinc-900 border border-amber-300">
                  <span className="text-[11px] text-amber-700 dark:text-amber-300 font-semibold block">Requested (After Approval):</span>
                  <strong className="text-amber-900 dark:text-amber-200">{pendingRequest.newSeniorityLevel} — ₹{pendingRequest.newDailyRate}/day</strong>
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
              <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select level" />
                </SelectTrigger>
                <SelectContent>
                  {SENIORITY_LEVEL_OPTIONS.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rateInput" className="text-xs font-semibold">
                Requested Daily Wage Rate (₹)
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-muted-foreground font-semibold">₹</span>
                <Input
                  id="rateInput"
                  type="number"
                  min={100}
                  step={50}
                  value={dailyRateInput}
                  onChange={(e) => setDailyRateInput(Number(e.target.value) || 0)}
                  className="pl-8 rounded-xl font-semibold text-base"
                  placeholder="1200"
                  required
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Your direct daily take-home earnings per booking shift (excl. platform markup).
              </p>
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
                disabled={isSubmitting}
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
