import ServiceDetailPageClient from '@/components/service/ServiceDetailPageClient';
import { adminDb } from '@/lib/firebaseAdmin';
import type { FirestoreService, ClientServiceData, FirestoreCategory, FirestoreSubCategory } from '@/types/firestore';
import { Timestamp } from '@/lib/mysqlDbAdmin';
import JsonLdScript from '@/components/shared/JsonLdScript';
import { getBaseUrl } from '@/lib/config';
import type { Metadata, ResolvingMetadata } from 'next';
import { replacePlaceholders } from '@/lib/seoUtils';
import { getGlobalSEOSettings } from '@/lib/seoServerUtils';
import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { notFound } from 'next/navigation';
import { getAggregateRating } from '@/lib/homepageUtils';
import { getGlobalAppSettings } from '@/lib/webServerUtils';
import { generateBreadcrumbSchema } from '@/lib/seoAdvancedUtils';
import { serializeFirestoreData } from '@/lib/serializeUtils';

export const revalidate = false; // Persistent Cache (Smart Revalidation Only)

export async function generateStaticParams() {
  return [];
}

/**
 * Server-side helper to safely get milliseconds from various timestamp formats.
 * Important for Server Components handling both Admin SDK and serialized data.
 */
function getTimestampMillis(ts: any): number {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts === 'object') {
    if (ts.seconds !== undefined) return ts.seconds * 1000 + (ts.nanoseconds || 0) / 1000000;
    if (ts._seconds !== undefined) return ts._seconds * 1000 + (ts._nanoseconds || 0) / 1000000;
    if (ts instanceof Date) return ts.getTime();
  }
  if (typeof ts === 'string') {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }
  return typeof ts === 'number' ? ts : 0;
}

interface ServicePageProps {
  params: Promise<{ slug: string }>;
}

const getServiceData = cache(async (slug: string): Promise<ClientServiceData | null> => {
  return unstable_cache(
    async () => {
      try {
        const servRef = adminDb.collection('adminServices');
        const q = servRef.where('slug', '==', slug).where('isActive', '==', true).limit(1);
        const snapshot = await q.get();
        if (snapshot.empty) return null;

        const serviceDoc = snapshot.docs[0];
        const serviceDocData = serviceDoc.data() as FirestoreService | undefined;
        if (!serviceDocData) return null; 

        const serviceId = serviceDoc.id;

        let parentCategoryName: string | undefined;
        let parentCategorySlug: string | undefined;
        let parentCategoryId: string | undefined;

        if (serviceDocData.subCategoryId) {
            const subCatDocRef = adminDb.collection("adminSubCategories").doc(serviceDocData.subCategoryId);
            const subCatDoc = await subCatDocRef.get();
            if (subCatDoc.exists) {
                const subCategory = subCatDoc.data() as FirestoreSubCategory | undefined;
                if (subCategory && subCategory.isActive) { 
                    if (subCategory.parentId) {
                        parentCategoryId = subCategory.parentId;
                        const catDocRef = adminDb.collection("adminCategories").doc(subCategory.parentId);
                        const catDoc = await catDocRef.get();
                        if (catDoc.exists) {
                            const category = catDoc.data() as FirestoreCategory | undefined;
                            if (category && category.isActive) { 
                                parentCategoryName = category.name;
                                parentCategorySlug = category.slug;
                            } else {
                                return null;
                            }
                        }
                    }
                } else {
                     return null;
                }
            }
        }

        const { createdAt, updatedAt, ...restOfServiceData } = serviceDocData;

        const clientData: ClientServiceData = {
          ...restOfServiceData, 
          id: serviceId, 
          parentCategoryName,
          parentCategorySlug,
          parentCategoryId,
          taskTimeValue: restOfServiceData.taskTimeValue,
          taskTimeUnit: restOfServiceData.taskTimeUnit,
          includedItems: restOfServiceData.includedItems,
          excludedItems: restOfServiceData.excludedItems,
          allowPayLater: restOfServiceData.allowPayLater,
          serviceFaqs: restOfServiceData.serviceFaqs,
          hasMinQuantity: restOfServiceData.hasMinQuantity,
          minQuantity: restOfServiceData.minQuantity,
          metaTitle: restOfServiceData.seo_title, // Map seo_title to metaTitle for ClientServiceData
          metaDescription: restOfServiceData.seo_description,
          metaKeywords: restOfServiceData.seo_keywords,
        };
        
        clientData.createdAt = (() => {
          const millis = getTimestampMillis(createdAt);
          return millis ? new Date(millis).toISOString() : String(createdAt || '');
        })();

        clientData.updatedAt = (() => {
          const millis = getTimestampMillis(updatedAt);
          return millis ? new Date(millis).toISOString() : String(updatedAt || '');
        })();

        return clientData;

      } catch (error) {
        console.error('Error fetching service data for page component:', error);
        return null;
      }
    },
    [`service-data-${slug}`],
    { revalidate: false, tags: ['services', `service-${slug}`, 'global-cache'] }
  )();
});

