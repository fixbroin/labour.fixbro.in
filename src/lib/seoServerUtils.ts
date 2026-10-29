// src/lib/seoServerUtils.ts
'use server';

import { adminDb } from './firebaseAdmin';
import { defaultSeoValues } from './seoUtils';
import type { FirestoreSEOSettings, CityCategorySeoSetting, AreaCategorySeoSetting, AreaServiceSeoSetting } from '@/types/firestore';
import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { serializeFirestoreData } from './serializeUtils';

/**
 * Fetches global SEO settings with server-side request memoization using Admin SDK.
 * This is safe to call only from Server Components or Server Actions.
 * Uses unstable_cache for cross-request caching (24 hours).
 */
export const getGlobalSEOSettings = cache(async (): Promise<FirestoreSEOSettings> => {
  return unstable_cache(
    async () => {
      try {
        const settingsDoc = await adminDb.collection('seoSettings').doc('global').get();
        if (settingsDoc.exists) {
          return { ...defaultSeoValues, ...(settingsDoc.data() as FirestoreSEOSettings) };
        }
        return defaultSeoValues;
      } catch (error) {
        console.error('Error fetching global SEO settings via Admin SDK:', error);
        return defaultSeoValues;
      }
    },
    ['global-seo-settings'],
    { 
      revalidate: false, 
      tags: ['seo-settings', 'global-cache'] 
    }
  )();
});

/**
 * Fetches city-category specific SEO overrides.
 */
export const getCityCategorySeoOverride = cache(async (cityId: string, categoryId: string): Promise<CityCategorySeoSetting | null> => {
  return unstable_cache(
    async () => {
      try {
        const query = adminDb.collection('cityCategorySeoSettings')
          .where('cityId', '==', cityId)
          .where('categoryId', '==', categoryId)
          .where('isActive', '==', true)
          .limit(1);
        const snapshot = await query.get();
        if (!snapshot.empty) {
          return { id: snapshot.docs[0].id, ...serializeFirestoreData(snapshot.docs[0].data()) } as CityCategorySeoSetting;
        }
        return null;
      } catch (error) {
        console.error('Error fetching city-category SEO override:', error);
        return null;
      }
    },
    [`city-category-seo-${cityId}-${categoryId}`],
    { revalidate: false, tags: ['seo-settings', 'city-category-seo', 'global-cache'] }
  )();
});

/**
 * Fetches area-category specific SEO overrides.
 */
export const getAreaCategorySeoOverride = cache(async (areaId: string, categoryId: string): Promise<AreaCategorySeoSetting | null> => {
  return unstable_cache(
    async () => {
      try {
        const query = adminDb.collection('areaCategorySeoSettings')
          .where('areaId', '==', areaId)
          .where('categoryId', '==', categoryId)
          .where('isActive', '==', true)
          .limit(1);
        const snapshot = await query.get();
        if (!snapshot.empty) {
          return { id: snapshot.docs[0].id, ...serializeFirestoreData(snapshot.docs[0].data()) } as AreaCategorySeoSetting;
        }
        return null;
      } catch (error) {
        console.error('Error fetching area-category SEO override:', error);
        return null;
      }
    },
    [`area-category-seo-${areaId}-${categoryId}`],
    { revalidate: false, tags: ['seo-settings', 'area-category-seo', 'global-cache'] }
  )();
});

/**
 * Fetches area-service specific SEO overrides.
 */
export const getAreaServiceSeoOverride = cache(async (areaId: string, serviceId: string): Promise<AreaServiceSeoSetting | null> => {
  return unstable_cache(
    async () => {
      try {
        const query = adminDb.collection('areaServiceSeoSettings')
          .where('areaId', '==', areaId)
          .where('serviceId', '==', serviceId)
          .where('isActive', '==', true)
          .limit(1);
        const snapshot = await query.get();
        if (!snapshot.empty) {
          return { id: snapshot.docs[0].id, ...serializeFirestoreData(snapshot.docs[0].data()) } as AreaServiceSeoSetting;
        }
        return null;
      } catch (error) {
        console.error('Error fetching area-service SEO override:', error);
        return null;
      }
    },
    [`area-service-seo-${areaId}-${serviceId}`],
    { revalidate: false, tags: ['seo-settings', 'area-service-seo', 'global-cache'] }
  )();
});

export interface SiloLinkItem {
  url: string;
  label: string;
  areaSlug: string;
  areaName: string;
}

