const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'fixbro_labour'
  });

  const [rows] = await conn.execute('SELECT id, data, createdAt FROM blogPosts');
  console.log(`Found ${rows.length} blogs in blogPosts`);
  rows.forEach(r => {
    try {
      const d = JSON.parse(r.data);
      console.log(`- [${r.id}] ${d.title} (slug: ${d.slug}, published: ${d.isPublished})`);
    } catch (e) {
      console.log(`- [${r.id}] raw: ${r.data}`);
    }
  });
  await conn.end();
}

main().catch(console.error);
