'use server';

import { db } from '@/lib/mysqlDb';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
} from '@/lib/mysqlDb';
import { revalidatePath } from 'next/cache';
import type { RentalListing, MarketplaceListingStatus } from '@/types/marketplace';
import { getHaversineDistance } from '@/lib/locationUtils';
import { getMarketplaceSettingsAction } from './marketplaceSettingsActions';
import { generateMarketplaceSlug, extractMarketplaceId } from '@/lib/marketplaceSlug';
import { deleteMarketplacePhotos } from '@/lib/marketplaceStorage';
import { deleteMarketplaceCallLogsByListingIdAction } from './marketplaceCallActions';

const COLLECTION_NAME = 'marketplaceRentals';

export interface RentalFilterParams {
  lat?: number;
  lng?: number;
  radiusKm?: number;
  propertyType?: string; // 'all' or specific type
  furnishing?: string;
  minRent?: number;
  maxRent?: number;
  search?: string;
  tenantPreference?: string;
  sort?: 'distance' | 'newest' | 'rent_asc' | 'rent_desc';
}

/**
 * Creates a new rental property listing with automatic 30-day expiration timer.
 */
export async function createRentalListingAction(
  data: Omit<RentalListing, 'id' | 'createdAt' | 'expiresAt' | 'status' | 'viewCount' | 'callCount'>
): Promise<{ success: boolean; id?: string; slug?: string; error?: string }> {
  try {
    if (!data.title?.trim()) {
      return { success: false, error: 'Property title is required' };
    }
    if (!data.propertyType) {
      return { success: false, error: 'Property type is required' };
    }
    if (typeof data.monthlyRent !== 'number' || data.monthlyRent < 0) {
      return { success: false, error: 'Valid monthly rent is required' };
    }
    if (!data.latitude || !data.longitude) {
      return { success: false, error: 'Valid location coordinates are required' };
    }

    const settings = await getMarketplaceSettingsAction();
    const expirationDays = settings.expirationDays || 30;

    const now = Date.now();
    const expiresAt = new Date(now + expirationDays * 24 * 60 * 60 * 1000).toISOString();

    const payload = {
      ...data,
      photos: Array.isArray(data.photos) ? data.photos : [],
      amenities: Array.isArray(data.amenities) ? data.amenities : [],
      billsIncluded: Array.isArray(data.billsIncluded) ? data.billsIncluded : [],
      status: 'active' as MarketplaceListingStatus,
      viewCount: 0,
      callCount: 0,
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
      expiresAt,
    };

    const docRef = await addDoc(collection(db, COLLECTION_NAME), payload);
    const slug = generateMarketplaceSlug(data.title, docRef.id);
    await updateDoc(doc(db, COLLECTION_NAME, docRef.id), { slug }).catch(() => {});

    revalidatePath('/rent-home');
    revalidatePath('/marketplace/my-posts');

    return { success: true, id: docRef.id, slug };
  } catch (error: any) {
    console.error('Error creating rental listing:', error);
    return { success: false, error: error?.message || 'Failed to create rental post.' };
  }
}

/**
 * Fetches active rental listings with distance calculation, property type, rent range, and auto-expiration.
 */
