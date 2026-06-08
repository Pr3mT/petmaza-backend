import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Collections approved for deletion (go-live cleanup of test/demo data).
const TO_CLEAR = [
  'orders',
  'transactions',
  'saleshistories',
  'shippingdetails',
  'emaillogs',
  'securityauditlogs',
  'servicerequests',
  'animalads',
];

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI!);
  const db = mongoose.connection.db!;
  console.log(`✅ Connected to DB: ${db.databaseName}\n`);

  console.log('Collection'.padEnd(24) + 'Before'.padStart(8) + 'Deleted'.padStart(10) + 'After'.padStart(8));
  console.log('─'.repeat(50));

  for (const name of TO_CLEAR) {
    const before = await db.collection(name).countDocuments();
    const res = await db.collection(name).deleteMany({});
    const after = await db.collection(name).countDocuments();
    console.log(name.padEnd(24) + String(before).padStart(8) + String(res.deletedCount).padStart(10) + String(after).padStart(8));
  }

  console.log('─'.repeat(50));
  console.log('\n✅ Cleanup complete.');

  await mongoose.connection.close();
  process.exit(0);
};

run().catch((e) => { console.error('❌ Error:', e); process.exit(1); });
