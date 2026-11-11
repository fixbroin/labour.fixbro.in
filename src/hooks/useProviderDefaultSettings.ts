"use client";

import { useState, useEffect } from 'react';
import { doc, onSnapshot } from '@/lib/mysqlDb';
import { db } from '@/lib/firebase';
import {
  type ProviderDefaultSettings,
  DEFAULT_PROVIDER_DEFAULT_SETTINGS,
} from '@/types/providerDefaultSettings';
import { getProviderDefaultSettingsAction } from '@/app/actions/providerDefaultSettingsActions';

let inMemorySettings: ProviderDefaultSettings | null = null;

export function useProviderDefaultSettings(initialData?: ProviderDefaultSettings) {
  const [settings, setSettings] = useState<ProviderDefaultSettings>(() => {
    if (initialData) return initialData;
    if (inMemorySettings) return inMemorySettings;
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('fixbro_provider_default_settings');
        if (stored) return JSON.parse(stored);
      } catch {}
    }
    return DEFAULT_PROVIDER_DEFAULT_SETTINGS;
  });

  const [isLoading, setIsLoading] = useState(!inMemorySettings && !initialData);

  useEffect(() => {
    let isSubscribed = true;
    try {
      const unsub = onSnapshot(doc(db, 'webSettings', 'providerDefaultSettings'), (snap) => {
        if (!isSubscribed) return;
        if (snap.exists()) {
          const raw = snap.data() as Partial<ProviderDefaultSettings>;
          const merged: ProviderDefaultSettings = {
            ...DEFAULT_PROVIDER_DEFAULT_SETTINGS,
            ...raw,
            adminMarkupFee: typeof raw.adminMarkupFee === 'number' ? raw.adminMarkupFee : DEFAULT_PROVIDER_DEFAULT_SETTINGS.adminMarkupFee,
            rules: Array.isArray(raw.rules) && raw.rules.length > 0 ? raw.rules : DEFAULT_PROVIDER_DEFAULT_SETTINGS.rules,
            seniorityTaxes: Array.isArray(raw.seniorityTaxes) && raw.seniorityTaxes.length > 0 ? raw.seniorityTaxes : DEFAULT_PROVIDER_DEFAULT_SETTINGS.seniorityTaxes,
          };
          inMemorySettings = merged;
          setSettings(merged);
          setIsLoading(false);
          try {
            localStorage.setItem('fixbro_provider_default_settings', JSON.stringify(merged));
          } catch {}
        } else {
          getProviderDefaultSettingsAction().then((res) => {
            if (!isSubscribed) return;
            inMemorySettings = res;
            setSettings(res);
            setIsLoading(false);
          }).catch(console.error);
        }
      }, (err) => {
        console.warn('Realtime provider settings listener error, fallback to server action:', err);
        getProviderDefaultSettingsAction().then((res) => {
          if (!isSubscribed) return;
          inMemorySettings = res;
          setSettings(res);
          setIsLoading(false);
        }).catch(() => {
          if (isSubscribed) setIsLoading(false);
        });
      });

      return () => {
        isSubscribed = false;
        unsub();
      };
    } catch (e) {
      getProviderDefaultSettingsAction().then((res) => {
        if (!isSubscribed) return;
        inMemorySettings = res;
        setSettings(res);
        setIsLoading(false);
      });
      return () => {
        isSubscribed = false;
      };
    }
  }, []);

  return { settings, isLoading };
}
