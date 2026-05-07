const { Client } = require('pg');
require('dotenv').config();
const client = new Client({ connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/idesk_db' });

async function run() {
  await client.connect();
  const res = await client.query('SELECT id, "fullName", role, "isActive", "siteId" FROM users WHERE role::text LIKE \'%AGENT%\'');
  console.log('Agents in DB:');
  console.table(res.rows);
  
  const sites = await client.query('SELECT id, code, name FROM sites');
  console.log('\nSites in DB:');
  console.table(sites.rows);
  
  const workloads = await client.query('SELECT "agentId", "totalPoints", "activeTickets", "workDate", "lastAssignedAt" FROM agent_daily_workload');
  console.log('\nWorkloads:');
  console.table(workloads.rows);
  
  await client.end();
}

run().catch(console.error);