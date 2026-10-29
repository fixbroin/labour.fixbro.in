// src/lib/seoGenerator.ts
import { cleanServiceName, getCategorySearchTerm, prioritizeCategoryNames } from './seoAdvancedUtils';

interface SeoPlaceholderData {
  cityName: string;
  areaName?: string;
  categoryName?: string;
  serviceName?: string;
  nearbyAreas?: Array<{ id: string; name: string; slug: string }>;
}

interface CoordsArea {
  id: string;
  name: string;
  slug: string;
  latitude?: number | string;
  longitude?: number | string;
}

export function getNearbyAreasSorted(
  selectedArea: { latitude?: number | string; longitude?: number | string } | null | undefined,
  allAreas: CoordsArea[],
  maxCount: number = 10
): Array<{ id: string; name: string; slug: string }> {
  if (!selectedArea) {
    return allAreas.slice(0, maxCount).map(a => ({ id: a.id, name: a.name, slug: a.slug }));
  }

  const lat1 = typeof selectedArea.latitude === 'string' ? parseFloat(selectedArea.latitude) : selectedArea.latitude;
  const lon1 = typeof selectedArea.longitude === 'string' ? parseFloat(selectedArea.longitude) : selectedArea.longitude;

  if (lat1 === undefined || lat1 === null || isNaN(lat1) || lon1 === undefined || lon1 === null || isNaN(lon1)) {
    return allAreas.slice(0, maxCount).map(a => ({ id: a.id, name: a.name, slug: a.slug }));
  }

  const areasWithDistance = allAreas
    .map(area => {
      const lat2 = typeof area.latitude === 'string' ? parseFloat(area.latitude) : area.latitude;
      const lon2 = typeof area.longitude === 'string' ? parseFloat(area.longitude) : area.longitude;

      if (lat2 === undefined || lat2 === null || isNaN(lat2) || lon2 === undefined || lon2 === null || isNaN(lon2)) {
        return { area, distance: Infinity };
      }

      const R = 6371; // Radius of Earth in km
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const aVal =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
      const distance = R * c;

      return { area, distance };
    })
    .filter(item => item.distance !== Infinity && item.area.id !== (selectedArea as any).id)
    .sort((a, b) => a.distance - b.distance);

  return areasWithDistance.slice(0, maxCount).map(item => ({
    id: item.area.id,
    name: item.area.name,
    slug: item.area.slug
  }));
}

const NEARBY_AREAS_MAP: Record<string, string[]> = {
  'byrathi': ['Hennur', 'Thanisandra', 'Horamavu', 'Kothanur', 'Geddalahalli', 'Kalyan Nagar', 'Kammanahalli', 'Babusapalya', 'Chikka Gubbi', 'Anagalapura'],
  'electronic-city': ['HSR Layout', 'Singasandra', 'Bommanahalli', 'Begur', 'Parappana Agrahara', 'Jayamahal', 'Kudlu Gate', 'Jigani', 'Chandapura', 'Huskur'],
  'hsr-layout': ['Koramangala', 'BTM Layout', 'Bellandur', 'Singasandra', 'Electronic City', 'Madiwala', 'Sarjapur Road', 'AECS Layout', 'Kudlu Gate', 'Bommanahalli'],
  'whitefield': ['Marathahalli', 'AECS Layout', 'Kadugodi', 'Hoodi', 'Varthur', 'Brookefield', 'Kundalahalli', 'Mahadevapura', 'Garudacharpalya', 'Nallurhalli'],
  'aecs-layout': ['Whitefield', 'Marathahalli', 'Brookefield', 'Kundalahalli', 'Varthur', 'Hoodi', 'Kadugodi', 'Mahadevapura', 'Doddanekundi', 'HAL'],
  'marathahalli': ['Whitefield', 'AECS Layout', 'Bellandur', 'HAL', 'Kadubeesanahalli', 'Brookefield', 'Kundalahalli', 'Doddanekundi', 'Yamalur', 'Munnekolala'],
  'indiranagar': ['Domlur', 'Ulsoor', 'CV Raman Nagar', 'Kalyan Nagar', 'HAL Road', 'Koramangala', 'Cox Town', 'Frazer Town', 'Benson Town', 'Jeevanbheemanagar']
};

