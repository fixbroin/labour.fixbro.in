"use server";

import { getPool } from '@/lib/mysql';

export interface ProviderBookedDatesResponse {
  success: boolean;
  bookedDates: string[]; // List of 'YYYY-MM-DD'
  error?: string;
}

/**
 * Fetches all booked dates for the specified provider ID(s)
 * from all active bookings (not cancelled or rejected).
 */
export async function getProviderBookedDatesAction(
  providerIds: string[]
): Promise<ProviderBookedDatesResponse> {
  if (!providerIds || providerIds.length === 0) {
    return { success: true, bookedDates: [] };
  }

  try {
    const pool = await getPool();
    // Fetch all active bookings
    const [rows] = await pool.query(
      `SELECT data FROM bookings WHERE 
       JSON_UNQUOTE(JSON_EXTRACT(data, '$.status')) NOT IN ('Cancelled', 'cancelled', 'Rejected', 'rejected', 'Refunded', 'refunded')`
    );

    const bookedDatesSet = new Set<string>();
    const normalizedTargetIds = new Set(providerIds.map(id => String(id).trim()));

    for (const row of rows as any[]) {
      let bData: any = null;
      try {
        bData = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
      } catch (e) {
        continue;
      }
      if (!bData) continue;

      const rawScheduledDate = bData.scheduledDate;
      if (!rawScheduledDate) continue;

      // Extract services and check if any targeted provider is involved
      const services: any[] = Array.isArray(bData.services) ? bData.services : [];
      const bookingProviderId = bData.providerId ? String(bData.providerId).trim() : null;
      const bookingProviderIds: string[] = Array.isArray(bData.providerIds) 
        ? bData.providerIds.map((id: any) => String(id).trim()) 
        : [];
      const suggestedProviderIds: string[] = Array.isArray(bData.suggestedProviderIds)
        ? bData.suggestedProviderIds.map((id: any) => String(id).trim())
        : [];

      let isMatching = false;
      let maxDurationDays = 1;

      // Check root level
      if (bookingProviderId && normalizedTargetIds.has(bookingProviderId)) {
        isMatching = true;
      }
      if (!isMatching) {
        for (const pid of bookingProviderIds) {
          if (normalizedTargetIds.has(pid)) {
            isMatching = true;
            break;
          }
        }
      }
      if (!isMatching) {
        for (const pid of suggestedProviderIds) {
          if (normalizedTargetIds.has(pid)) {
            isMatching = true;
            break;
          }
        }
      }

      // Check inside services array
      for (const s of services) {
        const sProvId = s.providerId ? String(s.providerId).trim() : null;
        const sServId = s.serviceId ? String(s.serviceId).trim() : null;
        if ((sProvId && normalizedTargetIds.has(sProvId)) || (sServId && normalizedTargetIds.has(sServId))) {
          isMatching = true;
          if (typeof s.quantity === 'number' && s.quantity > 0) {
            maxDurationDays = Math.max(maxDurationDays, s.quantity);
          }
        }
      }

      if (!isMatching) continue;

      if (typeof bData.bookingDurationDays === 'number' && bData.bookingDurationDays > 0) {
        maxDurationDays = Math.max(maxDurationDays, bData.bookingDurationDays);
      }

      // Parse scheduledDate to YYYY-MM-DD
      let dateStr = "";
      if (typeof rawScheduledDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawScheduledDate)) {
        dateStr = rawScheduledDate;
      } else {
        const parsed = new Date(rawScheduledDate);
        if (!isNaN(parsed.getTime())) {
          dateStr = parsed.toLocaleDateString('en-CA');
        }
      }

      if (!dateStr) continue;

      const [y, m, d] = dateStr.split('-').map(Number);
      const baseDate = new Date(y, m - 1, d);

      for (let i = 0; i < maxDurationDays; i++) {
        const spanDate = new Date(baseDate);
        spanDate.setDate(baseDate.getDate() + i);
        bookedDatesSet.add(spanDate.toLocaleDateString('en-CA'));
      }
    }

    return {
      success: true,
      bookedDates: Array.from(bookedDatesSet).sort(),
    };
  } catch (error: any) {
    console.error("Error in getProviderBookedDatesAction:", error);
    return {
      success: false,
      bookedDates: [],
      error: error?.message || "Failed to load availability",
    };
  }
}
