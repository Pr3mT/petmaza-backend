import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const TARGET = 'admin@petmaza.com';

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI!);
  const db = mongoose.connection.db!;
  console.log(`✅ Connected to DB: ${db.databaseName}\n`);

  const users = db.collection('users');

  const target = await users.findOne({ email: TARGET }, { projection: { email: 1, role: 1 } });
  if (!target) {
    console.log(`ℹ️  ${TARGET} not found — nothing to delete.`);
    await mongoose.connection.close();
    process.exit(0);
  }
  console.log('Target:', JSON.stringify(target));

  // Safety: ensure at least one OTHER admin remains before deleting.
  const otherAdmins = await users.countDocuments({ role: 'admin', email: { $ne: TARGET } });
  console.log(`Other admin accounts remaining after delete: ${otherAdmins}`);
  if (otherAdmins < 1) {
    console.error('❌ Refusing to delete — this would leave zero admin accounts. Aborting.');
    await mongoose.connection.close();
    process.exit(1);
  }

  const res = await users.deleteOne({ email: TARGET });
  console.log(`\nDeleted: ${res.deletedCount}`);

  const remainingAdmins = await users
    .find({ role: 'admin' }, { projection: { email: 1 } })
    .toArray();
  console.log('Remaining admins:', remainingAdmins.map((a) => a.email).join(', '));

  await mongoose.connection.close();
  console.log('\n✅ Done.');
  process.exit(0);
};

run().catch((e) => { console.error('❌ Error:', e); process.exit(1); });
