const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const [rows] = await conn.execute("SELECT data FROM websettings WHERE id = 'global'");
  if (rows.length > 0) {
    const d = JSON.parse(rows[0].data);
    d.homepageContent = {
      footerCTA: {
        title: "Ready to get started?",
        subtitle: "Book your verified daily labour provider today and experience reliable craftsmanship.",
        buttonLink: "/categories",
        buttonText: "Book a Provider"
      },
      whyChooseUs: [
        {
          id: "1",
          title: "Trusted Professionals",
          iconName: "Users",
          description: "Experienced and background-verified trade workers."
        },
        {
          id: "2",
          title: "Punctual Providers",
          iconName: "ClockIcon",
          description: "We value your time with on-time shift arrivals."
        },
        {
          id: "3",
          title: "Verified Providers",
          iconName: "ShieldCheck",
          description: "Quality craftsmanship and identity verification for all daily labour providers."
        },
        {
          id: "4",
          title: "Transparent Day Rates",
          iconName: "Star",
          description: "No hidden costs, clear and upfront daily wage pricing."
        }
      ],
      footerCompanyBio: "Your trusted platform for verified daily wage workers and skilled daily labour in Bangalore. We connect you directly with experienced carpenters, painters, electricians, plumbers, and helpers on fixed daily rates."
    };

    await conn.execute("UPDATE websettings SET data = ? WHERE id = 'global'", [JSON.stringify(d)]);
    console.log("Successfully updated homepageContent in websettings table!");
  }
  await conn.end();
}

run().catch(console.error);
