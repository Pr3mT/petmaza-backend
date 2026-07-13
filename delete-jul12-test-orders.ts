// @ts-nocheck
// Removes 9 test orders created 2026-07-12 (Samruddhi Amrutkar re-testing,
// Prem's own account, and the "Addr Debug2" synthetic test account).
// Backs up to ./backups first. Guarded: only deletes these exact ids.
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const ORDER_IDS = [
  '6a53634853dc88f3d60eba50',
  '6a53647053dc88f3d60ebaeb',
  '6a537e8118bf1e3ba85fe632',
  '6a53822653dc88f3d60ec0b7',
  '6a53abba18bf1e3ba85feaf5',
  '6a53aff797824c087cf9e1ce',
  '6a53b1cc2ac272c1c2db5c80',
  '6a53bbe92ac272c1c2db5cd7',
  '6a53be722ac272c1c2db5d31',
];

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    const objIds = ORDER_IDS.map(id => new mongoose.Types.ObjectId(id));
    const both = [...objIds, ...ORDER_IDS];

    const orderMatch = { _id: { $in: objIds } };
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

    if (backup.orders.length !== ORDER_IDS.length) {
      console.error(`❌ Expected ${ORDER_IDS.length} orders, found ${backup.orders.length}. Aborting — nothing deleted.`);
      return;
    }

    const backupDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const backupFile = path.join(backupDir, `jul12-test-orders-backup-${Date.now()}.json`);
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
