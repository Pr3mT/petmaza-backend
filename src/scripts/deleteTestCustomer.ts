import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User';

dotenv.config();

const EMAIL = 'ui-audit-temp@petmaza.local';

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI!);
  const res = await User.deleteOne({ email: EMAIL });
  console.log(`Deleted temp customer ${EMAIL}: ${res.deletedCount}`);
  await mongoose.connection.close();
  process.exit(0);
};

run().catch((e) => { console.error(e); process.exit(1); });
