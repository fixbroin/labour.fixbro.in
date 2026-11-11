'use server';

import { adminDb } from '@/lib/firebaseAdmin';
import { db } from '@/lib/mysqlDb';
import { doc, getDoc, setDoc, updateDoc, Timestamp, collection, getDocs, query, where } from '@/lib/mysqlDb';
import { revalidatePath } from 'next/cache';
import { triggerRefresh } from '@/lib/revalidateUtils';
import { sendServerPushNotification } from '@/app/actions/providerWalletActions';
import type { RateAndSkillChangeRequest, ProviderApplication } from '@/types/firestore';

export interface PendingRateAndSkillChangeItem {
  providerId: string;
  providerName: string;
  providerPhone?: string;
  photoUrl?: string;
  workCategoryId?: string;
  workCategoryName?: string;
  request: RateAndSkillChangeRequest;
}

/**
 * 1. Provider submits a request to update their Seniority/Skill Level & Daily Wage Rate
 */
export async function requestRateAndSkillChangeAction(params: {
  providerId: string;
  newSeniorityLevel: string;
  newSkillLevelLabel?: string;
  newDailyRate: number;
}): Promise<{ success: boolean; message: string }> {
  try {
    const { providerId, newSeniorityLevel, newSkillLevelLabel, newDailyRate } = params;
    if (!providerId) throw new Error("Provider ID is required.");
    if (!newSeniorityLevel) throw new Error("Seniority level is required.");
    if (!newDailyRate || newDailyRate < 100) throw new Error("Please enter a valid daily rate (minimum ₹100).");

    const appRef = adminDb.collection('providerApplications').doc(providerId);
    const appSnap = await appRef.get();
    if (!appSnap.exists) {
      throw new Error("Provider application profile not found.");
    }

    const appData = appSnap.data() as ProviderApplication;
    const previousSeniorityLevel = appData.seniorityLevel || appData.skillLevelLabel || 'Fresher';
    const previousSkillLevelLabel = appData.skillLevelLabel || appData.seniorityLevel || 'Fresher';
    const previousDailyRate = Number(appData.dailyRate) || 1200;
    const providerName = appData.fullName || 'Provider';

    // Validate rate bounds against category's configured seniorityRates
    if (appData.workCategoryId || appData.workCategoryName) {
      let catData: any = null;
      if (appData.workCategoryId) {
        const catSnap = await adminDb.collection('adminCategories').doc(appData.workCategoryId).get();
        if (catSnap.exists) {
          catData = catSnap.data();
        }
      }
      if (!catData && appData.workCategoryName) {
        const catQuery = await adminDb.collection('adminCategories').where('name', '==', appData.workCategoryName).limit(1).get();
        if (!catQuery.empty) {
          catData = catQuery.docs[0].data();
        }
      }

      if (catData) {
        const rawRates = catData.seniorityRates;
        const rates: any[] = Array.isArray(rawRates)
          ? rawRates
          : (typeof rawRates === 'string' ? JSON.parse(rawRates || '[]') : []);

        const targetLabel = (newSkillLevelLabel || newSeniorityLevel || '').trim().toLowerCase();
        const targetId = (newSeniorityLevel || '').trim().toLowerCase();

        const rateRule = rates.find((r: any) => {
          const ruleLabel = (r.skillLevelLabel || '').trim().toLowerCase();
          const ruleId = (r.skillLevelId || '').trim().toLowerCase();
          return (ruleLabel && targetLabel && ruleLabel === targetLabel) ||
                 (ruleId && targetId && ruleId === targetId) ||
                 (ruleId && targetLabel && ruleId === targetLabel);
        });

        if (rateRule) {
          const minRate = typeof rateRule.minRate === 'number' ? rateRule.minRate : 500;
          const maxRate = typeof rateRule.maxRate === 'number' ? rateRule.maxRate : 2500;
          if (newDailyRate < minRate || newDailyRate > maxRate) {
            throw new Error(`Requested daily rate ₹${newDailyRate} is outside the allowed range of ₹${minRate} - ₹${maxRate} for ${newSkillLevelLabel || newSeniorityLevel} in ${catData.name || 'this category'}.`);
          }
        }
      }
    }

    const rateAndSkillChangeRequest: RateAndSkillChangeRequest = {
      status: 'pending',
      requestedAt: Timestamp.now(),
      previousSeniorityLevel,
      previousSkillLevelLabel,
      previousDailyRate,
      newSeniorityLevel,
      newSkillLevelLabel: newSkillLevelLabel || newSeniorityLevel,
      newDailyRate: Math.round(newDailyRate),
    };

    const updatePayload = {
      rateAndSkillChangeRequest,
      updatedAt: Timestamp.now(),
    };

    // Update in MySQL via adminDb
    await appRef.set(updatePayload, { merge: true });

    // Client SDK sync
    try {
      await updateDoc(doc(db, 'providerApplications', providerId), updatePayload);
    } catch {}

    // Notify Admins
    try {
      const adminUsersSnap = await adminDb.collection('users').where('role', 'in', ['admin', 'super_admin']).get();
      const adminIds = new Set<string>();
      adminUsersSnap.forEach((d) => adminIds.add(d.id));

      const adminPromises = Array.from(adminIds).map(async (adminUid) => {
        await adminDb.collection('userNotifications').add({
          userId: adminUid,
          title: "Skill & Daily Rate Change Request",
          message: `Provider ${providerName} requested to update rate from ₹${previousDailyRate} (${previousSeniorityLevel}) to ₹${newDailyRate} (${newSeniorityLevel}).`,
          type: 'admin_alert',
          href: '/admin/daily-providers?tab=skill_requests',
          read: false,
          createdAt: Timestamp.now(),
        });

        return sendServerPushNotification({
          userId: adminUid,
          title: "Skill & Daily Rate Change Request",
          body: `Provider ${providerName} requested ₹${newDailyRate}/day (${newSeniorityLevel}). Review for approval.`,
          href: '/admin/daily-providers?tab=skill_requests',
          type: 'admin_alert',
        }).catch((e) => console.error("Error sending admin rate change push:", e));
      });

      await Promise.allSettled(adminPromises);
    } catch (notifyErr) {
      console.error("Error notifying admins of rate change request:", notifyErr);
    }

    revalidatePath('/provider/profile');
    revalidatePath('/admin/daily-providers');
    triggerRefresh('/provider/profile');
    triggerRefresh('/admin/daily-providers');
    triggerRefresh('global-cache');

    return { success: true, message: "Change request submitted successfully for Admin approval." };
  } catch (error: any) {
    console.error("Error in requestRateAndSkillChangeAction:", error);
    return { success: false, message: error.message || "Failed to submit request." };
  }
}