export function getSpinnedLocalContent(data: SeoPlaceholderData & { templateIdx?: number }): string {
  const { cityName, areaName = '', categoryName = '', serviceName = '', nearbyAreas, templateIdx } = data;
  
  const idx = typeof templateIdx === 'number' ? (Math.abs(templateIdx) % 10) : Math.floor(Math.random() * 10);
  const targetLabel = (serviceName ? cleanServiceName(serviceName) : '') || (categoryName ? getCategorySearchTerm(categoryName) : 'Home Services');
  const locationLabel = areaName || cityName;

  // Resolve nearby area list dynamically
  let nearbyList: string[] = [];
  if (nearbyAreas && nearbyAreas.length > 0) {
    nearbyList = nearbyAreas.map(a => a.name);
  } else {
    const cleanAreaKey = areaName.toLowerCase().replace(/[^a-z0-9]/g, '');
    nearbyList = NEARBY_AREAS_MAP[cleanAreaKey] || ['nearby neighborhoods', 'adjacent sectors', 'surrounding areas'];
  }
  
  const formattedAreas = nearbyList.slice(0, 10).join(', ');

  // 1. Subheadlines (10 distinct options)
  const subheadlines = [
    `${targetLabel} Services in ${locationLabel}, ${cityName}`,
    `Professional ${targetLabel} Solutions Across ${locationLabel}`,
    `On-Demand ${targetLabel} in ${locationLabel} | Verified Technicians`,
    `Premium Doorstep ${targetLabel} in ${locationLabel} Near You`,
    `Reliable ${targetLabel} Experts in ${locationLabel}, ${cityName}`,
    `Top-Rated ${targetLabel} Services Near You in ${locationLabel}`,
    `Fast & Affordable ${targetLabel} in ${locationLabel}`,
    `Certified ${targetLabel} Specialists Serving ${locationLabel}`,
    `Best ${targetLabel} Support in ${locationLabel}, ${cityName}`,
    `Expert ${targetLabel} Assistance at Your Doorstep in ${locationLabel}`
  ];

  // 2. Main Paragraphs (Part 1 - 10 distinct variations)
  const paragraph1List = [
    `Need professional ${targetLabel} services in ${locationLabel}? Fixbro connects customers with trusted local experts who provide reliable service solutions for homes, apartments, offices, retail shops, and commercial properties throughout ${locationLabel} and neighbouring areas like ${formattedAreas}.`,
    `Looking for certified ${targetLabel} specialists near you in ${locationLabel}? Fixbro brings you background-verified trade experts equipped with advanced tools to handle home maintenance, retail support, and corporate installations around ${locationLabel} and neighbouring localities like ${formattedAreas}.`,
    `If you are searching for high-quality ${targetLabel} in ${locationLabel}, our digital booking platform offers instant scheduling. Fixbro connects you with skilled pros serving residential complexes, offices, and retail properties in ${locationLabel} as well as adjacent sectors including ${formattedAreas}.`,
    `Get verified doorstep assistance for ${targetLabel} in ${locationLabel}. Fixbro bridges the gap between home-owners and certified service professionals, delivering premium quality solutions across the entire ${locationLabel} region and surrounding areas like ${formattedAreas}.`,
    `Searching for dependable ${targetLabel} in ${locationLabel}, ${cityName}? Our platform connects you with vetted, background-checked specialists ready to handle jobs of any size across ${locationLabel} and nearby communities such as ${formattedAreas}.`,
    `Fixbro is your trusted destination for on-demand ${targetLabel} in ${locationLabel}. We connect residents and business owners with skilled technicians who deliver top-tier service across ${locationLabel} and adjacent neighborhoods including ${formattedAreas}.`,
    `Enjoy seamless, hassle-free booking for ${targetLabel} in ${locationLabel}. Our verified specialists arrive fully equipped to provide durable installations, quick fixes, and routine servicing across ${locationLabel} and nearby locations like ${formattedAreas}.`,
    `When you need prompt and certified ${targetLabel} in ${locationLabel}, Fixbro delivers. We provide fast doorstep service for homes, apartments, and commercial facilities throughout ${locationLabel} and surrounding parts of ${cityName} such as ${formattedAreas}.`,
    `Experience five-star ${targetLabel} right at your doorstep in ${locationLabel}. Fixbro partners with background-verified professionals serving residential and commercial properties in ${locationLabel} and adjacent sectors including ${formattedAreas}.`,
    `Get connected with skilled technicians for all your ${targetLabel} needs in ${locationLabel}, ${cityName}. From urgent repairs to scheduled maintenance, our pros cater to residences and offices across ${locationLabel} and nearby areas like ${formattedAreas}.`
  ];

  // Main Paragraphs (Part 2 - 10 distinct variations)
  const paragraph2List = [
    `Our local professionals understand the service requirements of customers in ${locationLabel} and provide prompt assistance, quality workmanship, and convenient scheduling options. From small repairs to complete installations and maintenance projects, we help ensure every job is completed efficiently.`,
    `Every trade expert in ${locationLabel} is vetted for quality and safety. We understand that your time is valuable, which is why we offer flexible booking slots, same-day emergency options, and fixed upfront rates with zero hidden charges.`,
    `Our dedicated service crews in ${locationLabel} deliver standard-setting workmanship using premium grade materials. Whether it is a minor fix or an extensive remodel, our team ensures complete reliability and a post-service cleanup.`,
    `With thousands of successfully completed service calls in ${locationLabel}, we focus on customer satisfaction above all else. Benefit from quick turnaround times, friendly customer support, and warranty coverage on all repairs.`,
    `We take pride in transparent pricing and professional execution across ${locationLabel}. Our experts carry standard safety gear and precision instruments, ensuring high durability and complete peace of mind.`,
    `Convenience and reliability are at the core of our service in ${locationLabel}. Book your preferred time slot online, track your technician, and enjoy upfront fixed quotes with zero hidden surprises.`,
    `All services in ${locationLabel} are backed by our dedicated customer care and service warranty. Our pros strictly adhere to industry safety guidelines and leave your premises neat and clean after work completion.`,
    `Whether you need routine tune-ups or precision installations in ${locationLabel}, our technicians are equipped with modern gear and authentic parts to deliver lasting results on every visit.`,
    `Customer trust is our highest priority in ${locationLabel}. That is why we enforce stringent background verification, skill checks, and transparent flat-rate pricing for all home and commercial service calls.`,
    `Save time and avoid hassle with our streamlined booking workflow in ${locationLabel}. Get fast doorstep response, certified technicians, and responsive customer service for every task.`
  ];

  // 3. Highlight Cards (10 sets, 3 cards each)
  const highlightCards = [
    [
      { title: "Local Experts", subtitle: `Professionals serving ${locationLabel} and nearby locations like ${nearbyList.slice(0, 3).join(', ')}.` },
      { title: "Fast Response", subtitle: "Quick service scheduling and local availability." },
      { title: "Trusted Service", subtitle: "Reliable workmanship and customer-focused support." }
    ],
    [
      { title: "Certified Vetted Pros", subtitle: `Highly skilled specialists operating in ${locationLabel} and ${nearbyList.slice(0, 3).join(', ')}.` },
      { title: "Upfront Fixed Pricing", subtitle: "Clear transparent invoices with zero hidden charges." },
      { title: "Satisfaction Guaranteed", subtitle: "Enjoy comprehensive warranties and friendly after-service support." }
    ],
    [
      { title: "Experienced Techs", subtitle: `Background-verified trade professionals covering ${locationLabel} and ${nearbyList.slice(0, 3).join(', ')}.` },
      { title: "Same-Day Bookings", subtitle: "Flexible time slots suited to your busy calendar." },
      { title: "Standard Quality Tools", subtitle: "We use only premium materials and modern tools for repair work." }
    ],
    [
      { title: "Doorstep Assistance", subtitle: `Prompt local technicians serving ${locationLabel} and surrounding sectors like ${nearbyList.slice(0, 3).join(', ')}.` },
      { title: "Online Confirmations", subtitle: "Instant booking verification and live status notifications." },
      { title: "Clean & Professional", subtitle: "Our crews maintain neatness and follow post-service cleaning protocols." }
    ],
    [
      { title: "Verified Technicians", subtitle: `Rigorous background checks on all crews operating across ${locationLabel}.` },
      { title: "Transparent Billing", subtitle: "Fixed rate cards with detailed breakdowns before starting any task." },
      { title: "Quality Workmanship", subtitle: "Strict quality benchmarks and verified post-service safety checks." }
    ],
    [
      { title: "Rapid Turnaround", subtitle: `Quick transit to residences across ${locationLabel} and ${nearbyList.slice(0, 3).join(', ')}.` },
      { title: "Skilled Tradesmen", subtitle: "Trained specialists equipped to handle complex service requirements." },
      { title: "Convenient Booking", subtitle: "Instant digital reservations with real-time status updates." }
    ],
    [
      { title: "Precision Execution", subtitle: `Accurate measurements and durable repairs in ${locationLabel}.` },
      { title: "Authentic Materials", subtitle: "Only genuine, brand-approved parts and high-grade consumables used." },
      { title: "Service Warranty", subtitle: "Protected by our satisfaction guarantee and dedicated aftercare." }
    ],
    [
      { title: "Flexible Slots", subtitle: "Book morning, afternoon, or evening slots fitting your routine." },
      { title: "Courteous Crews", subtitle: "Polite, uniformed technicians who respect your home and property." },
      { title: "Spotless Cleanup", subtitle: "Thorough cleanup following every repair and installation job." }
    ],
    [
      { title: "Punctual Arrival", subtitle: `Reliable on-time arrival across ${locationLabel} and ${nearbyList.slice(0, 3).join(', ')}.` },
      { title: "Upfront Estimates", subtitle: "No surprise costs — approve work only after reviewing clear quotes." },
      { title: "Dedicated Helpdesk", subtitle: "Round-the-clock customer support for inquiries and follow-ups." }
    ],
    [
      { title: "Top-Rated Service", subtitle: `Backed by 5-star customer ratings across ${locationLabel}.` },
      { title: "Safety Standardized", subtitle: "Strict adherence to electrical, structural, and hygiene protocols." },
      { title: "Digital Invoicing", subtitle: "Instant digital receipts and warranty cards sent directly to your phone." }
    ]
  ];

  // 4. Benefits Section (10 sets, 6 items each)
  const benefitsLists = [
    [
      `Dedicated local service professionals in ${locationLabel}`,
      `Faster arrival and response times across ${locationLabel}`,
      `Flexible appointment scheduling for your convenience`,
      `Residential and commercial support in ${locationLabel}`,
      `Professional tools and equipment for precise execution`,
      `Reliable service quality standards and warranty`
    ],
    [
      `Fully vetted and background-checked technicians`,
      `Prompt doorstep response in ${locationLabel} and surrounding sectors`,
      `Upfront estimates with zero hidden billing items`,
      `Comprehensive warranty coverage on all parts and labor`,
      `Certified experts specializing in standard home installations`,
      `Emergency booking slots for same-day repair needs`
    ],
    [
      `Skilled trade workers stationed locally in ${locationLabel}`,
      `Quick transit times to ${nearbyList.slice(0, 3).join(', ')}`,
      `Transparent fixed billing with online invoices`,
      `Flexible timing tailored to fit your busy schedule`,
      `Use of premium-grade replacement parts and materials`,
      `100% customer satisfaction guarantee on all service calls`
    ],
    [
      `Friendly customer care and after-service assistance`,
      `Technicians equipped with state-of-the-art tools`,
      `Doorstep service covering homes, shops, and offices in ${locationLabel}`,
      `Clean-up protocols followed after every job completion`,
      `Affordable local rates with online booking discounts`,
      `Certified specialists with decades of cumulative trade experience`
    ],
    [
      `Strict background checks and verified photo IDs`,
      `Fast coverage across ${locationLabel} and nearby communities`,
      `Upfront quote approval before any work commences`,
      `Guaranteed workmanship with rework coverage`,
      `High-durability repairs using industrial-grade materials`,
      `Multi-slot booking availability including weekends`
    ],
    [
      `Hyper-local professionals who know ${locationLabel} well`,
      `Minimal wait times and real-time technician coordination`,
      `Direct digital invoicing with transparent rate cards`,
      `Full warranty protection on all repairs and installations`,
      `Expertise across residential and corporate spaces`,
      `Post-job safety checks and debris clearance`
    ],
    [
      `Certified trade mechanics with verified qualifications`,
      `Service radius covering ${locationLabel} and ${nearbyList.slice(0, 3).join(', ')}`,
      `No hidden surcharges or surprise travel fees`,
      `Prompt post-service customer assistance and warranty`,
      `Advanced diagnostics and modern precision gear`,
      `Customized maintenance plans for gated complexes`
    ],
    [
      `Experienced hands for intricate repair and mounting work`,
      `Punctual arrival with pre-visit phone confirmation`,
      `Competitive flat-rate pricing with zero surge fees`,
      `Peace of mind with comprehensive service guarantees`,
      `Safe handling of delicate equipment and home interiors`,
      `Instant booking confirmation via SMS and email`
    ],
    [
      `Vetted craftsmen with rigorous skill validation`,
      `Swift travel across ${locationLabel} and adjacent zones`,
      `Itemized billing with online payment or Pay After Service`,
      `30-day workmanship warranty on all completed jobs`,
      `Heavy-duty tools for clean and silent execution`,
      `Responsive resolution team for prompt aftercare`
    ],
    [
      `Dedicated local teams serving ${locationLabel} 7 days a week`,
      `Rapid dispatch for time-sensitive home repairs`,
      `Transparent upfront estimates with clear scope of work`,
      `Reliable warranty support backed by Fixbro`,
      `Uniformed, polite, and background-cleared specialists`,
      `Full cleanliness inspection before signing off`
    ]
  ];

  // 5. Serving Customers (Part 3 & 4 - 10 distinct variations)
  const paragraph3List = [
    `We help customers in apartments, independent houses, villas, gated communities, office spaces, retail outlets, and commercial buildings throughout ${locationLabel} with dependable ${targetLabel} services.`,
    `Our network covers independent homes, high-rise apartments, retail shops, business centers, corporate offices, and gated communities throughout ${locationLabel}.`,
    `We extend our services to residential complexes, villa associations, corporate hubs, showrooms, and retail stores situated in ${locationLabel} and neighbouring sectors.`,
    `Whether you live in a gated community, manage a corporate office space, or run a retail showroom in ${locationLabel}, our technicians are ready to assist you.`,
    `From standalone homes and high-rise condominiums to tech parks and retail stores across ${locationLabel}, we cater to diverse service requirements with tailored solutions.`,
    `Our verified trade pros regularly serve residential societies, modern apartments, independent duplexes, and commercial office hubs situated throughout ${locationLabel}.`,
    `Whether it is a residential flat in ${locationLabel}, a commercial showroom, or an office space, our technicians deliver prompt and consistent workmanship.`,
    `Serving gated townships, residential layouts, educational institutions, and corporate facilities across ${locationLabel} with dependable doorstep assistance.`,
    `Homeowners, landlords, tenants, and business managers in ${locationLabel} rely on Fixbro for scheduled maintenance and urgent repair services.`,
    `We cater to all property types across ${locationLabel}, including studio apartments, luxury villas, commercial offices, and neighborhood retail establishments.`
  ];

  const paragraph4List = [
    `If you are searching for trusted ${targetLabel} near ${locationLabel}, ${cityName}, Fixbro helps you connect with experienced professionals for quality service and dependable support.`,
    `For anyone seeking reliable ${targetLabel} near me in ${locationLabel}, our certified technicians provide fast, professional, and friendly assistance.`,
    `Get connected to the best ${targetLabel} near you in ${locationLabel} today. Experience standard-setting doorstep maintenance with Fixbro.`,
    `Searching for affordable ${targetLabel} near you in ${locationLabel}? Look no further. Fixbro guarantees high-quality repairs with maximum convenience.`,
    `Choose Fixbro for top-notch ${targetLabel} near ${locationLabel}, ${cityName}. Book online in under two minutes and enjoy seamless doorstep service.`,
    `Need quick and dependable ${targetLabel} in ${locationLabel}? Book your trusted local pro with Fixbro today and get upfront fixed pricing.`,
    `Discover five-star rated ${targetLabel} near you in ${locationLabel}. Experience punctual arrivals, expert workmanship, and reliable warranties.`,
    `For top-rated ${targetLabel} in ${locationLabel}, ${cityName}, trust Fixbro for guaranteed satisfaction and hassle-free scheduling.`,
    `Connect with vetted ${targetLabel} experts near you in ${locationLabel} today. Enjoy quick service, upfront pricing, and friendly support.`,
    `Find the most reliable ${targetLabel} near you in ${locationLabel}. Fixbro delivers quality trade solutions directly to your doorstep.`
  ];

  const selectedSubheadline = subheadlines[idx];
  const selectedP1 = paragraph1List[idx];
  const selectedP2 = paragraph2List[idx];
  const selectedCards = highlightCards[idx];
  const selectedBenefits = benefitsLists[idx];
  const selectedP3 = paragraph3List[idx];
  const selectedP4 = paragraph4List[idx];

  return `
<div class="space-y-8 text-slate-700">
  <!-- Subheadline -->
  <p class="text-md font-semibold text-slate-500 tracking-wide uppercase">${selectedSubheadline}</p>

  <!-- Paragraphs -->
  <div class="space-y-4">
    <p class="leading-relaxed text-slate-600">${selectedP1}</p>
    <p class="leading-relaxed text-slate-600">${selectedP2}</p>
  </div>

  <!-- Highlight Cards -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-100">
    ${selectedCards.map(card => `
      <div class="space-y-2">
        <h4 class="font-bold text-slate-900 text-base">${card.title}</h4>
        <p class="text-sm text-slate-500 leading-relaxed">${card.subtitle}</p>
      </div>
    `).join('')}
  </div>

  <!-- Benefits Section -->
  <div class="space-y-4">
    <h3 class="text-lg font-bold text-slate-900">Benefits of Booking in ${locationLabel}</h3>
    <ul class="grid grid-cols-1 md:grid-cols-2 gap-2 list-none pl-0">
      ${selectedBenefits.map(benefit => `
        <li class="flex items-center text-sm text-slate-600">
          <span class="text-green-500 mr-2 font-bold">✓</span>
          ${benefit}
        </li>
      `).join('')}
    </ul>
  </div>

  <!-- Serving Section -->
  <div class="space-y-4 pt-4 border-t border-slate-100">
    <h3 class="text-lg font-bold text-slate-900">Serving Customers Across ${locationLabel}</h3>
    <p class="leading-relaxed text-slate-600">${selectedP3}</p>
    <p class="leading-relaxed text-slate-600">${selectedP4}</p>
  </div>
</div>
  `.trim();
}