export async function getRentalListingsAction(
  filters: RentalFilterParams = {}
): Promise<RentalListing[]> {
  try {
    const collRef = collection(db, COLLECTION_NAME);
    const snap = await getDocs(collRef);

    const nowIso = new Date().toISOString();
    const results: RentalListing[] = [];

    for (const d of snap.docs) {
      const item = { id: d.id, ...d.data() } as RentalListing;

      // Auto-expire 30-day listings
      if (item.status === 'active' && item.expiresAt && item.expiresAt < nowIso) {
        updateDoc(doc(db, COLLECTION_NAME, item.id), { status: 'expired' }).catch(console.error);
        item.status = 'expired';
      }

      // Public only sees active
      if (item.status !== 'active') {
        continue;
      }

      // Filter by property type
      if (filters.propertyType && filters.propertyType !== 'all') {
        if (item.propertyType !== filters.propertyType) continue;
      }

      // Filter by furnishing
      if (filters.furnishing && filters.furnishing !== 'all') {
        if (item.furnishing !== filters.furnishing) continue;
      }

      // Filter by tenant preference
      if (filters.tenantPreference && filters.tenantPreference !== 'all') {
        if (item.tenantPreference !== 'any' && item.tenantPreference !== filters.tenantPreference) continue;
      }

      // Filter by rent range
      if (typeof filters.minRent === 'number' && item.monthlyRent < filters.minRent) continue;
      if (typeof filters.maxRent === 'number' && item.monthlyRent > filters.maxRent) continue;

      // Filter by search query
      if (filters.search && filters.search.trim()) {
        const queryStr = filters.search.toLowerCase().trim();
        const matchesTitle = item.title?.toLowerCase().includes(queryStr);
        const matchesDesc = item.description?.toLowerCase().includes(queryStr);
        const matchesArea = item.area?.toLowerCase().includes(queryStr);
        const matchesType = item.propertyType?.toLowerCase().includes(queryStr);
        if (!matchesTitle && !matchesDesc && !matchesArea && !matchesType) continue;
      }

      // Calculate distance if lat/lng are provided
      if (typeof filters.lat === 'number' && typeof filters.lng === 'number' && item.latitude && item.longitude) {
        const dist = getHaversineDistance(filters.lat, filters.lng, item.latitude, item.longitude);
        item.distanceKm = Math.round(dist * 10) / 10;

        // Radius filter
        if (filters.radiusKm && filters.radiusKm > 0 && dist > filters.radiusKm) {
          continue;
        }
      }

      results.push(item);
    }

    // Sort results
    const sort = filters.sort || (typeof filters.lat === 'number' ? 'distance' : 'newest');
    results.sort((a, b) => {
      if (sort === 'distance' && typeof a.distanceKm === 'number' && typeof b.distanceKm === 'number') {
        return a.distanceKm - b.distanceKm;
      }
      if (sort === 'rent_asc') {
        return (a.monthlyRent || 0) - (b.monthlyRent || 0);
      }
      if (sort === 'rent_desc') {
        return (b.monthlyRent || 0) - (a.monthlyRent || 0);
      }
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    return results;
  } catch (error) {
    console.error('Error fetching rental listings:', error);
    return [];
  }
}

/**
 * Fetches a single rental listing by ID.
 */
export async function getRentalListingByIdAction(
  slugOrId: string,
  userLat?: number,
  userLng?: number
): Promise<RentalListing | null> {
  try {
    if (!slugOrId) return null;
    const decoded = decodeURIComponent(slugOrId).trim();

    // 1. Try direct doc ID match first (fastest, supports raw IDs with hyphens)
    let snap = await getDoc(doc(db, COLLECTION_NAME, decoded));

    // 2. If not found, extract target ID from title slug
    if (!snap.exists()) {
      const targetId = extractMarketplaceId(decoded);
      if (targetId && targetId !== decoded) {
        snap = await getDoc(doc(db, COLLECTION_NAME, targetId));
      }
    }

    // 3. If still not found, search by stored slug property
    if (!snap.exists()) {
      const q = query(collection(db, COLLECTION_NAME), where('slug', '==', decoded));
      const querySnap = await getDocs(q);
      if (!querySnap.empty) {
        snap = querySnap.docs[0];
      }
    }

    if (!snap.exists()) return null;

    const item = { id: snap.id, ...snap.data() } as RentalListing;

    const nowIso = new Date().toISOString();
    if (item.status === 'active' && item.expiresAt && item.expiresAt < nowIso) {
      updateDoc(doc(db, COLLECTION_NAME, item.id), { status: 'expired' }).catch(console.error);
      item.status = 'expired';
    }

    if (typeof userLat === 'number' && typeof userLng === 'number' && item.latitude && item.longitude) {
      item.distanceKm = Math.round(getHaversineDistance(userLat, userLng, item.latitude, item.longitude) * 10) / 10;
    }

    return item;
  } catch (error) {
    console.error('Error getting rental listing by ID:', error);
    return null;
  }
}

/**
 * Increment view count for a rental listing once per unique visitor session.
 */
export async function incrementRentalViewCountAction(id: string): Promise<boolean> {
  try {
    const realId = extractMarketplaceId(id);
    const docRef = doc(db, COLLECTION_NAME, realId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return false;
    const current = snap.data()?.viewCount || 0;
    await updateDoc(docRef, { viewCount: current + 1 });
    return true;
  } catch (error) {
    console.error('Error incrementing rental view count:', error);
    return false;
  }
}

/**
 * Fetches all rental listings created by a specific user.
 */
export async function getUserRentalListingsAction(userId: string): Promise<RentalListing[]> {
  try {
    if (!userId) return [];
    const collRef = collection(db, COLLECTION_NAME);
    const snap = await getDocs(collRef);

    const nowIso = new Date().toISOString();
    const userItems: RentalListing[] = [];

    for (const d of snap.docs) {
      const item = { id: d.id, ...d.data() } as RentalListing;
      if (item.userId !== userId) continue;

      if (item.status === 'active' && item.expiresAt && item.expiresAt < nowIso) {
        updateDoc(doc(db, COLLECTION_NAME, item.id), { status: 'expired' }).catch(console.error);
        item.status = 'expired';
      }

      userItems.push(item);
    }

    userItems.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    return userItems;
  } catch (error) {
    console.error('Error fetching user rentals:', error);
    return [];
  }
}

/**
 * 1-Click Republish rental post (resets 30-day countdown timer).
 */
export async function republishRentalListingAction(
  id: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const listingRef = doc(db, COLLECTION_NAME, id);
    const snap = await getDoc(listingRef);
    if (!snap.exists()) return { success: false, error: 'Listing not found' };

    const data = snap.data() as RentalListing;
    if (data.userId !== userId) {
      return { success: false, error: 'Unauthorized' };
    }

    const settings = await getMarketplaceSettingsAction();
    const expirationDays = settings.expirationDays || 30;

    const now = Date.now();
    const newExpiresAt = new Date(now + expirationDays * 24 * 60 * 60 * 1000).toISOString();

    await updateDoc(listingRef, {
      status: 'active',
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
      expiresAt: newExpiresAt,
    });

    revalidatePath('/rent-home');
    revalidatePath(`/rent-home/${id}`);
    revalidatePath('/marketplace/my-posts');

    return { success: true };
  } catch (error: any) {
    console.error('Error republishing rental:', error);
    return { success: false, error: error?.message || 'Failed to republish listing.' };
  }
}

/**
 * Updates status of a rental (e.g. mark as 'rented' or 'active').
 */
export async function updateRentalStatusAction(
  id: string,
  userId: string,
  status: MarketplaceListingStatus,
  isAdmin = false
): Promise<{ success: boolean; error?: string }> {
  try {
    const listingRef = doc(db, COLLECTION_NAME, id);
    const snap = await getDoc(listingRef);
    if (!snap.exists()) return { success: false, error: 'Listing not found' };

    const data = snap.data() as RentalListing;
    if (!isAdmin && data.userId !== userId) {
      return { success: false, error: 'Unauthorized' };
    }

    await updateDoc(listingRef, {
      status,
      updatedAt: new Date().toISOString(),
    });

    revalidatePath('/rent-home');
    revalidatePath(`/rent-home/${id}`);
    revalidatePath('/marketplace/my-posts');
    revalidatePath('/admin/rentals');

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to update status.' };
  }
}

/**
 * Permanently deletes a rental listing.
 */
export async function deleteRentalListingAction(
  id: string,
  userId: string,
  isAdmin = false
): Promise<{ success: boolean; error?: string }> {
  try {
    const targetId = extractMarketplaceId(id);
    const listingRef = doc(db, COLLECTION_NAME, targetId);
    const snap = await getDoc(listingRef);
    if (!snap.exists()) return { success: false, error: 'Listing not found' };

    const data = snap.data() as RentalListing;
    if (!isAdmin && data.userId !== userId) {
      return { success: false, error: 'Unauthorized to delete this listing' };
    }

    // Automatically delete all photos associated with this rental from local disk / remote storage
    if (Array.isArray(data.photos) && data.photos.length > 0) {
      await deleteMarketplacePhotos(data.photos).catch((pErr) => {
        console.warn('Could not delete marketplace photos:', pErr);
      });
    }

    // Automatically delete all call logs & inquiries for this rental ad
    await deleteMarketplaceCallLogsByListingIdAction(targetId).catch((cErr) => {
      console.warn('Could not delete marketplace call logs:', cErr);
    });

    await deleteDoc(listingRef);

    revalidatePath('/rent-home');
    revalidatePath('/marketplace/my-posts');
    revalidatePath('/admin/rentals');

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to delete listing.' };
  }
}

/**
 * Increments call count when a buyer confirms calling the landlord.
 */
export async function recordRentalCallAction(id: string): Promise<void> {
  try {
    const snap = await getDoc(doc(db, COLLECTION_NAME, id));
    if (snap.exists()) {
      const data = snap.data();
      await updateDoc(doc(db, COLLECTION_NAME, id), {
        callCount: (data.callCount || 0) + 1,
      });
    }
  } catch (err) {
    console.error('Error logging rental call click:', err);
  }
}

/**
 * Admin action to fetch all rental listings without filtering.
 */
export async function getAdminRentalListingsAction(): Promise<RentalListing[]> {
  try {
    const collRef = collection(db, COLLECTION_NAME);
    const snap = await getDocs(collRef);
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as RentalListing));
    list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    return list;
  } catch (error) {
    console.error('Error getting admin rental listings:', error);
    return [];
  }
}

