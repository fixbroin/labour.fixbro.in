// src/lib/seoUtils.ts

import type { FirestoreSEOSettings } from '@/types/firestore';
import { cleanSeoString, getCategorySearchTerm } from './seoAdvancedUtils';

export const defaultSeoValues: FirestoreSEOSettings = {
  siteName: 'Fixbro Daily Labour - Hire Daily Labour in Bangalore',

  // Automatically added to every meta title
  defaultMetaTitleSuffix: ' | Fixbro Daily Labour',

  defaultMetaDescription:
    'Hire trusted daily labour, carpenters, electricians, plumbers, painters, and skilled daily wage workers near you in Bangalore. Background-verified workers, full-day labour booking, upfront daily rates.',

  defaultMetaKeywords:
    'daily labour near me, carpenter daily labour, electrician daily labour, painter daily labour, daily wage workers bangalore, hire daily labour, daily labour in bangalore',

  homepageMetaTitle:
    'Hire Daily Labour, Carpenter, Painter & Electrician in Bangalore | Fixbro Daily Labour',

  homepageMetaDescription:
    'Book verified daily labour and skilled daily wage workers in Bangalore. Hire carpenters, painters, electricians, and helpers for full-day work with upfront daily rates.',

  homepageMetaKeywords:
    'daily labour near me, carpenter daily labour, electrician daily labour, painter daily labour, daily wage workers bangalore, hire daily labour, daily labour in bangalore',

  homepageH1:
    'Hire Trusted Daily Labour Near You in Bangalore',

  categoryPageTitlePattern:
    '{{categorySearchTerm}} Daily Labour Near Me in Bangalore',

  categoryPageDescriptionPattern:
    'Hire top-rated, background-verified {{categorySearchTerm}} daily labour near you in Bangalore. Professional full-day labour booking with upfront daily rates and same-day availability.',

  categoryPageKeywordsPattern:
    '{{categorySearchTerm}} daily labour near me, best {{categorySearchTerm}} daily labour, {{categorySearchTerm}} daily wage worker, hire {{categorySearchTerm}} in bangalore, carpenter daily labour',

  categoryPageH1Pattern:
    '{{categorySearchTerm}} Daily Labour in Bangalore',

  cityCategoryPageTitlePattern:
    '{{categorySearchTerm}} Daily Labour in {{cityName}} | Near Me',

  cityCategoryPageDescriptionPattern:
    'Hire verified {{categorySearchTerm}} daily labour in {{cityName}} near you. Book background-checked daily wage {{categorySearchTerm}} workers for full-day work with upfront daily rates.',

  cityCategoryPageKeywordsPattern:
    '{{categorySearchTerm}} daily labour {{cityName}}, {{categorySearchTerm}} daily labour near me, hire daily wage {{categorySearchTerm}} in {{cityName}}, best {{categorySearchTerm}} daily labour',

  cityCategoryPageH1Pattern:
    '{{categorySearchTerm}} Daily Labour in {{cityName}}',

  areaCategoryPageTitlePattern:
    '{{categorySearchTerm}} Daily Labour in {{areaName}}, {{cityName}} | Near Me',

  areaCategoryPageDescriptionPattern:
    'Looking for {{categorySearchTerm}} daily labour in {{areaName}}, {{cityName}}? Book verified local daily wage workers for full-day work. Upfront daily rates & same-day dispatch.',

  areaCategoryPageKeywordsPattern:
    '{{categorySearchTerm}} daily labour {{areaName}}, {{categorySearchTerm}} daily labour near me, {{categorySearchTerm}} daily wage worker in {{areaName}}, hire {{categorySearchTerm}} in {{areaName}}',

  areaCategoryPageH1Pattern:
    '{{categorySearchTerm}} Daily Labour in {{areaName}}',

  servicePageTitlePattern:
    '{{serviceName}} Daily Labour in Bangalore | Near Me',

  servicePageDescriptionPattern:
    'Book verified {{serviceName}} daily labour in Bangalore with Fixbro Daily Labour. Background-checked workers, full-day labour, transparent daily rates near you.',

  servicePageKeywordsPattern:
    '{{serviceName}} daily labour, {{serviceName}} near me, best {{serviceName}} in bangalore, daily wage {{serviceName}}, hire {{serviceName}}',

  servicePageH1Pattern:
    '{{serviceName}} Daily Labour in Bangalore',

  areaPageTitlePattern:
    'Daily Labour in {{areaName}}, {{cityName}} | Near Me',

  areaPageDescriptionPattern:
    'Book verified daily labour, carpenters, electricians, and skilled workers near you in {{areaName}}, {{cityName}}. Full-day labour booking with upfront daily rates.',

  areaPageKeywordsPattern:
    'daily labour {{areaName}}, daily labour near me {{areaName}}, carpenter daily labour {{areaName}}, electrician daily labour {{areaName}}, hire daily wage workers {{areaName}}',

  areaPageH1Pattern:
    'Daily Labour in {{areaName}}',

  cityPageTitlePattern:
    'Daily Labour in {{cityName}} | Daily Wage Workers Near Me',

  cityPageDescriptionPattern:
    'Book verified daily labour and skilled trade workers (carpenter, electrician, painter) near you in {{cityName}}. Full-day booking with upfront daily rates.',

  cityPageKeywordsPattern:
    'daily labour {{cityName}}, daily labour near me, hire daily labour {{cityName}}, carpenter daily labour {{cityName}}, electrician daily labour {{cityName}}, daily wage workers {{cityName}}',

  cityPageH1Pattern:
    'Daily Labour in {{cityName}}',

  structuredDataType: 'LocalBusiness',

  structuredDataName: 'Fixbro Daily Labour',

  structuredDataStreetAddress:
    '#44, G S Palya Road, Konappana Agrahara, Electronic City Phase 2',

  structuredDataLocality: 'Bangalore',

  structuredDataRegion: 'Karnataka',

  structuredDataPostalCode: '560100',

  structuredDataCountry: 'IN',

  structuredDataTelephone: '+91-7353113455',

  structuredDataImage:
    'https://labour.fixbro.in/android-chrome-512x512.png',

  socialProfileUrls: {
    facebook: 'https://www.facebook.com/fixbro.in',
    twitter: 'https://x.com/fixbro_in',
    instagram: 'https://www.instagram.com/fixbro.in/',
    linkedin: 'https://www.linkedin.com/company/fixbro-in',
    youtube: 'https://www.youtube.com/@fixbro-in',
  },

  fallbackRatingValue: '4.9',

  fallbackReviewCount: '2500',

  // Dynamic Content Templates (SEO Optimized)

cityCategorySeoContentTemplate: `
<section class="space-y-5">

  <h2>Professional {{categoryName}} Daily Labour in {{cityName}}</h2>

  <p>
    Looking for verified {{categoryName}} daily labour in {{cityName}}? Fixbro Daily Labour connects contractors, homeowners, interior managers, and businesses with experienced daily wage workers for full-day job bookings. Whether you need skilled carpenters, electricians, plumbers, painters, or helpers, our workers are verified and ready to work.
  </p>

  <p>
    Our {{categoryName}} daily wage professionals in {{cityName}} work a full day (09:30 AM – 05:30 PM with a 1:00 PM – 2:00 PM lunch break) using standard professional tools to ensure high-efficiency progress and dependable workmanship.
  </p>

  <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">

    <div class="p-4 bg-muted/30 rounded-lg">
      <strong>Background-Verified Workers</strong><br>
      Identity-cleared trade workers with verified experience.
    </div>

    <div class="p-4 bg-muted/30 rounded-lg">
      <strong>Transparent Daily Rates</strong><br>
      Fixed full-day wage rates with zero hidden commissions.
    </div>

    <div class="p-4 bg-muted/30 rounded-lg">
      <strong>Full-Day Labour Booking</strong><br>
      Standard 7-hour active workday dedicated to your project.
    </div>

    <div class="p-4 bg-muted/30 rounded-lg">
      <strong>Doorstep Arrival &amp; OTP Verification</strong><br>
      Secure start and completion OTPs ensure reliable attendance.
    </div>

  </div>

  <h3>Why Hire {{categoryName}} Daily Labour via Fixbro in {{cityName}}?</h3>

  <ul>
    <li>Experienced local daily wage trade workers</li>
    <li>Dedicated single-day or multi-day labour bookings</li>
    <li>Direct doorstep arrival across all localities of {{cityName}}</li>
    <li>Residential, commercial, and renovation site support</li>
    <li>Upfront fixed daily rates with no unexpected extra fees</li>
    <li>Guaranteed attendance and dedicated customer care</li>
  </ul>

  <h3>Popular {{categoryName}} Daily Labour Work in {{cityName}}</h3>

  <p>
    Customers commonly book daily wage workers for furniture making, repair work, full-day site preparation, wall painting, wiring installations, pipe repairs, and structural renovation tasks.
  </p>

  <p>
    Book trusted {{categoryName}} daily labour near you in {{cityName}} with Fixbro Daily Labour today.
  </p>

</section>
`,

cityCategoryFaqsTemplate: [
  {
    question: "What are the working hours for {{categoryName}} daily labour in {{cityName}}?",
    answer: "Our standard daily labour schedule runs from 09:30 AM to 05:30 PM, which includes a 1-hour lunch break from 01:00 PM to 02:00 PM (7 active working hours)."
  },
  {
    question: "How do I book {{categoryName}} daily wage workers in {{cityName}}?",
    answer: "Simply choose your category, select an approved worker based on skill level and daily rate, pick your date, and confirm your booking online or via Pay After Service."
  },
  {
    question: "Are {{categoryName}} daily labour workers background-verified?",
    answer: "Yes. All daily labour workers undergo Government ID verification, trade skill checks, and background assessment before being listed on Fixbro Daily Labour."
  },
  {
    question: "Can I book {{categoryName}} workers for multiple days?",
    answer: "Yes, you can easily book workers for a single day or consecutive days directly during checkout."
  },
  {
    question: "What are the daily wage rates for {{categoryName}} in {{cityName}}?",
    answer: "Daily rates depend on the worker's seniority level (Fresher, Intermediate, Senior, Expert). The exact daily wage is transparently displayed upfront on each worker's profile."
  },
  {
    question: "Do daily labour workers bring their own tools?",
    answer: "Yes, our skilled trade workers bring their standard professional hand tools required for regular daily labour tasks."
  }
],

areaCategorySeoContentTemplate: `
<section class="space-y-5">

  <h2>{{categoryName}} Daily Labour in {{areaName}}, {{cityName}}</h2>

  <p>
    Need verified {{categoryName}} daily labour in {{areaName}}? Fixbro Daily Labour connects you with local, background-checked daily wage workers ready to provide full-day labour for homes, commercial interiors, renovation sites, and construction projects across {{areaName}}.
  </p>

  <p>
    Our daily wage trade specialists in {{areaName}} arrive punctually for a full 8-hour workday (09:30 AM – 05:30 PM) equipped with trade tools, ensuring your scheduled project work finishes on time.
  </p>

  <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">

    <div class="p-4 bg-muted/30 rounded-lg">
      <strong>Local Daily Labour</strong><br>
      Workers located directly in {{areaName}} and adjacent sectors.
    </div>

    <div class="p-4 bg-muted/30 rounded-lg">
      <strong>Full-Day Fixed Wage</strong><br>
      Fixed daily pricing with transparent online or cash settlement.
    </div>

    <div class="p-4 bg-muted/30 rounded-lg">
      <strong>Secure OTP Verification</strong><br>
      Start OTP and Complete OTP safeguard your booking.
    </div>

  </div>

  <h3>Benefits of Booking Daily Labour in {{areaName}}</h3>

  <ul>
    <li>Prompt local arrival without long travel delays</li>
    <li>Verified identity and trade skills (Fresher to Senior levels)</li>
    <li>Dedicated full-day focus on your booked task only</li>
    <li>Transparent flat daily rates with zero hidden charges</li>
    <li>Flexible scheduling across residential and commercial sites</li>
    <li>Prompt customer support and attendance assurance</li>
  </ul>

  <h3>Serving Projects Across {{areaName}}</h3>

  <p>
    We supply reliable daily labour to apartments, independent houses, villas, gated communities, corporate offices, and retail renovation sites throughout {{areaName}}.
  </p>

  <p>
    Find trusted {{categoryName}} daily labour near you in {{areaName}}, {{cityName}} on Fixbro Daily Labour today.
  </p>

</section>
`,

areaCategoryFaqsTemplate: [
  {
    question: "Can I get {{categoryName}} daily labour in {{areaName}} on the same day?",
    answer: "Yes. Many of our registered daily labour workers reside in or near {{areaName}}, enabling fast doorstep arrival and same-day work."
  },
  {
    question: "How does the job start and completion OTP work in {{areaName}}?",
    answer: "When your worker arrives at your location in {{areaName}}, share your 4-digit Start OTP to begin work. Once the full day is completed, share your Complete OTP to finalize the job."
  },
  {
    question: "What are the daily labour working hours in {{areaName}}?",
    answer: "Work starts at 09:30 AM and ends at 05:30 PM with a 1-hour lunch break between 01:00 PM and 02:00 PM."
  },
  {
    question: "Can I book daily labour for apartment interiors in {{areaName}}?",
    answer: "Yes, our workers regularly work in gated communities, apartments, villas, and commercial properties throughout {{areaName}}."
  },
  {
    question: "What if the worker does not show up at my site in {{areaName}}?",
    answer: "Fixbro guarantees your booking. If a worker fails to attend, we will promptly reassign another available worker or issue a full refund."
  },
  {
    question: "Why hire daily labour through Fixbro Daily Labour in {{areaName}}?",
    answer: "We offer verified identity checks, transparent daily wage cards, secure OTP start/finish tracking, and dedicated customer support."
  }
],

  areaServiceSeoContentTemplate: `
<section class="space-y-5">

  <h2>{{serviceName}} in {{areaName}}, {{cityName}}</h2>

  <p>
    Fixbro offers reliable, top-rated {{serviceName}} in {{areaName}}, {{cityName}}. Whether you need urgent assistance, standard repairs, routine maintenance, or professional installation work, our verified local service experts are ready to handle it for you.
  </p>

  <p>
    Every job is completed by background-verified professionals using modern tools, high-quality spare parts, and standardized processes. Book {{serviceName}} near you in {{areaName}} with flexible scheduling and get transparent upfront estimates.
  </p>

  <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">

    <div class="p-4 bg-muted/30 rounded-lg">
      <strong>Local Availability</strong><br>
      Serving homes, apartments, and offices in {{areaName}}.
    </div>

    <div class="p-4 bg-muted/30 rounded-lg">
      <strong>Prompt Turnaround</strong><br>
      Same-day scheduling option and on-time service delivery.
    </div>

    <div class="p-4 bg-muted/30 rounded-lg">
      <strong>Verified Quality</strong><br>
      Backed by verified technician reviews and Fixbro assurance.
    </div>

  </div>

  <h3>Why Book {{serviceName}} in {{areaName}} with Fixbro?</h3>

  <ul>
    <li>Dedicated service experts available locally in {{areaName}}</li>
    <li>Upfront pricing with no hidden charges</li>
    <li>Flexible booking slots to suit your schedule</li>
    <li>Equipped with professional equipment for precise execution</li>
    <li>Customer-first platform support</li>
  </ul>

  <p>
    Enjoy a stress-free booking experience. Reserve your {{serviceName}} slot in {{areaName}}, {{cityName}} today!
  </p>

</section>
`,

  areaServiceFaqsTemplate: [
    {
      question: "What is the cost of {{serviceName}} in {{areaName}}?",
      answer: "The price for {{serviceName}} is displayed transparently above. Upfront pricing ensures you pay only for the exact service you select, with no hidden fees."
    },
    {
      question: "How soon can I schedule {{serviceName}} in {{areaName}}?",
      answer: "We offer flexible slots, including same-day availability depending on technician schedules in {{areaName}}."
    },
    {
      question: "Are the technicians trained for {{serviceName}}?",
      answer: "Yes, all service professionals are experienced, background-verified, and fully equipped with professional tools to execute {{serviceName}} safely."
    },
    {
      question: "Is there any warranty on {{serviceName}}?",
      answer: "Fixbro stands behind the service quality. If any issues arise from the workmanship, our support team will address it promptly."
    }
  ],
};