const getRecommendedServices = cache(async (
  currentServiceId: string, 
  subCategoryId?: string, 
  parentCategoryId?: string
): Promise<FirestoreService[]> => {
  return unstable_cache(
    async () => {
      try {
        const servRef = adminDb.collection('adminServices');
        const results: FirestoreService[] = [];

        // 1. Fetch other services from the same subcategory
        if (subCategoryId) {
          const qSub = servRef
            .where('subCategoryId', '==', subCategoryId)
            .where('isActive', '==', true)
            .limit(12);
          const snapSub = await qSub.get();
          snapSub.docs.forEach(docSnap => {
            if (docSnap.id !== currentServiceId) {
              const data = serializeFirestoreData<any>(docSnap.data());
              results.push({ id: docSnap.id, ...data });
            }
          });
        }

        // 2. If fewer than 6, also fetch from other subcategories in the same parent category
        if (results.length < 6 && parentCategoryId) {
          const subCatRef = adminDb.collection('adminSubCategories');
          const qOtherSubCats = subCatRef
            .where('parentId', '==', parentCategoryId)
            .where('isActive', '==', true)
            .limit(8);
          const snapOtherSubCats = await qOtherSubCats.get();
          const otherSubCatIds = snapOtherSubCats.docs
            .map(d => d.id)
            .filter(id => id !== subCategoryId);

          if (otherSubCatIds.length > 0) {
            const qCatServices = servRef
              .where('subCategoryId', 'in', otherSubCatIds.slice(0, 10))
              .where('isActive', '==', true)
              .limit(12);
            const snapCatServices = await qCatServices.get();
            snapCatServices.docs.forEach(docSnap => {
              if (docSnap.id !== currentServiceId && !results.some(r => r.id === docSnap.id)) {
                const data = serializeFirestoreData<any>(docSnap.data());
                results.push({ id: docSnap.id, ...data });
              }
            });
          }
        }

        return results
          .sort((a, b) => (a.order || 0) - (b.order || 0) || (b.rating || 0) - (a.rating || 0))
          .slice(0, 12);
      } catch (err) {
        console.error('Error fetching recommended services server-side:', err);
        return [];
      }
    },
    [`recommended-services-${currentServiceId}-${subCategoryId || 'none'}`],
    { revalidate: false, tags: ['services', 'global-cache'] }
  )();
});

export async function generateMetadata(
  { params }: ServicePageProps,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { slug } = await params;
  const serviceData = await getServiceData(slug);
  
  if (!serviceData) return {};

  const seoSettings = await getGlobalSEOSettings();
  const appBaseUrl = getBaseUrl();
  const cityName = seoSettings.structuredDataLocality || "Bangalore";
  const placeholderData = { 
    serviceName: serviceData.name, 
    categoryName: serviceData.parentCategoryName || "Home Services",
    cityName: cityName
  };

  const title = replacePlaceholders(serviceData.seo_title || seoSettings.servicePageTitlePattern, placeholderData) || `${serviceData.name} in ${cityName} | Fixbro`;
  const description = replacePlaceholders(serviceData.seo_description || seoSettings.servicePageDescriptionPattern, placeholderData) || `${serviceData.name} in ${cityName}. Trusted experts, transparent pricing, and quality home solutions by Fixbro.`;
  const keywords = (replacePlaceholders(serviceData.seo_keywords || seoSettings.servicePageKeywordsPattern, placeholderData) || `${serviceData.name}, best ${serviceData.name} near me`).split(',').map(k => k.trim()).filter(k => k);

  const rawOgImage = serviceData.imageUrl || seoSettings.structuredDataImage || `/default-image.png`;
  const ogImage = rawOgImage.startsWith('http') ? rawOgImage : `${appBaseUrl}${rawOgImage.startsWith('/') ? '' : '/'}${rawOgImage}`;

  return {
    title: title,
    description: description,
    keywords: keywords.length > 0 ? keywords : undefined,
    robots: {
      index: true,
      follow: true,
    },
    alternates: {
      canonical: `${appBaseUrl}/service/${slug}`,
    },
    openGraph: {
      title: title,
      description: description,
      url: `/service/${slug}`,
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
      type: 'article',
    },
  };
}

