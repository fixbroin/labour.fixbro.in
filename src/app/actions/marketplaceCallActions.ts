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
  Timestamp,
} from '@/lib/mysqlDb';
import { revalidatePath } from 'next/cache';
import type { MarketplaceCallLog } from '@/types/marketplace';

const CALL_LOGS_COLLECTION = 'marketplaceCallLogs';

export interface SellerCallLogItem {
  id: string;
  callerName: string;
  callerPhone: string;
  callerEmail?: string;
  listingId: string;
  listingTitle: string;
  listingType: 'furniture' | 'rental';
  callCount?: number;
  lastCalledAt?: string;
  createdAt: string;
}

/**
 * Records a call click from a logged-in user to a listing owner.
 * Increments callCount on the listing and logs caller details for Admin and Seller.
 * If the same caller has already called this listing, increments callCount on the existing log rather than creating duplicates.
 * Also generates an in-app notification for the seller so they immediately know who called.
 */
export async function recordMarketplaceCallAction(
  data: Omit<MarketplaceCallLog, 'id' | 'createdAt'>
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    if (!data.callerUserId || !data.sellerUserId) {
      return { success: false, error: 'User IDs are required to record a call.' };
    }

    // A user cannot call themselves on their own listing
    if (data.callerUserId === data.sellerUserId) {
      return { success: false, error: 'You cannot call yourself on your own listing.' };
    }

    const collRef = collection(db, CALL_LOGS_COLLECTION);
    const snap = await getDocs(collRef);
    const existingDoc = snap.docs.find(
      (d) => {
        const item = d.data();
        return item.callerUserId === data.callerUserId && item.listingId === data.listingId;
      }
    );

    let docId = '';
    let currentCallCount = 1;

    if (existingDoc) {
      docId = existingDoc.id;
      const prevData = existingDoc.data() as MarketplaceCallLog;
      currentCallCount = (prevData.callCount || 1) + 1;
      await updateDoc(doc(db, CALL_LOGS_COLLECTION, docId), {
        callCount: currentCallCount,
        lastCalledAt: new Date().toISOString(),
        callerName: data.callerName?.trim() || prevData.callerName,
        callerPhone: data.callerPhone?.trim() || prevData.callerPhone,
        callerEmail: data.callerEmail || prevData.callerEmail,
      });
    } else {
      const payload: MarketplaceCallLog = {
        ...data,
        callerName: data.callerName?.trim() || 'FixBro User',
        callerPhone: data.callerPhone?.trim() || '',
        callCount: 1,
        lastCalledAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      const docRef = await addDoc(collRef, payload);
      docId = docRef.id;
    }

    // Save phone to caller user profile if missing
    if (data.callerUserId && data.callerPhone) {
      try {
        const userRef = doc(db, 'users', data.callerUserId);
        const uSnap = await getDoc(userRef);
        if (uSnap.exists()) {
          const uData = uSnap.data();
          if (!uData.mobileNumber) {
            await updateDoc(userRef, { mobileNumber: data.callerPhone });
          }
        }
      } catch {}
    }

    // Increment total callCount on the respective listing
    const targetCollection = data.listingType === 'furniture' ? 'marketplaceFurniture' : 'marketplaceRentals';
    try {
      const listingRef = doc(db, targetCollection, data.listingId);
      const lSnap = await getDoc(listingRef);
      if (lSnap.exists()) {
        const item = lSnap.data();
        await updateDoc(listingRef, {
          callCount: (item.callCount || 0) + 1,
        });
      }
    } catch (countErr) {
      console.warn("Could not increment listing callCount:", countErr);
    }

    // In-app notification for seller so they immediately see who called
    if (data.sellerUserId) {
      try {
        const notificationTitle = currentCallCount > 1
          ? `📞 Inquiry on "${data.listingTitle}" (Called ${currentCallCount} times)`
          : `📞 New Inquiry on "${data.listingTitle}"`;
        const notificationMessage = currentCallCount > 1
          ? `${data.callerName || 'A user'} (${data.callerPhone || 'Caller'}) called again regarding your ${
              data.listingType === 'furniture' ? 'furniture ad' : 'rental listing'
            } (Called ${currentCallCount} times).`
          : `${data.callerName || 'A buyer'} (${data.callerPhone || 'Caller'}) clicked to call regarding your ${
              data.listingType === 'furniture' ? 'furniture ad' : 'rental listing'
            }.`;

        await addDoc(collection(db, 'userNotifications'), {
          userId: data.sellerUserId,
          title: notificationTitle,
          message: notificationMessage,
          type: 'info',
          href: '/marketplace/my-posts',
          read: false,
          createdAt: Timestamp.now(),
        });
      } catch (notifErr) {
        console.warn('Could not post seller notification:', notifErr);
      }
    }

    revalidatePath('/admin/furniture');
    revalidatePath('/admin/rentals');
    revalidatePath('/marketplace/my-posts');

    return { success: true, id: docId };
  } catch (error: any) {
    console.error('Error recording marketplace call log:', error);
    return { success: false, error: error?.message || 'Failed to record call.' };
  }
}

