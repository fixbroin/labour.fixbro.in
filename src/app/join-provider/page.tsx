import React from 'react';
import type { Metadata } from 'next';
import { adminDb } from '@/lib/firebaseAdmin';
import { serializeFirestoreData } from '@/lib/serializeUtils';
import { getPool, getDocsInternal } from '@/lib/mysql';
import type { FirestoreCategory } from '@/types/firestore';
import { getJoinProviderPageSettingsAction } from '@/app/actions/joinProviderActions';
import { getProviderWalletSettingsAction } from '@/app/actions/providerWalletActions';
import { getGlobalSEOSettings } from '@/lib/seoServerUtils';
import JoinProviderClient from '@/components/provider/JoinProviderClient';
import JsonLdScript from '@/components/shared/JsonLdScript';
import { getBaseUrl } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getJoinProviderPageSettingsAction();
  const appBaseUrl = getBaseUrl();
  const canonical = settings.canonicalUrl || `${appBaseUrl}/join-provider`;

  return {
    title: settings.pageTitle,
    description: settings.metaDescription,
    keywords: settings.metaKeywords,
    alternates: {
      canonical: canonical,
    },
    openGraph: {
      title: settings.pageTitle,
      description: settings.metaDescription,
      url: canonical,
      siteName: 'Fixbro',
      images: [
        {
          url: settings.heroBannerImage || `${appBaseUrl}/default-image.png`,
          width: 1200,
          height: 630,
          alt: settings.pageTitle,
        },
      ],
      locale: 'en_IN',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: settings.pageTitle,
      description: settings.metaDescription,
      images: [settings.heroBannerImage || `${appBaseUrl}/default-image.png`],
    },
  };
}

export default async function JoinProviderPage() {
  const appBaseUrl = getBaseUrl();
  const [settings, walletSettings, seoSettings] = await Promise.all([
    getJoinProviderPageSettingsAction(),
    getProviderWalletSettingsAction(),
    getGlobalSEOSettings(),
  ]);

  // Fetch application configuration (commission & currency)
  let appConfig: any = {};
  try {
    const configSnap = await adminDb.collection('webSettings').doc('applicationConfig').get();
    if (configSnap.exists) {
      appConfig = serializeFirestoreData(configSnap.data()) || {};
    }
  } catch (err) {
    console.error("Error fetching applicationConfig:", err);
  }

  // Fetch active categories directly from MySQL database
  let categories: FirestoreCategory[] = [];
  try {
    const pool = await getPool();
    const rawCategories = await getDocsInternal(pool, 'adminCategories', []);
    categories = rawCategories
      .filter((c: any) => c.data?.isActive !== false)
      .map((c: any) => ({
        id: String(c.id),
        name: String(c.data?.name || ''),
        slug: String(c.data?.slug || ''),
        order: Number(c.data?.order || 0),
        imageUrl: String(c.data?.imageUrl || ''),
        imageHint: String(c.data?.imageHint || ''),
        isActive: Boolean(c.data?.isActive ?? true),
      } as FirestoreCategory))
      .sort((a: FirestoreCategory, b: FirestoreCategory) => a.order - b.order);
  } catch (err) {
    console.error("Error fetching categories for join provider page:", err);
  }

  const commissionPercentage = Number(appConfig?.providerFeeValue || 10);
  const commissionType = appConfig?.providerFeeType || 'percentage';
  const minWalletBalance = Number(walletSettings?.minBalanceForJobs || 100);
  const currencySymbol = appConfig?.currencySymbol || '₹';
  const currencyCode = appConfig?.currencyCode || 'INR';

  // Sanitize settings to plain JSON object
  const plainSettings = JSON.parse(JSON.stringify(settings));

  const streetAddress = seoSettings?.structuredDataStreetAddress || "#44, G S Palya Road, Konappana Agrahara, Electronic City Phase 2";
  const addressLocality = seoSettings?.structuredDataLocality || "Bangalore";
  const addressRegion = seoSettings?.structuredDataRegion || "Karnataka";
  const postalCode = seoSettings?.structuredDataPostalCode || "560100";
  const addressCountry = seoSettings?.structuredDataCountry || "IN";

  // Dynamic JobPosting schema for each category trade (e.g. Carpenter Jobs Near Me, Plumber Jobs Near Me)
  const categoryJobPostings = categories.map((cat) => ({
    "@type": "JobPosting",
    "@id": `${appBaseUrl}/join-provider#job-${cat.slug || cat.id}`,
    "title": `${cat.name} Jobs Near Me - Fixbro Service Partner`,
    "description": `Looking for ${cat.name.toLowerCase()} jobs near me or ${cat.name.toLowerCase()} service work? Join Fixbro in Bangalore & India. Receive verified customer bookings dispatched to your local radius, flexible online/offline toggle, and earnings withdrawal in 3 days.`,
    "identifier": {
      "@type": "PropertyValue",
      "name": "Fixbro",
      "value": `FIXBRO-JOB-${(cat.slug || cat.id).toUpperCase()}`,
    },
    "datePosted": "2026-01-01",
    "validThrough": "2027-12-31",
    "employmentType": ["CONTRACTOR", "PART_TIME", "FULL_TIME"],
    "directApply": true,
    "hiringOrganization": {
      "@type": "Organization",
      "name": "Fixbro",
      "sameAs": appBaseUrl,
      "logo": `${appBaseUrl}/android-chrome-512x512.png`,
    },
    "jobLocation": {
      "@type": "Place",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": streetAddress,
        "addressLocality": addressLocality,
        "addressRegion": addressRegion,
        "postalCode": postalCode,
        "addressCountry": addressCountry,
      },
    },
    "baseSalary": {
      "@type": "MonetaryAmount",
      "currency": currencyCode,
      "value": {
        "@type": "QuantitativeValue",
        "minValue": 30000,
        "maxValue": 90000,
        "unitText": "MONTH",
      },
    },
  }));

    // Generate Schema.org JSON-LD Structured Data
    const jsonLdData: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebPage",
          "@id": `${appBaseUrl}/join-provider#webpage`,
          "url": `${appBaseUrl}/join-provider`,
          "name": settings.pageTitle,
          "description": settings.metaDescription,
          "isPartOf": {
            "@type": "WebSite",
            "@id": `${appBaseUrl}/#website`,
            "url": appBaseUrl,
            "name": "Fixbro",
          },
        },
        ...categoryJobPostings,
        {
          "@type": "FAQPage",
          "@id": `${appBaseUrl}/join-provider#faq`,
          "mainEntity": settings.faqs.map(faq => ({
            "@type": "Question",
            "name": faq.question
            .replace(/{commission}/g, `${commissionPercentage}%`)
            .replace(/{currency}/g, currencySymbol)
            .replace(/{min_wallet_balance}/g, String(minWalletBalance)),
          "acceptedAnswer": {
            "@type": "Answer",
            "text": faq.answer
              .replace(/{commission}/g, `${commissionPercentage}%`)
              .replace(/{currency}/g, currencySymbol)
              .replace(/{min_wallet_balance}/g, String(minWalletBalance)),
          },
        })),
      },
    ],
  };

  return (
    <>
      <JsonLdScript data={jsonLdData} idSuffix="join-provider" />
      <JoinProviderClient 
        settings={plainSettings}
        categories={categories}
        commissionPercentage={commissionPercentage}
        commissionType={commissionType}
        minWalletBalance={minWalletBalance}
        currencySymbol={currencySymbol}
        currencyCode={currencyCode}
      />
    </>
  );
}
