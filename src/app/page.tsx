import type { Metadata, ResolvingMetadata } from 'next';
import { adminDb } from '@/lib/firebaseAdmin'; // Corrected import
import type { GlobalWebSettings, FirestoreSEOSettings } from '@/types/firestore';
import { getGlobalSEOSettings } from '@/lib/seoServerUtils';
import HomePageClient from '@/components/home/HomePageClient';
import { getBaseUrl } from '@/lib/config';
import { getHomepageData, getAggregateRating } from '@/lib/homepageUtils';
import { getGlobalWebSettings, getGlobalAppSettings } from '@/lib/webServerUtils';
import JsonLdScript from '@/components/shared/JsonLdScript';

export const dynamic = 'force-dynamic';

export async function generateMetadata(
  _: {}, 
  parent: ResolvingMetadata
): Promise<Metadata> {
  const resolvedParent = await parent;
  
  const seoSettings = await getGlobalSEOSettings();
  const webSettings = await getGlobalWebSettings();
  const appBaseUrl = getBaseUrl();

  const title = seoSettings.homepageMetaTitle || seoSettings.siteName || 'Fixbro';
  const description = seoSettings.homepageMetaDescription || seoSettings.defaultMetaDescription || '';
  const keywords = (seoSettings.homepageMetaKeywords || seoSettings.defaultMetaKeywords || '').split(',').map(k => k.trim()).filter(k => k);

  const ogImageFromWebSettings = webSettings?.websiteIconUrl || webSettings?.logoUrl;
  const rawOgImage = ogImageFromWebSettings || seoSettings.structuredDataImage || `/default-image.png`;
  const ogImage = rawOgImage.startsWith('http') ? rawOgImage : `${appBaseUrl}${rawOgImage.startsWith('/') ? '' : '/'}${rawOgImage}`;

  const siteName = resolvedParent.openGraph?.siteName || seoSettings.siteName || 'Fixbro';

  return {
    title: title,
    description: description,
    keywords: keywords.length > 0 ? keywords : undefined,
    robots: {
      index: true,
      follow: true,
    },
    alternates: {
      canonical: `${appBaseUrl}`,
    },
    openGraph: {
      title: title,
      description: description,
      url: '/',
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
      siteName: siteName,
      type: 'website',
    },
  };
}

export default async function Page() {
  const [homepageData, aggregateRating, appConfig] = await Promise.all([
    getHomepageData(),
    getAggregateRating(),
    getGlobalAppSettings()
  ]);
  const symbol = appConfig?.currencySymbol || "₹";

  const appBaseUrl = getBaseUrl();
  const siteName = homepageData.seoSettings.siteName || 'Fixbro';
  const seoSettings = homepageData.seoSettings;

  const rawSchemaImage = seoSettings.structuredDataImage || `/android-chrome-512x512.png`;
  const schemaImage = rawSchemaImage.startsWith('http') ? rawSchemaImage : `${appBaseUrl}${rawSchemaImage.startsWith('/') ? '' : '/'}${rawSchemaImage}`;

  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": seoSettings.structuredDataType || "LocalBusiness",
    "name": siteName,
    "url": appBaseUrl,
    "logo": `${appBaseUrl}/android-chrome-512x512.png`,
    "image": schemaImage,
    "description": seoSettings.homepageMetaDescription,
    "telephone": seoSettings.structuredDataTelephone,
    "address": {
      "@type": "PostalAddress",
      "streetAddress": seoSettings.structuredDataStreetAddress,
      "addressLocality": seoSettings.structuredDataLocality,
      "addressRegion": seoSettings.structuredDataRegion,
      "postalCode": seoSettings.structuredDataPostalCode,
      "addressCountry": seoSettings.structuredDataCountry
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": 12.8452, 
      "longitude": 77.6633
    },
    "openingHoursSpecification": {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": [
        "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
      ],
      "opens": "08:00",
      "closes": "20:00"
    },
    "sameAs": Object.values(seoSettings.socialProfileUrls || {}).filter(url => !!url),
    "priceRange": `${symbol}${symbol}`,
    "areaServed": [
      {
        "@type": "City",
        "name": "Bangalore"
      },
      {
        "@type": "AdministrativeArea",
        "name": "Karnataka"
      }
    ],
    "hasOfferCatalog": {
      "@type": "OfferCatalog",
      "name": "Daily Labour Services",
      "itemListElement": [
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "name": "Carpenter Daily Labour"
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "name": "Painter Daily Labour"
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "name": "Electrician Daily Labour"
          }
        }
      ]
    }
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "How to hire carpenter daily labour in Bangalore?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Fixbro Daily Labour provides top-rated, background-verified carpenter daily labour in Bangalore for full-day woodwork, furniture crafting, and repairs on transparent daily wage rates."
        }
      },
      {
        "@type": "Question",
        "name": "How to hire daily wage workers in Bangalore?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "You can easily hire verified daily labour in Bangalore through Fixbro Daily Labour. Choose your trade category, select your area, and book a verified worker with two-factor OTP verification."
        }
      }
    ]
  };

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": siteName,
    "url": appBaseUrl,
    "logo": `${appBaseUrl}/android-chrome-512x512.png`,
    "sameAs": Object.values(seoSettings.socialProfileUrls || {}).filter(url => !!url),
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": seoSettings.structuredDataTelephone,
      "contactType": "customer service",
      "areaServed": "IN",
      "availableLanguage": ["English", "Hindi", "Kannada"]
    }
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": siteName,
    "url": appBaseUrl,
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": `${appBaseUrl}/categories?q={search_term_string}`
      },
      "query-input": "required name=search_term_string"
    }
  };
  const homeRatingValNum = parseFloat(String(aggregateRating?.ratingValue || "4.8")) || 4.8;
  const homeReviewCountNum = parseInt(String(aggregateRating?.reviewCount || "15600"), 10) || 15600;

  (localBusinessSchema as any).aggregateRating = {
    "@type": "AggregateRating",
    "ratingValue": homeRatingValNum,
    "reviewCount": homeReviewCountNum,
    "bestRating": 5,
    "worstRating": 1
  };
  return (
    <>
      <JsonLdScript data={localBusinessSchema} idSuffix="homepage-local-biz" />
      <JsonLdScript data={faqSchema} idSuffix="homepage-faqs" />
      <JsonLdScript data={organizationSchema} idSuffix="homepage-org" />
      <JsonLdScript data={websiteSchema} idSuffix="homepage-website" />
      <HomePageClient initialData={homepageData} initialH1Title={seoSettings.homepageH1} />
    </>
  );
}
