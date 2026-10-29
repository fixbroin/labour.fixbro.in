'use server';

import { db } from '@/lib/mysqlDb';
import { doc, getDoc, updateDoc } from '@/lib/mysqlDb';
import type { MarketplaceLocation } from '@/types/marketplace';

/**
 * Saves the selected marketplace browsing/posting coordinates directly to the user's database document.
 * This guarantees the user's default location automatically persists across devices and future logins.
 */
export async function saveUserMarketplaceLocationAction(
  userId: string,
  location: MarketplaceLocation
): Promise<{ success: boolean; error?: string }> {
  if (!userId || userId === 'guest') {
    return { success: false, error: 'User not authenticated' };
  }

  try {
    const userRef = doc(db, 'users', userId);
    const locationData = {
      latitude: Number(location.latitude),
      longitude: Number(location.longitude),
      address: location.address || '',
      area: location.area || '',
      city: location.city || '',
      pincode: location.pincode || '',
      updatedAt: new Date().toISOString(),
    };

    await updateDoc(userRef, {
      marketplaceLocation: locationData,
    });

    return { success: true };
  } catch (err: any) {
    console.error('Error saving user marketplace location to database:', err);
    return { success: false, error: err?.message || 'Failed to save location to database.' };
  }
}

/**
 * Retrieves the saved marketplace location for a given user from their database document.
 */
export async function getUserMarketplaceLocationAction(
  userId: string
): Promise<MarketplaceLocation | null> {
  if (!userId || userId === 'guest') {
    return null;
  }

  try {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data?.marketplaceLocation && typeof data.marketplaceLocation.latitude === 'number') {
        return data.marketplaceLocation as MarketplaceLocation;
      }
    }
    return null;
  } catch (err) {
    console.error('Error fetching user marketplace location:', err);
    return null;
  }
}
