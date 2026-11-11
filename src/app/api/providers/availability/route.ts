import { NextRequest, NextResponse } from 'next/server';
import { getProviderBookedDatesAction } from '@/app/actions/bookingAvailabilityActions';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const providerIdsParam = searchParams.get('providerIds');
  const providerIds = providerIdsParam ? providerIdsParam.split(',').filter(Boolean) : [];

  const res = await getProviderBookedDatesAction(providerIds);
  return NextResponse.json(res);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const providerIds = Array.isArray(body?.providerIds) ? body.providerIds : [];
    const res = await getProviderBookedDatesAction(providerIds);
    return NextResponse.json(res);
  } catch (e: any) {
    return NextResponse.json({ success: false, bookedDates: [], error: e?.message }, { status: 400 });
  }
}
