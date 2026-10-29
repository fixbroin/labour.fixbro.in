/**
 * Utilities for generating SEO-friendly URLs for marketplace listings.
 * e.g. "Wooden Sofa Set 3 Seater" + ID "AwLIeQ0qEWF5o-OHBx2H" 
 *   => "wooden-sofa-set-3-seater--AwLIeQ0qEWF5o-OHBx2H"
 */

export function generateMarketplaceSlug(title: string, id: string): string {
  if (!id) return '';
  const cleanTitle = (title || 'item')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // remove special characters
    .replace(/[\s_-]+/g, '-') // collapse spaces and dashes
    .replace(/^-+|-+$/g, '') || 'item'; // trim leading/trailing dashes

  return `${cleanTitle}--${id}`;
}

/**
 * Extracts the real document ID from a slug or raw ID.
 * Supports:
 * - Double hyphen separator: "wooden-sofa--AwLIeQ0qEWF5o-OHBx2H" => "AwLIeQ0qEWF5o-OHBx2H"
 * - Single hyphen separator: "wooden-sofa-ApsveIY01nO6naU5iD7G" => "ApsveIY01nO6naU5iD7G"
 * - Raw document IDs: "AwLIeQ0qEWF5o-OHBx2H" => "AwLIeQ0qEWF5o-OHBx2H"
 */
export function extractMarketplaceId(slugOrId: string): string {
  if (!slugOrId) return '';
  const decoded = decodeURIComponent(slugOrId).trim();

  // 1. Double hyphen separator (primary slug separator)
  const doubleDashIndex = decoded.lastIndexOf('--');
  if (doubleDashIndex !== -1) {
    const candidate = decoded.substring(doubleDashIndex + 2);
    if (candidate) return candidate;
  }

  // 2. If length <= 22, it's very likely a raw nanoid / Firestore document ID (e.g. AwLIeQ0qEWF5o-OHBx2H)
  if (decoded.length <= 22 && !decoded.includes(' ')) {
    return decoded;
  }

  // 3. Single hyphen fallback for legacy slugs with long titles
  const singleDashIndex = decoded.lastIndexOf('-');
  if (singleDashIndex !== -1) {
    const candidate = decoded.substring(singleDashIndex + 1);
    if (candidate.length >= 6) {
      return candidate;
    }
  }

  return decoded;
}

export function getFurniturePublicUrl(listing: { title?: string; id: string }): string {
  if (!listing?.id) return '/furniture';
  const slug = generateMarketplaceSlug(listing.title || 'furniture', listing.id);
  return `/furniture/${slug}`;
}

export function getRentalPublicUrl(listing: { title?: string; id: string }): string {
  if (!listing?.id) return '/rent-home';
  const slug = generateMarketplaceSlug(listing.title || 'rental', listing.id);
  return `/rent-home/${slug}`;
}