/**
 * Updates a rental listing (for User Edit or Admin Edit).
 */
export async function updateRentalListingAction(
  id: string,
  userId: string,
  data: Partial<RentalListing>,
  isAdmin = false
): Promise<{ success: boolean; error?: string }> {
  try {
    const targetId = extractMarketplaceId(id);
    const listingRef = doc(db, COLLECTION_NAME, targetId);
    const snap = await getDoc(listingRef);
    if (!snap.exists()) return { success: false, error: 'Rental listing not found' };

    const existing = snap.data() as RentalListing;
    if (!isAdmin && existing.userId !== userId) {
      return { success: false, error: 'Unauthorized to edit this rental listing' };
    }

    // Automatically delete photos from storage that were removed by clicking X mark
    if (Array.isArray(existing.photos) && Array.isArray(data.photos)) {
      const removedPhotos = existing.photos.filter((p) => !data.photos!.includes(p));
      if (removedPhotos.length > 0) {
        await deleteMarketplacePhotos(removedPhotos).catch((pErr) => {
          console.warn('Could not delete removed marketplace photos:', pErr);
        });
      }
    }

    const titleToUse = data.title || existing.title;
    const slug = generateMarketplaceSlug(titleToUse, targetId);

    const payload: Record<string, any> = {
      ...data,
      slug,
      updatedAt: new Date().toISOString(),
    };
    delete payload.id;
    delete payload.createdAt;
    if (!isAdmin) {
      delete payload.userId;
    }

    await updateDoc(listingRef, payload);

    revalidatePath('/rent-home');
    revalidatePath(`/rent-home/${id}`);
    revalidatePath('/marketplace/my-posts');
    revalidatePath('/admin/rentals');

    return { success: true };
  } catch (error: any) {
    console.error('Error updating rental listing:', error);
    return { success: false, error: error?.message || 'Failed to update listing' };
  }
}