export function generateFreeCitySeoData(cityName: string, categoryNames: string[], nearbyAreas?: Array<{ id: string; name: string; slug: string }>) {
  const idx = Math.floor(Math.random() * 10);
  const prioritizedCats = prioritizeCategoryNames(categoryNames);
  const topCats = prioritizedCats.slice(0, 5);
  const cat1 = topCats[0] || 'Carpentry';
  const cat2 = topCats[1] || 'TV Installation';
  const cat3 = topCats[2] || 'Interior';
  const trade1 = getCategorySearchTerm(cat1);
  const trade2 = getCategorySearchTerm(cat2);
  const trade3 = getCategorySearchTerm(cat3);
  const catsText = topCats.length > 0 ? topCats.join(', ') : "Carpentry, TV Installation, Interior";
  const tradesText = [trade1, trade2, trade3].join(', ');

  const areaList = nearbyAreas ? nearbyAreas.map(a => a.name) : [];
  const formattedAreas = areaList.slice(0, 10).join(', ');
  const localCoverageText = formattedAreas ? ` covering areas like ${formattedAreas}` : '';

  // 10 H1 Templates (home services + category names)
  const h1Templates = [
    `Home Services in ${cityName}`,
    `${trade1}, ${trade2} & Home Services in ${cityName}`,
    `Home Services & Repair in ${cityName}`,
    `Doorstep Home Services in ${cityName}`,
    `Professional Home Services in ${cityName}`,
    `${tradesText} & Home Services in ${cityName}`,
    `Top-Rated Home Services in ${cityName}`,
    `Verified Home Repair & Services in ${cityName}`,
    `Complete Home Services in ${cityName}`,
    `Reliable Doorstep Home Services in ${cityName}`
  ];

  // 10 Title Templates (strictly under 55-60 chars: category names + home service + near me)
  const titleTemplates = [
    `Home Services in ${cityName} | ${trade1}, ${trade2} Near Me`,
    `${trade1}, ${trade2} & Home Services in ${cityName} | Near Me`,
    `Best Home Services in ${cityName} | ${trade1} Near Me`,
    `Home Services in ${cityName} | Doorstep Service Near Me`,
    `Doorstep Home Services in ${cityName} | ${trade1}, ${trade2} Near Me`,
    `Top Home Services in ${cityName} | ${trade1} & ${trade2} Near Me`,
    `Professional Home Services in ${cityName} | Near Me`,
    `Verified Home Services in ${cityName} | ${trade1} Near Me`,
    `${trade1}, ${trade2}, ${trade3} in ${cityName} | Home Services`,
    `Affordable Home Services in ${cityName} | ${trade1} Near Me`
  ];

  // 10 Description Templates (under 155 chars: category names + home services + near me)
  const descTemplates = [
    `Looking for trusted home services in ${cityName} near you? Book verified ${tradesText} and repair experts with upfront pricing and same-day service.`,
    `Book professional ${tradesText} and home services in ${cityName} near me. Background-verified experts, scheduled convenience, and zero hidden fees.`,
    `Get premium doorstep home services in ${cityName} today. Certified pros for ${tradesText} with friendly assistance. Book your slot near you now!`,
    `FixBro offers high-quality home services in ${cityName} near you. Book verified specialists for ${catsText}${localCoverageText} with upfront rates.`,
    `Find verified home service pros in ${cityName}. Fast doorstep repair and maintenance for ${catsText}. Transparent pricing and guaranteed quality.`,
    `Book on-demand ${tradesText} and home maintenance in ${cityName}. Certified technicians, upfront rates, and quick arrival near you.`,
    `Need urgent home services in ${cityName}? FixBro provides same-day doorstep solutions for ${tradesText}. Background-checked experts near you.`,
    `Top-rated home repair and maintenance in ${cityName}. Connect with verified pros for ${catsText}. Transparent billing, warranty, and fast arrival.`,
    `Reliable doorstep home services in ${cityName} near you. Expert technicians for ${tradesText}. Instant booking and upfront quotes.`,
    `Doorstep home maintenance and repair services across ${cityName}. Book vetted pros for ${catsText}. Fast, trusted, and affordable near you.`
  ];

  const keywordsList: string[] = [
    `home services ${cityName}`,
    `home services near me`,
    `${cityName} home services`,
    `home maintenance ${cityName}`,
    `${cityName} home repair near me`,
    `doorstep home services in ${cityName}`,
    `local home services ${cityName}`,
    `booking home services in ${cityName}`,
    `professional home services ${cityName}`
  ];

  categoryNames.forEach(cat => {
    const cleanCat = cat.toLowerCase();
    const cleanTrade = getCategorySearchTerm(cat).toLowerCase();
    keywordsList.push(`${cleanCat} in ${cityName} near me`);
    keywordsList.push(`${cleanCat} services ${cityName}`);
    keywordsList.push(`best ${cleanCat} in ${cityName} near you`);
    keywordsList.push(`${cleanTrade} in ${cityName} near me`);
    keywordsList.push(`${cleanTrade} near me ${cityName}`);
  });

  areaList.slice(0, 10).forEach(area => {
    keywordsList.push(`home services in ${area} near me`);
    keywordsList.push(`${trade1.toLowerCase()} in ${area} near me`);
    keywordsList.push(`${trade2.toLowerCase()} in ${area} near me`);
  });

  const generic = [
    `booking services in ${cityName}`,
    `home maintenance services ${cityName}`, `certified repair ${cityName}`, `home services near you`,
    `fixbro ${cityName}`, `booking app ${cityName}`, `professional service ${cityName}`,
    `home care ${cityName}`, `local experts ${cityName}`, `repair technicians ${cityName}`,
    `home repair near me`, `repair near me`
  ];

  while (keywordsList.length < 25 && generic.length > 0) {
    const gen = generic.shift();
    if (gen && !keywordsList.includes(gen)) keywordsList.push(gen);
  }

  return {
    h1_title: h1Templates[idx],
    seo_title: titleTemplates[idx],
    seo_description: descTemplates[idx],
    seo_keywords: keywordsList.slice(0, 25).join(', ')
  };
}

