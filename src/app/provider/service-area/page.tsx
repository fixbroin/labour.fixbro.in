"use client";

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { 
  MapPin, 
  Navigation, 
  Compass, 
  Loader2, 
  Info, 
  AlertTriangle,
  LocateFixed,
  Radio,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ExternalLink
} from "lucide-react";
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useApplicationConfig } from '@/hooks/useApplicationConfig';
import { db } from '@/lib/firebase';
import { doc, getDoc, onSnapshot } from '@/lib/mysqlDb';
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import type { ProviderApplication, LocationChangeRequest } from '@/types/firestore';
import { 
  requestServiceAreaChangeAction, 
  cancelServiceAreaChangeAction 
} from '@/app/actions/serviceAreaChangeActions';

// Dynamic import with SSR false matching Step 4 of provider registration
const ProviderMapZoneSelector = dynamic(
  () => import('@/components/provider-registration/ProviderMapZoneSelector'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="animate-spin text-primary h-8 w-8" />
      </div>
    ),
  }
);

export default function ProviderServiceAreaPage() {
  const { user: providerUser } = useAuth();
  const { config: appConfig, isLoading: isLoadingAppSettings } = useApplicationConfig();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [providerApp, setProviderApp] = useState<ProviderApplication | null>(null);

  const googleMapsApiKey = appConfig?.googleMapsApiKey || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

  // Real-time listener for provider application so status updates instantly upon admin approval
  useEffect(() => {
    if (!providerUser?.uid) return;
    setIsLoading(true);
    const docRef = doc(db, "providerApplications", providerUser.uid);
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setProviderApp(docSnap.data() as ProviderApplication);
        }
        setIsLoading(false);
      },
      (error) => {
        console.error("Error subscribing to provider service area:", error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [providerUser?.uid]);

  // Current Active Service Area
  const currentAddress = providerApp?.workAreaAddress || 'No location set yet.';
  const currentLatitude = providerApp?.workAreaCenter?.latitude ?? null;
  const currentLongitude = providerApp?.workAreaCenter?.longitude ?? null;
  const currentRadius = providerApp?.workAreaRadiusKm ?? 5;
  const hasActiveLocation = currentLatitude !== null && currentLongitude !== null;

  // Pending Request
  const pendingRequest = providerApp?.locationChangeRequest?.status === 'pending' 
    ? providerApp.locationChangeRequest 
    : null;

  // Handle Confirmed Location from ProviderMapZoneSelector Modal
  const handleLocationConfirm = async (data: {
    center: { lat: number; lng: number };
    radiusKm: number;
    address: string;
  }) => {
    if (!providerUser?.uid) return;
    setIsSubmitting(true);
    try {
      const res = await requestServiceAreaChangeAction({
        providerId: providerUser.uid,
        newAddress: data.address,
        newCenter: {
          latitude: data.center.lat,
          longitude: data.center.lng,
        },
        newRadiusKm: data.radiusKm,
      });

      if (res.success) {
        setIsMapModalOpen(false);
        toast({
          title: "Change Request Submitted!",
          description: "Your location change has been submitted to admin for approval."
        });
      } else {
        toast({
          title: "Request Error",
          description: res.message,
          variant: "destructive"
        });
      }
    } catch (e: any) {
      toast({
        title: "Error",
        description: e.message || "Failed to submit location change.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Cancel Pending Request
  const handleCancelRequest = async () => {
    if (!providerUser?.uid || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await cancelServiceAreaChangeAction(providerUser.uid);
      if (res.success) {
        toast({ title: "Cancelled", description: res.message });
      } else {
        toast({ title: "Error", description: res.message, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[350px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div className="max-w-4xl mx-auto space-y-6 pb-12">
        {/* Top Header Card */}
        <Card className="border-border/60 shadow-sm bg-gradient-to-r from-card via-card to-primary/5">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="text-2xl font-bold flex items-center gap-2">
                  <MapPin className="h-6 w-6 text-primary" />
                  Serviceable Area & Coverage
                </CardTitle>
                <CardDescription>
                  Your current operational center and service radius. Changes are reviewed and approved by administration.
                </CardDescription>
              </div>
              <Button
                onClick={() => setIsMapModalOpen(true)}
                disabled={isSubmitting || !!pendingRequest}
                className="flex items-center gap-2 shadow-sm shrink-0"
              >
                <LocateFixed className="h-4 w-4" />
                Change Base Location on Map
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* PENDING APPROVAL BANNER (if request is awaiting admin approval) */}
        {pendingRequest && (
          <Card className="border-amber-500/40 bg-amber-500/5 shadow-md overflow-hidden">
            <CardHeader className="pb-3 border-b border-amber-500/20 bg-amber-500/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-base">
                  <Clock className="h-5 w-5 animate-pulse" />
                  Location Change Request Pending Admin Approval
                </div>
                <Badge variant="outline" className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40 font-semibold">
                  Pending Review
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                You recently submitted a request to change your service area. Until approved by the admin, your current active location remains in effect for all customer bookings.
              </p>

              {/* Before vs After Comparison */}
              <div className="grid gap-3 sm:grid-cols-2 p-3 rounded-xl border bg-card">
                {/* Before */}
                <div className="space-y-1 p-2 rounded-lg bg-muted/30">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Current Active (Before)
                  </span>
                  <p className="text-xs font-semibold text-foreground line-clamp-2">
                    {pendingRequest.previousAddress}
                  </p>
                  <p className="text-xs text-primary font-bold">
                    Radius: {pendingRequest.previousRadiusKm} km
                  </p>
                </div>

                {/* After */}
                <div className="space-y-1 p-2 rounded-lg bg-primary/5 border border-primary/20">
                  <span className="text-[10px] font-bold text-primary uppercase tracking-wider flex items-center gap-1">
                    Requested New (After) <ArrowRight className="h-3 w-3" />
                  </span>
                  <p className="text-xs font-semibold text-foreground line-clamp-2">
                    {pendingRequest.newAddress}
                  </p>
                  <p className="text-xs text-emerald-600 font-bold">
                    Radius: {pendingRequest.newRadiusKm} km
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelRequest}
                  disabled={isSubmitting}
                  className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <XCircle className="h-3.5 w-3.5 mr-1.5" />}
                  Cancel Change Request
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Current Active Coverage Card */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 font-semibold">
              <Compass className="h-5 w-5 text-primary" />
              Current Service Area Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              {/* Center Address */}
              <div className="md:col-span-2 p-4 rounded-xl border bg-muted/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Navigation className="h-3.5 w-3.5 text-primary" />
                    Base Operational Center
                  </span>
                  {hasActiveLocation ? (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 font-medium">
                      <Radio className="h-3 w-3 mr-1 animate-pulse" /> Live Active
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                      Not Configured
                    </Badge>
                  )}
                </div>
                <p className="text-sm font-medium text-foreground">
                  {currentAddress}
                </p>
                {hasActiveLocation && (
                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                      <span>Lat: {currentLatitude?.toFixed(6)}</span>
                      <span>Lng: {currentLongitude?.toFixed(6)}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(`https://www.google.com/maps?q=${currentLatitude},${currentLongitude}`, '_blank')}
                      className="h-7 text-xs text-primary"
                    >
                      View on Google Maps <ExternalLink className="ml-1 h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Active Radius Badge */}
              <div className="p-4 rounded-xl border bg-primary/5 flex flex-col justify-between space-y-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Active Radius
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-primary">{currentRadius}</span>
                  <span className="text-sm font-semibold text-muted-foreground">km</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  Maximum delivery & travel distance for jobs
                </span>
              </div>
            </div>

            {/* Coverage Explanation Alert */}
            <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-900 dark:text-blue-300">
              <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-semibold">How automated job matching works:</p>
                <p className="text-blue-800/80 dark:text-blue-300/80 leading-relaxed">
                  When a customer books a service within your <strong>{currentRadius} km</strong> circle, our platform checks your online status and dispatches the booking notification to you. To modify your location or radius, click <strong>"Change Base Location on Map"</strong> above.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* POP-UP MODAL matching Step 4 of Provider Registration */}
        <Dialog open={isMapModalOpen} onOpenChange={(open) => { if (!open) setIsMapModalOpen(false); }}>
          <DialogContent 
            className="max-w-3xl w-[95vw] h-[90vh] p-0 flex flex-col" 
            onPointerDownOutside={(e) => e.preventDefault()} 
            onEscapeKeyDown={(e) => e.preventDefault()} 
            hideCloseButton={true}
          >
            <DialogHeader className="p-4 border-b">
              <DialogTitle>Set Your Service Location & Radius</DialogTitle>
              <DialogDescription>
                Search your address or drag the pin, then adjust your coverage radius. Changes will be submitted to admin for approval.
              </DialogDescription>
            </DialogHeader>
            <div className="flex-grow relative h-full">
              {!isLoadingAppSettings && googleMapsApiKey ? (
                <ProviderMapZoneSelector 
                  apiKey={googleMapsApiKey} 
                  initialCenter={hasActiveLocation ? { lat: currentLatitude!, lng: currentLongitude! } : null}
                  initialRadiusKm={currentRadius || 5}
                  maxRadiusKm={50}
                  onConfirm={handleLocationConfirm} 
                  onClose={() => setIsMapModalOpen(false)} 
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="animate-spin text-primary h-8 w-8" />
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
  );
}
