import { redirect } from 'next/navigation';

interface BookingEditPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Fallback & Direct Redirect for /admin/bookings/edit/[id]
 * Seamlessly routes to the main bookings management page with the target booking modal open.
 */
export default async function BookingEditRedirectPage({ params }: BookingEditPageProps) {
  const resolved = await Promise.resolve(params);
  const rawId = resolved?.id || '';

  redirect(`/admin/bookings?openBookingId=${encodeURIComponent(rawId)}&search=${encodeURIComponent(rawId)}`);
}
