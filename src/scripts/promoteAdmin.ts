import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const EMAIL = 'premst2100@gmail.com';

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI!);
  const db = mongoose.connection.db!;
  console.log(`✅ Connected to DB: ${db.databaseName}\n`);

  const users = db.collection('users');

  const before = await users.findOne(
    { email: EMAIL },
    { projection: { email: 1, name: 1, role: 1, vendorType: 1, isApproved: 1 } }
  );
  if (!before) {
    console.error(`❌ No user found with email ${EMAIL} — aborting, nothing changed.`);
    await mongoose.connection.close();
    process.exit(1);
  }
  console.log('BEFORE:', JSON.stringify(before));

  const res = await users.updateOne(
    { email: EMAIL },
    { $set: { role: 'admin', isApproved: true }, $unset: { vendorType: '', pincodesServed: '' } }
  );
  console.log(`\nmatched=${res.matchedCount} modified=${res.modifiedCount}`);

  const after = await users.findOne(
    { email: EMAIL },
    { projection: { email: 1, name: 1, role: 1, vendorType: 1, isApproved: 1 } }
  );
  console.log('AFTER: ', JSON.stringify(after));

  await mongoose.connection.close();
  console.log('\n✅ Done.');
  process.exit(0);
};

run().catch((e) => { console.error('❌ Error:', e); process.exit(1); });
