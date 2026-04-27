const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://postgres:postgres@localhost:5432/idesk_db' });

async function run() {
  await client.connect();
  const res = await client.query('SELECT id, "fullName", role, "isActive", email FROM users');
  console.log('Total users:', res.rows.length);
  console.log('Active users:', res.rows.filter(u => u.isActive === true).length);
  console.log('Null active users:', res.rows.filter(u => u.isActive === null).length);
  console.log('False active users:', res.rows.filter(u => u.isActive === false).length);
  
  // Update all NULL isActive to true
  await client.query('UPDATE users SET "isActive" = true WHERE "isActive" IS NULL');
  console.log('Fixed NULL active users to true.');
  
  await client.end();
}

run().catch(console.error);
