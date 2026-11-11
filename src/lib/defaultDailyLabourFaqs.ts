/**
 * 10 Curated Default FAQs for FixBro Daily Labour
 * Strict constraints: No mention of "7 hours", no mention of "OTP".
 */

export interface DefaultFAQItem {
  question: string;
  answer: string;
  order: number;
}

export const DEFAULT_DAILY_LABOUR_FAQS: DefaultFAQItem[] = [
  {
    order: 1,
    question: "What is FixBro Daily Labour?",
    answer: "FixBro Daily Labour connects homeowners, tenants, and site managers directly with verified skilled and semi-skilled daily wage workers (such as carpenters, electricians, plumbers, painters, and general helpers) on a clear, transparent full-day shift basis without middlemen markups or per-point surprises."
  },
  {
    order: 2,
    question: "How does daily wage booking work?",
    answer: "You select your required trade category, choose your preferred verified provider based on skill level and experience, select your scheduled workday date, and complete booking. The technician arrives at your site for their scheduled shift and works exclusively on your prioritized task list."
  },
  {
    order: 3,
    question: "What trades can I hire a daily labour provider for?",
    answer: "You can book verified professionals for Carpentry (furniture repairs, door fitting, modular adjustments), Electrical (wiring, fans, switchboards, MCBs), Plumbing (sanitary fittings, leak fixes, pipe routing), Painting (wall putty, primer, finish coats), Aluminium Fabrication, and General Labour."
  },
  {
    order: 4,
    question: "Do daily labour providers bring their own tools?",
    answer: "Yes, verified skilled technicians carry standard professional hand and power tools necessary for their trade (e.g., drills, hammers, wrenches, tape measures, scrapers, and multimeters)."
  },
  {
    order: 5,
    question: "Who provides materials and consumables like nails, wires, or paint?",
    answer: "Consumables, hardware, and raw materials (such as screws, wood glue, electrical cables, switches, pipes, wall putty, and paint) are arranged or purchased by the customer according to their brand preference. You only pay for the provider's dedicated daily wage labour."
  },
  {
    order: 6,
    question: "Can I book multiple daily labour providers or multi-day shifts?",
    answer: "Yes! You can hire multiple providers in the same booking or choose multi-day duration for large projects. Our cart and checkout transparently display the total days and persons booked."
  },
  {
    order: 7,
    question: "What happens if the scheduled work finishes early?",
    answer: "Daily labour bookings cover a dedicated shift for your site. If your primary task finishes early, you can utilize the provider's remaining shift time for any other maintenance tasks within their booked trade category."
  },
  {
    order: 8,
    question: "How does supervision and work quality guidance work?",
    answer: "Work is carried out under your on-site guidance and direction. You walk the technician through your prioritized task list in the morning and verify progress as tasks are completed."
  },
  {
    order: 9,
    question: "Can I pay daily labour workers directly in cash on-site?",
    answer: "All booking payments should be processed through the official FixBro platform (either Online or via Pay After Service) to maintain transparent service records, guarantee dispute protection, and ensure safety."
  },
  {
    order: 10,
    question: "Can I reschedule or cancel my daily labour booking?",
    answer: "Yes, you can easily reschedule or cancel your booking through the 'My Bookings' section before the scheduled shift begins according to our transparent cancellation policy."
  }
];
