import type { Metadata } from 'next';
import { getFurnitureListingByIdAction } from '@/app/actions/furnitureActions';
import { generateMarketplaceSlug, extractMarketplaceId } from '@/lib/marketplaceSlug';

type Props = {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const listing = await getFurnitureListingByIdAction(id);

  if (!listing) {
    return {
      title: 'Furniture Listing Not Found | FixBro',
      description: 'The requested furniture ad has expired or was removed.',
    };
  }

  const slug = generateMarketplaceSlug(listing.title, listing.id);
  const title = `${listing.title} for Sale in ${listing.area || 'your area'} | FixBro Furniture`;
  const description = `${listing.title} for ₹${listing.price?.toLocaleString('en-IN') || 0} in ${listing.area || 'your city'}. Condition: ${
    listing.listingType === 'brand_new' ? 'Brand New' : 'Used'
  }. Connect with verified seller directly with zero commission on FixBro.`;
  const canonicalUrl = `https://fixbro.in/furniture/${slug}`;
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

export default async function FurnitureDetailLayout({
  children,
  params,
}: Props) {
  const { id } = await params;
  const listing = await getFurnitureListingByIdAction(id);

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
              'name': 'Buy & Sell Furniture',
              'item': 'https://fixbro.in/furniture',
            },
            {
              '@type': 'ListItem',
              'position': 3,
              'name': listing.title,
              'item': `https://fixbro.in/furniture/${slug}`,
            },
          ],
        },
        {
          '@type': 'Product',
          'name': listing.title,
          'image': listing.photos || [],
          'description': listing.description || `${listing.title} for sale in ${listing.area}`,
          'category': listing.category,
          'itemCondition':
            listing.listingType === 'brand_new'
              ? 'https://schema.org/NewCondition'
              : 'https://schema.org/UsedCondition',
          'offers': {
            '@type': 'Offer',
            'price': listing.price || 0,
            'priceCurrency': 'INR',
            'availability':
              listing.status === 'active'
                ? 'https://schema.org/InStock'
                : 'https://schema.org/SoldOut',
            'url': `https://fixbro.in/furniture/${slug}`,
            'seller': {
              '@type': 'Person',
              'name': listing.userName || 'FixBro Seller',
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
