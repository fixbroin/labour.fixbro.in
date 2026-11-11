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
 * Strictly returns plain serializable objects to prevent Next.js Server Action serialization crashes.
 */
export async function getProviderDefaultSettingsAction(): Promise<ProviderDefaultSettings> {
  try {
    const snap = await getDoc(SETTINGS_REF());
    if (snap.exists()) {
      const data = snap.data() as any;

      const safeSettings: ProviderDefaultSettings = {
        adminMarkupFee: typeof data.adminMarkupFee === 'number'
          ? data.adminMarkupFee
          : DEFAULT_PROVIDER_DEFAULT_SETTINGS.adminMarkupFee,
        markupTaxType: data.markupTaxType === 'exclusive' ? 'exclusive' : 'inclusive',
        markupTaxId: String(data.markupTaxId || DEFAULT_PROVIDER_DEFAULT_SETTINGS.markupTaxId),
        markupTaxName: String(data.markupTaxName || DEFAULT_PROVIDER_DEFAULT_SETTINGS.markupTaxName),
        markupTaxPercent: typeof data.markupTaxPercent === 'number'
          ? data.markupTaxPercent
          : DEFAULT_PROVIDER_DEFAULT_SETTINGS.markupTaxPercent,
        seniorityTaxes: Array.isArray(data.seniorityTaxes) && data.seniorityTaxes.length > 0
          ? data.seniorityTaxes.map((st: any) => ({
              id: String(st.id || ''),
              label: String(st.label || ''),
              taxType: st.taxType === 'exclusive' ? 'exclusive' : 'inclusive',
              taxId: String(st.taxId || 'no-tax'),
              taxName: String(st.taxName || 'No Tax'),
              taxPercent: typeof st.taxPercent === 'number' ? st.taxPercent : 0,
            }))
          : DEFAULT_PROVIDER_DEFAULT_SETTINGS.seniorityTaxes,
        requireOtpForJobStartComplete: typeof data.requireOtpForJobStartComplete === 'boolean'
          ? data.requireOtpForJobStartComplete
          : DEFAULT_PROVIDER_DEFAULT_SETTINGS.requireOtpForJobStartComplete,
        enableCartBookingRules: typeof data.enableCartBookingRules === 'boolean'
          ? data.enableCartBookingRules
          : DEFAULT_PROVIDER_DEFAULT_SETTINGS.enableCartBookingRules,
        cartRulesTitle: String(data.cartRulesTitle || DEFAULT_PROVIDER_DEFAULT_SETTINGS.cartRulesTitle),
        cartRulesSubtitle: String(data.cartRulesSubtitle || DEFAULT_PROVIDER_DEFAULT_SETTINGS.cartRulesSubtitle),
        cartRulesAgreementText: String(data.cartRulesAgreementText || DEFAULT_PROVIDER_DEFAULT_SETTINGS.cartRulesAgreementText),
        rules: Array.isArray(data.rules) && data.rules.length > 0
          ? data.rules.map((r: any, idx: number) => ({
              id: String(r.id || `rule-${idx}`),
              title: String(r.title || ''),
              description: String(r.description || ''),
              category: r.category || 'scope',
              isActive: r.isActive !== false,
              order: typeof r.order === 'number' ? r.order : idx + 1,
            }))
          : DEFAULT_PROVIDER_DEFAULT_SETTINGS.rules,
        updatedAt: data.updatedAt?.seconds
          ? new Date(data.updatedAt.seconds * 1000).toISOString()
          : (data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : null),
      };

      // 100% plain object guaranteed for Next.js Server Components / Actions boundary
      return JSON.parse(JSON.stringify(safeSettings));
    }

    return JSON.parse(JSON.stringify(DEFAULT_PROVIDER_DEFAULT_SETTINGS));
  } catch (error) {
    console.error('Error fetching provider default settings:', error);
    return JSON.parse(JSON.stringify(DEFAULT_PROVIDER_DEFAULT_SETTINGS));
  }
}

/**
 * Save updated provider default settings into webSettings/providerDefaultSettings.
 */
export async function saveProviderDefaultSettingsAction(
  settings: Partial<ProviderDefaultSettings>
): Promise<{ success: boolean; message?: string }> {
  try {
    const cleanSettings = JSON.parse(JSON.stringify(settings));
    delete cleanSettings.updatedAt;
    delete cleanSettings.id;

    const toSave = {
      ...cleanSettings,
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
