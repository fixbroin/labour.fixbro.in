import { type NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { verifyRequest, isUserAdmin } from '@/lib/dbSecurity';
import { triggerRefresh } from '@/lib/revalidateUtils';
import { Timestamp } from '@/lib/mysqlDbAdmin';
import type { AppUpdateSettings, AppUpdateTargetConfig } from '@/types/firestore';

const DEFAULT_CUSTOMER_CONFIG: AppUpdateTargetConfig = {
  enabled: false,
  forceUpdate: false,
  minVersionCode: 61,
  latestVersionName: '3.0.3',
  playStoreUrl: 'https://play.google.com/store/apps/details?id=com.fix.bro.user',
  title: 'New Update Available',
  message: 'A new version of Fixbro is available with important improvements and bug fixes. Please update to continue enjoying a smooth experience.',
};

const DEFAULT_PROVIDER_CONFIG: AppUpdateTargetConfig = {
  enabled: false,
  forceUpdate: false,
  minVersionCode: 26,
  latestVersionName: '3.0.1',
  playStoreUrl: 'https://play.google.com/store/apps/details?id=com.fixbro.provider',
  title: 'Fixbro Partner Update Available',
  message: 'A new version of Fixbro Partner is available with critical performance enhancements and booking improvements. Please update to continue.',
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const requestedApp = searchParams.get('app')?.toLowerCase(); // 'customer' or 'provider'

    const docSnap = await adminDb.collection('webSettings').doc('appUpdateConfig').get();
    const data = docSnap.exists ? (docSnap.data() as Partial<AppUpdateSettings>) : {};

    const customerConfig: AppUpdateTargetConfig = {
      ...DEFAULT_CUSTOMER_CONFIG,
      ...(data.customer || {}),
    };

    const providerConfig: AppUpdateTargetConfig = {
      ...DEFAULT_PROVIDER_CONFIG,
      ...(data.provider || {}),
    };

    let responsePayload: any = {
      success: true,
      customer: customerConfig,
      provider: providerConfig,
      updatedAt: data.updatedAt ? (data.updatedAt.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt) : null,
    };

    if (requestedApp === 'customer') {
      responsePayload = {
        success: true,
        app: 'customer',
        ...customerConfig,
      };
    } else if (requestedApp === 'provider') {
      responsePayload = {
        success: true,
        app: 'provider',
        ...providerConfig,
      };
    }

    return NextResponse.json(responsePayload, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error: any) {
    console.error('Error fetching app update config:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
        customer: DEFAULT_CUSTOMER_CONFIG,
        provider: DEFAULT_PROVIDER_CONFIG,
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
    const { customer, provider } = body;

    const updatePayload: Partial<AppUpdateSettings> = {
      customer: {
        enabled: Boolean(customer?.enabled),
        forceUpdate: Boolean(customer?.forceUpdate),
        minVersionCode: Number(customer?.minVersionCode) || DEFAULT_CUSTOMER_CONFIG.minVersionCode,
        latestVersionName: String(customer?.latestVersionName || DEFAULT_CUSTOMER_CONFIG.latestVersionName).trim(),
        playStoreUrl: String(customer?.playStoreUrl || DEFAULT_CUSTOMER_CONFIG.playStoreUrl).trim(),
        title: String(customer?.title || DEFAULT_CUSTOMER_CONFIG.title).trim(),
        message: String(customer?.message || DEFAULT_CUSTOMER_CONFIG.message).trim(),
      },
      provider: {
        enabled: Boolean(provider?.enabled),
        forceUpdate: Boolean(provider?.forceUpdate),
        minVersionCode: Number(provider?.minVersionCode) || DEFAULT_PROVIDER_CONFIG.minVersionCode,
        latestVersionName: String(provider?.latestVersionName || DEFAULT_PROVIDER_CONFIG.latestVersionName).trim(),
        playStoreUrl: String(provider?.playStoreUrl || DEFAULT_PROVIDER_CONFIG.playStoreUrl).trim(),
        title: String(provider?.title || DEFAULT_PROVIDER_CONFIG.title).trim(),
        message: String(provider?.message || DEFAULT_PROVIDER_CONFIG.message).trim(),
      },
      updatedAt: Timestamp.now(),
    };

    await adminDb.collection('webSettings').doc('appUpdateConfig').set(updatePayload, { merge: true });

    await triggerRefresh('global-cache');

    return NextResponse.json({
      success: true,
      message: 'App update configurations saved successfully.',
      data: updatePayload,
    });
  } catch (error: any) {
    console.error('Error saving app update config:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to save configuration.' }, { status: 500 });
  }
}