/**
 * Replace placeholders dynamically
 */
export function replacePlaceholders(
  template: string | undefined | null,
  data: Record<string, string | number | undefined | null>,
  isTitle: boolean = false
): string {
  if (!template) return '';

  let result = template;

  const extendedData = { ...data };

  // Auto generate category search term
  if (
    extendedData.categoryName &&
    !extendedData.categorySearchTerm
  ) {
    extendedData.categorySearchTerm =
      getCategorySearchTerm(
        String(extendedData.categoryName)
      );
  }

  try {
    for (const key in extendedData) {
      if (
        Object.prototype.hasOwnProperty.call(
          extendedData,
          key
        )
      ) {
        const value = extendedData[key];

        let replaceVal = '';
        if (Array.isArray(value)) {
          replaceVal = value.filter(Boolean).join(', ');
        } else if (value !== undefined && value !== null) {
          replaceVal = String(value);
        }

        result = result
          .replace(new RegExp(`{{${key}}}`, 'g'), replaceVal)
          .replace(new RegExp(`{${key}}`, 'g'), replaceVal);
      }
    }
  } catch (error) {
    return template;
  }

  // Clean extra spaces and duplicate separators
  result = cleanSeoString(result);

  // If it's a page title, ensure no duplicate brand suffix is appended
  if (isTitle && result) {
    result = result.replace(/\s*[|\-–]\s*Fixbro\s*$/i, '').trim();
  }
  
  return result;
}