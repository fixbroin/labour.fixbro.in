export interface JoinProviderFaq {
  question: string;
  answer: string;
}

export interface JoinProviderPageSettings {
  // SEO & Meta
  pageTitle: string;
  metaDescription: string;
  metaKeywords: string;
  canonicalUrl: string;

  // Hero Section
  heroBadge: string;
  heroHeadline: string;
  heroSubtitle: string;
  heroCtaText: string;
  heroCtaLink: string;
  heroSecondaryCtaText: string;
  heroSecondaryCtaLink: string;
  heroBannerImage?: string;

  // Key Statistics
  stats: {
    stat1Number: string;
    stat1Label: string;
    stat2Number: string;
    stat2Label: string;
    stat3Number: string;
    stat3Label: string;
    stat4Number: string;
    stat4Label: string;
  };

  // Radius & Dispatch Section
  radiusSectionBadge: string;
  radiusSectionTitle: string;
  radiusSectionDescription: string;
  radiusCardTitle: string;
  radiusCardDescription: string;
  radiusDefaultKm: number;

  // Flexibility (Online / Offline Toggle)
  flexibilityCardTitle: string;
  flexibilityCardDescription: string;
  flexibilityOnlineBadgeText: string;
  flexibilityOfflineBadgeText: string;

  // Commission & Payout Section
  commissionSectionBadge: string;
  commissionSectionTitle: string;
  commissionSectionDescription: string;

  // Online Payout Rules
  onlinePayoutTitle: string;
  onlinePayoutDescription: string;
  onlinePayoutTimelineDays: number; // e.g. 3

  // Cash / Pay After Service Rules
  cashPaymentTitle: string;
  cashPaymentDescription: string;

  // Minimum Wallet Balance Rules
  walletRulesTitle: string;
  walletRulesDescription: string;

  // Work Expectations & Area Indexing Policy
  expectationsBadge: string;
  expectationsTitle: string;
  expectationsDescription: string;
  expectationsPoint1Title: string;
  expectationsPoint1Desc: string;
  expectationsPoint2Title: string;
  expectationsPoint2Desc: string;

  // Online / Offline Responsibility & Cancellation Penalty Policy
  penaltySectionBadge: string;
  penaltySectionTitle: string;
  penaltySectionDescription: string;
  penaltyRule1Title: string;
  penaltyRule1Desc: string;
  penaltyRule2Title: string;
  penaltyRule2Desc: string;
  penaltyPercentage: number; // e.g. 100

  // 4 Mandatory Registration Steps
  stepsSectionBadge: string;
  stepsSectionTitle: string;
  stepsSectionDescription: string;
  step1Title: string;
  step1Desc: string;
  step2Title: string;
  step2Desc: string;
  step3Title: string;
  step3Desc: string;
  step4Title: string;
  step4Desc: string;

  // Categories Job Directory Section
  categorySectionBadge: string;
  categorySectionTitle: string;
  categorySectionDescription: string;
  categoryKeywordTemplate: string;
  categoryCardCtaText: string;

  // FAQs
  faqs: JoinProviderFaq[];

  // Bottom CTA Banner
  bottomCtaTitle: string;
  bottomCtaSubtitle: string;
  bottomCtaButtonText: string;
}

