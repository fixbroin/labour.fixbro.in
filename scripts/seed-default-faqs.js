const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

function getMySqlConfig() {
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl && (dbUrl.startsWith('mysql://') || dbUrl.startsWith('mysql2://'))) {
    try {
      const parsed = new URL(dbUrl);
      return {
        host: parsed.hostname || 'localhost',
        user: decodeURIComponent(parsed.username || 'root'),
        password: decodeURIComponent(parsed.password || ''),
        databaseName: (parsed.pathname || '').replace(/^\//, '') || 'fixbro_labour',
        port: parseInt(parsed.port || '3306', 10),
      };
    } catch (e) {}
  }
  return {
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    databaseName: process.env.MYSQL_DATABASE || 'fixbro_labour',
    port: parseInt(process.env.MYSQL_PORT || '3306', 10),
  };
}

const { host, user, password, databaseName, port } = getMySqlConfig();

const defaultFaqs = [
  {
    id: 'faq-daily-labour-what-is-fixbro',
    question: 'What is FixBro Daily Labour and how does it work?',
    answer: 'FixBro Daily Labour is an on-demand platform that connects homeowners, contractors, and businesses directly with skilled daily wage tradesmen (Carpenters, Electricians, Plumbers, Painters, and Labourers). You book verified workers on transparent daily wage rates without contractor markups or hidden fees.',
    order: 1,
  },
  {
    id: 'faq-daily-labour-shift-hours',
    question: 'What are the standard working hours for daily labour bookings?',
    answer: 'Daily labour shifts are scheduled from 09:30 AM to 05:30 PM, including a 1-hour lunch break (01:00 PM to 02:00 PM). Providers arrive promptly on-site to execute your tasks under your direct guidance.',
    order: 2,
  },
  {
    id: 'faq-daily-labour-single-location',
    question: 'What is the Single Service Location Policy?',
    answer: 'All scheduled work must take place strictly at the single booked address. Providers are booked for on-site trade work at that specific address; traveling between multiple locations or splitting hours across different properties is not permitted under one booking.',
    order: 3,
  },
  {
    id: 'faq-daily-labour-skill-levels',
    question: 'How are provider skill levels (seniority tiers) categorized?',
    answer: 'Daily labour providers are categorized into verified tiers: Fresher / Beginner (foundational tasks), Intermediate (1–3 years trade experience), Senior (3–5 years experience), and Expert (5+ years master craftsman). You choose the exact seniority level that matches your project requirements.',
    order: 4,
  },
  {
    id: 'faq-daily-labour-materials-tools',
    question: 'Who provides the materials and tools for the job?',
    answer: 'Booked providers bring standard hand and trade tools for their craft. Consumables and raw materials (such as plywood, pipes, electrical switches, paint, adhesive, or fittings) are purchased and kept ready by the customer so work can begin immediately upon arrival.',
    order: 5,
  },
  {
    id: 'faq-daily-labour-job-verification',
    question: 'How is job attendance and work completion verified?',
    answer: 'Customers verify the assigned provider upon their on-site arrival and review the completed work at the end of the shift. Digital job confirmation codes through your dashboard ensure safe, authorized attendance and mutual satisfaction before closing the shift.',
    order: 6,
  },
  {
    id: 'faq-daily-labour-multi-day-booking',
    question: 'Can I book a provider for multiple days or book multiple workers together?',
    answer: 'Yes! In the cart, you can adjust the days quantity for any provider (e.g. 1 worker for 2 or 3 days). You can also add different trade providers (e.g. 1 Carpenter and 1 Electrician) together in a single consolidated booking order.',
    order: 7,
  },
  {
    id: 'faq-daily-labour-payment-methods',
    question: 'What payment options are available on FixBro?',
    answer: 'You can choose to pay securely online at checkout using UPI, debit/credit cards, and net banking, or choose the "Pay After Service" option to complete payment once the daily work is finished on-site.',
    order: 8,
  },
  {
    id: 'faq-daily-labour-cancellation-policy',
    question: 'What is the cancellation and refund policy?',
    answer: 'You can cancel or reschedule bookings directly from your "My Bookings" page. Free cancellation is available before the cancellation window. Cancellations made within the final restricted window before service start may incur a cancellation fee to compensate the assigned provider.',
    order: 9,
  },
  {
    id: 'faq-daily-labour-contact-provider',
    question: 'Can I contact the assigned provider directly before they arrive?',
    answer: 'Yes. Once a provider is assigned to your booking, their verified name, photo, spoken languages, and a direct "Call Provider" button become available in your "My Bookings" screen for smooth coordination.',
    order: 10,
  },
];

async function main() {
  const conn = await mysql.createConnection({
    host,
    user,
    password,
    database: databaseName,
    port,
  });

  console.log(`Connected to MySQL (${databaseName}). Clearing old FAQs...`);
  await conn.query('DELETE FROM adminFAQs');

  console.log('Inserting 10 default Daily Labour FAQs...');
  const now = Math.floor(Date.now() / 1000);
  for (const f of defaultFaqs) {
    const data = {
      ...f,
      createdAt: { _seconds: now, _nanoseconds: 0, _isTimestamp: true },
      updatedAt: { _seconds: now, _nanoseconds: 0, _isTimestamp: true },
    };
    await conn.query('INSERT INTO adminFAQs (id, data) VALUES (?, ?)', [f.id, JSON.stringify(data)]);
    console.log(`✓ Added FAQ ${f.order}: "${f.question}"`);
  }

  await conn.end();
  console.log('Successfully seeded 10 default Daily Labour FAQs!');
}

main().catch(err => {
  console.error('Error seeding FAQs:', err);
  process.exit(1);
});