/**
 * 2. Provider cancels a pending request
 */
export async function cancelRateAndSkillChangeAction(providerId: string): Promise<{ success: boolean; message: string }> {
  try {
    if (!providerId) throw new Error("Provider ID is required.");

    const appRef = adminDb.collection('providerApplications').doc(providerId);
    const snap = await appRef.get();
    if (!snap.exists) throw new Error("Provider profile not found.");

    const data = snap.data() as ProviderApplication;
    if (!data.rateAndSkillChangeRequest || data.rateAndSkillChangeRequest.status !== 'pending') {
      throw new Error("No pending rate & skill change request found to cancel.");
    }

    const updatedRequest: RateAndSkillChangeRequest = {
      ...data.rateAndSkillChangeRequest,
      status: 'cancelled',
      resolvedAt: Timestamp.now(),
    };

    await appRef.update({
      rateAndSkillChangeRequest: updatedRequest,
      updatedAt: Timestamp.now(),
    });

    try {
      await updateDoc(doc(db, 'providerApplications', providerId), {
        rateAndSkillChangeRequest: updatedRequest,
        updatedAt: Timestamp.now(),
      });
    } catch {}

    revalidatePath('/provider/profile');
    revalidatePath('/admin/daily-providers');
    triggerRefresh('/provider/profile');
    triggerRefresh('/admin/daily-providers');

    return { success: true, message: "Change request cancelled successfully." };
  } catch (error: any) {
    console.error("Error in cancelRateAndSkillChangeAction:", error);
    return { success: false, message: error.message || "Failed to cancel request." };
  }
}

