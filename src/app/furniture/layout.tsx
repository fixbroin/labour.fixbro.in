import type { Metadata } from 'next';
import { getMarketplaceSettingsAction } from '@/app/actions/marketplaceSettingsActions';
import { DEFAULT_MARKETPLACE_SETTINGS } from '@/types/marketplace';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getMarketplaceSettingsAction().catch(() => DEFAULT_MARKETPLACE_SETTINGS);

  const title = settings.furnitureSeoTitle || DEFAULT_MARKETPLACE_SETTINGS.furnitureSeoTitle;
  const description = settings.furnitureSeoDescription || DEFAULT_MARKETPLACE_SETTINGS.furnitureSeoDescription;
  const keywords = settings.furnitureSeoKeywords || DEFAULT_MARKETPLACE_SETTINGS.furnitureSeoKeywords;
  const canonicalUrl = settings.furnitureCanonicalUrl || 'https://fixbro.in/furniture';
  const ogImage = settings.furnitureOgImage || '/default-image.png';

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: 'FixBro',
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: 'FixBro Buy & Sell Furniture',
        },
      ],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function FurnitureRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        'itemListElement': [
          {
            '@type': 'ListItem',
            'position': 1,
            'name': 'Home',
            'item': 'https://fixbro.in',
          },
          {
            '@type': 'ListItem',
            'position': 2,
            'name': 'Buy & Sell Furniture',
            'item': 'https://fixbro.in/furniture',
          },
        ],
      },
      {
        '@type': 'CollectionPage',
        'name': 'Buy & Sell Used and New Furniture Online',
        'description': 'Marketplace to buy and sell used and new furniture near your location. Connect directly with owners.',
        'url': 'https://fixbro.in/furniture',
        'provider': {
          '@type': 'Organization',
          'name': 'FixBro',
          'url': 'https://fixbro.in',
        },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  );
}