export function generateFreeAreaSeoData(cityName: string, areaName: string, categoryNames: string[], nearbyAreas?: Array<{ id: string; name: string; slug: string }>) {
  const idx = Math.floor(Math.random() * 10);
  const prioritizedCats = prioritizeCategoryNames(categoryNames);
  const topCats = prioritizedCats.slice(0, 5);
  const cat1 = topCats[0] || 'Carpentry';
  const cat2 = topCats[1] || 'TV Installation';
  const cat3 = topCats[2] || 'Interior';
  const trade1 = getCategorySearchTerm(cat1);
  const trade2 = getCategorySearchTerm(cat2);
  const trade3 = getCategorySearchTerm(cat3);
  const catsText = topCats.length > 0 ? topCats.join(', ') : "Carpentry, TV Installation, Interior";
  const tradesText = [trade1, trade2, trade3].join(', ');

  const areaList = nearbyAreas ? nearbyAreas.map(a => a.name) : [];
  const formattedAreas = areaList.slice(0, 10).join(', ');
  const localCoverageText = formattedAreas ? ` and surrounding sectors like ${formattedAreas}` : '';

  // 10 H1 Templates (home services + category names)
  const h1Templates = [
    `Home Services in ${areaName}`,
    `${trade1}, ${trade2} & Home Services in ${areaName}`,
    `Home Services & Repair in ${areaName}`,
    `Doorstep Home Services in ${areaName}`,
    `Professional Home Services in ${areaName}`,
    `${tradesText} in ${areaName}`,
    `Top-Rated Home Services in ${areaName}`,
    `Verified Home Repair in ${areaName}`,
    `Home Repair & Maintenance in ${areaName}`,
    `Reliable Home Services in ${areaName}`
  ];

  // 10 Title Templates (strictly under 55-60 chars: category names + home service + near me)
  const titleTemplates = [
    `Home Services in ${areaName}, ${cityName} | Near Me`,
    `${trade1}, ${trade2} in ${areaName} | Home Services Near Me`,
    `Home Services in ${areaName} | ${trade1}, ${trade2} Near Me`,
    `Best Home Services in ${areaName}, ${cityName} | Near Me`,
    `Doorstep Home Services in ${areaName} | ${trade1} Near Me`,
    `Top Home Services in ${areaName}, ${cityName} | Near Me`,
    `${trade1}, ${trade2} & Home Services in ${areaName} | Near Me`,
    `Verified Home Services in ${areaName} | ${trade1} Near Me`,
    `Professional Home Services in ${areaName}, ${cityName} | Near Me`,
    `Affordable Home Services in ${areaName} | Near Me`
  ];

  // 10 Description Templates (under 155 chars: category names + home service + near me)
  const descTemplates = [
    `Looking for trusted home services in ${areaName}, ${cityName} near you? FixBro connects you with verified experts for ${tradesText}. Book online!`,
    `Need professional home services in ${areaName} near me? Find background-verified pros for ${tradesText} in ${cityName}. Zero hidden fees.`,
    `Get premium home maintenance in ${areaName} today. Our local technicians offer same-day service for ${tradesText}. Book your slot near you now!`,
    `FixBro offers high-quality home services in ${areaName} near you. Book verified experts for ${catsText}${localCoverageText} with upfront rates.`,
    `Find verified home service pros in ${areaName}, ${cityName}. Fast doorstep repair for ${tradesText}. Transparent pricing and warranty.`,
    `Book on-demand home repair in ${areaName}. Certified technicians for ${tradesText}. Upfront rates and guaranteed doorstep support.`,
    `Need urgent home repair in ${areaName}? FixBro provides same-day doorstep solutions for ${tradesText}. Background-checked pros near you.`,
    `Top-rated home services and maintenance in ${areaName}, ${cityName}. Connect with verified pros for ${catsText}. Warranty included.`,
    `Reliable doorstep home services in ${areaName} near you. Expert technicians for ${tradesText}. Instant booking and upfront quotes.`,
    `Doorstep home maintenance and repair services across ${areaName}. Book vetted pros for ${catsText}. Fast, trusted & affordable near you.`
  ];

  const keywordsList: string[] = [
    `home services ${areaName}`,
    `home services near me`,
    `${areaName} home services`,
    `home maintenance ${areaName}`,
    `${areaName} home repair near me`,
    `doorstep home services in ${areaName}`,
    `local home services ${areaName}`
  ];

  categoryNames.forEach(cat => {
    const cleanCat = cat.toLowerCase();
    const cleanTrade = getCategorySearchTerm(cat).toLowerCase();
    keywordsList.push(`${cleanCat} in ${areaName} near me`);
    keywordsList.push(`${cleanCat} services ${areaName}`);
    keywordsList.push(`best ${cleanCat} in ${areaName} ${cityName}`);
    keywordsList.push(`${cleanTrade} in ${areaName} near me`);
    keywordsList.push(`${cleanTrade} near me ${areaName}`);
  });

  areaList.slice(0, 10).forEach(na => {
    keywordsList.push(`home services in ${na} near me`);
    keywordsList.push(`${trade1.toLowerCase()} in ${na} near me`);
  });

  const generic = [
    `booking services in ${areaName}`,
    `home maintenance services ${areaName}`, `certified repair ${areaName}`, `home services near you`,
    `fixbro ${areaName}`, `booking app ${areaName}`, `professional service ${areaName}`,
    `home care ${areaName}`, `local experts ${areaName}`, `repair technicians ${areaName}`,
    `repair near me ${areaName}`
  ];

  while (keywordsList.length < 25 && generic.length > 0) {
    const gen = generic.shift();
    if (gen && !keywordsList.includes(gen)) keywordsList.push(gen);
  }

  return {
    h1_title: h1Templates[idx],
    seo_title: titleTemplates[idx],
    seo_description: descTemplates[idx],
    seo_keywords: keywordsList.slice(0, 25).join(', ')
  };
}

