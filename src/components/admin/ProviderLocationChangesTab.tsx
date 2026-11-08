"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  MapPin, 
  ArrowRight, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  ExternalLink, 
  Clock, 
  UserCircle,
  Phone,
  RefreshCw,
  AlertCircle
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
  getPendingServiceAreaChangesAction, 
  approveServiceAreaChangeAction, 
  rejectServiceAreaChangeAction
} from '@/app/actions/serviceAreaChangeActions';
import type { PendingLocationChangeItem } from '@/types/providerAreaAndId';
import { getTimestampMillis, formatDateInTimezone, formatTimeInTimezone } from '@/lib/utils';
import { useApplicationConfig } from '@/hooks/useApplicationConfig';

export default function ProviderLocationChangesTab() {
  const { toast } = useToast();
  const { config: appConfig } = useApplicationConfig();
  const [requests, setRequests] = useState<PendingLocationChangeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Reject Dialog State
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [selectedItemForReject, setSelectedItemForReject] = useState<PendingLocationChangeItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const loadRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getPendingServiceAreaChangesAction();
      setRequests(data);
    } catch (e) {
      console.error("Error loading location change requests:", e);
      toast({ title: "Error", description: "Failed to load location change requests.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleApprove = async (item: PendingLocationChangeItem) => {
    if (processingId) return;
    setProcessingId(item.providerId);
    try {
      const res = await approveServiceAreaChangeAction(item.providerId);
      if (res.success) {
        toast({ title: "Approved!", description: res.message });
        setRequests(prev => prev.filter(r => r.providerId !== item.providerId));
      } else {
        toast({ title: "Error", description: res.message, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to approve.", variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  const handleOpenReject = (item: PendingLocationChangeItem) => {
    setSelectedItemForReject(item);
    setRejectionReason("");
    setIsRejectDialogOpen(true);
  };

  const handleConfirmReject = async () => {
    if (!selectedItemForReject || processingId) return;
    setProcessingId(selectedItemForReject.providerId);
    try {
      const res = await rejectServiceAreaChangeAction(selectedItemForReject.providerId, rejectionReason);
      if (res.success) {
        toast({ title: "Rejected", description: res.message });
        setRequests(prev => prev.filter(r => r.providerId !== selectedItemForReject.providerId));
        setIsRejectDialogOpen(false);
      } else {
        toast({ title: "Error", description: res.message, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to reject.", variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-16 px-4 bg-muted/10 rounded-2xl border border-dashed border-border/80 space-y-3">
        <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-full w-12 h-12 mx-auto flex items-center justify-center">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-bold text-foreground">No Pending Location Requests</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          All service provider location and operational radius change requests have been processed.
        </p>
        <Button variant="outline" size="sm" onClick={loadRequests} className="mt-2 text-xs">
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh List
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-1">
        <div className="text-sm text-muted-foreground">
          Showing <strong>{requests.length}</strong> pending location change {requests.length === 1 ? 'request' : 'requests'}
        </div>
        <Button variant="outline" size="sm" onClick={loadRequests} className="text-xs">
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
                        {item.categoryName && <span className="font-medium text-primary">{item.categoryName}</span>}
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
                  <div className="p-3.5 rounded-xl border bg-muted/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                        Current Active Location (Before)
                      </span>
                      <Badge variant="secondary" className="text-xs font-bold">
                        {req.previousRadiusKm} km radius
                      </Badge>
                    </div>
                    <p className="text-xs text-foreground font-medium leading-relaxed">
                      {req.previousAddress}
                    </p>
                    {req.previousCenter && (
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] text-muted-foreground font-mono">
                          Lat: {req.previousCenter.latitude?.toFixed(5)}, Lng: {req.previousCenter.longitude?.toFixed(5)}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(`https://www.google.com/maps?q=${req.previousCenter?.latitude},${req.previousCenter?.longitude}`, '_blank')}
                          className="h-6 text-[11px] px-2 text-primary"
                        >
                          View Map <ExternalLink className="ml-1 h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* After */}
                  <div className="p-3.5 rounded-xl border-2 border-primary/30 bg-primary/5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-primary uppercase tracking-wider flex items-center gap-1">
                        Requested New Location (After) <ArrowRight className="h-3 w-3 text-primary" />
                      </span>
                      <Badge className="text-xs font-bold bg-primary text-primary-foreground">
                        {req.newRadiusKm} km radius
                      </Badge>
                    </div>
                    <p className="text-xs text-foreground font-semibold leading-relaxed">
                      {req.newAddress}
                    </p>
                    {req.newCenter && (
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] text-muted-foreground font-mono">
                          Lat: {req.newCenter.latitude?.toFixed(5)}, Lng: {req.newCenter.longitude?.toFixed(5)}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(`https://www.google.com/maps?q=${req.newCenter?.latitude},${req.newCenter?.longitude}`, '_blank')}
                          className="h-6 text-[11px] px-2 text-primary"
                        >
                          View Map <ExternalLink className="ml-1 h-3 w-3" />
                        </Button>
                      </div>
                    )}
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
                  Approve & Apply Location
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
            <DialogTitle>Reject Location Change Request</DialogTitle>
            <DialogDescription>
              Provide an explanation to {selectedItemForReject?.providerName} for declining this location change.
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
              placeholder="e.g. Address is outside permitted city operational cluster."
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
