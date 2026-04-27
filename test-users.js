const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://postgres:postgres@localhost:5432/idesk' });

async function run() {
  await client.connect();
  const res = await client.query('SELECT id, "fullName", role, "isActive", email FROM users');
  console.log('Total users:', res.rows.length);
  console.log('Active users:', res.rows.filter(u => u.isActive).length);
  console.log('Sample users:');
  console.table(res.rows.slice(0, 10));
  await client.end();
}

run().catch(console.error);
