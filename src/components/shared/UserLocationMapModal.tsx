"use client";

import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2, MapPin } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useApplicationConfig } from '@/hooks/useApplicationConfig';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from '@/lib/mysqlDb';
import type { AddressFormData } from '@/components/forms/AddressForm';

const UserGoogleMapAddressSelector = dynamic(
  () => import('./UserGoogleMapAddressSelector'),
  {
    loading: () => (
      <div className="flex items-center justify-center h-64 bg-muted rounded-md">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    ),
    ssr: false,
  }
);

export interface UserSavedLocation {
  latitude: number;
  longitude: number;
  area: string;
  city: string;
  pincode: string;
  formattedAddress: string;
}

interface UserLocationMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLocationSaved?: (loc: UserSavedLocation) => void;
  isMandatory?: boolean;
}

export default function UserLocationMapModal({ isOpen, onClose, onLocationSaved, isMandatory = false }: UserLocationMapModalProps) {
  const { user, firestoreUser } = useAuth();
  const { config: appConfig, isLoading: isLoadingAppSettings } = useApplicationConfig();

  const initialCenter = useMemo(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('fixbroUserLocation');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.latitude && parsed.longitude) {
            return { lat: Number(parsed.latitude), lng: Number(parsed.longitude) };
          }
        }
      } catch (e) {}
    }
    const profileLat = (firestoreUser as any)?.coordinates?.latitude;
    const profileLng = (firestoreUser as any)?.coordinates?.longitude;
    if (profileLat && profileLng) {
      return { lat: Number(profileLat), lng: Number(profileLng) };
    }
    return null; // Return null when no location is saved so Google Maps auto-prompts geolocation
  }, [firestoreUser]);

  const handleAddressSelect = async (address: Partial<AddressFormData>) => {
    const lat = address.latitude || 12.9716;
    const lng = address.longitude || 77.5946;
    const area = address.addressLine2 || address.addressLine1 || address.city || "Bengaluru";
    const city = address.city || "Bengaluru";
    const pincode = address.pincode || "";
    const formattedAddress = [address.addressLine1, address.addressLine2, address.city, address.pincode].filter(Boolean).join(", ");

    const savedLoc: UserSavedLocation = {
      latitude: lat,
      longitude: lng,
      area,
      city,
      pincode,
      formattedAddress,
    };

    // 1. Save to localStorage for instant client filtering across the platform
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('fixbroUserLocation', JSON.stringify(savedLoc));
      } catch (e) {
        console.error("Error saving location to localStorage:", e);
      }
    }

    // 2. Persist to user profile document if user is logged in
    if (user?.uid) {
      try {
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, {
          coordinates: { latitude: lat, longitude: lng },
          savedArea: area,
          savedCity: city,
          savedPincode: pincode,
          savedAddress: formattedAddress,
        });
      } catch (e) {
        console.warn("Could not save location coordinates to user document:", e);
      }
    }

    // 3. Dispatch event for instant UI update across header, category page, etc.
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('fixbroUserLocationChanged'));
    }

    if (onLocationSaved) {
      onLocationSaved(savedLoc);
    }

    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !isMandatory) onClose(); }}>
      <DialogContent
        className="max-w-3xl w-[95vw] sm:w-[90vw] h-[90vh] p-0 flex flex-col"
        aria-describedby={undefined}
        hideCloseButton={isMandatory}
        onPointerDownOutside={(e) => {
          if (isMandatory) {
            e.preventDefault();
            return;
          }
          const target = e.target as HTMLElement;
          if (target.closest('.pac-container')) {
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => {
          if (isMandatory) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader className="p-4 border-b">
          <DialogTitle className="flex items-center gap-2 font-headline text-lg sm:text-xl font-bold">
            <MapPin className="h-5 w-5 text-primary shrink-0" />
            {isMandatory ? "Set Work Site Location (Required)" : "Select Work Site Location"}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            {isMandatory 
              ? "Please select or search your exact work site location on the map to view and hire verified daily labour providers nearest to you."
              : "Select your work site location on the map to find nearby daily labour providers."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-grow flex flex-col h-full overflow-hidden">
          {!isLoadingAppSettings && appConfig?.googleMapsApiKey && (
            <UserGoogleMapAddressSelector
              apiKey={appConfig.googleMapsApiKey}
              onAddressSelect={handleAddressSelect}
              onClose={onClose}
              initialCenter={initialCenter}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
