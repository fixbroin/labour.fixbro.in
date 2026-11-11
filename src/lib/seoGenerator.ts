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
  const rawTarget = (serviceName ? cleanServiceName(serviceName) : '') || (categoryName ? getCategorySearchTerm(categoryName) : 'Daily Labour');
  const targetLabel = rawTarget.toLowerCase().includes('labour') ? rawTarget : `${rawTarget} Daily Labour`;
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
    `${targetLabel} in ${locationLabel}, ${cityName}`,
    `Verified ${targetLabel} Across ${locationLabel}`,
    `Full-Day ${targetLabel} in ${locationLabel} | Background-Checked Workers`,
    `Hire Skilled ${targetLabel} in ${locationLabel} Near You`,
    `Reliable Daily Wage ${targetLabel} in ${locationLabel}, ${cityName}`,
    `Top-Rated ${targetLabel} Workers Near You in ${locationLabel}`,
    `Affordable Daily Wage ${targetLabel} in ${locationLabel}`,
    `Verified ${targetLabel} Specialists Serving ${locationLabel}`,
    `Best Daily Labour Support in ${locationLabel}, ${cityName}`,
    `Expert ${targetLabel} at Your Site in ${locationLabel}`
  ];

  // 2. Main Paragraphs (Part 1 - 10 distinct variations)
  const paragraph1List = [
    `Need verified ${targetLabel} in ${locationLabel}? Fixbro Daily Labour connects contractors, homeowners, interior managers, and commercial projects with background-checked daily wage trade workers across ${locationLabel} and neighbouring localities like ${formattedAreas}.`,
    `Looking for skilled ${targetLabel} near you in ${locationLabel}? Fixbro Daily Labour brings you verified trade workers equipped with professional hand tools, ready for full-day on-site work around ${locationLabel} and neighbouring areas like ${formattedAreas}.`,
    `Searching for dependable ${targetLabel} in ${locationLabel}, ${cityName}? Our platform connects you with vetted, identity-cleared daily wage specialists ready to handle full-day jobs across ${locationLabel} and adjacent communities such as ${formattedAreas}.`,
    `Hire verified daily labour for ${targetLabel} in ${locationLabel}. Fixbro Daily Labour provides experienced tradesmen who work full-day shifts with upfront fixed daily wage rates across ${locationLabel} and surrounding areas like ${formattedAreas}.`,
    `Get reliable doorstep ${targetLabel} in ${locationLabel}, ${cityName}. Book skilled daily wage workers online with zero hassle, transparent rates, and guaranteed attendance throughout ${locationLabel} and nearby sectors like ${formattedAreas}.`,
    `Fixbro Daily Labour is your trusted platform for on-demand ${targetLabel} in ${locationLabel}. We connect project owners with skilled tradesmen who deliver dedicated full-day work across ${locationLabel} and adjacent neighborhoods including ${formattedAreas}.`,
    `Enjoy transparent, fixed-rate booking for ${targetLabel} in ${locationLabel}. Our verified workers arrive punctually at 09:30 AM to provide dedicated full-day labour across ${locationLabel} and nearby locations like ${formattedAreas}.`,
    `When you need prompt and certified ${targetLabel} in ${locationLabel}, Fixbro Daily Labour delivers. We provide dedicated full-day trade workers for residences, apartments, and commercial sites throughout ${locationLabel} and surrounding parts of ${cityName} such as ${formattedAreas}.`,
    `Experience five-star rated ${targetLabel} at your site in ${locationLabel}. Fixbro Daily Labour connects you with background-verified daily wage workers serving projects in ${locationLabel} and adjacent sectors including ${formattedAreas}.`,
    `Get connected with skilled tradesmen for all your ${targetLabel} needs in ${locationLabel}, ${cityName}. From site renovation to complex installations, our daily workers cater to properties across ${locationLabel} and nearby areas like ${formattedAreas}.`
  ];

  // Main Paragraphs (Part 2 - 10 distinct variations)
  const paragraph2List = [
    `Our daily wage professionals in ${locationLabel} work a standard full day (09:30 AM – 05:30 PM with a 1:00 PM – 2:00 PM lunch break), providing 7 active hours of high-efficiency labour. Fixed daily rates mean zero surprise costs.`,
    `Every daily labourer in ${locationLabel} undergoes Government ID verification and trade skill evaluation. We safeguard your project with a secure Start OTP and Complete OTP workflow, ensuring verified on-site attendance.`,
    `Our dedicated daily workers in ${locationLabel} arrive with standard professional tools, dedicated solely to your booked project for the entire day. No multi-location hopping or incomplete shifts.`,
    `With thousands of successfully completed daily labour shifts in ${locationLabel}, we focus on customer satisfaction, transparent pricing, and punctual doorstep arrival.`,
    `We take pride in transparent daily wages and professional execution across ${locationLabel}. Hire skilled workers for carpentry, electrical, painting, masonry, and full-day renovations with complete peace of mind.`,
    `Convenience and attendance guarantees are at the core of Fixbro Daily Labour in ${locationLabel}. Choose your worker by skill level (Fresher, Intermediate, Senior, Expert) with upfront pricing and zero hidden markups.`,
    `All daily labour bookings in ${locationLabel} are backed by our attendance guarantee and dedicated customer care. If a worker fails to attend, we promptly provide a replacement or full refund.`,
    `Whether you require single-day repair assistance or multi-day renovation labour in ${locationLabel}, our skilled workers deliver consistent productivity from start to finish.`,
    `Customer trust is our highest priority in ${locationLabel}. We enforce strict background checks, punctual attendance standards, and transparent flat daily rates for all residential and commercial bookings.`,
    `Save time searching street labour chowks in ${locationLabel}. Hire verified daily labour online with guaranteed arrival, trade skill verification, and responsive customer support.`
  ];

  // 3. Highlight Cards (10 sets, 3 cards each)
  const highlightCards = [
    [
      { title: "Local Daily Labour", subtitle: `Workers serving ${locationLabel} and nearby sectors like ${nearbyList.slice(0, 3).join(', ')}.` },
      { title: "Full-Day Shift", subtitle: "Standard 09:30 AM to 05:30 PM shift (7 active hours)." },
      { title: "Verified Identity", subtitle: "Government ID and trade skill background checks." }
    ],
    [
      { title: "Verified Trade Workers", subtitle: `Skilled specialists operating in ${locationLabel} and ${nearbyList.slice(0, 3).join(', ')}.` },
      { title: "Upfront Daily Wages", subtitle: "Clear daily rate cards with zero hidden commission." },
      { title: "Secure OTP System", subtitle: "Start & Complete OTP verification for verified attendance." }
    ],
    [
      { title: "Experienced Tradesmen", subtitle: `Background-verified daily workers covering ${locationLabel} and ${nearbyList.slice(0, 3).join(', ')}.` },
      { title: "Single & Multi-Day", subtitle: "Book workers for one day or consecutive project days." },
      { title: "Professional Tools", subtitle: "Workers carry standard trade tools for site execution." }
    ],
    [
      { title: "Punctual Arrival", subtitle: `Prompt local workers serving ${locationLabel} and surrounding sectors like ${nearbyList.slice(0, 3).join(', ')}.` },
      { title: "Dedicated Site Focus", subtitle: "Worker remains at your single project site for the entire day." },
      { title: "Transparent Settlement", subtitle: "Pay online securely or choose Pay After Service." }
    ],
    [
      { title: "Background Checked", subtitle: `Rigorous verification for all workers operating across ${locationLabel}.` },
      { title: "Transparent Pricing", subtitle: "Clear daily rates based on worker seniority level." },
      { title: "Productive Execution", subtitle: "High work ethic and full-day productive labour." }
    ],
    [
      { title: "Prompt Local Transit", subtitle: `Fast travel to project sites across ${locationLabel} and ${nearbyList.slice(0, 3).join(', ')}.` },
      { title: "Multi-Skill Tiers", subtitle: "Choose Fresher, Intermediate, Senior, or Expert tradesmen." },
      { title: "Attendance Guarantee", subtitle: "Guaranteed worker attendance or immediate free reassignment." }
    ],
    [
      { title: "Skilled Craftsmen", subtitle: `Precision craftsmanship and sturdy project execution in ${locationLabel}.` },
      { title: "Standard Trade Gear", subtitle: "Equipped with essential hand and power trade instruments." },
      { title: "Fixbro Backed", subtitle: "Supported by responsive customer service and verified records." }
    ],
    [
      { title: "Flexible Scheduling", subtitle: "Book convenient dates fitting your construction or interior schedule." },
      { title: "Courteous Behaviour", subtitle: "Polite, honest workers who respect your property and safety." },
      { title: "Clean Finish", subtitle: "Standard cleanup and work inspection before sign-off." }
    ],
    [
      { title: "Prompt Shift Start", subtitle: `On-time arrival at 09:30 AM across ${locationLabel} and ${nearbyList.slice(0, 3).join(', ')}.` },
      { title: "Fixed Daily Quotes", subtitle: "No surprise hourly surge charges or hidden add-ons." },
      { title: "Dedicated Support", subtitle: "Direct support helpline for fast coordination and queries." }
    ],
    [
      { title: "Top-Rated Workers", subtitle: `Backed by positive ratings and customer reviews in ${locationLabel}.` },
      { title: "Safe & Compliant", subtitle: "Strict adherence to site safety and trade norms." },
      { title: "Instant Invoicing", subtitle: "Digital receipts and booking summary sent directly to your phone." }
    ]
  ];

  // 4. Benefits Section (10 sets, 6 items each)
  const benefitsLists = [
    [
      `Dedicated local daily wage workers in ${locationLabel}`,
      `Prompt arrival for 09:30 AM full-day shifts across ${locationLabel}`,
      `Flexible single-day or multi-day labour booking`,
      `Residential, interior, and commercial support in ${locationLabel}`,
      `Equipped with standard trade tools for fast execution`,
      `Attendance guarantee and responsive customer support`
    ],
    [
      `Fully vetted and background-checked daily tradesmen`,
      `Prompt doorstep response in ${locationLabel} and surrounding sectors`,
      `Upfront daily wage rates with zero hidden commission`,
      `Dual OTP start and completion tracking for safety`,
      `Experienced in carpentry, painting, electrical, and general labour`,
      `Same-day booking availability for urgent project requirements`
    ],
    [
      `Skilled trade workers stationed locally in ${locationLabel}`,
      `Quick transit times to ${nearbyList.slice(0, 3).join(', ')}`,
      `Transparent fixed daily wages with digital receipts`,
      `Tailored booking for homeowners and building contractors`,
      `Proper tools carried for reliable site work`,
      `Guaranteed worker attendance on scheduled dates`
    ],
    [
      `Friendly support and hassle-free worker coordination`,
      `Workers equipped with essential trade equipment`,
      `Doorstep coverage across homes, shops, and construction sites in ${locationLabel}`,
      `Full-day dedicated focus on your specific booked task`,
      `Affordable daily rates based on worker seniority level`,
      `Vetted specialists with years of cumulative practical experience`
    ],
    [
      `Strict background checks and verified Government photo IDs`,
      `Fast coverage across ${locationLabel} and nearby communities`,
      `Upfront daily price approval before worker arrival`,
      `Dedicated 7-hour active workday for maximum output`,
      `High-durability repairs and solid craftsmanship`,
      `Multi-day booking availability including weekend slots`
    ],
    [
      `Hyper-local daily workers who know ${locationLabel} well`,
      `Zero wait times at local labour chowks`,
      `Direct digital booking with clear skill-tier rates`,
      `Verified attendance with Start OTP and Complete OTP`,
      `Expertise across residential and corporate spaces`,
      `Post-job site clearance and safe work habits`
    ],
    [
      `Certified trade mechanics with proven on-site skills`,
      `Service radius covering ${locationLabel} and ${nearbyList.slice(0, 3).join(', ')}`,
      `No hidden surcharges or surprise travel fees`,
      `Prompt customer care and replacement guarantee`,
      `Equipped with essential trade tools`,
      `Tailored labour solutions for contractors and interior designers`
    ],
    [
      `Experienced hands for heavy-duty daily labour work`,
      `Punctual arrival with pre-visit phone confirmation`,
      `Competitive flat daily wages with zero surge fees`,
      `Peace of mind with verified attendance guarantees`,
      `Safe handling of delicate equipment and home interiors`,
      `Instant booking confirmation via SMS and email`
    ],
    [
      `Vetted craftsmen with rigorous skill validation`,
      `Swift travel across ${locationLabel} and adjacent zones`,
      `Itemized booking summary with online payment or Pay After Service`,
      `Quality workmanship on all completed daily tasks`,
      `Heavy-duty tools for clean and solid execution`,
      `Responsive customer helpline for prompt coordination`
    ],
    [
      `Dedicated local labour teams serving ${locationLabel} 7 days a week`,
      `Rapid dispatch for time-sensitive site repairs`,
      `Transparent upfront daily rates with clear scope of work`,
      `Guaranteed attendance backed by Fixbro Daily Labour`,
      `Polite, honest, and background-cleared workers`,
      `Complete work inspection before OTP sign-off`
    ]
  ];

  // 5. Serving Customers (Part 3 & 4 - 10 distinct variations)
  const paragraph3List = [
    `We provide skilled daily wage workers to apartments, independent houses, villas, gated communities, corporate offices, retail stores, and construction sites throughout ${locationLabel}.`,
    `Our daily labour network covers residential homes, renovation sites, retail shops, business centers, corporate offices, and gated communities throughout ${locationLabel}.`,
    `We extend full-day daily labour to residential complexes, villa associations, corporate hubs, showrooms, and renovation projects situated in ${locationLabel} and neighbouring sectors.`,
    `Whether you are renovating a home, managing an office interior, or running a construction site in ${locationLabel}, our daily workers are ready to assist you.`,
    `From standalone homes and high-rise apartments to tech parks and commercial properties across ${locationLabel}, we cater to diverse labour requirements with reliable daily wage workers.`,
    `Our verified tradesmen regularly serve residential societies, modern apartments, independent duplexes, and commercial office hubs situated throughout ${locationLabel}.`,
    `Whether it is a residential flat in ${locationLabel}, a commercial showroom, or an ongoing construction site, our workers deliver prompt and consistent daily productivity.`,
    `Serving gated townships, residential layouts, educational institutions, and corporate facilities across ${locationLabel} with dependable daily labour.`,
    `Homeowners, contractors, interior designers, and business managers in ${locationLabel} rely on Fixbro Daily Labour for scheduled and urgent project manpower.`,
    `We cater to all project types across ${locationLabel}, including apartment makeovers, luxury villas, commercial offices, and neighborhood retail establishments.`
  ];

  const paragraph4List = [
    `If you are searching for trusted ${targetLabel} near ${locationLabel}, ${cityName}, Fixbro Daily Labour helps you connect with experienced daily wage workers for quality work and dependable support.`,
    `For anyone seeking reliable ${targetLabel} near me in ${locationLabel}, our verified tradesmen provide fast, dedicated, and professional full-day assistance.`,
    `Get connected to the best ${targetLabel} near you in ${locationLabel} today. Experience reliable full-day labour with Fixbro Daily Labour.`,
    `Searching for affordable ${targetLabel} near you in ${locationLabel}? Look no further. Fixbro Daily Labour guarantees verified workers with maximum convenience.`,
    `Choose Fixbro Daily Labour for top-notch ${targetLabel} near ${locationLabel}, ${cityName}. Book online in under two minutes and enjoy seamless on-site labour.`,
    `Need quick and dependable ${targetLabel} in ${locationLabel}? Book your trusted local worker with Fixbro Daily Labour today and get upfront fixed daily rates.`,
    `Discover top-rated ${targetLabel} near you in ${locationLabel}. Experience punctual arrivals, full-day productivity, and secure OTP verification.`,
    `For verified ${targetLabel} in ${locationLabel}, ${cityName}, trust Fixbro Daily Labour for guaranteed attendance and hassle-free scheduling.`,
    `Connect with vetted ${targetLabel} workers near you in ${locationLabel} today. Enjoy quick booking, upfront daily rates, and friendly support.`,
    `Find the most reliable ${targetLabel} near you in ${locationLabel}. Fixbro Daily Labour delivers quality daily manpower directly to your project location.`
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
    <h3 class="text-lg font-bold text-slate-900">Benefits of Booking Daily Labour in ${locationLabel}</h3>
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
    <h3 class="text-lg font-bold text-slate-900">Serving Projects Across ${locationLabel}</h3>
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
  const cat2 = topCats[1] || 'Painting';
  const cat3 = topCats[2] || 'Electrical';
  const trade1 = getCategorySearchTerm(cat1);
  const trade2 = getCategorySearchTerm(cat2);
  const trade3 = getCategorySearchTerm(cat3);
  const catsText = topCats.length > 0 ? topCats.join(', ') : "Carpentry, Painting, Electrical";
  const tradesText = [trade1, trade2, trade3].join(', ');

  const areaList = nearbyAreas ? nearbyAreas.map(a => a.name) : [];
  const formattedAreas = areaList.slice(0, 10).join(', ');
  const localCoverageText = formattedAreas ? ` covering areas like ${formattedAreas}` : '';

  // 10 H1 Templates (Daily Labour + category names)
  const h1Templates = [
    `Daily Labour in ${cityName}`,
    `${trade1}, ${trade2} & Daily Labour in ${cityName}`,
    `Hire Daily Labour in ${cityName}`,
    `Doorstep Daily Labour in ${cityName}`,
    `Daily Wage Workers in ${cityName}`,
    `${tradesText} Daily Labour in ${cityName}`,
    `Top-Rated Daily Labour in ${cityName}`,
    `Verified Daily Labour & Workers in ${cityName}`,
    `Full-Day Daily Labour in ${cityName}`,
    `Reliable Daily Wage Labour in ${cityName}`
  ];

  // 10 Title Templates (strictly under 55-60 chars: daily labour + category names + near me)
  const titleTemplates = [
    `Daily Labour in ${cityName} | ${trade1}, ${trade2} Near Me`,
    `${trade1}, ${trade2} Daily Labour in ${cityName} | Near Me`,
    `Hire Daily Labour in ${cityName} | ${trade1} Near Me`,
    `Daily Labour in ${cityName} | Daily Wage Workers Near Me`,
    `Doorstep Daily Labour in ${cityName} | ${trade1} Near Me`,
    `Daily Wage Workers in ${cityName} | ${trade1} & ${trade2}`,
    `Verified Daily Labour in ${cityName} | Near Me`,
    `${trade1}, ${trade2} Daily Labour in ${cityName}`,
    `Affordable Daily Labour in ${cityName} | ${trade1} Near Me`,
    `Full-Day Daily Labour in ${cityName} | ${trade1} Near Me`
  ];

  // 10 Description Templates (under 155 chars: daily labour + category names + near me)
  const descTemplates = [
    `Looking for verified daily labour in ${cityName} near you? Hire trusted ${tradesText} and skilled daily wage workers for full-day work with upfront rates.`,
    `Hire professional ${tradesText} daily labour in ${cityName} near me. Background-verified workers, full-day booking, scheduled convenience, zero hidden fees.`,
    `Get verified daily labour in ${cityName} today. Skilled daily wage workers for ${tradesText} with friendly assistance. Book your slot near you now!`,
    `Fixbro Daily Labour offers verified daily wage workers in ${cityName} near you. Book specialists for ${catsText}${localCoverageText} with upfront daily rates.`,
    `Find verified daily labour in ${cityName}. Skilled trade workers for ${catsText}. Transparent daily wages and guaranteed attendance.`,
    `Book on-demand ${tradesText} daily labour in ${cityName}. Certified workers, upfront daily rates, and quick arrival near you.`,
    `Need urgent daily labour in ${cityName}? Fixbro Daily Labour provides same-day doorstep solutions for ${tradesText}. Background-checked workers near you.`,
    `Top-rated daily labour and skilled workers in ${cityName}. Connect with verified pros for ${catsText}. Transparent billing, warranty, and fast arrival.`,
    `Reliable doorstep daily labour in ${cityName} near you. Expert workers for ${tradesText}. Instant booking and upfront daily quotes.`,
    `Full-day daily labour across ${cityName}. Book vetted daily wage workers for ${catsText}. Fast, trusted, and affordable near you.`
  ];

  const keywordsList: string[] = [
    `daily labour ${cityName}`,
    `daily labour near me`,
    `${cityName} daily labour`,
    `hire daily labour ${cityName}`,
    `daily wage workers ${cityName}`,
    `daily wage workers near me`,
    `doorstep daily labour in ${cityName}`,
    `local daily labour ${cityName}`,
    `booking daily labour in ${cityName}`,
    `professional daily labour ${cityName}`
  ];

  categoryNames.forEach(cat => {
    const cleanCat = cat.toLowerCase();
    const cleanTrade = getCategorySearchTerm(cat).toLowerCase();
    keywordsList.push(`${cleanTrade} daily labour ${cityName}`);
    keywordsList.push(`${cleanTrade} daily labour near me`);
    keywordsList.push(`${cleanCat} daily labour ${cityName}`);
    keywordsList.push(`daily wage ${cleanTrade} in ${cityName}`);
    keywordsList.push(`${cleanTrade} daily wage workers near me`);
  });

  areaList.slice(0, 10).forEach(area => {
    keywordsList.push(`daily labour in ${area} near me`);
    keywordsList.push(`${trade1.toLowerCase()} daily labour in ${area}`);
    keywordsList.push(`${trade2.toLowerCase()} daily labour in ${area}`);
  });

  const generic = [
    `daily labour contractor ${cityName}`,
    `daily wage workers in ${cityName}`, `certified labour ${cityName}`, `daily labour near you`,
    `fixbro daily labour ${cityName}`, `labour booking app ${cityName}`, `hire skilled labour ${cityName}`,
    `construction labour ${cityName}`, `local workers ${cityName}`, `daily wage technicians ${cityName}`,
    `daily labour carpenter near me`, `daily labour painter near me`
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
  const cat2 = topCats[1] || 'Painting';
  const cat3 = topCats[2] || 'Electrical';
  const trade1 = getCategorySearchTerm(cat1);
  const trade2 = getCategorySearchTerm(cat2);
  const trade3 = getCategorySearchTerm(cat3);
  const catsText = topCats.length > 0 ? topCats.join(', ') : "Carpentry, Painting, Electrical";
  const tradesText = [trade1, trade2, trade3].join(', ');

  const areaList = nearbyAreas ? nearbyAreas.map(a => a.name) : [];
  const formattedAreas = areaList.slice(0, 10).join(', ');
  const localCoverageText = formattedAreas ? ` and surrounding sectors like ${formattedAreas}` : '';

  // 10 H1 Templates
  const h1Templates = [
    `Daily Labour in ${areaName}`,
    `${trade1}, ${trade2} & Daily Labour in ${areaName}`,
    `Hire Daily Labour in ${areaName}`,
    `Doorstep Daily Labour in ${areaName}`,
    `Daily Wage Workers in ${areaName}`,
    `${tradesText} Daily Labour in ${areaName}`,
    `Top-Rated Daily Labour in ${areaName}`,
    `Verified Daily Labour in ${areaName}`,
    `Full-Day Daily Labour in ${areaName}`,
    `Reliable Daily Labour in ${areaName}`
  ];

  // 10 Title Templates (strictly under 55-60 chars)
  const titleTemplates = [
    `Daily Labour in ${areaName}, ${cityName} | Near Me`,
    `${trade1}, ${trade2} Daily Labour in ${areaName} | Near Me`,
    `Daily Labour in ${areaName} | ${trade1}, ${trade2} Near Me`,
    `Hire Daily Labour in ${areaName}, ${cityName} | Near Me`,
    `Doorstep Daily Labour in ${areaName} | ${trade1} Near Me`,
    `Daily Wage Workers in ${areaName}, ${cityName} | Near Me`,
    `${trade1}, ${trade2} & Daily Labour in ${areaName} | Near Me`,
    `Verified Daily Labour in ${areaName} | ${trade1} Near Me`,
    `Daily Labour in ${areaName}, ${cityName} | Daily Wage`,
    `Affordable Daily Labour in ${areaName} | Near Me`
  ];

  // 10 Description Templates (under 155 chars)
  const descTemplates = [
    `Looking for verified daily labour in ${areaName}, ${cityName} near you? Fixbro Daily Labour connects you with trusted workers for ${tradesText}. Book online!`,
    `Need professional daily labour in ${areaName} near me? Find background-verified workers for ${tradesText} in ${cityName}. Zero hidden fees.`,
    `Get verified daily wage workers in ${areaName} today. Our local tradesmen offer full-day labour for ${tradesText}. Book your slot near you now!`,
    `Fixbro Daily Labour offers verified workers in ${areaName} near you. Book specialists for ${catsText}${localCoverageText} with upfront daily rates.`,
    `Find verified daily labour in ${areaName}, ${cityName}. Fast doorstep arrival for ${tradesText}. Transparent daily pricing and verified attendance.`,
    `Book on-demand daily labour in ${areaName}. Certified workers for ${tradesText}. Upfront rates and guaranteed full-day support.`,
    `Need urgent daily labour in ${areaName}? Fixbro Daily Labour provides same-day doorstep workers for ${tradesText}. Background-checked workers near you.`,
    `Top-rated daily labour and skilled workers in ${areaName}, ${cityName}. Connect with verified pros for ${catsText}. Upfront daily rates.`,
    `Reliable doorstep daily labour in ${areaName} near you. Expert workers for ${tradesText}. Instant booking and upfront quotes.`,
    `Full-day daily labour across ${areaName}. Book vetted daily wage workers for ${catsText}. Fast, trusted & affordable near you.`
  ];

  const keywordsList: string[] = [
    `daily labour ${areaName}`,
    `daily labour near me`,
    `${areaName} daily labour`,
    `hire daily labour ${areaName}`,
    `${areaName} daily wage workers near me`,
    `doorstep daily labour in ${areaName}`,
    `local daily labour ${areaName}`
  ];

  categoryNames.forEach(cat => {
    const cleanCat = cat.toLowerCase();
    const cleanTrade = getCategorySearchTerm(cat).toLowerCase();
    keywordsList.push(`${cleanTrade} daily labour in ${areaName}`);
    keywordsList.push(`${cleanTrade} daily labour near me ${areaName}`);
    keywordsList.push(`best ${cleanTrade} daily labour in ${areaName}`);
    keywordsList.push(`daily wage ${cleanTrade} in ${areaName}`);
  });

  areaList.slice(0, 10).forEach(na => {
    keywordsList.push(`daily labour in ${na} near me`);
    keywordsList.push(`${trade1.toLowerCase()} daily labour in ${na}`);
  });

  const generic = [
    `daily wage workers ${areaName}`,
    `labour contractor ${areaName}`, `certified labour ${areaName}`, `daily labour near you`,
    `fixbro daily labour ${areaName}`, `labour app ${areaName}`, `hire skilled labour ${areaName}`,
    `construction labour ${areaName}`, `local workers ${areaName}`, `daily wage technicians ${areaName}`,
    `daily labour near me ${areaName}`
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
  const servicesText = cleanServices.length > 0 ? cleanServices.slice(0, 4).join(', ') : `${trade} work, repairs & site installations`;

  const areaList = nearbyAreas ? nearbyAreas.map(a => a.name) : [];
  const formattedAreas = areaList.slice(0, 10).join(', ');
  const localCoverageText = formattedAreas ? ` covering areas like ${formattedAreas}` : '';

  // 10 H1 Templates
  const h1Templates = [
    `${trade} Daily Labour in ${cityName}`,
    `Hire ${trade} Daily Labour in ${cityName}`,
    `Verified ${trade} Daily Wage Workers in ${cityName}`,
    `Doorstep ${trade} Daily Labour in ${cityName}`,
    `Best ${trade} Daily Labour in ${cityName}`,
    `Top-Rated ${trade} Daily Labour in ${cityName}`,
    `Verified ${trade} Daily Labour in ${cityName}`,
    `Full-Day ${trade} Daily Labour in ${cityName}`,
    `Affordable ${trade} Daily Labour in ${cityName}`,
    `Certified ${trade} Daily Labour in ${cityName}`
  ];

  // 10 Title Templates (strictly under 55-60 chars: category + daily labour + near me)
  const titleTemplates = [
    `${trade} Daily Labour in ${cityName} | Near Me`,
    `Hire ${trade} Daily Labour in ${cityName} | Near Me`,
    `${trade} Daily Labour in ${cityName} | Daily Wage`,
    `Best ${trade} Daily Labour in ${cityName} | Near Me`,
    `Doorstep ${trade} Daily Labour in ${cityName}`,
    `Top-Rated ${trade} Daily Labour in ${cityName}`,
    `${trade} Daily Labour in ${cityName} | ${srv1 || 'Full Day'}`,
    `Certified ${trade} Daily Labour in ${cityName}`,
    `Professional ${trade} Daily Labour in ${cityName}`,
    `Affordable ${trade} Daily Labour in ${cityName} | Near Me`
  ];

  // 10 Description Templates (under 155 chars: category + daily labour)
  const descTemplates = [
    `Looking for verified ${trade.toLowerCase()} daily labour in ${cityName} near you? Fixbro Daily Labour connects you with background-checked daily wage workers. Book now!`,
    `Hire professional ${trade.toLowerCase()} daily labour in ${cityName} near me. Background-verified workers, 09:30 AM – 05:30 PM shift, zero hidden fees.`,
    `Get verified ${trade.toLowerCase()} daily wage workers in ${cityName} today. Our local tradesmen offer full-day labour for ${servicesText}${localCoverageText}.`,
    `Fixbro Daily Labour offers top-quality ${trade.toLowerCase()} daily labour in ${cityName} near you. Book verified workers with upfront daily rates.`,
    `Searching for the best ${trade.toLowerCase()} daily labour in ${cityName}? Book background-checked experts for full-day work. Transparent flat daily rates.`,
    `Doorstep ${trade.toLowerCase()} daily labour in ${cityName}. Fast arrival, certified workers, and OTP verification for ${servicesText}. Book online!`,
    `Find skilled and reliable ${trade.toLowerCase()} daily labour in ${cityName} near you. Fixbro Daily Labour delivers transparent daily rates.`,
    `Urgent ${trade.toLowerCase()} daily labour needed in ${cityName}? Get instant booking and same-day arrival from verified trade workers.`,
    `Connect with background-verified ${trade.toLowerCase()} daily labour in ${cityName}. Transparent daily rates, professional tools, and verified attendance.`,
    `Affordable, trusted ${trade.toLowerCase()} daily labour across ${cityName}. Experienced trade workers ready for full-day projects. Book today!`
  ];

  const cleanTrade = trade.toLowerCase();
  const keywordsList: string[] = [
    `${cleanTrade} daily labour ${cityName}`,
    `${cleanTrade} daily labour near me`,
    `${cityName} ${cleanTrade} daily labour`,
    `hire ${cleanTrade} daily labour in ${cityName}`,
    `daily wage ${cleanTrade} in ${cityName}`,
    `best ${cleanTrade} daily labour near me`
  ];

  serviceNames.forEach(srv => {
    const cleanSrv = cleanServiceName(srv).toLowerCase();
    keywordsList.push(`${cleanSrv} daily labour ${cityName}`);
    keywordsList.push(`${cleanSrv} daily wage near me`);
  });

  areaList.slice(0, 10).forEach(area => {
    keywordsList.push(`${cleanTrade} daily labour in ${area}`);
    keywordsList.push(`${cleanTrade} daily labour in ${area} near me`);
  });

  const generic = [
    `local ${cleanTrade} daily labour ${cityName}`, `booking ${cleanTrade} daily labour in ${cityName}`,
    `professional ${cleanTrade} daily labour in ${cityName}`, `certified ${cleanTrade} daily labour near me`,
    `daily wage ${cleanTrade} ${cityName}`, `hire ${cleanTrade} for a day ${cityName}`,
    `fixbro daily labour ${cleanTrade} ${cityName}`, `labour booking ${cleanTrade} ${cityName}`,
    `daily labour carpenter near me`, `carpenter daily labour`
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

  const faqPool = [
    {
      question: `What are the working hours for ${trade.toLowerCase()} daily labour in ${cityName}?`,
      answer: `Our standard daily labour shift runs from 09:30 AM to 05:30 PM with a 1-hour lunch break between 01:00 PM and 02:00 PM (7 active working hours).`
    },
    {
      question: `How do I book a verified ${trade.toLowerCase()} daily labour worker in ${cityName}?`,
      answer: `Choose your category, select an approved worker based on skill level and daily rate, pick your date, and confirm your booking online or choose Pay After Service.`
    },
    {
      question: `What are the daily wage rates for ${trade.toLowerCase()} in ${cityName}?`,
      answer: `Fixbro Daily Labour offers transparent daily wage rates based on skill level (Fresher, Intermediate, Senior, Expert). The exact daily wage is displayed upfront before booking.`
    },
    {
      question: `Are the ${trade.toLowerCase()} daily workers background-verified?`,
      answer: `Yes, all workers undergo Government ID verification, trade skill checks, and background assessment before being approved on the platform.`
    },
    {
      question: `How does Start OTP and Complete OTP work?`,
      answer: `When the worker arrives at your site, share your 4-digit Start OTP to begin work. When the full day's work is completed, share the Complete OTP to verify finish.`
    },
    {
      question: `Can I book ${trade.toLowerCase()} daily labour for multiple consecutive days?`,
      answer: `Yes, you can easily book workers for a single day or consecutive days directly during checkout.`
    },
    {
      question: `What types of work do ${trade.toLowerCase()} daily workers handle in ${cityName}?`,
      answer: `Our certified workers handle repairs, new installations, site renovation, furniture work, and customized trade tasks for full-day shifts.`
    },
    {
      question: `Do daily labour workers bring their own tools?`,
      answer: `Yes, all skilled daily labour workers bring standard professional hand tools required for their daily tasks.`
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
    imageHint: `${trade.toLowerCase()} daily labour ${cityName.toLowerCase()}`
  };
}

export function generateFreeAreaCategorySeoData(cityName: string, areaName: string, categoryName: string, serviceNames: string[], nearbyAreas?: Array<{ id: string; name: string; slug: string }>) {
  const trade = getCategorySearchTerm(categoryName);
  const idx = Math.floor(Math.random() * 10);
  const cleanServices = serviceNames.map(s => cleanServiceName(s)).filter(Boolean);
  const srv1 = cleanServices[0] || '';
  const servicesText = cleanServices.length > 0 ? cleanServices.slice(0, 4).join(', ') : `${trade} work, ${trade} repairs & installations`;

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
    `${trade} Daily Labour in ${areaName}`,
    `Hire ${trade} Daily Labour in ${areaName}`,
    `Verified ${trade} Daily Labour in ${areaName}`,
    `Doorstep ${trade} Daily Labour in ${areaName}`,
    `Best ${trade} Daily Labour in ${areaName}`,
    `Top-Rated ${trade} Daily Labour in ${areaName}`,
    `Full-Day ${trade} Daily Labour in ${areaName}`,
    `Daily Wage ${trade} in ${areaName}`,
    `Affordable ${trade} Daily Labour in ${areaName}`,
    `Certified ${trade} Daily Labour in ${areaName}`
  ];

  // 10 Title Templates (strictly under 55-60 chars)
  const titleTemplates = [
    `${trade} Daily Labour in ${areaName}, ${cityName} | Near Me`,
    `${trade} Daily Labour in ${areaName} | Near Me`,
    `Hire ${trade} Daily Labour in ${areaName} | Near Me`,
    `Best ${trade} Daily Labour in ${areaName}, ${cityName}`,
    `Daily Wage ${trade} in ${areaName} | Near Me`,
    `Verified ${trade} Daily Labour in ${areaName}`,
    `Doorstep ${trade} Daily Labour in ${areaName}`,
    `Top-Rated ${trade} Daily Labour in ${areaName}`,
    `Full-Day ${trade} Daily Labour in ${areaName}`,
    `Affordable ${trade} Daily Labour in ${areaName} | Near Me`
  ];

  // 10 Description Templates (under 155 chars)
  const descTemplates = [
    `Looking for verified ${trade.toLowerCase()} daily labour in ${areaName}, ${cityName} near you? Fixbro Daily Labour connects you with local daily wage workers for full-day jobs.`,
    `Hire professional ${trade.toLowerCase()} daily labour in ${areaName} near me. Background-verified workers, 09:30 AM – 05:30 PM shift, zero hidden fees.`,
    `Get verified ${trade.toLowerCase()} daily wage workers in ${areaName} today. Our local tradesmen offer full-day labour with friendly assistance.`,
    `Fixbro Daily Labour offers top-quality ${trade.toLowerCase()} daily labour in ${areaName} near you. Book verified specialists covering ${nearbyList.slice(0, 3).join(', ')}.`,
    `Searching for the best ${trade.toLowerCase()} daily labour in ${areaName}? Book background-checked workers for full-day work. Transparent flat daily rates.`,
    `Doorstep ${trade.toLowerCase()} daily labour in ${areaName}, ${cityName}. Fast arrival, certified workers, and OTP verification for ${servicesText}. Book online!`,
    `Find skilled and reliable ${trade.toLowerCase()} daily labour in ${areaName} near you. Fixbro Daily Labour delivers transparent daily rates.`,
    `Urgent ${trade.toLowerCase()} daily labour needed in ${areaName}? Get instant booking and same-day arrival from verified trade workers.`,
    `Connect with background-verified ${trade.toLowerCase()} daily labour in ${areaName}. Transparent daily rates, professional tools, and verified attendance.`,
    `Affordable, trusted ${trade.toLowerCase()} daily labour across ${areaName}, ${cityName}. Experienced trade workers ready for full-day projects. Book today!`
  ];

  const cleanTrade = trade.toLowerCase();
  const keywordsList: string[] = [
    `${cleanTrade} daily labour ${areaName}`,
    `${cleanTrade} daily labour near me`,
    `${areaName} ${cleanTrade} daily labour`,
    `hire ${cleanTrade} daily labour ${areaName}`,
    `daily wage ${cleanTrade} in ${areaName}`,
    `best ${cleanTrade} daily labour in ${areaName}`
  ];

  serviceNames.forEach(srv => {
    const cleanSrv = cleanServiceName(srv).toLowerCase();
    keywordsList.push(`${cleanSrv} daily labour ${areaName}`);
    keywordsList.push(`${cleanSrv} daily wage ${areaName}`);
  });

  nearbyList.slice(0, 10).forEach(na => {
    keywordsList.push(`${cleanTrade} daily labour in ${na} near me`);
  });

  const generic = [
    `daily wage workers ${areaName}`,
    `labour contractor ${areaName}`, `certified labour ${areaName}`, `daily labour near you`,
    `fixbro daily labour ${areaName}`, `labour app ${areaName}`, `hire skilled labour ${areaName}`,
    `construction labour ${areaName}`, `local workers ${areaName}`, `daily wage technicians ${areaName}`,
    `daily labour near me ${areaName}`
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

  const faqPool = [
    {
      question: `Do you provide ${trade.toLowerCase()} daily labour in ${areaName}?`,
      answer: `Yes, Fixbro Daily Labour provides verified, top-rated ${trade.toLowerCase()} daily wage workers throughout ${areaName} and nearby areas like ${formattedAreas}.`
    },
    {
      question: `How quickly can a ${trade.toLowerCase()} daily worker arrive in ${areaName}?`,
      answer: `We offer fast doorstep response in ${areaName}. Same-day slots and advance bookings are available with punctual 09:30 AM arrival.`
    },
    {
      question: `What are the daily wage rates for ${trade.toLowerCase()} in ${areaName}, ${cityName}?`,
      answer: `Fixbro Daily Labour provides transparent, upfront daily rates with zero hidden fees. You see the worker's exact daily rate before booking.`
    },
    {
      question: `Are your ${trade.toLowerCase()} workers in ${areaName} verified?`,
      answer: `Yes, every worker is Government ID verified, trade skill evaluated, and follows on-site safety standards for your peace of mind.`
    },
    {
      question: `What are the working hours for daily labour in ${areaName}?`,
      answer: `Standard working hours are 09:30 AM to 05:30 PM with a 1-hour lunch break between 01:00 PM and 02:00 PM (7 active hours).`
    },
    {
      question: `Can I book ${trade.toLowerCase()} daily labour for commercial sites in ${areaName}?`,
      answer: `Absolutely. Fixbro Daily Labour caters to residential apartments, independent homes, villas, corporate offices, and renovation sites across ${areaName}.`
    },
    {
      question: `How does OTP verification work for daily labour in ${areaName}?`,
      answer: `Share your Start OTP when the worker arrives, and share your Complete OTP once the full day is completed.`
    },
    {
      question: `How do I pay for daily labour in ${areaName}?`,
      answer: `You can pay securely online via UPI, card, or choose Pay After Service upon full-day job completion.`
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
    imageHint: `${trade.toLowerCase()} daily labour ${areaName.toLowerCase()}`
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
    `${cleanName} Daily Labour in ${areaName}`,
    `Hire ${cleanName} Daily Labour in ${areaName}`,
    `Verified ${cleanName} in ${areaName}`,
    `Doorstep ${cleanName} in ${areaName}`,
    `Best ${cleanName} Daily Labour in ${areaName}`,
    `Top-Rated ${cleanName} in ${areaName}`,
    `Full-Day ${cleanName} Labour in ${areaName}`,
    `Daily Wage ${cleanName} in ${areaName}`,
    `Affordable ${cleanName} in ${areaName}`,
    `Expert ${cleanName} in ${areaName}`
  ];

  // 10 Title Templates (strictly under 55-60 chars)
  const titleTemplates = [
    `${cleanName} Daily Labour in ${areaName}, ${cityName}`,
    `${cleanName} Daily Labour in ${areaName} | Near Me`,
    `Hire ${cleanName} in ${areaName}, ${cityName} | Daily Wage`,
    `Best ${cleanName} Daily Labour in ${areaName} | Near Me`,
    `Doorstep ${cleanName} Daily Labour in ${areaName}`,
    `Top-Rated ${cleanName} in ${areaName} | Book Online`,
    `Verified ${cleanName} Daily Labour in ${areaName}`,
    `Certified ${cleanName} in ${areaName} | Fast Arrival`,
    `Affordable ${cleanName} Daily Labour in ${areaName}`,
    `Full-Day ${cleanName} in ${areaName} | Near Me`
  ];

  // 10 Description Templates (under 155 chars)
  const descTemplates = [
    `Looking for verified ${cleanName.toLowerCase()} daily labour in ${areaName}, ${cityName} near you? Fixbro Daily Labour connects you with verified local workers. Book online!`,
    `Hire professional ${cleanName.toLowerCase()} daily labour in ${areaName} near me. Background-verified workers in ${cityName}. Full-day booking, zero hidden fees.`,
    `Get verified ${cleanName.toLowerCase()} daily wage workers in ${areaName} today. Our local tradesmen offer full-day labour with transparent rates.`,
    `Fixbro Daily Labour offers top-quality ${cleanName.toLowerCase()} daily labour in ${areaName} near you. Book verified specialists covering ${nearbyList.slice(0, 3).join(', ')}.`,
    `Searching for the best ${cleanName.toLowerCase()} daily labour in ${areaName}? Book background-checked workers with upfront daily rates.`,
    `Doorstep ${cleanName.toLowerCase()} daily labour in ${areaName}, ${cityName}. Fast arrival, certified workers, and OTP verification. Book online!`,
    `Find skilled and reliable ${cleanName.toLowerCase()} daily labour in ${areaName} near you. Fixbro Daily Labour delivers transparent daily rates.`,
    `Urgent ${cleanName.toLowerCase()} daily labour needed in ${areaName}? Get instant booking and same-day arrival in ${cityName} from verified workers.`,
    `Connect with background-verified daily workers for ${cleanName.toLowerCase()} in ${areaName}. Transparent daily rates, professional tools, and verified attendance.`,
    `Affordable, trusted ${cleanName.toLowerCase()} daily labour across ${areaName}, ${cityName}. Experienced trade workers ready to assist. Book today!`
  ];

  const cleanSrv = cleanName.toLowerCase();
  const trade = getCategorySearchTerm(categoryName).toLowerCase();
  const keywordsList: string[] = [
    `${cleanSrv} daily labour ${areaName}`,
    `${cleanSrv} daily labour near me`,
    `${areaName} ${cleanSrv} daily labour`,
    `best ${cleanSrv} daily labour in ${areaName}`
  ];

  keywordsList.push(`${cleanSrv} daily wage in ${areaName}`);
  keywordsList.push(`${trade} daily labour in ${areaName}`);
  keywordsList.push(`best ${trade} daily labour in ${areaName} near me`);
  
  nearbyList.slice(0, 10).forEach(na => {
    keywordsList.push(`${cleanSrv} daily labour in ${na} near me`);
  });

  const generic = [
    `daily wage workers ${areaName}`,
    `labour contractor ${areaName}`, `certified labour ${areaName}`, `daily labour near you`,
    `fixbro daily labour ${areaName}`, `labour app ${areaName}`, `hire skilled labour ${areaName}`,
    `construction labour ${areaName}`, `local workers ${areaName}`, `daily wage technicians ${areaName}`,
    `daily labour near me ${areaName}`
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

  const faqPool = [
    {
      question: `Do you provide ${cleanName.toLowerCase()} daily labour in ${areaName}?`,
      answer: `Yes, Fixbro Daily Labour provides verified, top-rated ${cleanName.toLowerCase()} daily workers across ${areaName} and neighbouring areas like ${formattedAreas}.`
    },
    {
      question: `How quickly can I book a worker for ${cleanName.toLowerCase()} in ${areaName}?`,
      answer: `You can book online in under 2 minutes. We offer same-day appointments and advance bookings across ${areaName}, ${cityName}.`
    },
    {
      question: `What is the daily rate for ${cleanName.toLowerCase()} in ${areaName}?`,
      answer: `Pricing is transparent and fixed upfront on the worker's card. You see the clear daily wage before booking with no surprise hidden fees.`
    },
    {
      question: `Are the workers providing ${cleanName.toLowerCase()} background-verified?`,
      answer: `Yes, all Fixbro Daily Labour workers undergo Government ID verification and trade skill evaluations for your safety.`
    },
    {
      question: `What are the working hours for ${cleanName.toLowerCase()} daily labour?`,
      answer: `Work hours run from 09:30 AM to 05:30 PM with a 1-hour lunch break between 01:00 PM and 02:00 PM (7 active hours).`
    },
    {
      question: `How does OTP verification work?`,
      answer: `Share your Start OTP when the worker arrives on site, and Complete OTP when the day's tasks are finished.`
    },
    {
      question: `Can I schedule ${cleanName.toLowerCase()} for weekends?`,
      answer: `Yes, we offer flexible booking 7 days a week, including weekend shifts to suit your project schedule.`
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
    imageHint: `${cleanName.toLowerCase()} daily labour ${areaName.toLowerCase()}`
  };
}
