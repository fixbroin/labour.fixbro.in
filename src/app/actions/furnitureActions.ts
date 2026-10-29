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
  orderBy,
  limit,
} from '@/lib/mysqlDb';
import { revalidatePath } from 'next/cache';
import type { FurnitureListing, MarketplaceListingStatus } from '@/types/marketplace';
import { getHaversineDistance } from '@/lib/locationUtils';
import { getMarketplaceSettingsAction } from './marketplaceSettingsActions';
import { generateMarketplaceSlug, extractMarketplaceId } from '@/lib/marketplaceSlug';
import { deleteMarketplacePhotos } from '@/lib/marketplaceStorage';
import { deleteMarketplaceCallLogsByListingIdAction } from './marketplaceCallActions';

const COLLECTION_NAME = 'marketplaceFurniture';

export interface FurnitureFilterParams {
  lat?: number;
  lng?: number;
  radiusKm?: number;
  condition?: string; // 'all' | 'brand_new' | 'used'
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  sort?: 'distance' | 'newest' | 'price_asc' | 'price_desc';
}

/**
 * Creates a new furniture listing with automatic 30-day expiration timer.
 */
export async function createFurnitureListingAction(
  data: Omit<FurnitureListing, 'id' | 'createdAt' | 'expiresAt' | 'status' | 'viewCount' | 'callCount'>
): Promise<{ success: boolean; id?: string; slug?: string; error?: string }> {
  try {
    if (!data.title?.trim()) {
      return { success: false, error: 'Title is required' };
    }
    if (!data.category) {
      return { success: false, error: 'Category is required' };
    }
    if (typeof data.price !== 'number' || data.price < 0) {
      return { success: false, error: 'Valid price is required' };
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
      damageDetails: Array.isArray(data.damageDetails) ? data.damageDetails : [],
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
    
    revalidatePath('/furniture');
    revalidatePath('/marketplace/my-posts');
    
    return { success: true, id: docRef.id, slug };
  } catch (error: any) {
    console.error('Error creating furniture listing:', error);
    return { success: false, error: error?.message || 'Failed to create listing.' };
  }
}

/**
 * Fetches active furniture listings with distance calculation, category & price filtering, and auto-expiration.
 */
export async function getFurnitureListingsAction(
  filters: FurnitureFilterParams = {}
): Promise<FurnitureListing[]> {
  try {
    const collRef = collection(db, COLLECTION_NAME);
    const snap = await getDocs(collRef);
    
    const nowIso = new Date().toISOString();
    const results: FurnitureListing[] = [];

    for (const d of snap.docs) {
      const item = { id: d.id, ...d.data() } as FurnitureListing;
      
      // Check 30-day auto-expiration
      if (item.status === 'active' && item.expiresAt && item.expiresAt < nowIso) {
        // Mark as expired in the background
        updateDoc(doc(db, COLLECTION_NAME, item.id), { status: 'expired' }).catch(console.error);
        item.status = 'expired';
      }

      // Only display active listings to public
      if (item.status !== 'active') {
        continue;
      }

      // Filter by condition
      if (filters.condition && filters.condition !== 'all') {
        if (item.listingType !== filters.condition) continue;
      }

      // Filter by category
      if (filters.category && filters.category !== 'all') {
        if (item.category !== filters.category) continue;
      }

      // Filter by price range
      if (typeof filters.minPrice === 'number' && item.price < filters.minPrice) continue;
      if (typeof filters.maxPrice === 'number' && item.price > filters.maxPrice) continue;

      // Filter by search query
      if (filters.search && filters.search.trim()) {
        const queryStr = filters.search.toLowerCase().trim();
        const matchesTitle = item.title?.toLowerCase().includes(queryStr);
        const matchesDesc = item.description?.toLowerCase().includes(queryStr);
        const matchesArea = item.area?.toLowerCase().includes(queryStr);
        const matchesCat = item.category?.toLowerCase().includes(queryStr);
        if (!matchesTitle && !matchesDesc && !matchesArea && !matchesCat) continue;
      }

      // Calculate distance if lat/lng are provided
      if (typeof filters.lat === 'number' && typeof filters.lng === 'number' && item.latitude && item.longitude) {
        const dist = getHaversineDistance(filters.lat, filters.lng, item.latitude, item.longitude);
        item.distanceKm = Math.round(dist * 10) / 10;

        // Radius filter (if specified)
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
      if (sort === 'price_asc') {
        return (a.price || 0) - (b.price || 0);
      }
      if (sort === 'price_desc') {
        return (b.price || 0) - (a.price || 0);
      }
      // 'newest' default
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    return results;
  } catch (error) {
    console.error('Error fetching furniture listings:', error);
    return [];
  }
}

/**
 * Fetches a single furniture listing by ID.
 */
export async function getFurnitureListingByIdAction(
  slugOrId: string,
  userLat?: number,
  userLng?: number
): Promise<FurnitureListing | null> {
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

    const item = { id: snap.id, ...snap.data() } as FurnitureListing;

    // Check expiration
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
    console.error('Error getting furniture listing by ID:', error);
    return null;
  }
}

/**
 * Increment view count for a furniture listing once per unique visitor session.
 */
export async function incrementFurnitureViewCountAction(id: string): Promise<boolean> {
  try {
    const realId = extractMarketplaceId(id);
    const docRef = doc(db, COLLECTION_NAME, realId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return false;
    const current = snap.data()?.viewCount || 0;
    await updateDoc(docRef, { viewCount: current + 1 });
    return true;
  } catch (error) {
    console.error('Error incrementing furniture view count:', error);
    return false;
  }
}

/**
 * Fetches all furniture listings created by a particular user (for "My Posts").
 */
export async function getUserFurnitureListingsAction(userId: string): Promise<FurnitureListing[]> {
  try {
    if (!userId) return [];
    const collRef = collection(db, COLLECTION_NAME);
    const snap = await getDocs(collRef);
    
    const nowIso = new Date().toISOString();
    const userItems: FurnitureListing[] = [];

    for (const d of snap.docs) {
      const item = { id: d.id, ...d.data() } as FurnitureListing;
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
    console.error('Error fetching user furniture listings:', error);
    return [];
  }
}

/**
 * 1-Click Republish listing: Resets the 30-day countdown timer and reactivates an expired or sold post.
 */
export async function republishFurnitureListingAction(
  id: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const listingRef = doc(db, COLLECTION_NAME, id);
    const snap = await getDoc(listingRef);
    if (!snap.exists()) return { success: false, error: 'Listing not found' };

    const data = snap.data() as FurnitureListing;
    if (data.userId !== userId) {
      return { success: false, error: 'Unauthorized to republish this listing' };
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

    revalidatePath('/furniture');
    revalidatePath(`/furniture/${id}`);
    revalidatePath('/marketplace/my-posts');

    return { success: true };
  } catch (error: any) {
    console.error('Error republishing furniture listing:', error);
    return { success: false, error: error?.message || 'Failed to republish listing.' };
  }
}

/**
 * Updates status of a listing (e.g. mark as 'sold' or 'active').
 */
export async function updateFurnitureStatusAction(
  id: string,
  userId: string,
  status: MarketplaceListingStatus,
  isAdmin = false
): Promise<{ success: boolean; error?: string }> {
  try {
    const listingRef = doc(db, COLLECTION_NAME, id);
    const snap = await getDoc(listingRef);
    if (!snap.exists()) return { success: false, error: 'Listing not found' };

    const data = snap.data() as FurnitureListing;
    if (!isAdmin && data.userId !== userId) {
      return { success: false, error: 'Unauthorized' };
    }

    await updateDoc(listingRef, {
      status,
      updatedAt: new Date().toISOString(),
    });

    revalidatePath('/furniture');
    revalidatePath(`/furniture/${id}`);
    revalidatePath('/marketplace/my-posts');
    revalidatePath('/admin/furniture');

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to update status.' };
  }
}

/**
 * Permanently deletes a furniture listing.
 */
export async function deleteFurnitureListingAction(
  id: string,
  userId: string,
  isAdmin = false
): Promise<{ success: boolean; error?: string }> {
  try {
    const targetId = extractMarketplaceId(id);
    const listingRef = doc(db, COLLECTION_NAME, targetId);
    const snap = await getDoc(listingRef);
    if (!snap.exists()) return { success: false, error: 'Listing not found' };

    const data = snap.data() as FurnitureListing;
    if (!isAdmin && data.userId !== userId) {
      return { success: false, error: 'Unauthorized to delete this listing' };
    }

    // Automatically delete all photos associated with this ad from local disk / remote storage
    if (Array.isArray(data.photos) && data.photos.length > 0) {
      await deleteMarketplacePhotos(data.photos).catch((pErr) => {
        console.warn('Could not delete marketplace photos:', pErr);
      });
    }

    // Automatically delete all call logs & inquiries for this ad
    await deleteMarketplaceCallLogsByListingIdAction(targetId).catch((cErr) => {
      console.warn('Could not delete marketplace call logs:', cErr);
    });

    await deleteDoc(listingRef);

    revalidatePath('/furniture');
    revalidatePath('/marketplace/my-posts');
    revalidatePath('/admin/furniture');

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to delete listing.' };
  }
}

/**
 * Increments call count when a buyer confirms calling the seller.
 */
export async function recordFurnitureCallAction(id: string): Promise<void> {
  try {
    const snap = await getDoc(doc(db, COLLECTION_NAME, id));
    if (snap.exists()) {
      const data = snap.data();
      await updateDoc(doc(db, COLLECTION_NAME, id), {
        callCount: (data.callCount || 0) + 1,
      });
    }
  } catch (err) {
    console.error('Error logging call click:', err);
  }
}

/**
 * Admin action to fetch all furniture listings without filtering.
 */
export async function getAdminFurnitureListingsAction(): Promise<FurnitureListing[]> {
  try {
    const collRef = collection(db, COLLECTION_NAME);
    const snap = await getDocs(collRef);
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as FurnitureListing));
    list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    return list;
  } catch (error) {
    console.error('Error getting admin furniture listings:', error);
    return [];
  }
}

/**
 * Updates a furniture listing (for User Edit or Admin Edit).
 */
export async function updateFurnitureListingAction(
  id: string,
  userId: string,
  data: Partial<FurnitureListing>,
  isAdmin = false
): Promise<{ success: boolean; error?: string }> {
  try {
    const targetId = extractMarketplaceId(id);
    const listingRef = doc(db, COLLECTION_NAME, targetId);
    const snap = await getDoc(listingRef);
    if (!snap.exists()) return { success: false, error: 'Listing not found' };

    const existing = snap.data() as FurnitureListing;
    if (!isAdmin && existing.userId !== userId) {
      return { success: false, error: 'Unauthorized to edit this listing' };
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

    revalidatePath('/furniture');
    revalidatePath(`/furniture/${id}`);
    revalidatePath('/marketplace/my-posts');
    revalidatePath('/admin/furniture');

    return { success: true };
  } catch (error: any) {
    console.error('Error updating furniture listing:', error);
    return { success: false, error: error?.message || 'Failed to update listing' };
  }
}

/**
 * Bans a marketplace user, disables their account, and disapproves/removes all their ads.
 */
export async function banMarketplaceUserAction(
  userId: string,
  reason = 'Violation of marketplace policies'
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!userId) return { success: false, error: 'User ID is required' };

    // 1. Disable the user account in users table/collection
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        isActive: false,
        isBanned: true,
        banReason: reason,
        updatedAt: new Date().toISOString(),
      });
    } catch (uErr) {
      console.warn('Could not update user record:', uErr);
    }

    // 2. Remove all furniture listings by this user
    try {
      const fColl = collection(db, 'marketplaceFurniture');
      const fSnap = await getDocs(fColl);
      for (const d of fSnap.docs) {
        if (d.data().userId === userId) {
          await updateDoc(doc(db, 'marketplaceFurniture', d.id), {
            status: 'removed',
            updatedAt: new Date().toISOString(),
          });
        }
      }
    } catch (fErr) {
      console.warn('Could not remove user furniture listings:', fErr);
    }

    // 3. Remove all rental listings by this user
    try {
      const rColl = collection(db, 'marketplaceRentals');
      const rSnap = await getDocs(rColl);
      for (const d of rSnap.docs) {
        if (d.data().userId === userId) {
          await updateDoc(doc(db, 'marketplaceRentals', d.id), {
            status: 'removed',
            updatedAt: new Date().toISOString(),
          });
        }
      }
    } catch (rErr) {
      console.warn('Could not remove user rental listings:', rErr);
    }

    revalidatePath('/furniture');
    revalidatePath('/rent-home');
    revalidatePath('/marketplace/my-posts');
    revalidatePath('/admin/furniture');
    revalidatePath('/admin/rentals');

    return { success: true };
  } catch (err: any) {
    console.error('Error banning marketplace user:', err);
    return { success: false, error: err?.message || 'Failed to ban user' };
  }
}

