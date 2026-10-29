import { NextResponse, type NextRequest } from 'next/server';
import { getPool, setDocInternal, updateDocInternal, deleteDocInternal } from '@/lib/mysql';
import { verifyRequest, validateAccess, isUserAdmin, isFieldProtectedFromCustomerMutation } from '@/lib/dbSecurity';

export async function POST(request: NextRequest) {
  try {
    const user = await verifyRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
    }

    const { operations = [] } = await request.json();
    const isAdmin = isUserAdmin(user);

    // Verify access and sanitize fields for all operations in the batch first
    for (const op of operations) {
      const pathToCheck = op.collection ? `${op.collection}/${op.id || ''}` : op.id || '';
      const isAllowed = validateAccess(user, pathToCheck, 'write');
      if (!isAllowed) {
        return NextResponse.json({ success: false, error: `Forbidden: No write access to "${pathToCheck}".` }, { status: 403 });
      }

      if (!isAdmin && (op.collection === 'users' || pathToCheck.startsWith('users/'))) {
        if (op.data && typeof op.data === 'object') {
          for (const key of Object.keys(op.data)) {
            if (isFieldProtectedFromCustomerMutation(key)) {
              delete op.data[key];
            }
          }
        }
      }

      if (!isAdmin && (op.collection === 'bookings' || pathToCheck.startsWith('bookings/'))) {
        if (op.action === 'deleteDoc') {
          return NextResponse.json({ success: false, error: 'Forbidden: Bookings cannot be deleted directly by clients.' }, { status: 403 });
        }
        if (op.data && typeof op.data === 'object') {
          delete op.data.razorpayPaymentId;
          delete op.data.razorpayOrderId;
          delete op.data.razorpaySignature;
          delete op.data.stripeSessionId;
          delete op.data.stripePaymentIntent;

          const restrictedStatuses = [
            'Confirmed',
            'AssignedToProvider',
            'ProviderAccepted',
            'InProgressByProvider',
            'Completed',
          ];
          if (op.data.status && restrictedStatuses.includes(op.data.status)) {
            return NextResponse.json(
              { success: false, error: 'Forbidden: Booking status progression must be processed via authoritative server endpoints.' },
              { status: 403 }
            );
          }
        }
      }
    }

    const pool = await getPool();
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      for (const op of operations) {
        if (op.action === 'setDoc') {
          await setDocInternal(conn, op.collection, op.id, op.data, op.options);
        } else if (op.action === 'updateDoc') {
          await updateDocInternal(conn, op.collection, op.id, op.data);
        } else if (op.action === 'deleteDoc') {
          await deleteDocInternal(conn, op.collection, op.id);
        }
      }

      await conn.commit();
      return NextResponse.json({ success: true });
    } catch (err: any) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Batch transaction failed' },
      { status: 500 }
    );
  }
}
