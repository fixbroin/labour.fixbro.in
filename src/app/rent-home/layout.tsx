import type { Metadata } from 'next';
import { getMarketplaceSettingsAction } from '@/app/actions/marketplaceSettingsActions';
import { DEFAULT_MARKETPLACE_SETTINGS } from '@/types/marketplace';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getMarketplaceSettingsAction().catch(() => DEFAULT_MARKETPLACE_SETTINGS);

  const title = settings.rentalsSeoTitle || DEFAULT_MARKETPLACE_SETTINGS.rentalsSeoTitle;
  const description = settings.rentalsSeoDescription || DEFAULT_MARKETPLACE_SETTINGS.rentalsSeoDescription;
  const keywords = settings.rentalsSeoKeywords || DEFAULT_MARKETPLACE_SETTINGS.rentalsSeoKeywords;
  const canonicalUrl = settings.rentalsCanonicalUrl || 'https://fixbro.in/rent-home';
  const ogImage = settings.rentalsOgImage || '/default-image.png';

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
          alt: 'FixBro Rent a Home & Flats',
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

export default async function RentalRootLayout({
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
            'name': 'Rent a Home',
            'item': 'https://fixbro.in/rent-home',
          },
        ],
      },
      {
        '@type': 'CollectionPage',
        'name': 'Rent a Home, Flats, Rooms & Apartments Near You',
        'description': 'Search 1RK, 1BHK, 2BHK, 3BHK flats, rooms, and independent houses for rent with zero brokerage.',
        'url': 'https://fixbro.in/rent-home',
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
