require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const webpush = require('web-push');

const envPath = path.join(__dirname, '..', '.env');
const hasPublic = Boolean(process.env.VAPID_PUBLIC_KEY);
const hasPrivate = Boolean(process.env.VAPID_PRIVATE_KEY);

if (hasPublic && hasPrivate) {
  console.log('VAPID keys are already configured.');
  process.exit(0);
}
if (hasPublic || hasPrivate) {
  console.error('Only one VAPID key is configured. Set both keys together, then rerun.');
  process.exit(1);
}

const keys = webpush.generateVAPIDKeys();
const subject = process.env.VAPID_SUBJECT || 'mailto:admin@onlinekirana.com';
fs.appendFileSync(envPath, `\n# Web Push keys — keep the private key secret\nVAPID_PUBLIC_KEY=${keys.publicKey}\nVAPID_PRIVATE_KEY=${keys.privateKey}\nVAPID_SUBJECT=${subject}\n`);
console.log('Generated VAPID keys and saved them to server/.env. The private key was not printed.');
