
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from './useAuth'; // Assuming useAuth is in the same hooks directory or adjust path
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, limit, or, and } from '@/lib/mysqlDb';
import type { FirestoreNotification } from '@/types/firestore';

interface UseUnreadNotificationsCountReturn {
  count: number;
  isLoading: boolean;
}

export function useUnreadNotificationsCount(userIdOverride?: string): UseUnreadNotificationsCountReturn {
  const { user, isSuperAdmin, adminRole, isLoading: authLoading } = useAuth();
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const effectiveUserId = userIdOverride || user?.uid;
  const isAdmin = !!adminRole || isSuperAdmin;

  useEffect(() => {
    if (authLoading) {
      setIsLoading(true);
      return;
    }

    if (!effectiveUserId) {
      setCount(0);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const notificationsCollectionRef = collection(db, "userNotifications");
    
    // Query notifications specifically addressed to this user/admin
    const newQuery = query(
      notificationsCollectionRef,
      where("userId", "==", effectiveUserId),
      where("read", "==", false),
      limit(50)
    );

    const unsubscribe = onSnapshot(newQuery, (querySnapshot) => {
      try {
        setCount(querySnapshot.docs.length);
      } catch (e) {
        setCount(0);
      } finally {
        setIsLoading(false);
      }
    }, (error) => {
      console.warn("Error fetching unread notifications count:", error);
      setCount(0);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [effectiveUserId, authLoading]);

  return { count, isLoading };
}
