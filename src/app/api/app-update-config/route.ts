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
  
  iosEnabled: false,
  iosForceUpdate: false,
  iosMinVersionCode: 1,
  iosLatestVersionName: '3.0.0',
  appStoreUrl: '',
  iosTitle: 'New Update Available',
  iosMessage: 'A new version of Fixbro is available on the App Store with important improvements and bug fixes. Please update to continue enjoying a smooth experience.',
};

const DEFAULT_PROVIDER_CONFIG: AppUpdateTargetConfig = {
  enabled: false,
  forceUpdate: false,
  minVersionCode: 26,
  latestVersionName: '3.0.1',
  playStoreUrl: 'https://play.google.com/store/apps/details?id=com.fixbro.provider',
  title: 'Fixbro Partner Update Available',
  message: 'A new version of Fixbro Partner is available with critical performance enhancements and booking improvements. Please update to continue.',

  iosEnabled: false,
  iosForceUpdate: false,
  iosMinVersionCode: 1,
  iosLatestVersionName: '3.0.0',
  appStoreUrl: '',
  iosTitle: 'Fixbro Partner Update Available',
  iosMessage: 'A new version of Fixbro Partner is available on the App Store with critical performance enhancements and booking improvements. Please update to continue.',
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const requestedApp = searchParams.get('app')?.toLowerCase(); // 'customer' or 'provider'
    const requestedPlatform = searchParams.get('platform')?.toLowerCase(); // 'ios' or 'android'

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
      if (requestedPlatform === 'ios') {
        responsePayload = {
          success: true,
          app: 'customer',
          platform: 'ios',
          enabled: customerConfig.iosEnabled ?? false,
          forceUpdate: customerConfig.iosForceUpdate ?? false,
          minVersionCode: customerConfig.iosMinVersionCode ?? 1,
          latestVersionName: customerConfig.iosLatestVersionName || customerConfig.latestVersionName,
          appStoreUrl: customerConfig.appStoreUrl || '',
          playStoreUrl: customerConfig.appStoreUrl || '',
          title: customerConfig.iosTitle || customerConfig.title,
          message: customerConfig.iosMessage || customerConfig.message,
          rawConfig: customerConfig,
        };
      } else {
        responsePayload = {
          success: true,
          app: 'customer',
          platform: 'android',
          ...customerConfig,
        };
      }
    } else if (requestedApp === 'provider') {
      if (requestedPlatform === 'ios') {
        responsePayload = {
          success: true,
          app: 'provider',
          platform: 'ios',
          enabled: providerConfig.iosEnabled ?? false,
          forceUpdate: providerConfig.iosForceUpdate ?? false,
          minVersionCode: providerConfig.iosMinVersionCode ?? 1,
          latestVersionName: providerConfig.iosLatestVersionName || providerConfig.latestVersionName,
          appStoreUrl: providerConfig.appStoreUrl || '',
          playStoreUrl: providerConfig.appStoreUrl || '',
          title: providerConfig.iosTitle || providerConfig.title,
          message: providerConfig.iosMessage || providerConfig.message,
          rawConfig: providerConfig,
        };
      } else {
        responsePayload = {
          success: true,
          app: 'provider',
          platform: 'android',
          ...providerConfig,
        };
      }
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

        iosEnabled: Boolean(customer?.iosEnabled),
        iosForceUpdate: Boolean(customer?.iosForceUpdate),
        iosMinVersionCode: Number(customer?.iosMinVersionCode) || 1,
        iosLatestVersionName: String(customer?.iosLatestVersionName || customer?.latestVersionName || '3.0.0').trim(),
        appStoreUrl: String(customer?.appStoreUrl || '').trim(),
        iosTitle: String(customer?.iosTitle || customer?.title || 'New Update Available').trim(),
        iosMessage: String(customer?.iosMessage || customer?.message || '').trim(),
      },
      provider: {
        enabled: Boolean(provider?.enabled),
        forceUpdate: Boolean(provider?.forceUpdate),
        minVersionCode: Number(provider?.minVersionCode) || DEFAULT_PROVIDER_CONFIG.minVersionCode,
        latestVersionName: String(provider?.latestVersionName || DEFAULT_PROVIDER_CONFIG.latestVersionName).trim(),
        playStoreUrl: String(provider?.playStoreUrl || DEFAULT_PROVIDER_CONFIG.playStoreUrl).trim(),
        title: String(provider?.title || DEFAULT_PROVIDER_CONFIG.title).trim(),
        message: String(provider?.message || DEFAULT_PROVIDER_CONFIG.message).trim(),

        iosEnabled: Boolean(provider?.iosEnabled),
        iosForceUpdate: Boolean(provider?.iosForceUpdate),
        iosMinVersionCode: Number(provider?.iosMinVersionCode) || 1,
        iosLatestVersionName: String(provider?.iosLatestVersionName || provider?.latestVersionName || '3.0.0').trim(),
        appStoreUrl: String(provider?.appStoreUrl || '').trim(),
        iosTitle: String(provider?.iosTitle || provider?.title || 'Fixbro Partner Update Available').trim(),
        iosMessage: String(provider?.iosMessage || provider?.message || '').trim(),
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
