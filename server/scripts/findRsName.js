// One-off: discover replica set name via direct connection to a shard host
require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  const host = process.argv[2] || 'ac-utoqbp1-shard-00-00.hon0lkh.mongodb.net';
  const uri = `mongodb://${process.env.DB_USER}:${process.env.DB_PASS}@${host}:27017/admin?tls=true&directConnection=true`;
  const c = await mongoose.createConnection(uri).asPromise();
  const hello = await c.db.admin().command({ hello: 1 });
  console.log('setName:', hello.setName, '| primary:', hello.primary);
  await c.close();
})().catch((e) => { console.error('ERR:', e.message); process.exit(1); });
