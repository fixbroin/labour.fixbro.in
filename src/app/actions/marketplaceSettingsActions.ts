'use server';

import { db } from '@/lib/mysqlDb';
import { doc, getDoc, setDoc } from '@/lib/mysqlDb';
import { revalidatePath } from 'next/cache';
import {
  type MarketplaceSettings,
  DEFAULT_MARKETPLACE_SETTINGS,
} from '@/types/marketplace';

const SETTINGS_REF = () => doc(db, 'webSettings', 'marketplaceSettings');

/**
 * Fetch marketplace global settings (expiration days, fraud warning disclaimer, SEO, etc.)
 */
export async function getMarketplaceSettingsAction(): Promise<MarketplaceSettings> {
  try {
    const snap = await getDoc(SETTINGS_REF());
    if (snap.exists()) {
      const data = snap.data() as Partial<MarketplaceSettings>;
      return {
        ...DEFAULT_MARKETPLACE_SETTINGS,
        ...data,
        showMarketplaceOnHomeServices: data.showMarketplaceOnHomeServices !== undefined
          ? data.showMarketplaceOnHomeServices
          : true,
        safetyWarningPoints: Array.isArray(data.safetyWarningPoints) && data.safetyWarningPoints.length > 0
          ? data.safetyWarningPoints
          : DEFAULT_MARKETPLACE_SETTINGS.safetyWarningPoints,
      };
    }
    return DEFAULT_MARKETPLACE_SETTINGS;
  } catch (error) {
    console.error('Error fetching marketplace settings:', error);
    return DEFAULT_MARKETPLACE_SETTINGS;
  }
}

/**
 * Save updated marketplace settings into webSettings.
 */
export async function saveMarketplaceSettingsAction(
  settings: Partial<MarketplaceSettings>
): Promise<{ success: boolean; message?: string }> {
  try {
    await setDoc(SETTINGS_REF(), settings, { merge: true });
    revalidatePath('/');
    revalidatePath('/furniture');
    revalidatePath('/rent-home');
    revalidatePath('/admin/marketplace-settings');
    return { success: true };
  } catch (error: any) {
    console.error('Error saving marketplace settings:', error);
    return { success: false, message: error?.message || 'Failed to save settings.' };
  }
}