/**
 * 3. Admin approves request -> Immediately sets new skill level & daily rate live!
 */
export async function approveRateAndSkillChangeAction(providerId: string): Promise<{ success: boolean; message: string }> {
  try {
    if (!providerId) throw new Error("Provider ID is required.");

    const appRef = adminDb.collection('providerApplications').doc(providerId);
    const snap = await appRef.get();
    if (!snap.exists) throw new Error("Provider profile not found.");

    const data = snap.data() as ProviderApplication;
    const req = data.rateAndSkillChangeRequest;
    if (!req || req.status !== 'pending') {
      throw new Error("No pending rate change request found.");
    }

    const updatedRequest: RateAndSkillChangeRequest = {
      ...req,
      status: 'approved',
      resolvedAt: Timestamp.now(),
    };

    const liveProfileUpdate = {
      seniorityLevel: req.newSeniorityLevel,
      skillLevelLabel: req.newSkillLevelLabel || req.newSeniorityLevel,
      dailyRate: req.newDailyRate,
      rateAndSkillChangeRequest: updatedRequest,
      updatedAt: Timestamp.now(),
    };

    await appRef.update(liveProfileUpdate);

    try {
      await updateDoc(doc(db, 'providerApplications', providerId), liveProfileUpdate);
    } catch {}

    // Also sync to main users collection
    try {
      await adminDb.collection('users').doc(providerId).set({
        seniorityLevel: req.newSeniorityLevel,
        skillLevelLabel: req.newSkillLevelLabel || req.newSeniorityLevel,
        dailyRate: req.newDailyRate,
        updatedAt: Timestamp.now(),
      }, { merge: true });
    } catch {}

    // Notify Provider of Approval
    try {
      await adminDb.collection('userNotifications').add({
        userId: providerId,
        title: "Daily Rate & Skill Level Approved! 🎉",
        message: `Your requested update to ${req.newSeniorityLevel} at ₹${req.newDailyRate}/day has been approved by admin and is now live!`,
        type: 'success',
        href: '/provider/profile',
        read: false,
        createdAt: Timestamp.now(),
      });

      await sendServerPushNotification({
        userId: providerId,
        title: "Daily Rate & Skill Level Approved! 🎉",
        body: `Your update to ${req.newSeniorityLevel} at ₹${req.newDailyRate}/day is now live!`,
        href: '/provider/profile',
        type: 'account_approved',
      });
    } catch (e) {
      console.error("Error notifying provider of approval:", e);
    }

    revalidatePath('/provider/profile');
    revalidatePath('/admin/daily-providers');
    revalidatePath('/admin/provider-applications');
    revalidatePath('/');
    triggerRefresh('/provider/profile');
    triggerRefresh('/admin/daily-providers');
    triggerRefresh('/admin/provider-applications');
    triggerRefresh('global-cache');

    return { success: true, message: `Approved! Provider rate is now ₹${req.newDailyRate}/day (${req.newSeniorityLevel}).` };
  } catch (error: any) {
    console.error("Error in approveRateAndSkillChangeAction:", error);
    return { success: false, message: error.message || "Failed to approve request." };
  }
}

/**
 * 4. Admin rejects request
 */
