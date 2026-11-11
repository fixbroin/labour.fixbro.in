import type { Timestamp } from '@/lib/mysqlDb';

export interface SeniorityTaxConfig {
  id: string; // e.g., "fresher", "intermediate", "advanced", "senior", "expert"
  label: string; // e.g., "Fresher / Helper", "Intermediate", "Advanced", "Senior", "Expert"
  taxType: 'inclusive' | 'exclusive';
  taxId: string; // FirestoreTax.id
  taxName?: string;
  taxPercent?: number;
}

export type GuidelineCategory = 'scope' | 'location' | 'hours' | 'payment' | 'conduct' | 'refund' | 'safety' | 'general';

export interface ServiceGuidelineRule {
  id: string;
  title: string;
  description: string;
  category?: GuidelineCategory;
  isActive: boolean;
  order: number;
}

export interface ProviderDefaultSettings {
  // Admin Markup Fee
  adminMarkupFee: number; // e.g., 200
  markupTaxType: 'inclusive' | 'exclusive';
  markupTaxId: string; // e.g., "no-tax" or tax ID from adminTaxes
  markupTaxName?: string;
  markupTaxPercent?: number;

  // Seniority Level Tax Settings
  seniorityTaxes: SeniorityTaxConfig[];

  // Job OTP Verification Controls
  requireOtpForJobStartComplete: boolean; // If enabled, provider must enter customer OTP to start & complete work

  // Cart Booking Rules Pop-up Settings
  enableCartBookingRules: boolean;
  cartRulesTitle: string;
  cartRulesSubtitle: string;
  cartRulesAgreementText: string;
  rules: ServiceGuidelineRule[];

  updatedAt?: any;
}

export const DEFAULT_GUIDELINE_RULES: ServiceGuidelineRule[] = [
  {
    id: 'rule-trade-only',
    title: 'Service Strictly Limited to Booked Trade Only',
    description: 'Technicians and providers will perform ONLY the specific trade work booked (e.g., Carpentry bookings cover carpentry tasks only). Providers will not perform other unrelated heavy manual labour, weight lifting, furniture shifting, or cleaning.',
    category: 'scope',
    isActive: true,
    order: 1,
  },
  {
    id: 'rule-single-location',
    title: 'Single Service Location Only (No Multi-Location Travel)',
    description: 'All work must take place strictly at the single booked service address. If the scheduled task finishes early, the provider will depart. Traveling to multiple locations or splitting hours between different addresses is not permitted under one booking.',
    category: 'location',
    isActive: true,
    order: 2,
  },
  {
    id: 'rule-working-hours',
    title: 'Standard Working Hours (09:30 AM – 05:30 PM)',
    description: 'Daily labour shifts consist of 7 working hours (09:30 AM – 05:30 PM) with a mandatory 1-hour lunch break (01:00 PM – 02:00 PM). Providers will not work after standard shift hours.',
    category: 'hours',
    isActive: true,
    order: 3,
  },
  {
    id: 'rule-skill-selection',
    title: 'Verified Skill Level & Quality Expectation',
    description: 'You have chosen the provider based on their transparently displayed skill level (Fresher, Intermediate, Senior, Expert). Because work is done under your direct on-site guidance, subjective "not satisfied" claims after work is completed are not eligible for refunds.',
    category: 'conduct',
    isActive: true,
    order: 4,
  },
  {
    id: 'rule-offline-bypass-ban',
    title: 'Offline Bypass & Direct Contact Strictly Prohibited',
    description: 'Directly asking for personal contact numbers, arranging off-platform side deals, or bypassing FixBro is a severe violation. Violators face immediate and permanent account bans with all future bookings blocked.',
    category: 'safety',
    isActive: true,
    order: 5,
  },
  {
    id: 'rule-no-direct-cash',
    title: 'No Direct Cash or Personal Payments to Workers',
    description: 'All payments must be made securely through FixBro. Directly giving cash or personal payments to workers is not allowed and is not supported or protected under FixBro warranties.',
    category: 'payment',
    isActive: true,
    order: 6,
  },
  {
    id: 'rule-no-show-guarantee',
    title: '100% Refund Guarantee on Provider No-Show',
    description: 'If a booked provider fails to arrive at your scheduled location, report the issue immediately by calling our customer helpline. We guarantee a prompt 100% full refund.',
    category: 'refund',
    isActive: true,
    order: 7,
  },
  {
    id: 'rule-early-completion',
    title: 'Full Day Rate Applies (No Partial Early-Finish Refunds)',
    description: 'Daily labour is reserved on a full-day commitment basis. If your assigned task is completed earlier than 05:30 PM, the full day charge still applies. Requesting partial refunds or half-day adjustments after work is done is strictly rejected.',
    category: 'refund',
    isActive: true,
    order: 8,
  },
  {
    id: 'rule-respect-dignity',
    title: 'Mutual Respect & Professional Dignity',
    description: 'Always treat service workers with courtesy and dignity ("Give respect, take respect"). Provide reasonable access to drinking water and washroom facilities during the work shift.',
    category: 'conduct',
    isActive: true,
    order: 9,
  },
  {
    id: 'rule-personal-boundaries',
    title: 'Professional Boundaries & Personal Privacy',
    description: 'Conversations and interactions must remain strictly professional. Inquiring into personal matters or crossing professional boundaries is strictly unacceptable.',
    category: 'safety',
    isActive: true,
    order: 10,
  },
];

export const DEFAULT_SENIORITY_TAXES: SeniorityTaxConfig[] = [
  {
    id: 'beginner',
    label: 'Beginner / Fresher',
    taxType: 'inclusive',
    taxId: 'no-tax',
    taxName: 'No Tax',
    taxPercent: 0,
  },
  {
    id: 'intermediate',
    label: 'Intermediate',
    taxType: 'inclusive',
    taxId: 'no-tax',
    taxName: 'No Tax',
    taxPercent: 0,
  },
  {
    id: 'advanced',
    label: 'Advanced',
    taxType: 'inclusive',
    taxId: 'no-tax',
    taxName: 'No Tax',
    taxPercent: 0,
  },
  {
    id: 'senior',
    label: 'Senior',
    taxType: 'inclusive',
    taxId: 'no-tax',
    taxName: 'No Tax',
    taxPercent: 0,
  },
  {
    id: 'expert',
    label: 'Expert',
    taxType: 'inclusive',
    taxId: 'no-tax',
    taxName: 'No Tax',
    taxPercent: 0,
  },
];

export const DEFAULT_PROVIDER_DEFAULT_SETTINGS: ProviderDefaultSettings = {
  adminMarkupFee: 200,
  markupTaxType: 'inclusive',
  markupTaxId: 'no-tax',
  markupTaxName: 'No Tax',
  markupTaxPercent: 0,
  seniorityTaxes: DEFAULT_SENIORITY_TAXES,
  requireOtpForJobStartComplete: true,
  enableCartBookingRules: true,
  cartRulesTitle: 'Daily Labour Booking Guidelines & Rules',
  cartRulesSubtitle: 'Please review and accept our daily labour service terms before proceeding to checkout.',
  cartRulesAgreementText: 'I have read, understood, and agree to these daily labour guidelines & terms.',
  rules: DEFAULT_GUIDELINE_RULES,
};
