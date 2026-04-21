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
    const items = [
      ['LAPTOP_STD', 'Laptop Standard', 'LAPTOP'],
      ['LAPTOP_DESIGN', 'Laptop Design/Heavy', 'LAPTOP'],
      ['MONITOR_24', 'Monitor 24"', 'MONITOR'],
      ['MONITOR_27', 'Monitor 27"', 'MONITOR'],
      ['MOUSE_STD', 'Mouse', 'ACCESSORY'],
      ['KEYBOARD_STD', 'Keyboard', 'ACCESSORY'],
      ['HEADSET_STD', 'Headset', 'ACCESSORY'],
      ['NET_CABLE', 'Network Cable', 'NETWORK'],
      ['NET_AP', 'Access Point', 'NETWORK'],
      ['SW_LICENSE_GEN', 'Software License (Generic)', 'SOFTWARE'],
    ];

    let order = 10;
    for (const [code, name, category] of items) {
      try {
        await client.query(
          `INSERT INTO hardware_catalog (code, name, category, "displayOrder", active, "createdAt", "updatedAt", "defaultSpecs")
           VALUES ($1, $2, $3, $4, TRUE, NOW(), NOW(), '{}')
           ON CONFLICT (code) DO NOTHING`,
          [code, name, category, order],
        );
        order += 10;
      } catch (e) {
        console.error('Error inserting', code, e.message);
      }
    }
    console.log("Hardware catalog seeded successfully.");
  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}
run();