export async function rejectRateAndSkillChangeAction(
  providerId: string,
  rejectionReason?: string
): Promise<{ success: boolean; message: string }> {
  try {
    if (!providerId) throw new Error("Provider ID is required.");

    const appRef = adminDb.collection('providerApplications').doc(providerId);
    const snap = await appRef.get();
    if (!snap.exists) throw new Error("Provider profile not found.");

    const data = snap.data() as ProviderApplication;
    const req = data.rateAndSkillChangeRequest;
    if (!req || req.status !== 'pending') {
      throw new Error("No pending rate change request found.");
    }

    const updatedRequest: RateAndSkillChangeRequest = {
      ...req,
      status: 'rejected',
      resolvedAt: Timestamp.now(),
      rejectionReason: rejectionReason || 'Request rejected by administrator.',
    };

    await appRef.update({
      rateAndSkillChangeRequest: updatedRequest,
      updatedAt: Timestamp.now(),
    });

    try {
      await updateDoc(doc(db, 'providerApplications', providerId), {
        rateAndSkillChangeRequest: updatedRequest,
        updatedAt: Timestamp.now(),
      });
    } catch {}

    // Notify Provider of Rejection
    try {
      await adminDb.collection('userNotifications').add({
        userId: providerId,
        title: "Daily Rate Update Not Approved",
        message: `Your request to change daily rate to ₹${req.newDailyRate} was not approved.${rejectionReason ? ` Reason: ${rejectionReason}` : ''}`,
        type: 'warning',
        href: '/provider/profile',
        read: false,
        createdAt: Timestamp.now(),
      });

      await sendServerPushNotification({
        userId: providerId,
        title: "Daily Rate Update Not Approved",
        body: `Your request to change daily rate to ₹${req.newDailyRate} was not approved.${rejectionReason ? ` Reason: ${rejectionReason}` : ''}`,
        href: '/provider/profile',
        type: 'other',
      });
    } catch (e) {
      console.error("Error notifying provider of rejection:", e);
    }

    revalidatePath('/provider/profile');
    revalidatePath('/admin/daily-providers');
    revalidatePath('/admin/provider-applications');
    triggerRefresh('/provider/profile');
    triggerRefresh('/admin/daily-providers');
    triggerRefresh('/admin/provider-applications');

    return { success: true, message: "Request rejected." };
  } catch (error: any) {
    console.error("Error in rejectRateAndSkillChangeAction:", error);
    return { success: false, message: error.message || "Failed to reject request." };
  }
}

/**
 * 5. Fetch all pending rate and skill changes for Admin review
 */
export async function getPendingRateAndSkillChangesAction(): Promise<PendingRateAndSkillChangeItem[]> {
  try {
    const snap = await adminDb.collection('providerApplications')
      .where('rateAndSkillChangeRequest.status', '==', 'pending')
      .get();

    const items: PendingRateAndSkillChangeItem[] = [];
    snap.forEach((d) => {
      const data = d.data() as ProviderApplication;
      if (data.rateAndSkillChangeRequest && data.rateAndSkillChangeRequest.status === 'pending') {
        const req = data.rateAndSkillChangeRequest;
        let reqTimeMillis = Date.now();
        if (req.requestedAt) {
          const sec = typeof (req.requestedAt as any)._seconds === 'number'
            ? (req.requestedAt as any)._seconds
            : (typeof (req.requestedAt as any).seconds === 'number' ? (req.requestedAt as any).seconds : null);
          if (sec) {
            reqTimeMillis = sec * 1000;
          } else if (typeof (req.requestedAt as any).toDate === 'function') {
            reqTimeMillis = (req.requestedAt as any).toDate().getTime();
          }
        }

        items.push({
          providerId: d.id,
          providerName: data.fullName || 'Provider',
          providerPhone: data.mobileNumber || data.alternateMobile,
          photoUrl: data.profilePhotoUrl,
          workCategoryId: data.workCategoryId,
          workCategoryName: data.workCategoryName,
          request: {
            ...req,
            requestedAt: { seconds: Math.floor(reqTimeMillis / 1000), nanoseconds: 0 } as any,
          },
        });
      }
    });

    return JSON.parse(JSON.stringify(items));
  } catch (error) {
    console.error("Error fetching pending rate changes:", error);
    return [];
  }
}
