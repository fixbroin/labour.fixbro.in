
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, PackageSearch, Briefcase } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { FirestoreBooking, BookingStatus, FirestoreNotification } from '@/types/firestore';
import { db } from '@/lib/firebase';
import { collectionGroup, query, where, onSnapshot, orderBy, doc, updateDoc, Timestamp, getDoc, getDocs, limit, addDoc, collection } from '@/lib/mysqlDb';
import { getProviderBookingCountsAction } from '@/app/actions/dbActions';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import ProviderJobCard from '@/components/provider/ProviderJobCard'; 
import { triggerPushNotification } from '@/lib/fcmUtils';
import { ADMIN_EMAIL } from '@/contexts/AuthContext';
import JobOtpVerificationModal from '@/components/provider/JobOtpVerificationModal';
import { updateBookingStatusByProviderAction, getProviderWalletSettingsAction } from '@/app/actions/providerWalletActions';
import { getProviderDefaultSettingsAction } from '@/app/actions/providerDefaultSettingsActions';
import { useApplicationConfig } from '@/hooks/useApplicationConfig';
import { getBookingScheduledTimestamp } from '@/lib/utils';

export default function ProviderMyJobsPage() {
  const { user: providerUser, isLoading: authIsLoading } = useAuth();
  const { toast } = useToast();
  const [bookings, setBookings] = useState<FirestoreBooking[]>([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(true);
  const [processingBookingAction, setProcessingBookingAction] = useState<string | null>(null);
  const [displayLimit, setDisplayLimit] = useState(50);
  const [bookingCounts, setBookingCounts] = useState({ completed: 0, newRequests: 0, ongoing: 0, other: 0, total: 0 });
  const [providerWalletBalance, setProviderWalletBalance] = useState<number>(0);
  const [minBalanceForJobs, setMinBalanceForJobs] = useState<number>(50);

  // OTP Modal State
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
  const [selectedJobForOtp, setSelectedJobForOtp] = useState<FirestoreBooking | null>(null);
  const [otpActionType, setOtpActionType] = useState<'start' | 'complete'>('start');
  const [requireOtpSetting, setRequireOtpSetting] = useState(true);

  useEffect(() => {
    getProviderDefaultSettingsAction()
      .then((settings) => {
        if (typeof settings?.requireOtpForJobStartComplete === 'boolean') {
          setRequireOtpSetting(settings.requireOtpForJobStartComplete);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!providerUser || authIsLoading) return;
    
    // Fetch provider wallet balance
    const userDocRef = doc(db, 'users', providerUser.uid);
    getDoc(userDocRef).then(snap => {
      if (snap.exists()) {
        setProviderWalletBalance(snap.data()?.providerWalletBalance || 0);
      }
    }).catch(err => console.error("Error loading wallet balance:", err));

    // Fetch minimum balance setting
    getProviderWalletSettingsAction().then(settings => {
      setMinBalanceForJobs(settings.minBalanceForJobs);
    }).catch(err => console.error("Error loading wallet settings:", err));
  }, [providerUser, authIsLoading]);

  useEffect(() => {
    if (!providerUser || authIsLoading) {
      if (!authIsLoading && !providerUser) setIsLoadingBookings(false);
      return;
    }
    setIsLoadingBookings(true);
    const bookingsColGroupRef = collectionGroup(db, "bookings");
    const q = query(
      bookingsColGroupRef, 
      where("providerId", "==", providerUser.uid), 
      orderBy("scheduledDate", "desc"),
      orderBy("createdAt", "desc"),
      limit(displayLimit)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setBookings(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as FirestoreBooking)));
      setIsLoadingBookings(false);
      // Fetch true counts from DB
      getProviderBookingCountsAction(providerUser.uid)
        .then(setBookingCounts)
        .catch(err => console.error("Error fetching booking counts:", err));
    }, (error) => {
      console.error("Error fetching provider jobs:", error);
      toast({ title: "Error", description: "Could not fetch your jobs.", variant: "destructive" });
      setIsLoadingBookings(false);
    });
    return () => unsubscribe();
  }, [providerUser, authIsLoading, toast, displayLimit]);

  const updateBookingStatus = async (
    bookingId: string, 
    newStatus: BookingStatus, 
    additionalCharges?: {name: string, amount: number}[], 
    finalizedPaymentMethod?: string,
    enteredOtp?: string
  ) => {
    setProcessingBookingAction(bookingId);
    try {
      if (!providerUser?.uid) {
        throw new Error("No authenticated provider session found.");
      }

      const result = await updateBookingStatusByProviderAction(
        bookingId,
        providerUser.uid,
        newStatus,
        additionalCharges,
        finalizedPaymentMethod,
        enteredOtp
      );

      if (!result.success) {
        throw new Error(result.message);
      }

      setBookings(prev => prev.map(b => {
        if (b.id !== bookingId) return b;
        return {
          ...b,
          status: newStatus,
          ...(newStatus === 'InProgressByProvider' && { workStartedAt: Timestamp.now() }),
          ...(newStatus === 'Completed' && { workCompletedAt: Timestamp.now() }),
          updatedAt: Timestamp.now(),
        };
      }));

      toast({
        title: "Success",
        description: newStatus === 'InProgressByProvider' ? "Work started successfully!" : newStatus === 'Completed' ? "Job completed successfully!" : "Status updated.",
      });
    } catch (err: any) {
      toast({
        title: "Action Failed",
        description: err.message || "Failed to update booking status.",
        variant: "destructive"
      });
      throw err;
    } finally {
      setProcessingBookingAction(null);
    }
  };

  const handleStartWork = (id: string) => {
    const job = bookings.find(b => b.id === id);
    if (!job) return;
    if (requireOtpSetting) {
      setSelectedJobForOtp(job);
      setOtpActionType('start');
      setIsOtpModalOpen(true);
    } else {
      updateBookingStatus(id, 'InProgressByProvider');
    }
  };

  const handleCompleteWork = (id: string) => {
    const job = bookings.find(b => b.id === id);
    if (!job) return;
    if (requireOtpSetting) {
      setSelectedJobForOtp(job);
      setOtpActionType('complete');
      setIsOtpModalOpen(true);
    } else {
      updateBookingStatus(id, 'Completed');
    }
  };

  const handleVerifyOtp = async (enteredOtp: string) => {
    if (!selectedJobForOtp?.id) return;
    const targetStatus = otpActionType === 'start' ? 'InProgressByProvider' : 'Completed';
    await updateBookingStatus(selectedJobForOtp.id, targetStatus, undefined, undefined, enteredOtp);
  };

  const newJobRequests = useMemo(() => {
    return bookings
      .filter(b => b.status === 'AssignedToProvider' || b.status === 'Rescheduled')
      .sort((a, b) => getBookingScheduledTimestamp(a) - getBookingScheduledTimestamp(b));
  }, [bookings]);

  const ongoingJobs = useMemo(() => {
    return bookings
      .filter(b => b.status === 'ProviderAccepted' || b.status === 'InProgressByProvider')
      .sort((a, b) => getBookingScheduledTimestamp(a) - getBookingScheduledTimestamp(b));
  }, [bookings]);

  const completedJobs = useMemo(() => {
    return bookings
      .filter(b => b.status === 'Completed')
      .sort((a, b) => getBookingScheduledTimestamp(b) - getBookingScheduledTimestamp(a));
  }, [bookings]);

  const otherJobs = useMemo(() => {
    return bookings
      .filter(b => b.status === 'ProviderRejected' || b.status === 'Cancelled' || b.status === 'Pending Payment' || b.status === 'Processing')
      .sort((a, b) => getBookingScheduledTimestamp(b) - getBookingScheduledTimestamp(a));
  }, [bookings]);

  const defaultTab = useMemo(() => {
    if (newJobRequests.length > 0) return 'new';
    if (ongoingJobs.length > 0) return 'ongoing';
    if (completedJobs.length > 0) return 'completed';
    return 'new';
  }, [newJobRequests.length, ongoingJobs.length, completedJobs.length]);

  const [activeTab, setActiveTab] = useState<string>('new');
  const [hasUserSelectedTab, setHasUserSelectedTab] = useState(false);

  useEffect(() => {
    if (!hasUserSelectedTab) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab, hasUserSelectedTab]);

  if (authIsLoading || isLoadingBookings) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
            <CardTitle className="text-2xl flex items-center"><Briefcase className="mr-2 h-6 w-6 text-primary"/>My Jobs</CardTitle>
            <CardDescription>View and manage all jobs assigned to you.</CardDescription>
        </CardHeader>
      </Card>
      
      <Tabs value={activeTab} onValueChange={(val) => { setActiveTab(val); setHasUserSelectedTab(true); }} className="w-full">
        <div className="relative mb-6">
          <TabsList className="h-12 w-full justify-start gap-2 bg-transparent p-0 overflow-x-auto no-scrollbar flex-nowrap border-b border-border rounded-none">
             <TabsTrigger 
              value="new" 
              className="relative h-12 rounded-none border-b-2 border-transparent bg-transparent px-4 pb-3 pt-2 font-semibold text-muted-foreground shadow-none transition-none data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none whitespace-nowrap"
            >
              New Requests <Badge className="ml-2 bg-primary/10 text-primary border-none hover:bg-primary/10">{bookingCounts.newRequests}</Badge>
            </TabsTrigger>
            <TabsTrigger 
              value="ongoing" 
              className="relative h-12 rounded-none border-b-2 border-transparent bg-transparent px-4 pb-3 pt-2 font-semibold text-muted-foreground shadow-none transition-none data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none whitespace-nowrap"
            >
              Ongoing <Badge className="ml-2 bg-blue-500/10 text-blue-500 border-none hover:bg-blue-500/10">{bookingCounts.ongoing}</Badge>
            </TabsTrigger>
            <TabsTrigger 
              value="completed" 
              className="relative h-12 rounded-none border-b-2 border-transparent bg-transparent px-4 pb-3 pt-2 font-semibold text-muted-foreground shadow-none transition-none data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none whitespace-nowrap"
            >
              Completed <Badge className="ml-2 bg-green-500/10 text-green-500 border-none hover:bg-green-500/10">{bookingCounts.completed}</Badge>
            </TabsTrigger>
            <TabsTrigger 
              value="other" 
              className="relative h-12 rounded-none border-b-2 border-transparent bg-transparent px-4 pb-3 pt-2 font-semibold text-muted-foreground shadow-none transition-none data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none whitespace-nowrap"
            >
              Other Statuses <Badge className="ml-2 bg-muted text-muted-foreground border-none hover:bg-muted">{bookingCounts.other}</Badge>
            </TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="new" className="mt-0 focus-visible:outline-none">
          {newJobRequests.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-4">
              {newJobRequests.map((job, idx) => (
                <ProviderJobCard key={job.id} job={job} type="new" queuePosition={idx + 1}
                  onAccept={(id) => updateBookingStatus(id, 'ProviderAccepted')}
                  onReject={(id) => updateBookingStatus(id, 'ProviderRejected')}
                  isProcessingAction={processingBookingAction === job.id}
                  providerWalletBalance={providerWalletBalance}
                  minBalanceForJobs={minBalanceForJobs}
                />
              ))}
            </div>
          ) : <p className="text-muted-foreground text-center py-6">No new job requests.</p>}
        </TabsContent>

        <TabsContent value="ongoing">
           {ongoingJobs.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-4">
              {ongoingJobs.map((job, idx) => (
                <ProviderJobCard key={job.id} job={job} type="ongoing" queuePosition={idx + 1}
                  onStartWork={handleStartWork}
                  onCompleteWork={handleCompleteWork}
                  isProcessingAction={processingBookingAction === job.id}
                  providerWalletBalance={providerWalletBalance}
                  minBalanceForJobs={minBalanceForJobs}
                />
              ))}
            </div>
          ) : <p className="text-muted-foreground text-center py-6">No ongoing jobs.</p>}
        </TabsContent>

        <TabsContent value="completed">
          {completedJobs.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-4">
              {completedJobs.map(job => (
                <ProviderJobCard key={job.id} job={job} type="completed"
                  providerWalletBalance={providerWalletBalance}
                  minBalanceForJobs={minBalanceForJobs}
                />
              ))}
            </div>
          ) : <p className="text-muted-foreground text-center py-6">No completed jobs yet.</p>}
        </TabsContent>
        
        <TabsContent value="other">
          {otherJobs.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-4">
              {otherJobs.map(job => (
                <ProviderJobCard key={job.id} job={job} type="completed"
                  providerWalletBalance={providerWalletBalance}
                  minBalanceForJobs={minBalanceForJobs}
                />
              ))}
            </div>
          ) : <p className="text-muted-foreground text-center py-6">No jobs with other statuses.</p>}
        </TabsContent>
      </Tabs>

      {bookingCounts.total > bookings.length && (
        <div className="flex justify-center pt-4 pb-8">
          <Button 
            variant="outline" 
            onClick={() => setDisplayLimit(prev => prev + 50)}
            className="rounded-full px-8 font-bold border-muted-foreground/20 hover:bg-muted"
          >
            Load More Jobs
          </Button>
        </div>
      )}

      {selectedJobForOtp && (
        <JobOtpVerificationModal
          isOpen={isOtpModalOpen}
          onClose={() => { setIsOtpModalOpen(false); setSelectedJobForOtp(null); }}
          onVerify={handleVerifyOtp}
          bookingId={selectedJobForOtp.bookingId}
          customerName={selectedJobForOtp.customerName}
          actionType={otpActionType}
          isProcessing={processingBookingAction === selectedJobForOtp.id}
        />
      )}
    </div>
  );
}