export interface SiloData {
  city: { id: string; name: string; slug: string } | null;
  areas: Array<{ id: string; name: string; slug: string }>;
  categories: Array<{ id: string; name: string; slug: string }>;
  siloLinks: SiloLinkItem[];
}

const PRIORITY_BANGALORE_HUBS = [
  'whitefield', 'koramangala', 'hsr-layout', 'indiranagar', 'electronic-city',
  'bellandur', 'marathahalli', 'jp-nagar', 'jayanagar', 'btm-layout',
  'hebbal', 'yelahanka', 'banashankari', 'sarjapur-road', 'rajajinagar',
  'malleshwaram', 'rt-nagar', 'domlur', 'kalyan-nagar', 'vijayanagar',
  'mahadevapura', 'hoodi', 'cv-raman-nagar', 'richmond-town'
];

/**
 * Fetches server-rendered Silo links for the footer and layout.
 * Ensures Googlebot immediately crawls real HTML links instead of skeletons.
 */
export const getLocalSiloData = cache(async (): Promise<SiloData> => {
  return unstable_cache(
    async () => {
      try {
        // 1. Fetch primary city (Bangalore)
        const citySnap = await adminDb.collection('cities')
          .where('isActive', '==', true)
          .orderBy('name')
          .limit(1)
          .get();

        if (citySnap.empty) {
          return { city: null, areas: [], categories: [], siloLinks: [] };
        }

        const cityDoc = citySnap.docs[0];
        const cityData = cityDoc.data() as any;
        const city = { id: cityDoc.id, name: cityData.name, slug: cityData.slug };

        // 2. Fetch active areas in that city
        const areasSnap = await adminDb.collection('areas')
          .where('cityId', '==', city.id)
          .where('isActive', '==', true)
          .get();

        const allAreas = areasSnap.docs.map(d => {
          const dData = d.data() as any;
          return {
            id: d.id,
            name: dData.name as string,
            slug: dData.slug as string,
          };
        });

        // Sort areas: put top priority Bangalore commercial hubs first!
        const priorityAreas = allAreas.filter(a =>
          PRIORITY_BANGALORE_HUBS.includes((a.slug || '').toLowerCase()) ||
          PRIORITY_BANGALORE_HUBS.some(hub => (a.name || '').toLowerCase().includes(hub))
        );
        const otherAreas = allAreas.filter(a => !priorityAreas.some(p => p.id === a.id));
        const topAreas = [...priorityAreas, ...otherAreas].slice(0, 24);

        // 3. Fetch top categories
        const catsSnap = await adminDb.collection('adminCategories')
          .where('isActive', '==', true)
          .orderBy('order', 'asc')
          .get();

        const allCats = catsSnap.docs.map(d => {
          const cData = d.data() as any;
          return {
            id: d.id,
            name: cData.name as string,
            slug: cData.slug as string,
          };
        });

        // Prioritize top categories
        const priorityCatSlugs = ['tv-installation', 'carpentry', 'plumber', 'electrician', 'washing-machine', 'painting', 'ac', 'water-purifier', 'geyser', 'chimney', 'home-cleaning', 'pest-control'];
        const priorityCats = allCats.filter(c => priorityCatSlugs.includes((c.slug || '').toLowerCase()));
        const otherCats = allCats.filter(c => !priorityCats.some(p => p.id === c.id));
        const categories = [...priorityCats, ...otherCats].slice(0, 12);

        // 4. Generate the 24 silo links
        const { getCategorySearchTerm } = await import('./seoAdvancedUtils');
        const siloLinks: SiloLinkItem[] = topAreas.map((area, index) => {
          const category = categories[index % categories.length];
          const searchTerm = getCategorySearchTerm(category ? category.name : 'Home Services');
          return {
            url: `/${city.slug}/${area.slug}/${category ? category.slug : ''}`,
            label: `${searchTerm} in ${area.name}`,
            areaSlug: area.slug,
            areaName: area.name,
          };
        });

        return {
          city,
          areas: topAreas,
          categories,
          siloLinks,
        };
      } catch (error) {
        console.error('Error fetching server local silo data:', error);
        return { city: null, areas: [], categories: [], siloLinks: [] };
      }
    },
    ['local-silo-links-cache'],
    {
      revalidate: false,
      tags: ['cities', 'areas', 'categories', 'seo-settings', 'global-cache'],
    }
  )();
});