export function generateFreeCityCategorySeoData(cityName: string, categoryName: string, serviceNames: string[], nearbyAreas?: Array<{ id: string; name: string; slug: string }>) {
  const trade = getCategorySearchTerm(categoryName);
  const idx = Math.floor(Math.random() * 10);
  const cleanServices = serviceNames.map(s => cleanServiceName(s)).filter(Boolean);
  const srv1 = cleanServices[0] || '';
  const srv2 = cleanServices[1] || '';
  const srvSummary = cleanServices.slice(0, 2).join(' & ');
  const servicesText = cleanServices.length > 0 ? cleanServices.slice(0, 4).join(', ') : `${trade} repair, installation, maintenance`;

  const areaList = nearbyAreas ? nearbyAreas.map(a => a.name) : [];
  const formattedAreas = areaList.slice(0, 10).join(', ');
  const localCoverageText = formattedAreas ? ` covering areas like ${formattedAreas}` : '';

  // 10 H1 Templates
  const h1Templates = [
    `${trade} Services in ${cityName}`,
    `${trade} in ${cityName}`,
    `Professional ${trade} in ${cityName}`,
    `Doorstep ${trade} Services in ${cityName}`,
    `Best ${trade} in ${cityName}`,
    `Top-Rated ${trade} Services in ${cityName}`,
    `Verified ${trade} in ${cityName}`,
    `On-Demand ${trade} in ${cityName}`,
    `Affordable ${trade} Services in ${cityName}`,
    `Certified ${trade} in ${cityName}`
  ];

  // 10 Title Templates (strictly under 55-60 chars: category + service names + near me)
  const titleTemplates = [
    `${trade} in ${cityName} | ${trade} Near Me`,
    `${trade} in ${cityName} | ${srv1 || 'Repair & Installation'} Near Me`,
    `Best ${trade} in ${cityName} | ${srv1 ? `${srv1} & Services` : 'Verified Pros'}`,
    `${trade} Services in ${cityName} | ${srv1 || 'Doorstep Help'} Near Me`,
    `Doorstep ${trade} in ${cityName} | ${srv1 ? `${srv1} Near Me` : `${trade} Services`}`,
    `Top-Rated ${trade} in ${cityName} | ${srv1 || 'Repair'} Near Me`,
    `${trade} & ${srv1 || 'Installation'} in ${cityName} | Near Me`,
    `Certified ${trade} in ${cityName} | ${srv2 || srv1 || 'Same Day'} Near Me`,
    `Professional ${trade} in ${cityName} | ${srv1 || 'Doorstep Help'}`,
    `Affordable ${trade} Services in ${cityName} | ${srv1 || trade} Near Me`
  ];

  // 10 Description Templates (under 155 chars: category + service names)
  const descTemplates = [
    `Looking for trusted ${trade.toLowerCase()} services in ${cityName} near you? FixBro connects you with certified experts for ${servicesText}${localCoverageText}. Book now!`,
    `Need professional ${trade.toLowerCase()} in ${cityName} near me? Find background-verified pros for ${servicesText}${localCoverageText}. Scheduled convenience, zero hidden fees.`,
    `Get premium ${trade.toLowerCase()} maintenance in ${cityName} today. Our local technicians offer same-day service for ${servicesText}${localCoverageText} with friendly assistance.`,
    `FixBro offers top-quality ${trade.toLowerCase()} services in ${cityName} near you. Book verified specialists for ${servicesText}${localCoverageText} with upfront rates.`,
    `Searching for the best ${trade.toLowerCase()} in ${cityName}? Book background-checked experts for ${servicesText}${localCoverageText}. Transparent flat rates.`,
    `Doorstep ${trade.toLowerCase()} services in ${cityName}. Fast arrival, certified technicians, and warranty on all repairs for ${servicesText}. Book online!`,
    `Find skilled and reliable ${trade.toLowerCase()} in ${cityName} near you. FixBro delivers transparent pricing and top workmanship for ${servicesText}.`,
    `Urgent ${trade.toLowerCase()} needed in ${cityName}? Get instant booking and same-day service for ${servicesText}${localCoverageText} from verified pros.`,
    `Connect with background-verified ${trade.toLowerCase()} in ${cityName}. Transparent rates, authentic spares, and full warranty for ${servicesText}.`,
    `Affordable, trusted ${trade.toLowerCase()} services across ${cityName}. Experienced trade experts ready to assist with ${servicesText}. Book today!`
  ];

  const cleanCat = categoryName.toLowerCase();
  const cleanTrade = trade.toLowerCase();
  const keywordsList: string[] = [
    `${cleanTrade} ${cityName}`,
    `${cleanTrade} services ${cityName}`,
    `${cityName} ${cleanTrade} near me`,
    `best ${cleanTrade} in ${cityName} near me`
  ];

  serviceNames.forEach(srv => {
    const cleanSrv = cleanServiceName(srv).toLowerCase();
    keywordsList.push(`${cleanSrv} in ${cityName} near me`);
    keywordsList.push(`${cleanSrv} services ${cityName}`);
    keywordsList.push(`best ${cleanSrv} in ${cityName} near you`);
  });

  areaList.slice(0, 10).forEach(area => {
    keywordsList.push(`${cleanTrade} in ${area} near me`);
    keywordsList.push(`${cleanTrade} services ${area}`);
  });

  const generic = [
    `local ${cleanTrade} ${cityName}`, `booking ${cleanTrade} in ${cityName}`,
    `professional ${cleanTrade} in ${cityName} near me`, `certified ${cleanTrade} in ${cityName} near me`, `${cleanCat} cleaning ${cityName} near you`,
    `${cleanTrade} repair ${cityName}`, `certified ${cleanTrade} ${cityName}`, `${cleanTrade} near you`,
    `fixbro ${cleanTrade} ${cityName}`, `booking app ${cleanTrade} ${cityName}`, `professional ${cleanTrade} service ${cityName}`,
    `${cleanTrade} care ${cityName}`, `local ${cleanTrade} experts ${cityName}`, `repair technicians ${cleanTrade} ${cityName}`,
    `${cleanTrade} near me`, `repair near me`
  ];

  while (keywordsList.length < 25 && generic.length > 0) {
    const gen = generic.shift();
    if (gen && !keywordsList.includes(gen)) keywordsList.push(gen);
  }

  const spinnedContent = getSpinnedLocalContent({
    cityName,
    categoryName,
    nearbyAreas,
    templateIdx: idx
  });

  // Dynamic pool of 8 FAQs; select 4 based on idx
  const faqPool = [
    {
      question: `Do you provide ${trade.toLowerCase()} services in ${cityName}?`,
      answer: `Yes, Fixbro provides comprehensive, top-rated ${trade.toLowerCase()} services throughout ${cityName} and surrounding localities.`
    },
    {
      question: `How quickly can I book a professional ${trade.toLowerCase()} in ${cityName}?`,
      answer: `You can schedule an appointment online instantly. We offer flexible time slots and same-day services across ${cityName}${formattedAreas ? ` including ${formattedAreas}` : ''}.`
    },
    {
      question: `What are the charges for ${trade.toLowerCase()} in ${cityName}?`,
      answer: `Fixbro offers transparent, upfront pricing with no hidden charges. Exact inspection charges and service rates are shown before you confirm your booking.`
    },
    {
      question: `Are the ${trade.toLowerCase()} professionals background-verified?`,
      answer: `Yes, all technicians on Fixbro undergo strict background checks, identity verification, and trade skill assessments to guarantee safety and top quality.`
    },
    {
      question: `Do you offer a warranty on ${trade.toLowerCase()} services?`,
      answer: `Yes, all ${trade.toLowerCase()} jobs booked through Fixbro come with a post-service warranty for complete customer satisfaction and peace of mind.`
    },
    {
      question: `Can I reschedule or cancel my ${trade.toLowerCase()} booking in ${cityName}?`,
      answer: `Yes, you can easily reschedule or cancel your appointment directly from your Fixbro account or by contacting our customer support team.`
    },
    {
      question: `What types of ${trade.toLowerCase()} services do you cover in ${cityName}?`,
      answer: `Our certified experts handle repair, installation, maintenance, and emergency fixes for ${servicesText || trade.toLowerCase()} across ${cityName}.`
    },
    {
      question: `Do technicians bring their own tools and materials?`,
      answer: `Yes, our trade specialists arrive equipped with industry-standard professional tools. Any required replacement parts are procured transparently with your approval.`
    }
  ];

  const faqsList = [
    faqPool[idx % 8],
    faqPool[(idx + 2) % 8],
    faqPool[(idx + 4) % 8],
    faqPool[(idx + 6) % 8]
  ];

  return {
    h1_title: h1Templates[idx],
    seo_title: titleTemplates[idx],
    seo_description: descTemplates[idx],
    seo_keywords: keywordsList.slice(0, 25).join(', '),
    seo_content: spinnedContent,
    faqs: faqsList,
    imageHint: `${trade.toLowerCase()} ${cityName.toLowerCase()}`
  };
}

