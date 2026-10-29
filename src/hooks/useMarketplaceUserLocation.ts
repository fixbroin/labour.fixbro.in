"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { MarketplaceLocation } from '@/types/marketplace';
import {
  saveUserMarketplaceLocationAction,
} from '@/app/actions/marketplaceLocationActions';

const STORAGE_KEY = 'fixbroMarketplaceLocation';

function readStoredLocation(): MarketplaceLocation | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.latitude === 'number' && typeof parsed.longitude === 'number') {
      return parsed as MarketplaceLocation;
    }
  } catch {}
  return null;
}

function writeStoredLocation(loc: MarketplaceLocation) {
  if (typeof window === 'undefined') return;
  try {
    const serialized = JSON.stringify(loc);
    localStorage.setItem(STORAGE_KEY, serialized);
    sessionStorage.setItem(STORAGE_KEY, serialized);
  } catch {}
}

export function useMarketplaceUserLocation() {
  const { user, firestoreUser, isLoading: isLoadingAuth } = useAuth();
  const [location, setLocation] = useState<MarketplaceLocation | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const hasAutoPromptedRef = useRef(false);
  const hasSyncedGuestToDbRef = useRef(false);

  // 1. Initial client mount: Read localStorage immediately to eliminate initial flicker
  useEffect(() => {
    const localLoc = readStoredLocation();
    if (localLoc) {
      setLocation(localLoc);
    }
  }, []);

  // 2. Auth resolution & Database synchronization
  useEffect(() => {
    if (isLoadingAuth) return;

    let activeLoc: MarketplaceLocation | null = null;
    const isLoggedIn = Boolean(user?.uid && user.uid !== 'guest');

    if (isLoggedIn && firestoreUser?.marketplaceLocation?.latitude) {
      // Logged in user with saved database location -> Always prefer database default
      activeLoc = firestoreUser.marketplaceLocation;
      writeStoredLocation(activeLoc);
      setLocation(activeLoc);
    } else {
      // Check localStorage / sessionStorage
      const localLoc = readStoredLocation();
      if (localLoc) {
        activeLoc = localLoc;
        setLocation(localLoc);

        // If user is logged in but database has no location yet, sync guest location to database
        if (isLoggedIn && user?.uid && !firestoreUser?.marketplaceLocation?.latitude && !hasSyncedGuestToDbRef.current) {
          hasSyncedGuestToDbRef.current = true;
          saveUserMarketplaceLocationAction(user.uid, localLoc).catch((err) => {
            console.warn('Failed to sync guest location to user profile:', err);
          });
        }
      }
    }

    setIsLoaded(true);

    // If after resolving both database and local storage there is no location, auto-open location selector
    if (!activeLoc && !hasAutoPromptedRef.current) {
      hasAutoPromptedRef.current = true;
      setIsLocationModalOpen(true);
    }
  }, [user?.uid, firestoreUser, isLoadingAuth]);

  // 3. User explicitly changes or selects location
  const setLocationAndSave = useCallback(
    async (newLoc: MarketplaceLocation) => {
      setLocation(newLoc);
      writeStoredLocation(newLoc);
      setIsLocationModalOpen(false);

      if (user?.uid && user.uid !== 'guest') {
        try {
          await saveUserMarketplaceLocationAction(user.uid, newLoc);
        } catch (err) {
          console.error('Failed to save location to database:', err);
        }
      }
    },
    [user?.uid]
  );

  return {
    location,
    isLoaded,
    hasLocation: Boolean(location?.latitude && location?.longitude),
    isLocationModalOpen,
    setIsLocationModalOpen,
    setLocationAndSave,
  };
}
