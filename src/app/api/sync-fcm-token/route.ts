import { NextResponse, type NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { verifyRequest } from '@/lib/dbSecurity';
import { Timestamp } from '@/lib/timestamp';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, userId, platform, appVariant } = body;

    if (!token || typeof token !== 'string' || token.trim().length < 10) {
      return NextResponse.json({ success: false, error: 'Invalid or missing FCM token.' }, { status: 400 });
    }

    const verification = await verifyRequest(request);
    // The target UID is either the verified caller or the passed userId parameter
    const targetUid = (verification.uid && verification.uid !== 'guest') 
      ? verification.uid 
      : (userId || null);

    if (!targetUid || targetUid === 'guest') {
      return NextResponse.json({ 
        success: false, 
        error: 'No target user ID provided or authenticated.' 
      }, { status: 400 });
    }

    const cleanToken = token.trim();
    const userDocRef = adminDb.collection('users').doc(targetUid);
    const userDoc = await userDocRef.get();

    if (userDoc.exists) {
      const data = userDoc.data() || {};
      const existingTokens = data.fcmTokens && typeof data.fcmTokens === 'object' ? { ...data.fcmTokens } : {};
      existingTokens[cleanToken] = Timestamp.now();

      await userDocRef.update({
        fcmTokens: existingTokens,
        lastDeviceToken: cleanToken,
        lastAppPlatform: platform || 'android',
        lastAppVariant: appVariant || 'customer',
        lastTokenSyncedAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
    } else {
      await userDocRef.set({
        id: targetUid,
        fcmTokens: {
          [cleanToken]: Timestamp.now()
        },
        lastDeviceToken: cleanToken,
        lastAppPlatform: platform || 'android',
        lastAppVariant: appVariant || 'customer',
        lastTokenSyncedAt: Timestamp.now(),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      }, { merge: true });
    }

    // Also sync to admin document if an admin document exists for this user
    try {
      const adminDocRef = adminDb.collection('admins').doc(targetUid);
      const adminDoc = await adminDocRef.get();
      if (adminDoc.exists) {
        const adminData = adminDoc.data() || {};
        const adminTokens = adminData.fcmTokens && typeof adminData.fcmTokens === 'object' ? { ...adminData.fcmTokens } : {};
        adminTokens[cleanToken] = Timestamp.now();
        await adminDocRef.update({
          fcmTokens: adminTokens,
          lastDeviceToken: cleanToken,
          updatedAt: Timestamp.now()
        });
      }
    } catch (_) {}

    return NextResponse.json({
      success: true,
      userId: targetUid,
      syncedToken: cleanToken.substring(0, 15) + '...'
    });
  } catch (error: any) {
    console.error("Error in sync-fcm-token API:", error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
