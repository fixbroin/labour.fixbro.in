import { type NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { getTimestampMillis } from '@/lib/utils';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { bookingId, sweepStale } = body;

    let deletedCount = 0;

    // 1. Delete a specific pending online booking if requested (e.g., on modal dismiss / failure / cancel)
    if (bookingId && typeof bookingId === 'string') {
      const docRef = adminDb.collection('bookings').doc(bookingId);
      const snap = await docRef.get();
      if (snap.exists) {
        const data = snap.data() as any;
        const isOnline = (data?.paymentMethod || '').toLowerCase().trim() === 'online';
        const isUnpaid =
          data?.status === 'Pending Payment' &&
          !data?.razorpayPaymentId &&
          !data?.stripePaymentIntent &&
          !data?.stripeSessionId;

        if (isOnline && isUnpaid) {
          await docRef.delete();
          deletedCount++;
        }
      }
    }

    // 2. Optionally sweep abandoned unpaid Online bookings (status === 'Pending Payment', no payment ID)
    if (sweepStale) {
      const pendingSnap = await adminDb
        .collection('bookings')
        .where('status', '==', 'Pending Payment')
        .get();

      const now = Date.now();
      const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

      for (const docSnap of pendingSnap.docs) {
        const data = docSnap.data() as any;
        const isOnline = (data?.paymentMethod || '').toLowerCase().trim() === 'online';
        const hasNoPaymentId =
          !data?.razorpayPaymentId &&
          !data?.stripePaymentIntent &&
          !data?.stripeSessionId;
        const isUnassigned = !data?.providerId && (!data?.bookingNumber || Number(data?.bookingNumber) === 0);

        if (isOnline && hasNoPaymentId && isUnassigned) {
          const createdMs = getTimestampMillis(data?.createdAt) || 0;
          if (!createdMs || now - createdMs > STALE_THRESHOLD_MS) {
            await adminDb.collection('bookings').doc(docSnap.id).delete();
            deletedCount++;
          }
        }
      }
    }

    return NextResponse.json({ success: true, deletedCount });
  } catch (error: any) {
    console.error('Error in cancel-pending-payment route:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
