import DetailsPage from '@/components/service/DetailsPage';
import { adminDb } from '@/lib/firebaseAdmin';
import type { FirestoreService, ClientServiceData } from '@/types/firestore';
import JsonLdScript from '@/components/shared/JsonLdScript';
import { getBaseUrl } from '@/lib/config';
import type { Metadata, ResolvingMetadata } from 'next';
import { getGlobalSEOSettings } from '@/lib/seoServerUtils';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { getAggregateRating } from '@/lib/homepageUtils';
import { getGlobalAppSettings } from '@/lib/webServerUtils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateStaticParams() {
  return [];
}

interface ProviderPageProps {
  params: Promise<{ slug: string }>;
}

const extractLocationParts = (address?: string) => {
  if (!address) return { area: 'Bangalore', city: 'Bangalore', pin: '560001' };
  const parts = address.split(',').map(p => p.trim()).filter(Boolean);
  const pinMatch = address.match(/\b\d{6}\b/);
  const pin = pinMatch ? pinMatch[0] : '';

  let area = 'Bangalore';
  let city = 'Bangalore';

  const nonPinParts = parts.filter(p => !/\b\d{6}\b/.test(p) && p.toLowerCase() !== 'karnataka' && p.toLowerCase() !== 'india');
  if (nonPinParts.length >= 2) {
    city = nonPinParts[nonPinParts.length - 1];
    area = nonPinParts[nonPinParts.length - 2];
  } else if (nonPinParts.length === 1) {
    area = nonPinParts[0];
  }

  return { area, city, pin };
};