/**
 * Fetches all call logs for Admin (full details: caller name, phone, email, listing info).
 */
export async function getAdminMarketplaceCallLogsAction(): Promise<MarketplaceCallLog[]> {
  try {
    const collRef = collection(db, CALL_LOGS_COLLECTION);
    const snap = await getDocs(collRef);
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as MarketplaceCallLog));
    list.sort((a, b) => new Date(b.lastCalledAt || b.createdAt || 0).getTime() - new Date(a.lastCalledAt || a.createdAt || 0).getTime());
    return list;
  } catch (error) {
    console.error('Error getting admin marketplace call logs:', error);
    return [];
  }
}

/**
 * Fetches caller information for the seller who posted the listing.
 * Includes callerName, callerPhone, callerEmail, listingTitle, callCount, and timestamp so the seller knows who called and can call back.
 */
export async function getSellerMarketplaceCallLogsAction(
  sellerUserId: string
): Promise<SellerCallLogItem[]> {
  try {
    if (!sellerUserId) return [];
    const collRef = collection(db, CALL_LOGS_COLLECTION);
    const snap = await getDocs(collRef);
    const list = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as MarketplaceCallLog))
      .filter(x => x.sellerUserId === sellerUserId)
      .map(x => ({
        id: x.id || '',
        callerName: x.callerName || 'Interested User',
        callerPhone: x.callerPhone || '',
        callerEmail: x.callerEmail || '',
        listingId: x.listingId || '',
        listingTitle: x.listingTitle || 'Listing',
        listingType: (x.listingType || 'furniture') as 'furniture' | 'rental',
        callCount: x.callCount || 1,
        lastCalledAt: x.lastCalledAt || x.createdAt,
        createdAt: x.createdAt,
      }));
    list.sort((a, b) => new Date(b.lastCalledAt || b.createdAt || 0).getTime() - new Date(a.lastCalledAt || a.createdAt || 0).getTime());
    return list;
  } catch (error) {
    console.error('Error getting seller marketplace call logs:', error);
    return [];
  }
}

/**
 * Permanently deletes all call logs associated with a deleted ad.
 */
export async function deleteMarketplaceCallLogsByListingIdAction(
  listingId: string
): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
  try {
    if (!listingId) return { success: true, deletedCount: 0 };
    const collRef = collection(db, CALL_LOGS_COLLECTION);
    const snap = await getDocs(collRef);
    let count = 0;
    for (const d of snap.docs) {
      const data = d.data() as MarketplaceCallLog;
      if (data.listingId === listingId) {
        await deleteDoc(doc(db, CALL_LOGS_COLLECTION, d.id));
        count++;
      }
    }
    revalidatePath('/admin/furniture');
    revalidatePath('/admin/rentals');
    revalidatePath('/marketplace/my-posts');
    return { success: true, deletedCount: count };
  } catch (err: any) {
    console.error('Error deleting marketplace call logs for listing:', err);
    return { success: false, error: err?.message || 'Failed to delete call logs' };
  }
}