export function generateFreeAreaCategorySeoData(cityName: string, areaName: string, categoryName: string, serviceNames: string[], nearbyAreas?: Array<{ id: string; name: string; slug: string }>) {
  const trade = getCategorySearchTerm(categoryName);
  const idx = Math.floor(Math.random() * 10);
  const cleanServices = serviceNames.map(s => cleanServiceName(s)).filter(Boolean);
  const srv1 = cleanServices[0] || '';
  const srv2 = cleanServices[1] || '';
  const srvSummary = cleanServices.slice(0, 2).join(' & ');
  const servicesText = cleanServices.length > 0 ? cleanServices.slice(0, 4).join(', ') : `${trade} services, ${trade} repair & installation`;

  let nearbyList: string[] = [];
  if (nearbyAreas && nearbyAreas.length > 0) {
    nearbyList = nearbyAreas.map(a => a.name);
  } else {
    const cleanAreaKey = areaName.toLowerCase().replace(/[^a-z0-9]/g, '');
    nearbyList = NEARBY_AREAS_MAP[cleanAreaKey] || ['nearby neighborhoods', 'adjacent sectors', 'surrounding areas'];
  }
  
  const formattedAreas = nearbyList.slice(0, 10).join(', ');

  // 10 H1 Templates
  const h1Templates = [
    `${trade} Services in ${areaName}`,
    `${trade} in ${areaName}`,
    `Professional ${trade} in ${areaName}`,
    `Doorstep ${trade} Services in ${areaName}`,
    `Best ${trade} in ${areaName}`,
    `Top-Rated ${trade} in ${areaName}`,
    `Verified ${trade} in ${areaName}`,
    `On-Demand ${trade} in ${areaName}`,
    `Affordable ${trade} in ${areaName}`,
    `Certified ${trade} in ${areaName}`
  ];

  // 10 Title Templates (strictly under 55-60 chars: category + service names + near me)
  const titleTemplates = [
    `${trade} in ${areaName}, ${cityName} | ${trade} Near Me`,
    `${trade} in ${areaName} | ${srv1 || trade} Near Me`,
    `${trade} & ${srv1 || 'Repair'} in ${areaName} | Near Me`,
    `Best ${trade} in ${areaName}, ${cityName} | ${srv1 || 'Near Me'}`,
    `${trade} Services in ${areaName} | ${srv1 || 'Doorstep Service'} Near Me`,
    `Professional ${trade} in ${areaName} | ${srv1 || trade} Near Me`,
    `Doorstep ${trade} in ${areaName}, ${cityName} | ${srv1 || 'Near Me'}`,
    `Top-Rated ${trade} in ${areaName} | ${srv1 || trade} Near Me`,
    `Certified ${trade} in ${areaName} | ${srv1 ? `${srv1} Near Me` : 'Fast Help'}`,
    `Affordable ${trade} in ${areaName}, ${cityName} | ${srv1 || 'Near Me'}`
  ];

  // 10 Description Templates (under 155 chars: category + service names)
  const descTemplates = [
    `Looking for trusted ${trade.toLowerCase()} in ${areaName}, ${cityName} near you? FixBro connects you with verified local experts for ${servicesText}. Book online!`,
    `Need professional ${trade.toLowerCase()} in ${areaName} near me? Find background-verified pros for ${servicesText} in ${cityName}. Fast doorstep service, zero hidden fees.`,
    `Get premium ${trade.toLowerCase()} services in ${areaName} today. Our local technicians offer same-day service for ${servicesText} with friendly assistance.`,
    `FixBro offers top-quality ${trade.toLowerCase()} in ${areaName} near you. Book verified specialists for ${servicesText} covering ${nearbyList.slice(0, 3).join(', ')}.`,
    `Searching for the best ${trade.toLowerCase()} in ${areaName}? Book background-checked experts for ${servicesText}. Transparent rates & quick doorstep arrival.`,
    `Doorstep ${trade.toLowerCase()} in ${areaName}, ${cityName}. Fast arrival, certified technicians, and warranty on all repairs for ${servicesText}. Book online!`,
    `Find skilled and reliable ${trade.toLowerCase()} in ${areaName} near you. FixBro delivers transparent pricing and top workmanship for ${servicesText}.`,
    `Urgent ${trade.toLowerCase()} needed in ${areaName}? Get instant booking and same-day service for ${servicesText} in ${cityName} from verified pros.`,
    `Connect with background-verified ${trade.toLowerCase()} in ${areaName}. Transparent rates, authentic spares, and full warranty for ${servicesText}.`,
    `Affordable, trusted ${trade.toLowerCase()} services across ${areaName}, ${cityName}. Experienced trade experts ready to assist with ${servicesText}. Book today!`
  ];

  const cleanCat = categoryName.toLowerCase();
  const cleanTrade = trade.toLowerCase();
  const keywordsList: string[] = [
    `${cleanTrade} ${areaName}`,
    `${cleanTrade} services ${areaName}`,
    `${areaName} ${cleanTrade} near me`,
    `best ${cleanTrade} in ${areaName} near me`
  ];

  serviceNames.forEach(srv => {
    const cleanSrv = cleanServiceName(srv).toLowerCase();
    keywordsList.push(`${cleanSrv} in ${areaName} near me`);
    keywordsList.push(`${cleanSrv} services ${areaName}`);
    keywordsList.push(`best ${cleanSrv} in ${areaName} ${cityName}`);
  });

  nearbyList.slice(0, 10).forEach(na => {
    keywordsList.push(`${cleanTrade} in ${na} near me`);
    keywordsList.push(`${cleanTrade} services ${na}`);
  });

  const generic = [
    `local ${cleanTrade} ${areaName}`, `booking ${cleanTrade} in ${areaName}`,
    `professional ${cleanTrade} in ${areaName} near me`, `certified ${cleanTrade} in ${areaName} near me`, `${cleanCat} cleaning ${areaName} near you`,
    `${cleanTrade} repair ${areaName}`, `certified ${cleanTrade} ${areaName}`, `${cleanTrade} near you`,
    `fixbro ${cleanTrade} ${areaName}`, `booking app ${cleanTrade} ${areaName}`, `professional ${cleanTrade} service ${areaName}`,
    `${cleanTrade} care ${areaName}`, `local ${cleanTrade} experts ${areaName}`, `repair technicians ${cleanTrade} ${areaName}`,
    `${cleanTrade} near me ${areaName}`, `repair near me ${areaName}`
  ];

  while (keywordsList.length < 25 && generic.length > 0) {
    const gen = generic.shift();
    if (gen && !keywordsList.includes(gen)) keywordsList.push(gen);
  }

  const spinnedContent = getSpinnedLocalContent({
    cityName,
    areaName,
    categoryName,
    nearbyAreas,
    templateIdx: idx
  });

  // Dynamic pool of 8 FAQs; select 4 based on idx
  const faqPool = [
    {
      question: `Do you provide ${trade.toLowerCase()} services in ${areaName}?`,
      answer: `Yes, Fixbro provides comprehensive, top-rated ${trade.toLowerCase()} services throughout ${areaName} and nearby areas like ${formattedAreas}.`
    },
    {
      question: `How quickly can a ${trade.toLowerCase()} arrive in ${areaName}?`,
      answer: `We offer fast doorstep response in ${areaName}. Same-day slots and quick emergency assistance are available depending on your schedule.`
    },
    {
      question: `What are the rates for ${trade.toLowerCase()} in ${areaName}, ${cityName}?`,
      answer: `Fixbro provides transparent, upfront pricing with zero hidden fees. You get clear quotations before any work begins.`
    },
    {
      question: `Are your ${trade.toLowerCase()} experts in ${areaName} verified?`,
      answer: `Yes, every professional is background-checked, vetted for skills, and follows strict safety protocols for your peace of mind.`
    },
    {
      question: `Is there a warranty on ${trade.toLowerCase()} work in ${areaName}?`,
      answer: `Yes, we offer post-service warranty coverage on workmanship so you can book with total confidence.`
    },
    {
      question: `Can I book ${trade.toLowerCase()} services for commercial spaces in ${areaName}?`,
      answer: `Absolutely. Fixbro caters to residential apartments, independent homes, villas, corporate offices, and retail shops across ${areaName}.`
    },
    {
      question: `What ${trade.toLowerCase()} tasks can you help with in ${areaName}?`,
      answer: `Our experts handle everything from quick fixes and routine maintenance to major installations for ${servicesText || trade.toLowerCase()}.`
    },
    {
      question: `How do I pay for ${trade.toLowerCase()} services in ${areaName}?`,
      answer: `You can pay securely online via UPI, card, or choose Pay After Service upon satisfactory job completion.`
    }
  ];

  const faqsList = [
    faqPool[idx % 8],
    faqPool[(idx + 2) % 8],
    faqPool[(idx + 4) % 8],
    faqPool[(idx + 6) % 8]
  ];

  return {
    h1_title: h1Templates[idx],
    seo_title: titleTemplates[idx],
    seo_description: descTemplates[idx],
    seo_keywords: keywordsList.slice(0, 25).join(', '),
    seo_content: spinnedContent,
    faqs: faqsList,
    imageHint: `${trade.toLowerCase()} ${areaName.toLowerCase()}`
  };
}

