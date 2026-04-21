/**
 * VAPID Key Generator for Web Push Notifications
 * 
 * Run this script to generate VAPID keys for push notifications:
 *   npx ts-node scripts/generate-vapid-keys.ts
 * 
 * Or if you have the project built:
 *   node dist/scripts/generate-vapid-keys.js
 */

const webpush = require('web-push');

function generateVapidKeys() {
    const vapidKeys = webpush.generateVAPIDKeys();

    console.log('\n========================================');
    console.log('  VAPID Keys Generated Successfully');
    console.log('========================================\n');
    console.log('Add these to your .env file:\n');
    console.log(`VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
    console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
    console.log(`VAPID_SUBJECT=mailto:admin@yourdomain.com`);
    console.log('\n========================================');
    console.log('  IMPORTANT: Keep VAPID_PRIVATE_KEY secret!');
    console.log('========================================\n');

    return vapidKeys;
}

// Run if executed directly
if (require.main === module) {
    generateVapidKeys();
}

module.exports = { generateVapidKeys };
