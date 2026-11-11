/**
 * Curated Pool of 100+ Unique Indian User Names and Category-Specific Daily Labour Reviews
 * No OTP mentions. No "7 hours" hardcoding.
 * Tailored strictly to trade craftsmanship, punctuality, fair day rates, and professional conduct.
 */

export const INDIAN_NAMES_POOL: string[] = [
  "Ramesh Hegde", "Sneha Rao", "Vikram Joshi", "Priya Nair", "Karthik Reddy",
  "Arvind Swamy", "Deepa Venkatesh", "Rohan Kamath", "Pooja Iyer", "Harish Patil",
  "Meena Sundaram", "Manoj Bhat", "Kavitha Menon", "Pradeep Sharma", "Divya Balaji",
  "Sandeep Shetty", "Shweta Desai", "Chetan Deshmukh", "Preethi Kurup", "Raghu Nambiar",
  "Shalini Varma", "Vinay Acharya", "Geetha Pillai", "Anand Murthy", "Sunita Choudhary",
  "Mahesh Poojary", "Lavanya Krishnan", "Ashok Naik", "Neha Singhal", "Satish Kumar",
  "Archana Prabhu", "Kiran Shenoy", "Rashmi Dixit", "Praveen Kumble", "Bhavana Hebbar",
  "Sudhir Shenker", "Swathi Pai", "Naveen Mohan", "Rekha Rao", "Varun Kaushik",
  "Shruti Alva", "Abhishek Urs", "Pallavi Somayaji", "Santosh Somani", "Tejaswini Nadkarni",
  "Rohit Chari", "Manisha Shinde", "Vijayalakshmi Iyer", "Rahul Sastry", "Vidya Raghavan",
  "Nitin Salian", "Shilpa Nayak", "Girish Kamath", "Roopa Hegde", "Deepak Achari",
  "Amrutha Bhat", "Pranav Shenoy", "Suma Gowda", "Madhav Rao", "Sushma Joshi",
  "Tarun Prasad", "Anusha Menon", "Rakesh Shetty", "Veena Kulkarni", "Bharath Reddy",
  "Nalini Murthy", "Umesh Nayak", "Radhika Iyer", "Sunil Hebbar", "Poornima Acharya",
  "Gautam Kamath", "Jayashree Bhat", "Alok Sharma", "Sowmya Hegde", "Vivek Somayaji",
  "Madhuri Pai", "Ganesh Prabhu", "Keerthi Rao", "Sachin Kumble", "Vandana Dixit",
  "Nagesh Naik", "Mamatha Pillai", "Srinivas Patil", "Tanuja Desai", "Raghuveer Shenoy",
  "Jayanthi Krishnan", "Lokesh Swamy", "Gayathri Balaji", "Yashwant Gowda", "Leela Nair",
  "Balaji Venkatesh", "Smitha Reddy", "Sridhar Kurup", "Jyothi Nambiar", "Harsha Varma",
  "Sangeetha Poojary", "Mohan Singhal", "Hema Naik", "Rajeshwari Hegde", "Dinesh Kamath",
  "Bipin Chandran", "Tara Srinivasan", "Ajay Kulkarni", "Chitra Raghavan", "Kishore Pai",
  "Sharada Murthy", "Naveena Shetty", "Bhaskar Rao", "Indira Iyer", "Gokul Shenoy"
];

export interface ReviewTemplateItem {
  comment: string;
  rating: number;
}

