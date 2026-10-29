import type { Metadata } from 'next';
import { getRentalListingByIdAction } from '@/app/actions/rentalActions';
import { generateMarketplaceSlug, extractMarketplaceId } from '@/lib/marketplaceSlug';

type Props = {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const listing = await getRentalListingByIdAction(id);

  if (!listing) {
    return {
      title: 'Rental Listing Not Found | FixBro',
      description: 'The requested rental property has expired or was removed.',
    };
  }

  const slug = generateMarketplaceSlug(listing.title, listing.id);
  const title = `${listing.title} for Rent in ${listing.area || 'your area'} | FixBro Home Rentals`;
  const description = `${listing.title} available for ₹${listing.monthlyRent?.toLocaleString('en-IN') || 0}/month in ${
    listing.area || 'your city'
  }. Zero brokerage. Contact verified landlord directly on FixBro.`;
  const canonicalUrl = `https://fixbro.in/rent-home/${slug}`;
  const ogImage = listing.photos && listing.photos.length > 0 ? listing.photos[0] : '/default-image.png';

  return {
    title,
    description,
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
          alt: listing.title,
        },
      ],
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function RentalDetailLayout({
  children,
  params,
}: Props) {
  const { id } = await params;
  const listing = await getRentalListingByIdAction(id);

  let jsonLd = null;

  if (listing) {
    const slug = generateMarketplaceSlug(listing.title, listing.id);
    jsonLd = {
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
            {
              '@type': 'ListItem',
              'position': 3,
              'name': listing.title,
              'item': `https://fixbro.in/rent-home/${slug}`,
            },
          ],
        },
        {
          '@type': 'RealEstateListing',
          'name': listing.title,
          'image': listing.photos || [],
          'description': listing.description || `${listing.title} for rent in ${listing.area}`,
          'offers': {
            '@type': 'Offer',
            'price': listing.monthlyRent || 0,
            'priceCurrency': 'INR',
            'businessFunction': 'https://schema.org/RentalOffer',
            'url': `https://fixbro.in/rent-home/${slug}`,
            'seller': {
              '@type': 'Person',
              'name': listing.userName || 'FixBro Landlord',
            },
          },
        },
      ],
    };
  }

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {children}
    </>
  );
}
