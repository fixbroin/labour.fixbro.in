'use server';

import { adminDb } from '@/lib/firebaseAdmin';
import { db } from '@/lib/mysqlDb';
import { doc, getDoc, setDoc, updateDoc, Timestamp } from '@/lib/mysqlDb';
import { revalidatePath } from 'next/cache';
import { triggerRefresh } from '@/lib/revalidateUtils';
import { sendServerPushNotification } from '@/app/actions/providerWalletActions';
import { getTimestampMillis } from '@/lib/utils';
import type { LocationChangeRequest, ProviderApplication } from '@/types/firestore';
import type { PendingLocationChangeItem } from '@/types/providerAreaAndId';

/**
 * 1. Provider submits a request to change their serviceable base location & radius.
 */
export async function requestServiceAreaChangeAction(params: {
  providerId: string;
  newAddress: string;
  newCenter: { latitude: number; longitude: number };
  newRadiusKm: number;
}): Promise<{ success: boolean; message: string }> {
  try {
    const { providerId, newAddress, newCenter, newRadiusKm } = params;
    if (!providerId) throw new Error("Provider ID is required.");

    const appRef = adminDb.collection('providerApplications').doc(providerId);
    const appSnap = await appRef.get();
    if (!appSnap.exists) {
      throw new Error("Provider application profile not found.");
    }

    const appData = appSnap.data() as ProviderApplication;
    const previousAddress = appData.workAreaAddress || 'Not Configured';
    const previousCenter = appData.workAreaCenter || null;
    const previousRadiusKm = appData.workAreaRadiusKm || 5;
    const providerName = appData.fullName || 'Provider';

    const locationChangeRequest: LocationChangeRequest = {
      status: 'pending',
      requestedAt: Timestamp.now(),
      previousAddress,
      previousCenter: previousCenter || undefined,
      previousRadiusKm,
      newAddress,
      newCenter,
      newRadiusKm,
    };

    const updatePayload = {
      locationChangeRequest,
      updatedAt: Timestamp.now(),
    };

    // Update in MySQL via adminDb
    await appRef.set(updatePayload, { merge: true });

    // Client SDK sync
    try {
      await updateDoc(doc(db, 'providerApplications', providerId), updatePayload);
    } catch {
      // adminDb write already committed
    }

    // Notify Admins
    try {
      const adminUsersSnap = await adminDb.collection('users').where('role', 'in', ['admin', 'super_admin']).get();
      const adminIds = new Set<string>();
      adminUsersSnap.forEach((d) => adminIds.add(d.id));

      const adminPromises = Array.from(adminIds).map(async (adminUid) => {
        // In-app notification
        await adminDb.collection('userNotifications').add({
          userId: adminUid,
          title: "Service Area Change Request",
          message: `Provider ${providerName} requested to change their serviceable area from "${previousAddress}" to "${newAddress}" (${newRadiusKm} km).`,
          type: 'admin_alert',
          href: '/admin/provider-applications?tab=location_changes',
          read: false,
          createdAt: Timestamp.now(),
        });

        // FCM push notification
        return sendServerPushNotification({
          userId: adminUid,
          title: "Service Area Change Request",
          body: `Provider ${providerName} requested to change area to ${newAddress} (${newRadiusKm} km). Review for approval.`,
          href: '/admin/provider-applications?tab=location_changes',
          type: 'admin_alert',
        }).catch((e) => console.error("Error sending admin area change push:", e));
      });

      await Promise.allSettled(adminPromises);
    } catch (notifyErr) {
      console.error("Error notifying admins of area change request:", notifyErr);
    }

    revalidatePath('/provider/service-area');
    revalidatePath('/admin/provider-applications');
    triggerRefresh('/provider/service-area');
    triggerRefresh('/admin/provider-applications');

    return { 
      success: true, 
      message: "Location change request submitted successfully. It is now awaiting admin approval." 
    };
  } catch (error: any) {
    console.error("Error submitting area change request:", error);
    return { success: false, message: error.message || "Failed to submit change request." };
  }
}