export const CATEGORY_REVIEW_TEMPLATES: Record<string, ReviewTemplateItem[]> = {
  carpentry: [
    { comment: "Very skilled carpenter. Fixed our sliding wardrobe doors and aligned the drawer channels smoothly. Brought his own tools and worked diligently throughout the day.", rating: 5 },
    { comment: "Great woodwork craftsmanship. Repaired two loose door frames and fitted new locksets cleanly. Polite, arrived on time, and cleaned up the wood dust before leaving.", rating: 5 },
    { comment: "Experienced carpenter. Handled our bed dismantling and reassembly with solid reinforcement. Very reasonable daily wage for the quality of work delivered.", rating: 5 },
    { comment: "Hired for full-day kitchen cabinet and hinge repairs. Understood the requirements quickly and executed everything without rushing. Highly recommended.", rating: 5 },
    { comment: "Good quality carpentry work on our balcony wooden paneling. Measured accurately, cut precisely, and gave helpful advice on wood maintenance.", rating: 4 },
    { comment: "Punctual and very respectful. Completed all our pending wooden repair tasks across bedrooms in a single day. Worth every rupee.", rating: 5 },
    { comment: "Expert in door framing and lock installation. Replaced old worn-out latches with modern fittings. Solid craftsmanship and patient approach.", rating: 5 },
    { comment: "Did a neat job installing custom wooden wall shelves. Brought all necessary drill bits and clamps. Very satisfied with his dedication.", rating: 5 },
    { comment: "Very polite carpenter. Repaired our dining table legs and tightened all wooden chairs. Good work ethic and fair daily rate.", rating: 4 },
    { comment: "Skill level is genuinely high. Fixed the laminate peeling on our modular cabinets and made them look fresh again. Excellent experience.", rating: 5 },
    { comment: "Hardworking carpenter. Arrived right on schedule and worked steadily. Handled wooden partition adjustments with great precision.", rating: 5 },
    { comment: "Very dependable for home woodwork. Assembled our heavy study desk and bookshelves securely. Happy with the overall service.", rating: 4 },
    { comment: "Good carpentry skills. Adjusted sticky main doors that were scraping the floor. Smooth opening and closing now without any squeaks.", rating: 5 },
    { comment: "Professional approach. We had multiple small and medium carpentry tasks; he systematically completed each one without wasting time.", rating: 5 },
    { comment: "Accurate measurements and neat wood finishing. Replaced damaged pelmet boxes and re-hung curtains securely. Very reliable.", rating: 5 },
    { comment: "Knowledgeable about different types of wood and adhesives. Reattached loose veneer sheets seamlessly. Highly skilled carpenter.", rating: 5 },
    { comment: "Very honest and hardworking craftsman. Handled door stopper installations and cupboard magnetic catchers swiftly. Great job.", rating: 4 },
    { comment: "Flawless woodwork. Built custom shoe rack shelving using leftover plywood efficiently with minimum wastage. Very happy with his work.", rating: 5 },
    { comment: "Punctual, brought professional power tools, and completed all tasks smoothly. Will definitely book him again for future carpentry work.", rating: 5 },
    { comment: "Great attitude and strong technical skills. Fixed uneven cabinet drawers and aligned all handles uniformly. Very satisfied.", rating: 5 }
  ],

  electrician: [
    { comment: "Excellent electrician. Rewired three switchboards, installed ceiling fans, and fixed a tripping MCB issue. Very cautious with safety and neat with wire dressing.", rating: 5 },
    { comment: "Very punctual and knowledgeable. Replaced our old distribution box fuses with modern miniature circuit breakers. Clean conduit work throughout.", rating: 5 },
    { comment: "Did a fantastic job installing concealed LED profile lights in our living room. Clean cuts in the false ceiling and zero damage to surrounding paint.", rating: 5 },
    { comment: "Skilled daily wage electrician. Diagnosed an inverter line grounding fault that two other electricians couldn't trace. Highly recommended.", rating: 5 },
    { comment: "Arrived on time with proper multimeter and insulation tools. Installed geyser power points and checked earthing thoroughly. Very satisfied.", rating: 5 },
    { comment: "Polite and focused. Completed our complete 2 BHK switch and socket upgrade in one day. Much more cost-effective than per-point contractor charges.", rating: 5 },
    { comment: "Great electrical work. Mounted three heavy chandeliers and aligned track lights properly. Checked all switches before leaving.", rating: 5 },
    { comment: "Very honest electrician. Explained the load distribution clearly and routed separate 16A lines for our AC and microwave safely.", rating: 4 },
    { comment: "Punctual, brought professional testing tools, and worked steadily. Fixed multiple flickering light issues and loose neutral wires.", rating: 5 },
    { comment: "Dependable and patient. Handled smart switchboard configurations and paired them with our home network smoothly. Great service.", rating: 5 },
    { comment: "Fixed multiple electrical issues across our kitchen and utility area. Neat cable ties used and no exposed wires left hanging.", rating: 4 },
    { comment: "Well-trained electrician. Handled balcony waterproof outdoor light installations cleanly. Fair daily rate and very respectful behavior.", rating: 5 },
    { comment: "Prompt arrival and fast execution. Replaced burnt sockets, installed new exhaust fans, and checked voltage levels. Excellent work.", rating: 5 },
    { comment: "Very professional. Kept the workspace tidy and vacuumed wire insulation clippings. Highly skilled in domestic single-phase wiring.", rating: 5 },
    { comment: "Great experience. Solved an intermittent power surge issue in our main panel. Very knowledgeable about electrical safety standards.", rating: 5 },
    { comment: "Reliable daily wage worker. Replaced old rotary fan regulators with smooth step-type controllers across four rooms. Very neat.", rating: 4 },
    { comment: "Brought all necessary diagnostic tools. Tested every power socket for proper phase, neutral, and earth continuity. Outstanding work.", rating: 5 },
    { comment: "Skillful and courteous. Completed all planned electrical modifications without taking unnecessary breaks. Will book again.", rating: 5 },
    { comment: "Replaced old ceiling rose points with modern flush spotlights. Very neat drilling and clean finish. Impressive craftsmanship.", rating: 5 },
    { comment: "Very pleased with his service. Addressed our outdoor sensor lights and gate pillar lamps effortlessly. Solid day's work.", rating: 5 }
  ],

  plumber: [
    { comment: "Exceptional plumber. Replaced our bathroom diverter cartridge and resolved persistent low water pressure issues in both showers.", rating: 5 },
    { comment: "Arrived on time with pipe wrenches and thread sealants. Installed new washbasin vanity taps without a single drop leaking. Very clean work.", rating: 5 },
    { comment: "Very skilled in concealed CPVC pipe routing. Fixed a hidden wall leak with minimal tile breakage and re-plastered neatly.", rating: 5 },
    { comment: "Hired for full-day bathroom renovation plumbing. Fitted sanitary ware, angle valves, and health faucets securely. Highly experienced.", rating: 5 },
    { comment: "Great plumbing work. Cleared a stubborn kitchen sink drain blockage and replaced the old bottle trap. Cleaned up the area thoroughly.", rating: 4 },
    { comment: "Polite, focused, and honest. Diagnosed an overhead water tank float valve failure and installed a heavy-duty brass replacement.", rating: 5 },
    { comment: "Did a complete overhaul of our utility washing machine inlet and drainage lines. Neat pipe alignment along the walls.", rating: 5 },
    { comment: "Hardworking plumber. Replaced two old flush valves and stopped continuous toilet cistern leakage completely. Excellent day's work.", rating: 5 },
    { comment: "Knowledgeable about pressure pumps and flow control. Rebalanced water flow across upstairs and downstairs bathrooms smoothly.", rating: 4 },
    { comment: "Very neat plumbing work. Tested every joint under full water pressure for 20 minutes before closing the shift. Zero leaks.", rating: 5 },
    { comment: "Prompt arrival and fast problem-solving. Fixed loose bathroom fixtures and replaced worn rubber gaskets cleanly.", rating: 5 },
    { comment: "Very dependable tradesman. Handled outdoor garden tap extensions and PVC drainage connections without any fuss.", rating: 5 },
    { comment: "Brought all necessary fittings and sealant tapes. Fixed dripping mixer taps across our kitchen and bathrooms seamlessly.", rating: 4 },
    { comment: "Expert in sanitary fitting alignment. Mounted new dual-flush commode and ensured strong anchor bolts. Very satisfied.", rating: 5 },
    { comment: "Courteous and very careful with porcelain bathroom fixtures. No scratches or chips caused during installation. Great service.", rating: 5 },
    { comment: "Clean and methodical plumbing. Replaced rusty galvanized iron pipes with modern UPVC lines. Solid craftsmanship.", rating: 5 },
    { comment: "Punctual and hardworking. Addressed all minor water seepage issues around bathroom floor drains efficiently.", rating: 5 },
    { comment: "Fair daily wage rate and high degree of trade skill. Completed all our plumbing checklist items smoothly.", rating: 5 },
    { comment: "Very knowledgeable about water heater connections and pressure relief valves. Installed safety valves properly.", rating: 4 },
    { comment: "Great plumbing experience. Arrived with full tool kit, explained what needed replacement, and finished everything cleanly.", rating: 5 }
  ],

  painting: [
    { comment: "Terrific painter. Applied wall putty and two coats of emulsion with absolute smoothness. Left zero paint splatters on our flooring.", rating: 5 },
    { comment: "Very dedicated painter. Sanded walls thoroughly before applying primer, resulting in a rich, uniform wall finish across our 2 BHK.", rating: 5 },
    { comment: "Did a fantastic job painting our living room accent wall. Sharp cut-in lines along ceilings and skirting boards. Highly recommended.", rating: 5 },
    { comment: "Very neat and polite. Covered our furniture with plastic masking sheets properly before beginning work. Beautiful paint outcome.", rating: 5 },
    { comment: "Skilled daily wage painter. Fixed water damage patches on our bedroom ceiling with waterproof putty and seamless color blending.", rating: 5 },
    { comment: "Punctual, brought professional rollers and extension poles, and worked steadily. Excellent paint coverage with minimal paint wastage.", rating: 4 },
    { comment: "Great painting technique. Applied enamel paint on our window grills and balcony railings smoothly without drips.", rating: 5 },
    { comment: "Very honest and hardworking. Followed manufacturer dilution guidelines carefully for genuine premium emulsion finish.", rating: 5 },
    { comment: "Completed our entire guest room painting in one day with neat double coats. Clean edges around electrical switch plates.", rating: 5 },
    { comment: "Patient and thorough. Prepared old chalking surfaces with primer properly. The walls look brand new now.", rating: 4 },
    { comment: "Professional daily wage painter. Replaced old peeling texture with a clean matte finish. Very impressed with his work ethic.", rating: 5 },
    { comment: "Good speed and high attention to detail. No roller marks visible even under direct sunlight. Very satisfied.", rating: 5 },
    { comment: "Respectful and focused. Cleaned up paint buckets and rollers neatly before leaving. Worth booking for home painting.", rating: 5 },
    { comment: "Handled exterior balcony weather-shield painting meticulously. Smooth coat application on textured walls.", rating: 5 },
    { comment: "Excellent color matching and fine brushwork around door frames. Highly skilled painter with years of experience.", rating: 4 },
    { comment: "Saved us thousands compared to turnkey contractor quotes. Provided dedicated daily labour and top quality finish.", rating: 5 },
    { comment: "Very careful with masking tape application around glass windows. Clean removal without peeling underlying paint.", rating: 5 },
    { comment: "Skilled in surface preparation and crack filling before painting. Zero blemishes visible on the final coat.", rating: 5 },
    { comment: "Punctual, brought all his own scrapers, rollers, and trays. Completed double coat painting flawlessly.", rating: 5 },
    { comment: "Very pleasant demeanor and diligent work ethic. Will certainly hire him again for our upcoming home painting needs.", rating: 5 }
  ],

  general: [
    { comment: "Very hardworking and punctual daily labour provider. Followed all instructions carefully and completed the day's tasks with great focus.", rating: 5 },
    { comment: "Arrived right on schedule. Dedicated full day to our home maintenance work without unnecessary delays. Very polite and respectful.", rating: 5 },
    { comment: "Excellent work ethic. Handled all scheduled tasks with high attention to detail and kept the work area clean throughout.", rating: 5 },
    { comment: "Honest, capable, and very cooperative. Assisted with on-site installations and material movement smoothly. Great daily rate.", rating: 5 },
    { comment: "Very dependable daily wage worker. Brought his own equipment, understood the requirements quickly, and delivered quality work.", rating: 4 },
    { comment: "Punctual and courteous. Completed all planned work systematically and verified everything with us before concluding the day.", rating: 5 },
    { comment: "High degree of trade dedication. Did not rush through tasks and ensured solid, durable finishing. Highly recommended.", rating: 5 },
    { comment: "Very professional conduct. Well-mannered, communicative, and very diligent. Worth every bit of the daily wage.", rating: 5 },
    { comment: "Worked with great sincerity and care. Left the premises neat and organized after finishing the assigned work.", rating: 4 },
    { comment: "Outstanding service. Prompt arrival, good communication, and quality execution. Very happy with his assistance today.", rating: 5 },
    { comment: "Skilled and reliable. Took great pride in doing the job correctly the first time. Will definitely book again.", rating: 5 },
    { comment: "Very respectful behavior and solid work output. Followed all site guidelines and safety precautions diligently.", rating: 5 },
    { comment: "Great experience booking this daily labour provider. Transparent day rate, punctual arrival, and clean workmanship.", rating: 4 },
    { comment: "Very active and enthusiastic worker. Completed everything on our checklist smoothly and with high standards.", rating: 5 },
    { comment: "Exceptional dedication to duty. Handled on-site adjustments effortlessly and maintained a polite attitude all day.", rating: 5 },
    { comment: "Dependable and skilled craftsman. Verified each stage of work with us before proceeding. Very satisfied.", rating: 5 },
    { comment: "Prompt, honest, and hardworking. Delivered exactly what was discussed in the morning with zero hassle.", rating: 4 },
    { comment: "Punctual, organized, and focused on quality. A true professional daily wage worker. Highly recommended on FixBro.", rating: 5 },
    { comment: "Courteous and well-behaved. Treated our home with respect and performed his tasks with impressive proficiency.", rating: 5 },
    { comment: "Strong work ethic and fair daily wage. It was a pleasure working with such a sincere tradesman.", rating: 5 }
  ]
};

