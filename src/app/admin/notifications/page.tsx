"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BellRing, BellOff, CheckCircle2, Info, AlertTriangle, Tag, Loader2, History, Trash2 as TrashIcon, User as UserIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, writeBatch, Timestamp, getDocs, limit } from '@/lib/mysqlDb';
import type { FirestoreNotification } from "@/types/firestore";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from 'date-fns';
import { useLoading } from "@/contexts/LoadingContext";
import { ADMIN_EMAIL } from "@/contexts/AuthContext";
import { getTimestampMillis } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const NotificationIcon = ({ type }: { type: FirestoreNotification['type'] }) => {
  if (type === "success") return <CheckCircle2 className="h-5 w-5 text-green-500" />;
  if (type === "info") return <Info className="h-5 w-5 text-blue-500" />;
  if (type === "warning") return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
  if (type === "error") return <AlertTriangle className="h-5 w-5 text-destructive" />;
  if (type === "booking_update" || type === "admin_alert") return <Tag className="h-5 w-5 text-primary" />;
  return <BellRing className="h-5 w-5 text-gray-500" />;
};

export default function AdminNotificationsPage() {
  const { user, isSuperAdmin, adminPermissions, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [adminNotifications, setAdminNotifications] = useState<FirestoreNotification[]>([]);
  const [systemNotifications, setSystemNotifications] = useState<FirestoreNotification[]>([]);
  const [isLoadingAdmin, setIsLoadingAdmin] = useState(true);
  const [isLoadingSystem, setIsLoadingSystem] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const { showLoading, hideLoading } = useLoading();
  const [isClearing, setIsClearing] = useState(false);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<string>("admin");

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 1. Listen to Admin's own Notifications
  useEffect(() => {
    if (!isMounted || !user || authLoading) {
      if (!authLoading && !user && isMounted) setIsLoadingAdmin(false);
      return;
    }

    if (!adminPermissions && user.email !== ADMIN_EMAIL) {
      toast({ title: "Access Denied", description: "You are not authorized to view these notifications.", variant: "destructive" });
      setIsLoadingAdmin(false);
      setAdminNotifications([]);
      return;
    }

    setIsLoadingAdmin(true);
    const notificationsCollectionRef = collection(db, "userNotifications");
    const q = query(
      notificationsCollectionRef,
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      try {
        const fetchedNotifications = querySnapshot.docs.map(docSnap => ({
          ...docSnap.data(),
          id: docSnap.id,
        } as FirestoreNotification));
        setAdminNotifications(fetchedNotifications);
      } catch (err) {
        console.warn("Admin notifications parse note:", err);
      } finally {
        setIsLoadingAdmin(false);
      }
    }, (error) => {
      console.warn("Error fetching admin notifications:", error);
      setIsLoadingAdmin(false);
    });

    return () => unsubscribe();
  }, [user, authLoading, adminPermissions, toast, isMounted]);

  // 2. Listen to System-Wide Notifications (For the "All" tab)
  useEffect(() => {
    if (!isMounted || !user || authLoading) {
      if (!authLoading && !user && isMounted) setIsLoadingSystem(false);
      return;
    }

    if (!adminPermissions && user.email !== ADMIN_EMAIL) {
      setIsLoadingSystem(false);
      setSystemNotifications([]);
      return;
    }

    setIsLoadingSystem(true);
    const notificationsCollectionRef = collection(db, "userNotifications");
    const q = query(
      notificationsCollectionRef,
      orderBy("createdAt", "desc"),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      try {
        const fetchedNotifications = querySnapshot.docs.map(docSnap => ({
          ...docSnap.data(),
          id: docSnap.id,
        } as FirestoreNotification));
        setSystemNotifications(fetchedNotifications);
      } catch (err) {
        console.warn("System notifications parse note:", err);
      } finally {
        setIsLoadingSystem(false);
      }
    }, (error) => {
      console.warn("Error fetching system notifications:", error);
      setIsLoadingSystem(false);
    });

    return () => unsubscribe();
  }, [user, authLoading, adminPermissions, isMounted]);

  // 3. Resolve display names for recipients in the "All" tab
  useEffect(() => {
    const fetchUserNames = async () => {
      const allUids = [
        ...adminNotifications.map(n => n.userId),
        ...systemNotifications.map(n => n.userId)
      ].filter(Boolean);
      const uniqueUids = Array.from(new Set(allUids));
      const newUids = uniqueUids.filter(uid => !userNames[uid]);
      if (newUids.length === 0) return;

      const resolved: Record<string, string> = { ...userNames };
      // Batch fetch in chunks of 10
      for (let i = 0; i < newUids.length; i += 10) {
        const chunk = newUids.slice(i, i + 10);
        try {
          const q = query(collection(db, "users"), where("uid", "in", chunk));
          const snap = await getDocs(q);
          snap.forEach(docSnap => {
            const data = docSnap.data();
            resolved[docSnap.id] = data.displayName || data.fullName || data.name || "Customer";
          });
        } catch (e) {
          // ignore batch lookup note
        }
      }
      newUids.forEach(uid => {
        if (!resolved[uid]) resolved[uid] = "Registered User";
      });
      setUserNames(resolved);
    };

    if (adminNotifications.length > 0 || systemNotifications.length > 0) {
      fetchUserNames();
    }
  }, [adminNotifications, systemNotifications]);

  const handleMarkAsRead = async (notificationId?: string) => {
    if (!user || !notificationId) return;
    const notificationRef = doc(db, "userNotifications", notificationId);
    try {
      await updateDoc(notificationRef, { read: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      toast({ title: "Error", description: "Could not update notification status.", variant: "destructive" });
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user || adminNotifications.filter(n => !n.read).length === 0) return;
    showLoading();
    const batch = writeBatch(db);
    adminNotifications.forEach(notification => {
      if (!notification.read && notification.id) {
        const notificationRef = doc(db, "userNotifications", notification.id);
        batch.update(notificationRef, { read: true });
      }
    });

    try {
      await batch.commit();
      toast({ title: "Success", description: "All admin alerts marked as read." });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      toast({ title: "Error", description: "Could not mark all as read.", variant: "destructive" });
    } finally {
      hideLoading();
    }
  };

  // Clear ONLY this admin's alerts
  const handleClearAllAdminNotifications = async () => {
    if (!user) return;
    setIsClearing(true);
    try {
      const notificationsCollectionRef = collection(db, "userNotifications");
      const q = query(notificationsCollectionRef, where("userId", "==", user.uid));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        toast({ title: "No Notifications", description: "There are no admin alerts to clear.", variant: "default" });
        setIsClearing(false);
        return;
      }

      const batchArray = [];
      let currentBatch = writeBatch(db);
      let currentBatchSize = 0;

      querySnapshot.docs.forEach((docSnap) => {
        currentBatch.delete(docSnap.ref);
        currentBatchSize++;
        if (currentBatchSize === 500) {
          batchArray.push(currentBatch);
          currentBatch = writeBatch(db);
          currentBatchSize = 0;
        }
      });

      if (currentBatchSize > 0) {
        batchArray.push(currentBatch);
      }

      for (const batch of batchArray) {
        await batch.commit();
      }

      toast({ title: "Alerts Cleared", description: "All your admin alerts have been cleared." });
    } catch (error) {
      console.error("Error clearing admin notifications:", error);
      toast({ title: "Error Clearing", description: (error as Error).message || "Could not clear alerts.", variant: "destructive" });
    } finally {
      setIsClearing(false);
    }
  };

  // Clear Platform-Wide Notifications (All tab)
  const handleClearAllSystemNotifications = async () => {
    if (!user) return;
    setIsClearing(true);
    try {
      const notificationsCollectionRef = collection(db, "userNotifications");
      const querySnapshot = await getDocs(query(notificationsCollectionRef));

      if (querySnapshot.empty) {
        toast({ title: "No Notifications", description: "There are no notifications to clear.", variant: "default" });
        setIsClearing(false);
        return;
      }

      const batchArray = [];
      let currentBatch = writeBatch(db);
      let currentBatchSize = 0;

      querySnapshot.docs.forEach((docSnap) => {
        currentBatch.delete(docSnap.ref);
        currentBatchSize++;
        if (currentBatchSize === 500) {
          batchArray.push(currentBatch);
          currentBatch = writeBatch(db);
          currentBatchSize = 0;
        }
      });

      if (currentBatchSize > 0) {
        batchArray.push(currentBatch);
      }

      for (const batch of batchArray) {
        await batch.commit();
      }

      toast({ title: "System Log Cleared", description: "All notifications across the platform have been cleared." });
    } catch (error) {
      console.error("Error clearing system notifications:", error);
      toast({ title: "Error Clearing", description: (error as Error).message || "Could not clear all notifications.", variant: "destructive" });
    } finally {
      setIsClearing(false);
    }
  };

  const unreadCount = adminNotifications.filter(n => !n.read).length;
  const isAnyLoading = authLoading || (isMounted && isLoadingAdmin && isLoadingSystem);

  if (isAnyLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl text-center">
        <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading notifications dashboard...</p>
      </div>
    );
  }

  if (!user && isMounted) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl text-center">
        <BellOff className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Admin Login Required</h2>
        <p className="text-muted-foreground mb-6">Please login as admin to view notifications.</p>
      </div>
    );
  }

  const renderNotificationCard = (notification: FirestoreNotification, showRecipient = false) => (
    <Card
      key={notification.id}
      className={`shadow-sm transition-all hover:shadow-md ${!notification.read ? "border-primary/50 border-l-4" : "border"}`}
      onClick={() => !notification.read && notification.id && handleMarkAsRead(notification.id)}
    >
      <CardContent className="p-3.5 flex items-start space-x-3">
        <div className="pt-1">
          <NotificationIcon type={notification.type} />
        </div>
        <div className="flex-grow">
          {notification.href ? (
            <Link href={notification.href} className="hover:underline" onClick={(e) => {
                e.stopPropagation(); 
                showLoading();
                if (!notification.read && notification.id) handleMarkAsRead(notification.id);
            }}>
                <h3 className={`text-sm font-semibold ${!notification.read ? "text-primary font-bold" : ""}`}>
                  {notification.title}
                </h3>
            </Link>
          ) : (
            <h3 className={`text-sm font-semibold ${!notification.read ? "text-primary font-bold" : ""}`}>
              {notification.title}
            </h3>
          )}
          <p className="text-xs text-muted-foreground mt-0.5 break-words">{notification.message}</p>
          
          {showRecipient && (
            <div className="flex items-center gap-1.5 mt-2 bg-secondary/50 py-1 px-2.5 rounded-md w-fit">
              <UserIcon className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] font-bold text-muted-foreground truncate max-w-[200px]">
                To: {userNames[notification.userId] || "System / Guest"}
              </span>
            </div>
          )}

          <p className="text-[9px] text-muted-foreground mt-1.5 uppercase font-medium tracking-wider">
            {(() => {
                const millis = getTimestampMillis(notification.createdAt);
                return millis ? formatDistanceToNow(new Date(millis), { addSuffix: true }) : 'just now';
            })()}
          </p>
        </div>
        {!notification.read && (
            <div className="h-2.5 w-2.5 bg-primary rounded-full shrink-0 mt-1.5" aria-label="Unread"></div>
        )}
      </CardContent>
    </Card>
  );

  const isAllTab = activeTab === "all";
  const hasNotificationsToClear = isAllTab ? systemNotifications.length > 0 : adminNotifications.length > 0;

  return (
    <Card className="border-primary/10 shadow-lg">
      <CardHeader className="p-4 sm:p-6 pb-3 sm:pb-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
          <div>
            <CardTitle className="text-xl sm:text-2xl font-black tracking-tight flex items-center">
              <History className="mr-2.5 h-5 w-5 sm:h-6 sm:w-6 text-primary animate-pulse" /> Notification Center
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              View system updates, service bookings, and platform logs.
            </CardDescription>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            {!isAllTab && adminNotifications.length > 0 && unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={handleMarkAllAsRead} disabled={isClearing} className="flex-1 sm:flex-initial text-xs sm:text-sm">
                Mark all as read
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={isClearing || !hasNotificationsToClear} className="flex-1 sm:flex-initial text-xs sm:text-sm">
                  {isClearing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TrashIcon className="mr-2 h-4 w-4" />}
                  {isAllTab ? "Clear All" : "Clear Alerts"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center">
                    <AlertTriangle className="mr-2 h-5 w-5 text-destructive"/>
                    {isAllTab ? "Clear All System Notifications?" : "Are you sure?"}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {isAllTab 
                      ? "This will permanently delete all notifications across the entire platform for all users and providers. This action cannot be undone."
                      : "This will permanently delete all your admin alerts. Customer and provider notifications will remain safe."
                    }
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isClearing}>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={isAllTab ? handleClearAllSystemNotifications : handleClearAllAdminNotifications} 
                    disabled={isClearing} 
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    {isClearing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Yes, Clear All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="w-full overflow-x-auto pb-2 mb-6 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <TabsList className="inline-flex min-w-full sm:w-full sm:grid sm:grid-cols-3 gap-1.5 bg-muted/60 p-1.5 rounded-xl h-auto">
              <TabsTrigger 
                value="admin" 
                className="rounded-lg font-bold text-xs sm:text-sm px-3.5 py-2.5 whitespace-nowrap shrink-0 flex-1 sm:flex-none text-center"
              >
                Admin Alerts ({adminNotifications.length})
              </TabsTrigger>
              <TabsTrigger 
                value="unread" 
                className="rounded-lg font-bold text-xs sm:text-sm px-3.5 py-2.5 whitespace-nowrap shrink-0 flex-1 sm:flex-none text-center"
              >
                Admin Unread ({unreadCount})
              </TabsTrigger>
              <TabsTrigger 
                value="all" 
                className="rounded-lg font-bold text-xs sm:text-sm px-3.5 py-2.5 whitespace-nowrap shrink-0 flex-1 sm:flex-none text-center"
              >
                All ({systemNotifications.length})
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="admin" className="space-y-3">
            {adminNotifications.length === 0 ? (
              <div className="text-center py-16 bg-muted/10 rounded-2xl border border-dashed">
                <BellOff className="mx-auto h-12 w-12 text-muted-foreground/60 mb-3" />
                <h3 className="text-base font-bold mb-1">No Admin Alerts</h3>
                <p className="text-muted-foreground text-xs">You're all caught up with your personal admin alerts.</p>
              </div>
            ) : (
              adminNotifications.map(notification => renderNotificationCard(notification, false))
            )}
          </TabsContent>

          <TabsContent value="unread" className="space-y-3">
            {unreadCount === 0 ? (
              <div className="text-center py-16 bg-muted/10 rounded-2xl border border-dashed">
                <CheckCircle2 className="mx-auto h-12 w-12 text-green-500/60 mb-3" />
                <h3 className="text-base font-bold mb-1">No Unread Alerts</h3>
                <p className="text-muted-foreground text-xs">Great job! All of your alerts have been read.</p>
              </div>
            ) : (
              adminNotifications.filter(n => !n.read).map(notification => renderNotificationCard(notification, false))
            )}
          </TabsContent>

          <TabsContent value="all" className="space-y-3">
            {systemNotifications.length === 0 ? (
              <div className="text-center py-16 bg-muted/10 rounded-2xl border border-dashed">
                <BellOff className="mx-auto h-12 w-12 text-muted-foreground/60 mb-3" />
                <h3 className="text-base font-bold mb-1">System Log Empty</h3>
                <p className="text-muted-foreground text-xs">No notifications exist across the entire platform yet.</p>
              </div>
            ) : (
              systemNotifications.map(notification => renderNotificationCard(notification, true))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