/**
 * 2. Provider cancels their pending location change request.
 */
export async function cancelServiceAreaChangeAction(
  providerId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const appRef = adminDb.collection('providerApplications').doc(providerId);
    const appSnap = await appRef.get();
    if (!appSnap.exists) throw new Error("Provider application not found.");

    const appData = appSnap.data() as ProviderApplication;
    if (appData.locationChangeRequest?.status !== 'pending') {
      throw new Error("No pending location change request found to cancel.");
    }

    const updatePayload = {
      'locationChangeRequest.status': 'cancelled',
      'locationChangeRequest.resolvedAt': Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    await appRef.update(updatePayload);
    try {
      await updateDoc(doc(db, 'providerApplications', providerId), updatePayload);
    } catch {
      // adminDb committed
    }

    revalidatePath('/provider/service-area');
    revalidatePath('/admin/provider-applications');
    triggerRefresh('/provider/service-area');
    triggerRefresh('/admin/provider-applications');

    return { success: true, message: "Location change request cancelled." };
  } catch (error: any) {
    console.error("Error cancelling area change request:", error);
    return { success: false, message: error.message || "Failed to cancel request." };
  }
}

/**
 * 3. Admin approves location change request.
 */
export async function approveServiceAreaChangeAction(
  providerId: string,
  adminNotes?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const appRef = adminDb.collection('providerApplications').doc(providerId);
    const appSnap = await appRef.get();
    if (!appSnap.exists) throw new Error("Provider application record not found.");

    const appData = appSnap.data() as ProviderApplication;
    const req = appData.locationChangeRequest;
    if (!req || req.status !== 'pending') {
      throw new Error("No pending location change request found for this provider.");
    }

    // Apply new location & radius
    const updatePayload: Record<string, any> = {
      workAreaAddress: req.newAddress,
      workAreaCenter: req.newCenter,
      workAreaRadiusKm: req.newRadiusKm,
      locationChangeRequest: {
        ...req,
        status: 'approved',
        resolvedAt: Timestamp.now(),
        adminNotes: adminNotes || null,
      },
      updatedAt: Timestamp.now(),
    };

    await appRef.set(updatePayload, { merge: true });

    try {
      await updateDoc(doc(db, 'providerApplications', providerId), updatePayload);
    } catch {
      // adminDb committed
    }

    // Notify provider in-app & push
    try {
      await adminDb.collection('userNotifications').add({
        userId: providerId,
        title: "Service Area Change Approved!",
        message: `Admin approved your serviceable area change to "${req.newAddress}" with a ${req.newRadiusKm} km radius. Your new coverage is now active.`,
        type: 'success',
        href: '/provider/service-area',
        read: false,
        createdAt: Timestamp.now(),
      });

      await sendServerPushNotification({
        userId: providerId,
        title: "Service Area Change Approved!",
        body: `Your new service area (${req.newAddress}, ${req.newRadiusKm} km) is now active and receiving customer jobs.`,
        href: '/provider/service-area',
        type: 'info',
      });
    } catch (e) {
      console.error("Error notifying provider of approved area:", e);
    }

    revalidatePath('/provider/service-area');
    revalidatePath('/admin/provider-applications');
    triggerRefresh('/provider/service-area');
    triggerRefresh('/admin/provider-applications');

    return { success: true, message: "Location change approved and new service area applied!" };
  } catch (error: any) {
    console.error("Error approving area change:", error);
    return { success: false, message: error.message || "Failed to approve change." };
  }
}

/**
 * 4. Admin rejects location change request.
 */
