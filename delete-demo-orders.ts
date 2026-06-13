// @ts-nocheck
// Deletes the 4 demo orders (₹1/₹2 test payments) + linked transactions,
// shippingdetails and saleshistories. Backs everything up to ./backups first.
// Security audit logs are intentionally kept.
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const DEMO_ORDER_IDS = [
  '6a2a5c48387705c25a4d469c',
  '6a2858378352468ed512e143',
  '6a2854598352468ed512bfda',
  '6a2853ec8352468ed512bf96',
];

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    const objIds = DEMO_ORDER_IDS.map(id => new mongoose.Types.ObjectId(id));
    const both = [...objIds, ...DEMO_ORDER_IDS];

    const orderMatch = { _id: { $in: objIds }, total: { $lte: 2 } }; // total guard: never touch real orders
    const txnMatch   = { orderId: { $in: both } };
    const shipMatch  = { order_id: { $in: both } };
    const salesMatch = { order_id: { $in: both } };

    // ── Backup everything first ──
    const backup = {
      exportedAt: new Date().toISOString(),
      orders: await db.collection('orders').find(orderMatch).toArray(),
      transactions: await db.collection('transactions').find(txnMatch).toArray(),
      shippingdetails: await db.collection('shippingdetails').find(shipMatch).toArray(),
      saleshistories: await db.collection('saleshistories').find(salesMatch).toArray(),
    };

    if (backup.orders.length !== 4) {
      console.error(`❌ Expected 4 demo orders, found ${backup.orders.length}. Aborting — nothing deleted.`);
      return;
    }

    const backupDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const backupFile = path.join(backupDir, `demo-orders-backup-${Date.now()}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
    console.log(`✅ Backup written: ${backupFile}`);
    console.log(`   orders: ${backup.orders.length}, transactions: ${backup.transactions.length}, shippingdetails: ${backup.shippingdetails.length}, saleshistories: ${backup.saleshistories.length}\n`);

    // ── Delete ──
    const r1 = await db.collection('orders').deleteMany(orderMatch);
    const r2 = await db.collection('transactions').deleteMany(txnMatch);
    const r3 = await db.collection('shippingdetails').deleteMany(shipMatch);
    const r4 = await db.collection('saleshistories').deleteMany(salesMatch);

    console.log(`🗑️ Deleted: ${r1.deletedCount} orders, ${r2.deletedCount} transactions, ${r3.deletedCount} shippingdetails, ${r4.deletedCount} saleshistories`);

    const remaining = await db.collection('orders').countDocuments();
    console.log(`\nOrders remaining in DB: ${remaining}`);
    const left = await db.collection('orders').find({}).project({ total: 1, status: 1, payment_status: 1, createdAt: 1 }).toArray();
    left.forEach(o => console.log(`  - ${o._id} | ₹${o.total} | ${o.status} | ${o.payment_status}`));
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await mongoose.disconnect();
  }
}

run();
