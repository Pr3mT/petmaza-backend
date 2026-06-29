/**
 * Sync orders (and optionally other collections) from the PRODUCTION Atlas
 * database (pet-marketplace) into the local dev database (petmaza-local).
 *
 * Usage:
 *   npx ts-node src/scripts/syncOrdersFromProd.ts
 *
 * Collections synced: orders, users, products, vendorproductpricings
 * Each collection is fully replaced (delete-all → insert-all).
 */

import mongoose, { Connection } from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Production Atlas database
const PROD_URI = process.env.MONGODB_URI!
  .replace('/petmaza-local?', '/pet-marketplace?')
  .replace('/petmaza-local&', '/pet-marketplace&');

// Dev Atlas database (currently used by local backend)
const DEV_URI = process.env.MONGODB_URI!;

// Collections to sync from prod → dev
const COLLECTIONS_TO_SYNC = [
  'orders',
  'users',
  'products',
  'vendorproductpricings',
  'servicerequests',
  'coupons',
];

async function syncCollection(
  src: Connection,
  dst: Connection,
  name: string
): Promise<number> {
  const srcCol = src.collection(name);
  const dstCol = dst.collection(name);

  const docs = await srcCol.find({}).toArray();
  if (docs.length === 0) {
    console.log(`  ${name}: (empty — skipping)`);
    return 0;
  }

  await dstCol.deleteMany({});
  await dstCol.insertMany(docs, { ordered: false });
  return docs.length;
}

async function main() {
  console.log('\n=== Sync Production → Dev (petmaza-local) ===\n');
  console.log(`PROD: ${PROD_URI.replace(/:([^@]+)@/, ':***@')}`);
  console.log(`DEV : ${DEV_URI.replace(/:([^@]+)@/, ':***@')}\n`);

  if (PROD_URI === DEV_URI) {
    console.error('ERROR: prod and dev URIs are the same — nothing to sync.');
    process.exit(1);
  }

  console.log('Connecting to PROD Atlas...');
  const prodConn = await mongoose.createConnection(PROD_URI, { serverSelectionTimeoutMS: 15000 }).asPromise();
  console.log('Connected to PROD\n');

  console.log('Connecting to DEV Atlas...');
  const devConn = await mongoose.createConnection(DEV_URI, { serverSelectionTimeoutMS: 15000 }).asPromise();
  console.log('Connected to DEV\n');

  let total = 0;
  for (const col of COLLECTIONS_TO_SYNC) {
    process.stdout.write(`Syncing "${col}"... `);
    try {
      const n = await syncCollection(prodConn, devConn, col);
      console.log(`${n} docs`);
      total += n;
    } catch (err: any) {
      console.log(`ERROR: ${err.message}`);
    }
  }

  console.log(`\nDone! Synced ${total} documents across ${COLLECTIONS_TO_SYNC.length} collections.`);
  console.log('Your local backend now has fresh production data.\n');

  await prodConn.close();
  await devConn.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('Sync failed:', err.message);
  process.exit(1);
});
