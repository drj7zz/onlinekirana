/* One-off backfill: give every approved merchant without a username a unique
   slug derived from their shop name. Safe to re-run — it only fills gaps. */
const mongoose = require('mongoose');
const User = require('../models/User');
const { uniqueShopUsername } = require('../lib/shopUsername');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const shops = await User.find({ role: 'merchant', merchantStatus: 'approved', shopUsername: { $in: [null, ''] } });
  for (const shop of shops) {
    if (!shop.shopName) continue;
    // eslint-disable-next-line no-await-in-loop
    shop.shopUsername = await uniqueShopUsername(User, shop.shopName, shop._id);
    // eslint-disable-next-line no-await-in-loop
    await shop.save();
    console.log(`${shop.shopName} -> ${shop.shopUsername}`);
  }
  console.log(`done, ${shops.length} shop(s) updated`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