export const DEFAULT_JOIN_PROVIDER_SETTINGS: JoinProviderPageSettings = {
  pageTitle: "Join as a Service Provider & Partner | Local Jobs Near Me in Carpentry, TV Installation, Plumbing, Electrical & More",
  metaDescription: "Looking for carpenter jobs near me, plumber jobs near me, or TV installation work? Register with Fixbro in Bangalore & across India. Get verified customer bookings dispatched to your local radius, flexible online/offline schedule, and earnings withdrawal within 3 days.",
  metaKeywords: "carpenter job near me, carpentry work near me, join carpentry service work, join carpentry category provider, plumber job near me, plumbing work near me, join plumbing category provider, TV installation job near me, TV installation work near me, join TV installation category provider, electrician job near me, electrical work near me, interior carpenter job near me, AC technician job near me, appliance repair job near me, home service partner registration Bangalore, handyman jobs near me India",
  canonicalUrl: "https://fixbro.in/join-provider",

  heroBadge: "Join Fixbro Partner Network",
  heroHeadline: "Grow Your Earnings with Daily Home Service Jobs in Your Area",
  heroSubtitle: "Register as an independent service provider. Receive customer bookings within your local service radius, enjoy flexible working hours with our Online/Offline toggle, and withdraw earnings directly to your bank account within 3 business days.",
  heroCtaText: "Register as a Provider",
  heroCtaLink: "/provider-registration",
  heroSecondaryCtaText: "Explore Category Jobs",
  heroSecondaryCtaLink: "#category-jobs",
  heroBannerImage: "/default-hero.jpg",

  stats: {
    stat1Number: "10,000+",
    stat1Label: "Bookings Dispatched",
    stat2Number: "3 Days",
    stat2Label: "Direct Bank Payouts",
    stat3Number: "100%",
    stat3Label: "Schedule Flexibility",
    stat4Number: "₹0",
    stat4Label: "Registration Fee",
  },

  radiusSectionBadge: "Smart Work Dispatch",
  radiusSectionTitle: "Work Locally Within Your Chosen Service Radius",
  radiusSectionDescription: "Save travel time and fuel costs. Our intelligent automated dispatch matches you with verified customer bookings located strictly within your configured service radius.",
  radiusCardTitle: "Radius-Based Location Matching",
  radiusCardDescription: "After joining, you set your base location and service radius. Fixbro automatically delivers customer bookings happening in your immediate neighborhood. No long commutes—only high-margin local jobs.",
  radiusDefaultKm: 10,

  flexibilityCardTitle: "1-Click Online / Offline Toggle",
  flexibilityCardDescription: "You are in complete control of your schedule. When ready for work, switch to 'Online' to receive job requests. If you have personal work or other commitments, simply tap 'Offline' anytime with zero penalties.",
  flexibilityOnlineBadgeText: "Online - Receiving Bookings",
  flexibilityOfflineBadgeText: "Offline - Resting / Busy",

  commissionSectionBadge: "Fair & Transparent Earnings",
  commissionSectionTitle: "Clear Commission, Fast Withdrawals & Zero Hidden Charges",
  commissionSectionDescription: "Understand exactly how your earnings are calculated, settled, and deposited into your account.",

  onlinePayoutTitle: "Online Paid Bookings: Withdraw Earnings in 3 Days",
  onlinePayoutDescription: "When customers pay online (via UPI, Card, or Netbanking), Fixbro deducts only the transparent platform commission ({commission}). Once the booking is completed, all details and net earnings become visible on your Earnings Page under Withdrawable Balance. Raise a withdrawal request anytime, and funds are credited directly to your bank account within 3 business days (72 hours).",
  onlinePayoutTimelineDays: 3,

  cashPaymentTitle: "Pay After Service: Collect 100% Cash On-Site",
  cashPaymentDescription: "For 'Pay After Service' bookings, you collect the total cash directly from the customer upon completing the work. The platform fee and commission are automatically settled and deducted from your prepaid wallet balance.",

  walletRulesTitle: "Prepaid Wallet Minimum Balance: {currency}{min_wallet_balance}",
  walletRulesDescription: "To maintain active job dispatch and receive new booking alerts, you must maintain a minimum balance of {currency}{min_wallet_balance} in your prepaid wallet. If your wallet balance drops below this threshold, booking alerts are temporarily paused until you top up your wallet.",

  // Work Expectations & Area Indexing
  expectationsBadge: "Work Expectations & Timelines",
  expectationsTitle: "How Bookings Arrive in Your Neighborhood",
  expectationsDescription: "Please note: Once you register and your application is approved, immediate work is not guaranteed in every pincode. Booking volume depends on local customer demand and search engine indexing.",
  expectationsPoint1Title: "Area Indexing & Demand Ramp-Up",
  expectationsPoint1Desc: "Google and search engines take time to index new service areas. In high-demand central zones, bookings may arrive immediately. In newly launched areas, it may take a few days or weeks for organic bookings to build up.",
  expectationsPoint2Title: "No False Guarantees, Real Jobs Only",
  expectationsPoint2Desc: "We do not create fake bookings or make false promises. Every booking dispatched to you is a genuine, verified customer looking for doorstep service in your radius.",

  // Online / Offline Responsibility & Penalty Policy
  penaltySectionBadge: "Strict Online / Offline Rules",
  penaltySectionTitle: "How Bookings Arrive & Why You Must Turn OFF When Away",
  penaltySectionDescription: "Bookings take time to arrive—sometimes right away, sometimes in a few days or 10 days. If you are waiting, bored, or going somewhere else, turn OFF your Online status immediately. Never assume no bookings will come.",
  penaltyRule1Title: "Going Somewhere or Not Ready? Turn OFF Immediately",
  penaltyRule1Desc: "Bookings can arrive unexpectedly at any time. If you wait and see no bookings, do NOT think: 'No booking came for 10 days, so none will come today' and leave your status Online while you go somewhere else! If you are busy, going out, or bored of waiting, turn OFF the Online button right away. If you have no active bookings, you can turn OFF anytime instantly. To avoid receiving new bookings tomorrow, turn it OFF 1 day in advance.",
  penaltyRule2Title: "100% Penalty for Refusing a Sudden Booking While Online",
  penaltyRule2Desc: "When your status is 'Online', our system assumes you are waiting with your tools and ready for work. If a customer booking suddenly arrives, you MUST take and complete that work. You cannot reject or abandon it because you went somewhere else or thought no work would come. Abandoning a booking while marked Online results in a penalty of up to {penalty_percentage}% of the booking amount. If you already have an assigned booking, you must complete it before turning offline.",
  penaltyPercentage: 100,

  // 4 Mandatory Registration Steps
  stepsSectionBadge: "Mandatory Onboarding",
  stepsSectionTitle: "Complete All 4 Registration Steps to Get Approved",
  stepsSectionDescription: "Your application will only be reviewed and approved once all 4 mandatory steps are completed. Incomplete applications cannot be activated.",
  step1Title: "Step 1: Category & Skills",
  step1Desc: "Select your primary service categories (Carpentry, Plumbing, Electrical, etc.) and describe your work experience.",
  step2Title: "Step 2: Personal Information",
  step2Desc: "Provide your full name, profile photo, verified mobile number, and permanent home address.",
  step3Title: "Step 3: KYC Verification",
  step3Desc: "Upload clear photos of government ID proof (Aadhaar Card, Voter ID, or Driving License) for partner background verification.",
  step4Title: "Step 4: Location Radius & Bank/UPI",
  step4Desc: "Set your operational service radius (in KM) and enter your Bank Account or UPI ID to receive weekly earnings payouts.",

  categorySectionBadge: "Every Category Jobs",
  categorySectionTitle: "Find Jobs & Register in Your Service Category",
  categorySectionDescription: "Explore verified work opportunities across every trade. Click any category to register directly and start receiving customer bookings.",
  categoryKeywordTemplate: "Join {category} Category Provider | {category} Job Near Me | {category} Work Opportunities",
  categoryCardCtaText: "Join as {category} Pro",

  faqs: [
    {
      question: "Will I get bookings immediately after my verification is approved?",
      answer: "Immediate work is not guaranteed in every area. While high-demand neighborhoods may receive bookings right away, other areas require time for search engines to index your service zone and for customer demand to ramp up. Bookings will steadily flow as your area gets established."
    },
    {
      question: "What if no bookings arrive for 10 days? Can I stay Online while I go somewhere else?",
      answer: "No! Customer bookings are unpredictable—sometimes jobs arrive right away, and other times they take a week or 10 days. If you get bored of waiting or need to go somewhere, simply turn OFF your Online status before you leave. Never leave it Online assuming no work will arrive. If a booking suddenly comes while you are marked Online and you cannot attend it, a strict penalty of up to {penalty_percentage}% applies."
    },
    {
      question: "When can I turn OFF my Online status?",
      answer: "If you have NO active or scheduled bookings, you can switch to 'Offline' anytime instantly with zero penalty. If you want to make sure you receive no bookings tomorrow, switch to Offline 1 day in advance. However, if a customer booking is already assigned to you, you must complete that job first."
    },
    {
      question: "What happens if I abandon or reject a booking while marked 'Online'?",
      answer: "Because Fixbro gives you an instant Online / Offline toggle, you must only stay Online when you are physically ready to take work. If a customer booking is dispatched while you are Online, you MUST complete it. Refusing or abandoning it incurs up to a {penalty_percentage}% penalty of the booking amount and risks account suspension."
    },
    {
      question: "Why must I complete all 4 registration steps?",
      answer: "Our onboarding team only reviews fully completed applications. You must finish Step 1 (Category selection), Step 2 (Personal information), Step 3 (KYC verification), and Step 4 (Service radius & Bank details) so we can activate your account and configure automated dispatch."
    },
    {
      question: "How does the platform commission and earnings payout work?",
      answer: "Fixbro charges a simple, transparent commission of {commission} per completed job. For online paid bookings, the commission is automatically deducted upon completion. Your net earnings appear on your Earnings Page under Withdrawable Balance. You can raise a withdrawal request anytime, and the amount is credited directly to your bank account within 3 business days. For cash bookings, you collect 100% cash from the customer on-site, and the commission is deducted from your prepaid wallet."
    },
    {
      question: "Why do I need to maintain a minimum wallet balance?",
      answer: "For cash (Pay After Service) bookings, the system auto-deducts the platform commission from your prepaid wallet. To ensure uninterrupted job dispatch, you must maintain at least {currency}{min_wallet_balance} in your wallet. If the balance falls below this limit, new booking alerts are paused until topped up."
    }
  ],

  bottomCtaTitle: "Ready to Start Earning with Fixbro?",
  bottomCtaSubtitle: "Join hundreds of successful service technicians in Bangalore and across India. Complete all 4 registration steps today and get verified within 24 hours.",
  bottomCtaButtonText: "Complete All 4 Registration Steps"
};
