"use client";

import { useState, useEffect } from 'react';
import { doc, onSnapshot } from '@/lib/mysqlDb';
import { db } from '@/lib/firebase';
import { type MarketplaceSettings, DEFAULT_MARKETPLACE_SETTINGS } from '@/types/marketplace';
import { getMarketplaceSettingsAction } from '@/app/actions/marketplaceSettingsActions';

let inMemorySettings: MarketplaceSettings | null = null;

export function useMarketplaceSettings(initialData?: MarketplaceSettings) {
  const [settings, setSettings] = useState<MarketplaceSettings>(() => {
    if (initialData) return initialData;
    if (inMemorySettings) return inMemorySettings;
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('fixbro_marketplace_settings');
        if (stored) return JSON.parse(stored);
      } catch {}
    }
    return DEFAULT_MARKETPLACE_SETTINGS;
  });

  useEffect(() => {
    try {
      const unsub = onSnapshot(doc(db, 'webSettings', 'marketplaceSettings'), (snap) => {
        if (snap.exists()) {
          const raw = snap.data() as Partial<MarketplaceSettings>;
          const merged: MarketplaceSettings = {
            ...DEFAULT_MARKETPLACE_SETTINGS,
            ...raw,
            showMarketplaceOnHomeServices: raw.showMarketplaceOnHomeServices !== undefined 
              ? raw.showMarketplaceOnHomeServices 
              : true,
          };
          inMemorySettings = merged;
          setSettings(merged);
          try {
            localStorage.setItem('fixbro_marketplace_settings', JSON.stringify(merged));
          } catch {}
        } else {
          getMarketplaceSettingsAction().then((res) => {
            inMemorySettings = res;
            setSettings(res);
          }).catch(console.error);
        }
      }, (err) => {
        console.warn('Realtime marketplace listener error, fallback to server action:', err);
        getMarketplaceSettingsAction().then((res) => {
          inMemorySettings = res;
          setSettings(res);
        }).catch(console.error);
      });

      return () => {
        try { unsub(); } catch {}
      };
    } catch (e) {
      getMarketplaceSettingsAction().then((res) => {
        inMemorySettings = res;
        setSettings(res);
      }).catch(console.error);
    }
  }, []);

  return { settings };
}
