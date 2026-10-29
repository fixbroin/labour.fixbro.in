/**
 * @fileOverview Advanced SEO utilities for cleaning and optimizing SEO metadata.
 */

/**
 * Maps category names to high-intent search terms (singular/person forms).
 * This helps target keywords like "Carpenter in Whitefield" instead of "Carpentry in Whitefield".
 */
export function getCategorySearchTerm(categoryName: string): string {
  const name = categoryName.trim();
  const lowerName = name.toLowerCase();

  const mapping: Record<string, string> = {
    // Top 3 Priority Categories
    'carpentry': 'Carpenter',
    'carpenter': 'Carpenter',
    'tv installation': 'TV Installation',
    'tv-installation': 'TV Installation',
    'tv mounting': 'TV Installation',
    'tv-mounting': 'TV Installation',
    'television installation': 'TV Installation',
    'interior': 'Interior Designers',
    'interiors': 'Interior Designers',
    'interior design': 'Interior Designers',
    'interior-design': 'Interior Designers',
    'interior work': 'Interior Work',

    // Other core trades
    'plumbing': 'Plumber',
    'plumber': 'Plumber',
    'electrical': 'Electrician',
    'electrician': 'Electrician',
    'painting': 'Painter',
    'painter': 'Painter',
    'cleaning': 'Cleaning Services',
    'appliance repair': 'Appliance Repair',
    'pest control': 'Pest Control',
    'ac service': 'AC Technician',
    'ac services': 'AC Technician',
    'home cleaning': 'Home Cleaners',
    'bathroom cleaning': 'Bathroom Cleaners',
    'sofa cleaning': 'Sofa Cleaners',
    'kitchen cleaning': 'Kitchen Cleaners',
    'waterproofing': 'Waterproofing Experts',
  };

  if (mapping[lowerName]) return mapping[lowerName];

  return name;
}

/**
 * Orders category names by business priority:
 * 1. Carpentry (Carpenter)
 * 2. TV Installation
 * 3. Interior (Interior Designers / Interior Work)
 * 4. Other trades (Plumbing, Electrical, Painting, etc.)
 */
export function prioritizeCategoryNames(categoryNames: string[]): string[] {
  if (!categoryNames || categoryNames.length === 0) return [];

  const getRank = (name: string): number => {
    const l = name.toLowerCase().trim();
    if (l.includes('carpent')) return 1;
    if (l.includes('tv') || l.includes('television')) return 2;
    if (l.includes('interior')) return 3;
    if (l.includes('plumb')) return 4;
    if (l.includes('electri')) return 5;
    if (l.includes('paint')) return 6;
    if (l.includes('appliance')) return 7;
    return 10;
  };

  return [...categoryNames].sort((a, b) => getRank(a) - getRank(b));
}

/**
 * Removes redundant words and cleans up SEO strings.
 * It removes duplicate words within a sentence but is now more 
 * careful not to break SEO-critical repetition.
 */
export function cleanSeoString(text: string | undefined | null): string {
  if (!text) return '';

  // 1. Basic cleaning: remove extra spaces
  let cleaned = text.replace(/\s+/g, ' ').trim();

  // 2. Remove common over-repeated patterns (e.g., "Professional Professional")
  // Only remove if it's EXACTLY the same word repeated consecutively.
  // We allow "Carpenter in Whitefield | Carpenter near me" because they are not adjacent.
  cleaned = cleaned.replace(/\b(\w+)\s+\1\b/gi, '$1');

  // 3. Remove any trailing separator characters like '|', '-', ':'
  cleaned = cleaned.replace(/[\s\|\-\–\—\:]+$/, '').trim();

  return cleaned;
}

/**
 * Strips any trailing company or brand name from an SEO title
 * (e.g. "| Fixbro", "- Fixbro", "| Fixbro") so that the root layout
 * metadata template (`%s - Brand`) does not create duplicate brand names.
 */
export function stripBrandSuffix(title: string | undefined | null, brandName?: string): string {
  if (!title) return '';
  let cleaned = title.trim();

  const brands = ['fixbro', 'fixbro'];
  if (brandName && brandName.trim()) {
    brands.push(brandName.trim().toLowerCase());
  }

  // Iteratively strip trailing brand matches
  for (const b of brands) {
    const regex = new RegExp(`\\s*(?:[\\|\\-\\–\\—\\:]|by)\\s*${b}\\s*$`, 'i');
    cleaned = cleaned.replace(regex, '').trim();
  }

  // Clean trailing punctuation/pipes
  cleaned = cleaned.replace(/[\s\|\-\–\—\:]+$/, '').trim();
  return cleaned;
}


/**
 * Ensures a string doesn't exceed a certain length while keeping it natural.
 */
export function truncateSeoString(text: string, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  
  // Try to cut at the last full word
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > maxLength * 0.7) { // Increased tolerance to 70%
    return truncated.slice(0, lastSpace).trim();
  }
  
  return truncated.trim();
}

/**
 * Advanced placeholder replacement with cleaning.
 */
export function replaceAndCleanPlaceholders(
  template: string | undefined | null,
  data: Record<string, string | number | undefined | null>
): string {
  if (!template) return '';
  
  let result = template;
  try {
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const placeholderValue = data[key];
        const value = placeholderValue !== undefined && placeholderValue !== null ? String(placeholderValue) : '';
        result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
      }
    }
  } catch (e) {
    return template;
  }
  
  // After replacement, clean the string
  return cleanSeoString(result);
}

/**
 * Generates a list of LSI (Latent Semantic Indexing) keywords for home services.
 */