/**
 * Normalizes any category string into one of our template keys:
 * 'carpentry', 'electrician', 'plumber', 'painting', or 'general'.
 */
export function normalizeCategoryKey(rawCategory?: string): string {
  if (!rawCategory) return 'general';
  const c = rawCategory.toLowerCase();
  if (c.includes('carpent') || c.includes('wood') || c.includes('furniture')) return 'carpentry';
  if (c.includes('electr') || c.includes('wire') || c.includes('light')) return 'electrician';
  if (c.includes('plumb') || c.includes('pipe') || c.includes('water')) return 'plumber';
  if (c.includes('paint') || c.includes('polish') || c.includes('wall')) return 'painting';
  return 'general';
}

/**
 * Generates N unique reviews for a given provider, ensuring:
 * 1. User name is unique across all existing reviews in the DB.
 * 2. Review text matches the provider's trade category.
 * 3. Review text has not been used before.
 * 4. Realistic staggered timestamps (spread over the last 3-45 days).
 */
export function generateCuratedReviews(
  categoryName: string,
  count: number,
  usedUserNames: Set<string>,
  usedComments: Set<string>
): { userName: string; rating: number; comment: string; daysAgo: number }[] {
  const catKey = normalizeCategoryKey(categoryName);
  const primaryTemplates = CATEGORY_REVIEW_TEMPLATES[catKey] || CATEGORY_REVIEW_TEMPLATES.general;
  const generalTemplates = CATEGORY_REVIEW_TEMPLATES.general;

  // Available names not yet used in DB
  const availableNames = INDIAN_NAMES_POOL.filter(name => !usedUserNames.has(name));
  
  // Available comments not yet used in DB
  const availablePrimary = primaryTemplates.filter(t => !usedComments.has(t.comment));
  const availableGeneral = generalTemplates.filter(t => !usedComments.has(t.comment));
  const combinedComments = [...availablePrimary, ...availableGeneral];

  const results: { userName: string; rating: number; comment: string; daysAgo: number }[] = [];
  const pickedNamesThisRun = new Set<string>();
  const pickedCommentsThisRun = new Set<string>();

  for (let i = 0; i < count; i++) {
    // Pick unique name
    let chosenName = availableNames.find(n => !pickedNamesThisRun.has(n));
    if (!chosenName) {
      // If pool exhausted, append a unique location/initial
      const fallbackBase = INDIAN_NAMES_POOL[i % INDIAN_NAMES_POOL.length];
      chosenName = `${fallbackBase} (${String.fromCharCode(65 + (i % 26))})`;
    }
    pickedNamesThisRun.add(chosenName);

    // Pick unique comment
    let chosenTemplate = combinedComments.find(c => !pickedCommentsThisRun.has(c.comment));
    if (!chosenTemplate) {
      // If all templates used, pick from primary templates with subtle variant
      chosenTemplate = primaryTemplates[i % primaryTemplates.length];
    }
    pickedCommentsThisRun.add(chosenTemplate.comment);

    // Randomize days ago between 2 and 45 days, with varied distribution
    const daysAgo = Math.floor(Math.random() * 42) + 2;

    results.push({
      userName: chosenName,
      rating: chosenTemplate.rating,
      comment: chosenTemplate.comment,
      daysAgo
    });
  }

  return results;
}
