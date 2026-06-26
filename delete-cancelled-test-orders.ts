// @ts-nocheck
// Removes the 2 remaining cancelled/failed test orders (₹1300, ₹60).
// Backs up to ./backups first. Guarded: only deletes these exact ids AND
// only if status=CANCELLED with payment_status=Failed. Audit logs kept.
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const ORDER_IDS = [
  '6a2701a0c1131ff1f584cd55',
  '6a27155a95a89683550c2f00',
];

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    const objIds = ORDER_IDS.map(id => new mongoose.Types.ObjectId(id));
    const both = [...objIds, ...ORDER_IDS];

    const orderMatch = { _id: { $in: objIds }, status: 'CANCELLED', payment_status: 'Failed' };
    const txnMatch   = { orderId: { $in: both } };
    const shipMatch  = { order_id: { $in: both } };
    const salesMatch = { order_id: { $in: both } };

    // Show what references these orders before deleting
    const collections = await db.listCollections().toArray();
    for (const c of collections) {
      if (c.name === 'orders') continue;
      for (const field of ['order_id', 'orderId', 'order']) {
        const count = await db.collection(c.name).countDocuments({ [field]: { $in: both } });
        if (count > 0) console.log(`ref: ${c.name}.${field}: ${count} doc(s)`);
      }
    }

    // ── Backup ──
    const backup = {
      exportedAt: new Date().toISOString(),
      orders: await db.collection('orders').find(orderMatch).toArray(),
      transactions: await db.collection('transactions').find(txnMatch).toArray(),
      shippingdetails: await db.collection('shippingdetails').find(shipMatch).toArray(),
      saleshistories: await db.collection('saleshistories').find(salesMatch).toArray(),
    };

    if (backup.orders.length !== 2) {
      console.error(`❌ Expected 2 cancelled test orders, found ${backup.orders.length}. Aborting — nothing deleted.`);
      return;
    }

    const backupDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const backupFile = path.join(backupDir, `cancelled-test-orders-backup-${Date.now()}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
    console.log(`\n✅ Backup written: ${backupFile}`);
    console.log(`   orders: ${backup.orders.length}, transactions: ${backup.transactions.length}, shippingdetails: ${backup.shippingdetails.length}, saleshistories: ${backup.saleshistories.length}\n`);

    // ── Delete ──
    const r1 = await db.collection('orders').deleteMany(orderMatch);
    const r2 = await db.collection('transactions').deleteMany(txnMatch);
    const r3 = await db.collection('shippingdetails').deleteMany(shipMatch);
    const r4 = await db.collection('saleshistories').deleteMany(salesMatch);

    console.log(`🗑️ Deleted: ${r1.deletedCount} orders, ${r2.deletedCount} transactions, ${r3.deletedCount} shippingdetails, ${r4.deletedCount} saleshistories`);

    const remaining = await db.collection('orders').countDocuments();
    console.log(`\nOrders remaining in DB: ${remaining}`);
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await mongoose.disconnect();
  }
}

run();