export async function rejectServiceAreaChangeAction(
  providerId: string,
  reason: string
): Promise<{ success: boolean; message: string }> {
  try {
    const appRef = adminDb.collection('providerApplications').doc(providerId);
    const appSnap = await appRef.get();
    if (!appSnap.exists) throw new Error("Provider application not found.");

    const appData = appSnap.data() as ProviderApplication;
    const req = appData.locationChangeRequest;
    if (!req || req.status !== 'pending') {
      throw new Error("No pending location change request found for this provider.");
    }

    const updatePayload: Record<string, any> = {
      locationChangeRequest: {
        ...req,
        status: 'rejected',
        rejectionReason: reason || 'Not approved by administration.',
        resolvedAt: Timestamp.now(),
      },
      updatedAt: Timestamp.now(),
    };

    await appRef.set(updatePayload, { merge: true });

    try {
      await updateDoc(doc(db, 'providerApplications', providerId), updatePayload);
    } catch {
      // adminDb committed
    }

    // Notify provider
    try {
      await adminDb.collection('userNotifications').add({
        userId: providerId,
        title: "Service Area Change Declined",
        message: `Your request to change service area was declined. Reason: ${reason || 'Contact administration for details.'}`,
        type: 'warning',
        href: '/provider/service-area',
        read: false,
        createdAt: Timestamp.now(),
      });

      await sendServerPushNotification({
        userId: providerId,
        title: "Service Area Change Declined",
        body: `Your location change was not approved. Reason: ${reason || 'Contact administration.'}`,
        href: '/provider/service-area',
        type: 'info',
      });
    } catch (e) {
      console.error("Error notifying provider of rejected area:", e);
    }

    revalidatePath('/provider/service-area');
    revalidatePath('/admin/provider-applications');
    triggerRefresh('/provider/service-area');
    triggerRefresh('/admin/provider-applications');

    return { success: true, message: "Location change request rejected." };
  } catch (error: any) {
    console.error("Error rejecting area change:", error);
    return { success: false, message: error.message || "Failed to reject change." };
  }
}

/**
 * 5. Fetch all pending service area change requests for Admin.
 */
export async function getPendingServiceAreaChangesAction(): Promise<PendingLocationChangeItem[]> {
  try {
    const snap = await adminDb.collection('providerApplications').get();
    const list: PendingLocationChangeItem[] = [];

    snap.forEach((docSnap) => {
      const data = docSnap.data() as ProviderApplication;
      if (data.locationChangeRequest && data.locationChangeRequest.status === 'pending') {
        const req = data.locationChangeRequest;
        const requestedAt = getTimestampMillis(req.requestedAt) || (typeof req.requestedAt === 'number' ? req.requestedAt : Date.now());
        const resolvedAt = req.resolvedAt ? (getTimestampMillis(req.resolvedAt) || Date.now()) : undefined;

        list.push({
          providerId: docSnap.id,
          providerName: String(data.fullName || 'Provider'),
          providerPhone: data.mobileNumber ? String(data.mobileNumber) : undefined,
          categoryName: data.workCategoryName ? String(data.workCategoryName) : undefined,
          photoUrl: data.profilePhotoUrl ? String(data.profilePhotoUrl) : undefined,
          request: {
            status: req.status,
            requestedAt,
            resolvedAt,
            previousAddress: String(req.previousAddress || ''),
            previousCenter: req.previousCenter ? {
              latitude: Number(req.previousCenter.latitude || 0),
              longitude: Number(req.previousCenter.longitude || 0),
            } : undefined,
            previousRadiusKm: Number(req.previousRadiusKm || 5),
            newAddress: String(req.newAddress || ''),
            newCenter: {
              latitude: Number(req.newCenter?.latitude || 0),
              longitude: Number(req.newCenter?.longitude || 0),
            },
            newRadiusKm: Number(req.newRadiusKm || 5),
            rejectionReason: req.rejectionReason ? String(req.rejectionReason) : undefined,
          },
        });
      }
    });

    return JSON.parse(JSON.stringify(list));
  } catch (error) {
    console.error("Error fetching pending area changes:", error);
    return [];
  }
}
