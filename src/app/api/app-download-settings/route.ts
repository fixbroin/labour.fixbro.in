import { type NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { verifyRequest, isUserAdmin } from '@/lib/dbSecurity';
import { triggerRefresh } from '@/lib/revalidateUtils';
import { Timestamp } from '@/lib/mysqlDbAdmin';
import type { AppDownloadSettings, AppDownloadMode } from '@/types/firestore';

export const dynamic = 'force-dynamic';

const DEFAULT_APP_DOWNLOAD_SETTINGS: AppDownloadSettings = {
  mode: 'pwa',
  androidUserUrl: 'https://play.google.com/store/apps/details?id=com.fix.bro.user',
  androidProviderUrl: 'https://play.google.com/store/apps/details?id=com.fixbro.provider',
  iosUserUrl: '',
  iosProviderUrl: '',
};

export async function GET(req: NextRequest) {
  try {
    const docSnap = await adminDb.collection('webSettings').doc('appDownloadSettings').get();
    const data = docSnap.exists ? (docSnap.data() as Partial<AppDownloadSettings>) : {};

    const settings: AppDownloadSettings = {
      mode: (data.mode === 'pwa' || data.mode === 'native_stores' || data.mode === 'disabled') 
        ? data.mode 
        : DEFAULT_APP_DOWNLOAD_SETTINGS.mode,
      androidUserUrl: typeof data.androidUserUrl === 'string' ? data.androidUserUrl : DEFAULT_APP_DOWNLOAD_SETTINGS.androidUserUrl,
      androidProviderUrl: typeof data.androidProviderUrl === 'string' ? data.androidProviderUrl : DEFAULT_APP_DOWNLOAD_SETTINGS.androidProviderUrl,
      iosUserUrl: typeof data.iosUserUrl === 'string' ? data.iosUserUrl : DEFAULT_APP_DOWNLOAD_SETTINGS.iosUserUrl,
      iosProviderUrl: typeof data.iosProviderUrl === 'string' ? data.iosProviderUrl : DEFAULT_APP_DOWNLOAD_SETTINGS.iosProviderUrl,
      updatedAt: data.updatedAt ? (data.updatedAt.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt) : null,
    };

    return NextResponse.json(
      { success: true, settings },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  } catch (error: any) {
    console.error('Error fetching app download settings:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
        settings: DEFAULT_APP_DOWNLOAD_SETTINGS,
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await verifyRequest(req);
    if (!user || !isUserAdmin(user)) {
      return NextResponse.json({ success: false, error: 'Unauthorized access.' }, { status: 401 });
    }

    const body = await req.json();
    const { mode, androidUserUrl, androidProviderUrl, iosUserUrl, iosProviderUrl } = body;

    const validMode: AppDownloadMode = (mode === 'pwa' || mode === 'native_stores' || mode === 'disabled')
      ? mode
      : 'pwa';

    const updatePayload: AppDownloadSettings = {
      mode: validMode,
      androidUserUrl: String(androidUserUrl || '').trim(),
      androidProviderUrl: String(androidProviderUrl || '').trim(),
      iosUserUrl: String(iosUserUrl || '').trim(),
      iosProviderUrl: String(iosProviderUrl || '').trim(),
      updatedAt: Timestamp.now(),
    };

    await adminDb.collection('webSettings').doc('appDownloadSettings').set(updatePayload, { merge: true });

    await triggerRefresh('global-cache');

    return NextResponse.json({
      success: true,
      message: 'App download settings saved successfully.',
      settings: updatePayload,
    });
  } catch (error: any) {
    console.error('Error saving app download settings:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save settings.' },
      { status: 500 }
    );
  }
}
