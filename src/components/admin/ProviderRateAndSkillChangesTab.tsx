"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  TrendingUp, 
  Award, 
  Coins, 
  ArrowRight, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Clock, 
  UserCircle,
  Phone,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  Briefcase
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  getPendingRateAndSkillChangesAction, 
  approveRateAndSkillChangeAction, 
  rejectRateAndSkillChangeAction,
  type PendingRateAndSkillChangeItem
} from '@/app/actions/rateAndSkillChangeActions';
import { getTimestampMillis, formatDateInTimezone, formatTimeInTimezone } from '@/lib/utils';
import { useApplicationConfig } from '@/hooks/useApplicationConfig';
import { db } from '@/lib/firebase';
import { collection, getDocs } from '@/lib/mysqlDb';

interface ProviderRateAndSkillChangesTabProps {
  onUpdated?: () => void;
}

export default function ProviderRateAndSkillChangesTab({ onUpdated }: ProviderRateAndSkillChangesTabProps) {
  const { toast } = useToast();
  const { config: appConfig } = useApplicationConfig();
  const symbol = appConfig?.currencySymbol || '₹';
  const [requests, setRequests] = useState<PendingRateAndSkillChangeItem[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Reject Dialog State
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [selectedItemForReject, setSelectedItemForReject] = useState<PendingRateAndSkillChangeItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [reqs, catsSnap] = await Promise.all([
        getPendingRateAndSkillChangesAction(),
        getDocs(collection(db, "adminCategories")).catch(() => ({ docs: [] } as any))
      ]);
      setRequests(reqs);
      const catList = catsSnap.docs ? catsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() })) : [];
      setCategories(catList);
    } catch (e) {
      console.error("Error loading rate and skill change requests:", e);
      toast({ title: "Error", description: "Failed to load skill & rate change requests.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleApprove = async (item: PendingRateAndSkillChangeItem) => {
    if (processingId) return;
    setProcessingId(item.providerId);
    try {
      const res = await approveRateAndSkillChangeAction(item.providerId);
      if (res.success) {
        toast({ title: "Approved!", description: res.message });
        setRequests(prev => prev.filter(r => r.providerId !== item.providerId));
        if (onUpdated) onUpdated();
      } else {
        toast({ title: "Error", description: res.message, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to approve request.", variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  const handleOpenReject = (item: PendingRateAndSkillChangeItem) => {
    setSelectedItemForReject(item);
    setRejectionReason("");
    setIsRejectDialogOpen(true);
  };

  const handleConfirmReject = async () => {
    if (!selectedItemForReject || processingId) return;
    setProcessingId(selectedItemForReject.providerId);
    try {
      const res = await rejectRateAndSkillChangeAction(selectedItemForReject.providerId, rejectionReason);
      if (res.success) {
        toast({ title: "Rejected", description: res.message });
        setRequests(prev => prev.filter(r => r.providerId !== selectedItemForReject.providerId));
        setIsRejectDialogOpen(false);
        if (onUpdated) onUpdated();
      } else {
        toast({ title: "Error", description: res.message, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to reject request.", variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading skill &amp; rate change requests...</p>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-12 px-4 border border-dashed rounded-xl bg-muted/10 space-y-3">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto text-primary">
          <Award className="h-6 w-6" />
        </div>
        <h3 className="font-bold text-base text-foreground">No Pending Skill or Rate Change Requests</h3>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          All provider seniority tier and daily wage rate update requests have been reviewed. New requests from active providers will appear here.
        </p>
        <Button variant="outline" size="sm" onClick={loadData} className="text-xs">
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Check for New Requests
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-1">
        <div className="text-sm text-muted-foreground">
          Showing <strong>{requests.length}</strong> pending skill &amp; rate change {requests.length === 1 ? 'request' : 'requests'}
        </div>
        <Button variant="outline" size="sm" onClick={loadData} className="text-xs">
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
        </Button>
      </div>

      <div className="grid gap-4">
        {requests.map((item) => {
          const req = item.request;
          const reqTime = getTimestampMillis(req.requestedAt);
          const timeFormatted = reqTime 
            ? `${formatDateInTimezone(new Date(reqTime), appConfig?.timezone || 'Asia/Kolkata', appConfig?.dateFormat)} ${formatTimeInTimezone(new Date(reqTime), appConfig?.timezone || 'Asia/Kolkata')}`
            : 'Recent';

          const isCurrentBusy = processingId === item.providerId;

          // Lookup category rate limits
          const cat = categories.find(c => c.id === item.workCategoryId || c.name === item.workCategoryName);
          const rawRates = cat?.seniorityRates;
          const rates: any[] = Array.isArray(rawRates)
            ? rawRates
            : (typeof rawRates === 'string' ? JSON.parse(rawRates || '[]') : []);

          const targetLevel = (req.newSkillLevelLabel || req.newSeniorityLevel || '').trim().toLowerCase();
          const targetId = (req.newSeniorityLevel || '').trim().toLowerCase();

          const matchedRule = rates.find((r: any) => {
            const rLabel = (r.skillLevelLabel || '').trim().toLowerCase();
            const rId = (r.skillLevelId || '').trim().toLowerCase();
            return (rLabel && targetLevel && rLabel === targetLevel) ||
                   (rId && targetId && rId === targetId) ||
                   (rId && targetLevel && rId === targetLevel);
          });

          const minAllowed = matchedRule?.minRate;
          const maxAllowed = matchedRule?.maxRate;

          return (
            <Card key={item.providerId} className="border-border/70 shadow-sm overflow-hidden">
              <CardHeader className="p-4 bg-muted/20 border-b">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border shrink-0">
                      <AvatarImage src={item.photoUrl || undefined} alt={item.providerName} />
                      <AvatarFallback>{item.providerName ? item.providerName[0] : <UserCircle />}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h4 className="font-bold text-sm text-foreground">{item.providerName}</h4>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {item.workCategoryName && (
                          <span className="font-medium text-primary flex items-center gap-1">
                            <Briefcase className="h-3 w-3" /> {item.workCategoryName}
                          </span>
                        )}
                        {item.providerPhone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {item.providerPhone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Requested: {timeFormatted}
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-4 space-y-4">
                {/* Before vs After Comparison Grid */}
                <div className="grid gap-4 md:grid-cols-2">
                  {/* Before */}
                  <div className="p-4 rounded-xl border bg-muted/30 space-y-3">
                    <div className="flex items-center justify-between border-b pb-2">
                      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                        Current Live Status (Before)
                      </span>
                      <Badge variant="secondary" className="text-xs font-semibold">
                        Live on Site
                      </Badge>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Seniority Tier:</span>
                        <span className="font-bold text-foreground flex items-center gap-1 text-sm">
                          <Award className="h-3.5 w-3.5 text-muted-foreground" />
                          {req.previousSeniorityLevel}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Daily Wage Rate:</span>
                        <span className="font-extrabold text-foreground text-sm flex items-center gap-1">
                          <Coins className="h-3.5 w-3.5 text-muted-foreground" />
                          {symbol}{(req.previousDailyRate ?? 0).toLocaleString()} <span className="text-[11px] font-normal text-muted-foreground">/ day</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* After */}
                  <div className="p-4 rounded-xl border-2 border-primary/30 bg-primary/5 space-y-3">
                    <div className="flex items-center justify-between border-b border-primary/20 pb-2">
                      <span className="text-[11px] font-bold text-primary uppercase tracking-wider flex items-center gap-1">
                        Requested Update (After Approval) <ArrowRight className="h-3 w-3 text-primary" />
                      </span>
                      <Badge className="text-xs font-bold bg-primary text-primary-foreground">
                        Requested
                      </Badge>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">New Seniority Tier:</span>
                        <span className="font-bold text-primary flex items-center gap-1 text-sm">
                          <Award className="h-3.5 w-3.5 text-primary" />
                          {req.newSeniorityLevel}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">New Daily Wage Rate:</span>
                        <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-base flex items-center gap-1">
                          <Coins className="h-4 w-4" />
                          {symbol}{(req.newDailyRate ?? 0).toLocaleString()} <span className="text-xs font-normal text-muted-foreground">/ day</span>
                        </span>
                      </div>

                      {/* Category Allowed Limits */}
                      {typeof minAllowed === 'number' && typeof maxAllowed === 'number' && (
                        <div className="pt-1.5 border-t border-primary/10 flex items-center justify-between">
                          <span className="text-[11px] text-muted-foreground">Category Allowed Range:</span>
                          <Badge variant="outline" className="text-[11px] bg-primary/10 text-primary border-primary/20 font-semibold">
                            {symbol}{minAllowed.toLocaleString()} - {symbol}{maxAllowed.toLocaleString()}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="p-4 bg-muted/10 border-t flex justify-end gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenReject(item)}
                  disabled={isCurrentBusy}
                  className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <XCircle className="h-3.5 w-3.5 mr-1.5" />
                  Reject Request
                </Button>

                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleApprove(item)}
                  disabled={isCurrentBusy}
                  className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isCurrentBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Approve &amp; Make Live
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Reject Reason Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Reject Skill &amp; Rate Request</DialogTitle>
            <DialogDescription>
              Provide an explanation to {selectedItemForReject?.providerName} for declining this rate and skill level change.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-2">
            <Label htmlFor="rejectionReason" className="text-xs font-semibold">
              Rejection Reason / Notes
            </Label>
            <Textarea
              id="rejectionReason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Daily rate is outside the allowed band for this seniority classification."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmReject}
              disabled={processingId !== null}
            >
              {processingId !== null && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
