import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI!);
  const db = mongoose.connection.db!;

  console.log('=== USERS by role ===');
  const usersByRole = await db.collection('users').aggregate([
    { $group: { _id: { role: '$role', vendorType: '$vendorType' }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]).toArray();
  for (const u of usersByRole) console.log(JSON.stringify(u._id), '→', u.count);

  console.log('\n=== USERS (email / role / created) ===');
  const users = await db.collection('users')
    .find({}, { projection: { email: 1, name: 1, role: 1, vendorType: 1, createdAt: 1 } })
    .sort({ createdAt: 1 }).toArray();
  for (const u of users) {
    console.log(`${(u.email || '(no email)').padEnd(36)} ${(u.role || '').padEnd(10)} ${u.vendorType || ''}  ${u.createdAt ? new Date(u.createdAt).toISOString().slice(0,10) : ''}`);
  }

  console.log('\n=== SERVICE REQUESTS ===');
  const srs = await db.collection('servicerequests').find({}).toArray();
  for (const s of srs) {
    console.log(JSON.stringify({ id: String(s._id), type: s.type || s.serviceType, status: s.status, name: s.name || s.customerName, createdAt: s.createdAt }));
  }

  console.log('\n=== ANIMAL ADS ===');
  const ads = await db.collection('animalads').find({}).toArray();
  for (const a of ads) {
    console.log(JSON.stringify({ id: String(a._id), title: a.title || a.name, status: a.status, createdAt: a.createdAt }));
  }

  console.log('\n=== WALLETS ===');
  const wallets = await db.collection('wallets').find({}).toArray();
  for (const w of wallets) {
    console.log(JSON.stringify({ id: String(w._id), vendor: String(w.vendor_id || w.vendorId || w.owner), balance: w.balance, txns: Array.isArray(w.transactions) ? w.transactions.length : undefined }));
  }

  await mongoose.connection.close();
  process.exit(0);
};

run().catch((e) => { console.error(e); process.exit(1); });
