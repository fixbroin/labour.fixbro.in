const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const [rows] = await conn.execute("SELECT data FROM websettings WHERE id = 'global'");
  if (rows.length > 0) {
    const d = JSON.parse(rows[0].data);
    console.log('homepageContent:', JSON.stringify(d.homepageContent, null, 2));
  } else {
    console.log('global websettings not found');
  }
  await conn.end();
}

run().catch(console.error);