const getProviderData = cache(async (slug: string): Promise<ClientServiceData | null> => {
  try {
    const normalizedSlug = slug.toLowerCase().trim();

    let provSnap = await adminDb.collection('providerApplications')
      .where('slug', '==', normalizedSlug)
      .limit(1)
      .get();

    if (provSnap.empty) {
      const provDoc = await adminDb.collection('providerApplications').doc(slug).get();
      if (provDoc.exists) {
        provSnap = { docs: [provDoc], empty: false } as any;
      }
    }

    if (provSnap.empty) {
      // Flexible matching for name slugs, provider ID prefixes, and full names
      const allApprovedSnap = await adminDb.collection('providerApplications')
        .where('status', '==', 'approved')
        .get();

      const matched = allApprovedSnap.docs.find(d => {
        const data = d.data();
        const pSlug = (data.slug || '').toLowerCase().trim();
        const nameSlug = data.fullName ? data.fullName.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') : '';
        const idPrefix = ('provider-' + d.id.slice(0, 5)).toLowerCase();
        const bareId = d.id.toLowerCase();

        return (
          pSlug === normalizedSlug ||
          nameSlug === normalizedSlug ||
          idPrefix === normalizedSlug ||
          bareId === normalizedSlug ||
          normalizedSlug.replace(/^provider-/, '') === d.id.slice(0, 5).toLowerCase() ||
          (data.fullName && normalizedSlug.replace(/-/g, ' ') === data.fullName.toLowerCase().trim())
        );
      });

      if (matched) {
        provSnap = { docs: [matched], empty: false } as any;
      }
    }

    if (provSnap.empty) {
      return null;
    }

    const pDoc = provSnap.docs[0];
    const pData = pDoc.data();

    // Check if provider is approved and active
    if (pData.status !== 'approved' || pData.isActive === false) {
      return null;
    }

    let parentCategoryName = pData.workCategoryName;
    let parentCategorySlug = pData.workCategoryName 
      ? pData.workCategoryName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') 
      : undefined;
    let parentCategoryId = pData.workCategoryId;

    let catWorkingHours = { start: "09:30 AM", end: "05:30 PM" };
    let catLunchBreak = { start: "01:00 PM", end: "02:00 PM" };

    if (parentCategoryId) {
      const catDoc = await adminDb.collection('adminCategories').doc(parentCategoryId).get();
      if (catDoc.exists) {
        const cData = catDoc.data();
        if (!parentCategoryName) parentCategoryName = cData.name;
        if (!parentCategorySlug) parentCategorySlug = cData.slug;
        if (cData.workingHours) catWorkingHours = cData.workingHours;
        if (cData.lunchBreak) catLunchBreak = cData.lunchBreak;
      }
    }

    const workingHours = pData.workingHours || catWorkingHours;
    const lunchBreak = pData.lunchBreak || catLunchBreak;

    // Load registered languages dynamically
    const languages = Array.isArray(pData.languagesSpokenLabels) && pData.languagesSpokenLabels.length > 0
      ? pData.languagesSpokenLabels
      : (Array.isArray(pData.languagesSpoken) && pData.languagesSpoken.length > 0 
          ? pData.languagesSpoken 
          : ["Hindi", "English", "Kannada"]);

    const seniority = pData.seniorityLevel || pData.skillLevelLabel || 'Senior';
    const loc = extractLocationParts(pData.workAreaAddress);

    // Fetch provider default settings for admin markup fee
    let adminMarkupFee = 200;
    try {
      const provSettingsDoc = await adminDb.collection('webSettings').doc('providerDefaultSettings').get();
      if (provSettingsDoc.exists) {
        const sData = provSettingsDoc.data();
        if (typeof sData?.adminMarkupFee === 'number') {
          adminMarkupFee = sData.adminMarkupFee;
        }
      }
    } catch (e) {}

    const baseDailyRate = Number(pData.dailyRate) || Number(pData.dailyWage) || Number(pData.desiredDailyRate) || Number(pData.price) || 1200;
    const customerDailyRate = baseDailyRate + adminMarkupFee;

    // High Ranking Local SEO: Category in Area, City | Category Near Me - Provider Name | FixBro
    const categoryName = parentCategoryName || 'Daily Labour';
    const seoTitle = `${categoryName} in ${loc.area}, ${loc.city} | ${categoryName} Near Me - ${pData.fullName} | FixBro`;
    const seoDesc = `Looking for trusted ${categoryName} in ${loc.area}, ${loc.city} or ${categoryName} near me? Hire ${pData.fullName}, verified ${seniority} ${categoryName} serving within ${pData.workAreaRadiusKm || 15}km. Book full-day daily labour online at ₹${customerDailyRate}/day.`;

    const clientData: ClientServiceData = {
      id: pDoc.id,
      name: pData.fullName || 'Daily Labour Provider',
      description: pData.bio || `Experienced ${seniority} daily labour provider in ${categoryName}. Verified professional serving ${loc.area}, ${loc.city} and nearby locations.`,
      price: customerDailyRate,
      discountedPrice: customerDailyRate,
      slug: pData.slug || slug,
      imageUrl: pData.profilePhotoUrl || '/default-image.png',
      rating: Number(pData.overallRating || pData.rating) || 5,
      reviewCount: Number(pData.reviewCount) || 0,
      subCategoryId: `providers-${parentCategoryId || 'general'}`,
      parentCategoryId,
      parentCategoryName,
      parentCategorySlug,
      allowPayLater: true,
      isActive: true,
      isProvider: true,
      seniorityLevel: seniority,
      age: pData.age || 28,
      experienceYears: pData.experienceYears || 5,
      experienceLevelLabel: pData.experienceLevelLabel || `${pData.experienceYears || 5} Years Experience`,
      workAreaAddress: pData.workAreaAddress || 'Bangalore',
      workAreaRadiusKm: Number(pData.workAreaRadiusKm) || 25,
      workingHours,
      lunchBreak,
      languagesSpokenLabels: languages,
      serviceFaqs: [],
      providerData: {
        id: pDoc.id,
        fullName: pData.fullName,
        seniorityLevel: seniority,
        workCategoryName: parentCategoryName,
        age: pData.age,
        experienceYears: pData.experienceYears,
        languagesSpokenLabels: languages,
        workingHours,
        lunchBreak,
        workAreaCenter: pData.workAreaCenter,
        workAreaRadiusKm: Number(pData.workAreaRadiusKm) || 25,
        // STRICT PRIVACY: mobileNumber and email are never exposed
      },
      metaTitle: seoTitle,
      metaDescription: seoDesc,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return clientData;
  } catch (error) {
    console.error('Error fetching provider data:', error);
    return null;
  }
});

const getRecommendedProviders = cache(async (
  currentProviderId: string,
  parentCategoryId?: string
): Promise<FirestoreService[]> => {
  try {
    let q = adminDb.collection('providerApplications')
      .where('status', '==', 'approved')
      .limit(10);

    if (parentCategoryId) {
      q = adminDb.collection('providerApplications')
        .where('workCategoryId', '==', parentCategoryId)
        .where('status', '==', 'approved')
        .limit(10);
    }

    const snap = await q.get();
    const results: FirestoreService[] = [];

    snap.docs.forEach((docSnap, idx) => {
      if (docSnap.id !== currentProviderId) {
        const p = docSnap.data();
        if (p.isActive !== false) {
          const baseDailyRate = Number(p.dailyRate) || Number(p.dailyWage) || Number(p.desiredDailyRate) || Number(p.price) || 1200;
          results.push({
            id: docSnap.id,
            subCategoryId: `providers-${p.workCategoryId || 'general'}`,
            parentCategoryId: p.workCategoryId,
            name: p.fullName || 'Labour Provider',
            slug: p.slug || (p.fullName ? p.fullName.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') : `provider-${docSnap.id.slice(0, 5)}`),
            description: p.bio || `Skilled ${p.seniorityLevel || 'Professional'} provider.`,
            imageUrl: p.profilePhotoUrl || '/default-image.png',
            price: baseDailyRate,
            discountedPrice: baseDailyRate,
            order: idx,
            isActive: true,
            rating: Number(p.overallRating || p.rating) || 5,
            reviewCount: Number(p.reviewCount) || 0,
            isProvider: true,
            seniorityLevel: p.seniorityLevel || 'Senior',
            age: p.age || 28,
            experienceYears: p.experienceYears || 5,
            experienceLevelLabel: p.experienceLevelLabel || `${p.experienceYears || 5} Years Exp`,
            workAreaAddress: p.workAreaAddress || '',
            workAreaRadiusKm: Number(p.workAreaRadiusKm) || 25,
            workAreaCenter: p.workAreaCenter || null,
            workingHours: p.workingHours || { start: "09:30 AM", end: "05:30 PM" },
            lunchBreak: p.lunchBreak || { start: "01:00 PM", end: "02:00 PM" },
          } as FirestoreService);
        }
      }
    });

    return results;
  } catch (err) {
    console.error('Error fetching recommended providers:', err);
    return [];
  }
});

export async function generateMetadata(
  { params }: ProviderPageProps,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { slug } = await params;
  const providerData = await getProviderData(slug);

  if (!providerData) return {};

  const seoSettings = await getGlobalSEOSettings();
  const appBaseUrl = getBaseUrl();
  const loc = extractLocationParts(providerData.workAreaAddress);

  const title = providerData.metaTitle || `${providerData.parentCategoryName} in ${loc.area}, ${loc.city} | ${providerData.parentCategoryName} Near Me - ${providerData.name} | FixBro`;
  const description = providerData.metaDescription || `Hire ${providerData.name}, verified ${providerData.seniorityLevel} ${providerData.parentCategoryName} in ${loc.area}, ${loc.city}.`;

  const rawImage = providerData.imageUrl || '/default-image.png';
  const ogImage = rawImage.startsWith('http')
    ? rawImage
    : `${appBaseUrl}${rawImage.startsWith('/') ? '' : '/'}${rawImage}`;

  const categoryName = providerData.parentCategoryName || 'Daily Labour';

  return {
    title,
    description,
    keywords: [
      `${categoryName} in ${loc.area}`,
      `${categoryName} in ${loc.city}`,
      `${categoryName} near me`,
      `hire ${categoryName} ${loc.area}`,
      `${providerData.name} ${categoryName}`,
      `daily labour ${loc.area}`,
      `${categoryName} daily wage ${loc.city}`,
      providerData.name
    ],
    robots: {
      index: true,
      follow: true,
    },
    alternates: {
      canonical: `${appBaseUrl}/provider/${slug}`,
    },
    openGraph: {
      title,
      description,
      url: `${appBaseUrl}/provider/${slug}`,
      images: [{ url: ogImage, width: 800, height: 800, alt: providerData.name }],
      siteName: seoSettings.siteName || 'FixBro Daily Labour',
      type: 'profile',
    },
  };
}

export default async function ProviderDetailsPage({ params }: ProviderPageProps) {
  const { slug } = await params;
  const providerData = await getProviderData(slug);

  if (!providerData) {
    notFound();
  }

  const [seoSettings, aggregateRating, appConfig, recommendedProviders] = await Promise.all([
    getGlobalSEOSettings(),
    getAggregateRating(),
    getGlobalAppSettings(),
    getRecommendedProviders(providerData.id, providerData.parentCategoryId)
  ]);

  const appBaseUrl = getBaseUrl();
  const loc = extractLocationParts(providerData.workAreaAddress);
  const symbol = appConfig?.currencySymbol || "₹";

  const rawSchemaImage = providerData.imageUrl || '/default-image.png';
  const schemaImage = rawSchemaImage.startsWith('http')
    ? rawSchemaImage
    : `${appBaseUrl}${rawSchemaImage.startsWith('/') ? '' : '/'}${rawSchemaImage}`;

  const ratingValNum = parseFloat(String(providerData.rating || aggregateRating?.ratingValue || 4.8));
  const reviewCountNum = parseInt(String(providerData.reviewCount || aggregateRating?.reviewCount || 10), 10);

  const providerServiceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": providerData.name,
    "description": providerData.description,
    "image": schemaImage,
    "provider": {
      "@type": "LocalBusiness",
      "name": "FixBro Daily Labour",
      "telephone": seoSettings.structuredDataTelephone,
      "priceRange": `${symbol}${symbol}`,
      "image": schemaImage,
      "address": {
        "@type": "PostalAddress",
        "streetAddress": loc.area,
        "addressLocality": loc.city,
        "postalCode": loc.pin,
        "addressRegion": "Karnataka",
        "addressCountry": "IN"
      }
    },
    "areaServed": {
      "@type": "City",
      "name": loc.city
    },
    "offers": {
      "@type": "Offer",
      "price": providerData.price,
      "priceCurrency": "INR",
      "availability": "https://schema.org/InStock",
      "url": `${appBaseUrl}/provider/${slug}`,
      "unitText": "DAY"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": ratingValNum,
      "reviewCount": reviewCountNum,
      "bestRating": 5,
      "worstRating": 1
    }
  };

  const breadcrumbListSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": appBaseUrl
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": providerData.parentCategoryName || "Daily Labour",
        "item": `${appBaseUrl}/category/${providerData.parentCategorySlug || 'all'}`
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": providerData.name,
        "item": `${appBaseUrl}/provider/${slug}`
      }
    ]
  };

  return (
    <>
      <JsonLdScript data={providerServiceSchema} idSuffix={`provider-schema-${slug}`} />
      <JsonLdScript data={breadcrumbListSchema} idSuffix={`provider-breadcrumbs-${slug}`} />

      <DetailsPage
        serviceSlug={slug}
        initialServiceData={providerData}
        initialH1Title={providerData.name}
        initialRecommendedServices={recommendedProviders}
      />
    </>
  );
}