export default async function ServiceDetailPage({ params }: ServicePageProps) {
  const { slug } = await params;
  const [serviceData, aggregateRating, seoSettings, appConfig] = await Promise.all([
    getServiceData(slug),
    getAggregateRating(),
    getGlobalSEOSettings(),
    getGlobalAppSettings()
  ]);
  const symbol = appConfig?.currencySymbol || "₹";

  if (!serviceData) {
    notFound();
  }

  const recommendedServices = await getRecommendedServices(
    serviceData.id,
    serviceData.subCategoryId,
    serviceData.parentCategoryId
  );

  const cityName = seoSettings.structuredDataLocality || "Bangalore";
  const placeholderData = { 
    serviceName: serviceData.name, 
    categoryName: serviceData.parentCategoryName || "Home Services",
    cityName: cityName
  };
  
  const h1Title = replacePlaceholders(serviceData.h1_title || seoSettings.servicePageH1Pattern, placeholderData) || `${serviceData.name} in ${cityName}`;

  const appBaseUrl = getBaseUrl();
  const rawSchemaImage = serviceData.imageUrl || `/android-chrome-512x512.png`;
  const schemaImage = rawSchemaImage.startsWith('http') ? rawSchemaImage : `${appBaseUrl}${rawSchemaImage.startsWith('/') ? '' : '/'}${rawSchemaImage}`;

  const breadcrumbItems = [
    { name: "Home", url: appBaseUrl },
    ...(serviceData.parentCategorySlug ? [{ name: serviceData.parentCategoryName || "Category", url: `${appBaseUrl}/category/${serviceData.parentCategorySlug}` }] : []),
    { name: serviceData.name, url: `${appBaseUrl}/service/${slug}` }
  ];
  const breadcrumbSchema = generateBreadcrumbSchema(breadcrumbItems);
  const ratingValue = serviceData.rating || aggregateRating?.ratingValue || seoSettings.fallbackRatingValue || "4.8";
  const reviewCount = serviceData.reviewCount || aggregateRating?.reviewCount || seoSettings.fallbackReviewCount || "156";
  const ratingValNum = parseFloat(String(ratingValue)) || 4.8;
  const reviewCountNum = parseInt(String(reviewCount), 10) || 156;

  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": serviceData.name,
    "description": serviceData.seo_description || serviceData.description,
    "image": schemaImage,
    "provider": {
      "@type": "LocalBusiness",
      "name": "Fixbro",
      "telephone": seoSettings.structuredDataTelephone,
      "priceRange": `${symbol}${symbol}`,
      "image": schemaImage,
      "address": {
        "@type": "PostalAddress",
        "streetAddress": seoSettings.structuredDataStreetAddress,
        "addressLocality": cityName,
        "addressRegion": seoSettings.structuredDataRegion,
        "addressCountry": "IN"
      }
    },
    "areaServed": {
      "@type": "City",
      "name": cityName
    }
  };

  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": serviceData.name,
    "description": serviceData.seo_description || serviceData.description,
    "image": schemaImage,
    "brand": {
      "@type": "Brand",
      "name": "Fixbro"
    },
    "sku": serviceData.id,
    "mpn": serviceData.id,
    "offers": serviceData.price ? {
      "@type": "Offer",
      "price": parseFloat(String(serviceData.discountedPrice || serviceData.price)) || 0,
      "priceCurrency": "INR",
      "availability": "https://schema.org/InStock",
      "url": `${appBaseUrl}/service/${slug}`,
      "priceValidUntil": `${new Date().getFullYear() + 5}-12-31`,
      "validFrom": `${new Date().getFullYear()}-01-01`,
      "hasMerchantReturnPolicy": {
        "@type": "MerchantReturnPolicy",
        "applicableCountry": "IN",
        "returnPolicyCategory": "https://schema.org/MerchantReturnNotPermitted"
      },
      "shippingDetails": {
        "@type": "OfferShippingDetails",
        "shippingRate": {
          "@type": "MonetaryAmount",
          "value": 0,
          "currency": "INR"
        },
        "shippingDestination": {
          "@type": "DefinedRegion",
          "addressCountry": "IN"
        },
        "deliveryTime": {
          "@type": "ShippingDeliveryTime",
          "handlingTime": {
            "@type": "QuantitativeValue",
            "minValue": 0,
            "maxValue": 0,
            "unitCode": "DAY"
          },
          "transitTime": {
            "@type": "QuantitativeValue",
            "minValue": 0,
            "maxValue": 0,
            "unitCode": "DAY"
          }
        }
      }
    } : undefined,
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": ratingValNum,
      "reviewCount": reviewCountNum,
      "bestRating": 5,
      "worstRating": 1
    }
  };
  // Add FAQ Schema if available
  let faqSchema = null;
  if (serviceData.serviceFaqs && serviceData.serviceFaqs.length > 0) {
    faqSchema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": serviceData.serviceFaqs.map((faq: any) => ({
        "@type": "Question",
        "name": faq.question,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": faq.answer
        }
      }))
    };
  }

  return (
    <>
      <JsonLdScript data={serviceSchema} idSuffix={`service-${serviceData.id}`} />
      <JsonLdScript data={productSchema} idSuffix={`product-${serviceData.id}`} />
      <JsonLdScript data={breadcrumbSchema} idSuffix={`breadcrumb-service-${serviceData.id}`} />
      {faqSchema && <JsonLdScript data={faqSchema} idSuffix={`faq-${serviceData.id}`} />}
      <ServiceDetailPageClient 
        serviceSlug={slug} 
        initialServiceData={serviceData} 
        initialH1Title={h1Title} 
        initialRecommendedServices={recommendedServices}
      />
    </>
  );
}
