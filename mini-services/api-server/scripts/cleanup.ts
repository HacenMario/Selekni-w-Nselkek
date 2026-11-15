/**
 * Dev utility: purge all test data, keep ONLY settings + superadmin.
 * Usage: bun scripts/cleanup.ts
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: new URL('../.env', import.meta.url).pathname });

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/slekni';
  await mongoose.connect(uri);
  const conn = mongoose.connection;
  const collections = await conn.db.listCollections().toArray();
  for (const c of collections) {
    if (c.name === 'settings') continue;
    if (c.name === 'users') {
      await conn.db.collection('users').deleteMany({ isSuperAdmin: { $ne: true } });
      continue;
    }
    await conn.db.collection(c.name).deleteMany({});
  }
  console.log('[cleanup] done. Remaining:');
  for (const c of await conn.db.listCollections().toArray()) {
    const count = await conn.db.collection(c.name).countDocuments();
    console.log(`  ${c.name}: ${count}`);
  }
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