export function generateFreeAreaServiceSeoData(cityName: string, areaName: string, categoryName: string, serviceName: string, nearbyAreas?: Array<{ id: string; name: string; slug: string }>) {
  const cleanName = cleanServiceName(serviceName);
  const idx = Math.floor(Math.random() * 10);

  let nearbyList: string[] = [];
  if (nearbyAreas && nearbyAreas.length > 0) {
    nearbyList = nearbyAreas.map(a => a.name);
  } else {
    const cleanAreaKey = areaName.toLowerCase().replace(/[^a-z0-9]/g, '');
    nearbyList = NEARBY_AREAS_MAP[cleanAreaKey] || ['nearby neighborhoods', 'adjacent sectors', 'surrounding areas'];
  }

  const formattedAreas = nearbyList.slice(0, 10).join(', ');

  // 10 H1 Templates
  const h1Templates = [
    `${cleanName} in ${areaName}`,
    `${cleanName} Services in ${areaName}`,
    `Professional ${cleanName} in ${areaName}`,
    `Doorstep ${cleanName} in ${areaName}`,
    `Best ${cleanName} in ${areaName}`,
    `Top-Rated ${cleanName} in ${areaName}`,
    `Verified ${cleanName} in ${areaName}`,
    `On-Demand ${cleanName} in ${areaName}`,
    `Affordable ${cleanName} in ${areaName}`,
    `Expert ${cleanName} in ${areaName}`
  ];

  // 10 Title Templates (strictly under 55-60 chars, high-CTR format)
  const titleTemplates = [
    `${cleanName} in ${areaName}, ${cityName} | ${cleanName} Near Me`,
    `${cleanName} in ${areaName} | ${cleanName} Near Me`,
    `Best ${cleanName} in ${areaName}, ${cityName} | Verified Pros`,
    `Professional ${cleanName} in ${areaName} | Same Day Service`,
    `Doorstep ${cleanName} in ${areaName}, ${cityName}`,
    `Top-Rated ${cleanName} in ${areaName} | Book Online`,
    `${cleanName} Services in ${areaName}, ${cityName} | Near Me`,
    `Certified ${cleanName} in ${areaName} | Fast Arrival`,
    `Affordable ${cleanName} in ${areaName}, ${cityName} | Near Me`,
    `On-Demand ${cleanName} in ${areaName} | Doorstep Service`
  ];

  // 10 Description Templates (under 155 chars)
  const descTemplates = [
    `Looking for trusted ${cleanName.toLowerCase()} in ${areaName}, ${cityName} near you? FixBro connects you with verified local experts. Book online with upfront pricing!`,
    `Need professional ${cleanName.toLowerCase()} in ${areaName} near me? Find background-verified pros in ${cityName}. Fast doorstep service, zero hidden fees.`,
    `Get premium ${cleanName.toLowerCase()} in ${areaName} today. Our local technicians offer same-day service with transparent rates and friendly assistance.`,
    `FixBro offers top-quality ${cleanName.toLowerCase()} services in ${areaName} near you. Book verified specialists covering ${nearbyList.slice(0, 3).join(', ')}.`,
    `Searching for the best ${cleanName.toLowerCase()} in ${areaName}? Book background-checked experts with upfront pricing and guaranteed quality.`,
    `Doorstep ${cleanName.toLowerCase()} in ${areaName}, ${cityName}. Fast arrival, certified technicians, and warranty on all repairs. Book online!`,
    `Find skilled and reliable ${cleanName.toLowerCase()} in ${areaName} near you. FixBro delivers transparent pricing and top workmanship.`,
    `Urgent ${cleanName.toLowerCase()} needed in ${areaName}? Get instant booking and same-day service in ${cityName} from verified pros.`,
    `Connect with background-verified experts for ${cleanName.toLowerCase()} in ${areaName}. Transparent rates, authentic spares, and full warranty.`,
    `Affordable, trusted ${cleanName.toLowerCase()} services across ${areaName}, ${cityName}. Experienced trade experts ready to assist. Book today!`
  ];

  const cleanSrv = cleanName.toLowerCase();
  const trade = getCategorySearchTerm(categoryName).toLowerCase();
  const keywordsList: string[] = [
    `${cleanSrv} ${areaName}`,
    `${cleanSrv} services ${areaName}`,
    `${areaName} ${cleanSrv} near me`,
    `best ${cleanSrv} in ${areaName} near me`
  ];

  keywordsList.push(`${cleanSrv} in ${areaName} ${cityName}`);
  keywordsList.push(`${trade} services in ${areaName}`);
  keywordsList.push(`best ${trade} in ${areaName} near me`);
  
  nearbyList.slice(0, 10).forEach(na => {
    keywordsList.push(`${cleanSrv} in ${na} near me`);
    keywordsList.push(`${cleanSrv} services ${na}`);
  });

  const generic = [
    `local ${cleanSrv} ${areaName}`, `booking ${cleanSrv} in ${areaName}`,
    `professional ${cleanSrv} in ${areaName} near me`, `certified ${cleanSrv} in ${areaName} near me`, `${cleanSrv} cleaning ${areaName} near you`,
    `${cleanSrv} repair ${areaName}`, `certified ${cleanSrv} ${areaName}`, `${cleanSrv} near you`,
    `fixbro ${cleanSrv} ${areaName}`, `booking app ${cleanSrv} ${areaName}`, `professional ${cleanSrv} service ${areaName}`,
    `${cleanSrv} care ${areaName}`, `local ${cleanSrv} experts ${areaName}`, `repair technicians ${cleanSrv} ${areaName}`,
    `${cleanSrv} near me ${areaName}`, `repair near me ${areaName}`
  ];

  while (keywordsList.length < 25 && generic.length > 0) {
    const gen = generic.shift();
    if (gen && !keywordsList.includes(gen)) keywordsList.push(gen);
  }

  const spinnedContent = getSpinnedLocalContent({
    cityName,
    areaName,
    serviceName: cleanName,
    nearbyAreas,
    templateIdx: idx
  });

  // Dynamic pool of 8 FAQs; select 4 based on idx
  const faqPool = [
    {
      question: `Do you provide ${cleanName.toLowerCase()} in ${areaName}?`,
      answer: `Yes, FixBro provides professional, top-rated ${cleanName.toLowerCase()} across ${areaName} and neighbouring areas like ${formattedAreas}.`
    },
    {
      question: `How quickly can I book a technician for ${cleanName.toLowerCase()} in ${areaName}?`,
      answer: `You can book online in under 2 minutes. We offer same-day appointments and convenient time slots across ${areaName}, ${cityName}.`
    },
    {
      question: `What is the cost of ${cleanName.toLowerCase()} in ${areaName}?`,
      answer: `Pricing is transparent and fixed upfront. You will see the clear rate before booking with no surprise hidden fees.`
    },
    {
      question: `Are the technicians providing ${cleanName.toLowerCase()} background-verified?`,
      answer: `Yes, all FixBro technicians undergo rigorous background verification and hands-on skill evaluations for your safety.`
    },
    {
      question: `Do you provide warranty on ${cleanName.toLowerCase()} in ${areaName}?`,
      answer: `Yes, our services are backed by a post-service workmanship warranty. If anything is amiss, we will make it right.`
    },
    {
      question: `What is included in the ${cleanName.toLowerCase()} service?`,
      answer: `Our specialists bring standard professional tools, perform thorough diagnostics, complete the work to high standards, and clean up afterwards.`
    },
    {
      question: `Can I schedule ${cleanName.toLowerCase()} for weekends or evenings?`,
      answer: `Yes, we offer flexible scheduling 7 days a week, including weekend and evening slots to suit your routine.`
    },
    {
      question: `What payment options are available for ${cleanName.toLowerCase()} in ${areaName}?`,
      answer: `You can pay online via UPI, debit/credit cards, net banking, or choose Pay After Service upon job completion.`
    }
  ];

  const faqsList = [
    faqPool[idx % 8],
    faqPool[(idx + 2) % 8],
    faqPool[(idx + 4) % 8],
    faqPool[(idx + 6) % 8]
  ];

  return {
    h1_title: h1Templates[idx],
    seo_title: titleTemplates[idx],
    seo_description: descTemplates[idx],
    seo_keywords: keywordsList.slice(0, 25).join(', '),
    seo_content: spinnedContent,
    faqs: faqsList,
    imageHint: `${cleanName.toLowerCase()} ${areaName.toLowerCase()}`
  };
}
