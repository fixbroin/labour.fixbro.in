'use server';

import { db } from '@/lib/mysqlDb';
import { doc, getDoc, setDoc, Timestamp } from '@/lib/mysqlDb';
import { revalidatePath } from 'next/cache';
import {
  type ProviderDefaultSettings,
  DEFAULT_PROVIDER_DEFAULT_SETTINGS,
} from '@/types/providerDefaultSettings';
import { triggerRefresh } from '@/lib/revalidateUtils';

const SETTINGS_REF = () => doc(db, 'webSettings', 'providerDefaultSettings');

/**
 * Fetch provider default settings (Admin markup fee, Seniority taxes, Cart rules pop-up, etc.)
 */
export async function getProviderDefaultSettingsAction(): Promise<ProviderDefaultSettings> {
  try {
    const snap = await getDoc(SETTINGS_REF());
    if (snap.exists()) {
      const data = snap.data() as Partial<ProviderDefaultSettings>;
      return {
        ...DEFAULT_PROVIDER_DEFAULT_SETTINGS,
        ...data,
        adminMarkupFee: typeof data.adminMarkupFee === 'number' ? data.adminMarkupFee : DEFAULT_PROVIDER_DEFAULT_SETTINGS.adminMarkupFee,
        markupTaxType: data.markupTaxType || DEFAULT_PROVIDER_DEFAULT_SETTINGS.markupTaxType,
        markupTaxId: data.markupTaxId || DEFAULT_PROVIDER_DEFAULT_SETTINGS.markupTaxId,
        seniorityTaxes: Array.isArray(data.seniorityTaxes) && data.seniorityTaxes.length > 0
          ? data.seniorityTaxes
          : DEFAULT_PROVIDER_DEFAULT_SETTINGS.seniorityTaxes,
        requireOtpForJobStartComplete: typeof data.requireOtpForJobStartComplete === 'boolean'
          ? data.requireOtpForJobStartComplete
          : DEFAULT_PROVIDER_DEFAULT_SETTINGS.requireOtpForJobStartComplete,
        enableCartBookingRules: typeof data.enableCartBookingRules === 'boolean'
          ? data.enableCartBookingRules
          : DEFAULT_PROVIDER_DEFAULT_SETTINGS.enableCartBookingRules,
        cartRulesTitle: data.cartRulesTitle || DEFAULT_PROVIDER_DEFAULT_SETTINGS.cartRulesTitle,
        cartRulesSubtitle: data.cartRulesSubtitle || DEFAULT_PROVIDER_DEFAULT_SETTINGS.cartRulesSubtitle,
        cartRulesAgreementText: data.cartRulesAgreementText || DEFAULT_PROVIDER_DEFAULT_SETTINGS.cartRulesAgreementText,
        rules: Array.isArray(data.rules) && data.rules.length > 0
          ? data.rules
          : DEFAULT_PROVIDER_DEFAULT_SETTINGS.rules,
      };
    }
    return DEFAULT_PROVIDER_DEFAULT_SETTINGS;
  } catch (error) {
    console.error('Error fetching provider default settings:', error);
    return DEFAULT_PROVIDER_DEFAULT_SETTINGS;
  }
}

/**
 * Save updated provider default settings into webSettings/providerDefaultSettings.
 */
export async function saveProviderDefaultSettingsAction(
  settings: Partial<ProviderDefaultSettings>
): Promise<{ success: boolean; message?: string }> {
  try {
    const toSave = {
      ...settings,
      updatedAt: Timestamp.now(),
    };
    await setDoc(SETTINGS_REF(), toSave, { merge: true });

    revalidatePath('/');
    revalidatePath('/category/[slug]', 'page');
    revalidatePath('/provider/[slug]', 'page');
    revalidatePath('/cart');
    revalidatePath('/checkout');
    revalidatePath('/admin/provider-default-settings');

    try {
      await triggerRefresh('global-cache');
    } catch (e) {}

    return { success: true };
  } catch (error: any) {
    console.error('Error saving provider default settings:', error);
    return { success: false, message: error?.message || 'Failed to save settings.' };
  }
}
