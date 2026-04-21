const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'idesk_db',
  });
  await client.connect();
  try {
    await client.query(`ALTER TABLE "hardware_requests" ADD COLUMN "recipientName" varchar(255) NULL;`);
    console.log("Column recipientName added to hardware_requests");
  } catch (e) {
    if (e.code === '42701') console.log("Column already exists");
    else console.error(e);
  } finally {
    await client.end();
  }
}
run();
