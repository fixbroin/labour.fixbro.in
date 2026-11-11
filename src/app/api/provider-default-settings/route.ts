import { NextResponse } from 'next/server';
import { getProviderDefaultSettingsAction, saveProviderDefaultSettingsAction } from '@/app/actions/providerDefaultSettingsActions';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const settings = await getProviderDefaultSettingsAction();
    return NextResponse.json(settings);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = await saveProviderDefaultSettingsAction(body);
    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to save settings' }, { status: 500 });
  }
}
