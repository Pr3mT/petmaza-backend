import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from '../models/Order';

dotenv.config();

(async () => {
  await mongoose.connect(process.env.MONGODB_URI!);
  const cutoff = new Date(Date.now() - 60 * 60 * 1000);
  const wouldCancel = await Order.countDocuments({ status: 'PENDING', payment_status: { $ne: 'Paid' }, createdAt: { $lt: cutoff } });
  const totalPending = await Order.countDocuments({ status: 'PENDING' });
  const paidPending = await Order.countDocuments({ status: 'PENDING', payment_status: 'Paid' });
  console.log(`PENDING total=${totalPending} | PENDING+Paid (protected, never cancelled)=${paidPending} | would auto-cancel (PENDING+unpaid+>60min)=${wouldCancel}`);
  await mongoose.connection.close();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
