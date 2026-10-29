'use server';

import { db } from '@/lib/mysqlDb';
import { doc, getDoc, setDoc } from '@/lib/mysqlDb';
import { revalidatePath } from 'next/cache';
import { 
  type JoinProviderPageSettings, 
  DEFAULT_JOIN_PROVIDER_SETTINGS 
} from '@/types/joinProvider';

const DOC_REF = () => doc(db, 'webSettings', 'joinProviderPage');

/**
 * Fetch Join Provider Page Settings from the database, falling back to default values.
 */
export async function getJoinProviderPageSettingsAction(): Promise<JoinProviderPageSettings> {
  try {
    const snap = await getDoc(DOC_REF());
    if (snap.exists()) {
      const data = snap.data() as Partial<JoinProviderPageSettings>;
      return {
        ...DEFAULT_JOIN_PROVIDER_SETTINGS,
        ...data,
        stats: {
          ...DEFAULT_JOIN_PROVIDER_SETTINGS.stats,
          ...(data.stats || {}),
        },
        faqs: Array.isArray(data.faqs) && data.faqs.length > 0 
          ? data.faqs 
          : DEFAULT_JOIN_PROVIDER_SETTINGS.faqs,
      };
    }
    return DEFAULT_JOIN_PROVIDER_SETTINGS;
  } catch (error) {
    console.error("Error fetching join provider settings:", error);
    return DEFAULT_JOIN_PROVIDER_SETTINGS;
  }
}

/**
 * Save updated Join Provider Page Settings into webSettings.
 */
export async function saveJoinProviderPageSettingsAction(
  settings: Partial<JoinProviderPageSettings>
): Promise<{ success: boolean; message?: string }> {
  try {
    await setDoc(DOC_REF(), settings, { merge: true });
    revalidatePath('/join-provider');
    revalidatePath('/admin/join-provider-settings');
    return { success: true };
  } catch (error: any) {
    console.error("Error saving join provider settings:", error);
    return { success: false, message: error?.message || "Failed to save settings." };
  }
}

/**
 * Reset Join Provider Page Settings back to the factory defaults.
 */
export async function resetJoinProviderPageSettingsAction(): Promise<{ success: boolean; message?: string }> {
  try {
    await setDoc(DOC_REF(), DEFAULT_JOIN_PROVIDER_SETTINGS);
    revalidatePath('/join-provider');
    revalidatePath('/admin/join-provider-settings');
    return { success: true };
  } catch (error: any) {
    console.error("Error resetting join provider settings:", error);
    return { success: false, message: error?.message || "Failed to reset settings." };
  }
}