export function getLSIKeywords(category: string, city: string = 'Bangalore'): string[] {
  const common = ['best', 'professional', 'top-rated', 'trusted', 'expert', 'near me', 'affordable', 'reliable'];
  const localized = [`in ${city}`, `${city} experts`, `booking ${city}`];
  
  return [
    `${category} ${city}`,
    `best ${category} ${city}`,
    `professional ${category} services`,
    `${category} near me`,
    ...common.map(c => `${c} ${category}`),
  ];
}

/**
 * Generates BreadcrumbList JSON-LD schema.
 */
export function generateBreadcrumbSchema(items: { name: string; url?: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      ...(item.url ? { "item": item.url } : {})
    }))
  };
}

/**
 * Cleans a service name by removing parentheses specifications, dimensions, and unnecessary prefixes.
 * Examples:
 *   "Just Wall Drilling (Single Hole)" -> "Wall Drilling"
 *   "TV Uninstallation (up to 55 inches.)" -> "TV Uninstallation"
 *   "TV Installation – Up to 32 Inches" -> "TV Installation"
 *   "Bed Dismantle (with or without storage)" -> "Bed Dismantle"
 */
export function cleanServiceName(rawName: string | undefined | null): string {
  if (!rawName) return '';
  let cleaned = rawName.trim();

  // Strip text within parentheses e.g. "(Single Hole)", "(up to 55 inches.)"
  cleaned = cleaned.replace(/\s*\([^)]*\)/g, '');

  // Strip dash specifications e.g. " – Up to 32 Inches", " - 44 to 55 Inches"
  cleaned = cleaned.replace(/\s*[\–\—\-]\s*(?:up to|\d+\s*to|\d+).*$/i, '');

  // Strip leading "Just " e.g. "Just Wall Drilling" -> "Wall Drilling"
  cleaned = cleaned.replace(/^Just\s+/i, '');

  // Clean double spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned || rawName.trim();
}

/**
 * Generates a clean, natural, high-CTR SEO title for an area service page.
 * Avoids awkward/robotic phrases like "Best Just Wall Drilling (Single Hole) Repair & Maintenance in Dollars Colony Near Me".
 */
export function formatAreaServiceTitle(
  rawOverrideTitle: string | undefined | null,
  serviceName: string,
  areaName: string,
  cityName: string
): string {
  const cleanName = cleanServiceName(serviceName);

  if (rawOverrideTitle && rawOverrideTitle.trim().length > 0) {
    let t = rawOverrideTitle.trim();
    // Remove parentheses specifications
    t = t.replace(/\s*\([^)]*\)/g, '');
    // Remove "Just "
    t = t.replace(/\bJust\s+/gi, '');
    // Clean "in [Area] near Bangalore" -> "in [Area], Bangalore"
    t = t.replace(/\s+near\s+Bangalore\b/gi, ', Bangalore');
    // If the service is drilling, assemble, dismantle, installation, or hanging, strip mismatched "Repair & Maintenance"
    const nonRepairKeywords = ['drilling', 'dismantle', 'assembly', 'installation', 'hanging', 'uninstallation', 'mount'];
    if (nonRepairKeywords.some(kw => cleanName.toLowerCase().includes(kw))) {
      t = t.replace(/\s*Repair\s*&\s*Maintenance\s*/gi, ' ');
    }
    // Remove trailing brand name so Next.js layout cleanly appends it
    t = t.replace(/\s*[|\-–]\s*Fixbro\s*$/i, '');
    // Clean double spaces and trailing pipes
    t = t.replace(/\s+/g, ' ').replace(/[\s\|\-\–\—\:]+$/, '').trim();

    if (t.length > 20 && !t.includes('(')) {
      return t;
    }
  }

  // High-CTR natural search title (clean, under 60 chars)
  return `${cleanName} in ${areaName}, ${cityName} | ${cleanName} Near Me`;
}

/**
 * Generates a clean, natural meta description for an area service page.
 */
export function formatAreaServiceDescription(
  rawOverrideDesc: string | undefined | null,
  serviceName: string,
  areaName: string,
  cityName: string
): string {
  const cleanName = cleanServiceName(serviceName);

  if (rawOverrideDesc && rawOverrideDesc.trim().length > 30) {
    let d = rawOverrideDesc.trim();
    d = d.replace(/\s*\([^)]*\)/g, '');
    d = d.replace(/\bjust\s+/gi, '');
    d = d.replace(/\s+near\s+Bangalore\b/gi, ', Bangalore');
    d = d.replace(/\s+/g, ' ').trim();
    if (d.length > 50 && !d.includes('(')) {
      return d;
    }
  }

  return `Book professional ${cleanName} services in ${areaName}, ${cityName}. Verified local experts, upfront transparent rates, and same-day doorstep service by FixBro.`;
}

/**
 * Generates a clean, natural SEO title for an area category page.
 * Incorporates category + service names when provided.
 */
export function formatAreaCategoryTitle(
  rawOverrideTitle: string | undefined | null,
  searchTerm: string,
  areaName: string,
  cityName: string,
  primaryServiceName?: string
): string {
  if (rawOverrideTitle && rawOverrideTitle.trim().length > 0) {
    let t = rawOverrideTitle.trim();
    t = t.replace(/\s+near\s+Bangalore\b/gi, ', Bangalore');
    t = t.replace(/\s*[|\-–]\s*Fixbro\s*$/i, '');
    t = t.replace(/\s+/g, ' ').replace(/[\s\|\-\–\—\:]+$/, '').trim();
    if (t.length > 15 && !t.includes('near Bangalore')) {
      return t;
    }
  }

  if (primaryServiceName && primaryServiceName.trim()) {
    const cleanSrv = cleanServiceName(primaryServiceName);
    return `${searchTerm} in ${areaName}, ${cityName} | ${cleanSrv} Near Me`;
  }

  return `${searchTerm} in ${areaName}, ${cityName} | ${searchTerm} Near Me`;
}

