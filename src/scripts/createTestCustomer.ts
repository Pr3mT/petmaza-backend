import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User';

dotenv.config();

// Temporary customer used ONLY for the mobile-UI audit. Delete afterwards
// with deleteTestCustomer.ts. Email is namespaced so it's easy to find/remove.
const EMAIL = 'ui-audit-temp@petmaza.local';
const PASSWORD = 'AuditTemp123!';

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI!);

  let user = await User.findOne({ email: EMAIL });
  if (user) {
    user.password = PASSWORD; // re-hash via pre-save
    user.isApproved = true;
    user.isEmailVerified = true;
    await user.save();
    console.log('Updated existing temp customer:', EMAIL);
  } else {
    user = await User.create({
      name: 'UI Audit Temp',
      email: EMAIL,
      password: PASSWORD,
      phone: '9000000000',
      role: 'customer',
      isApproved: true,
      isEmailVerified: true,
      address: { street: '1 Test St', city: 'Mumbai', state: 'Maharashtra', pincode: '400001' },
    });
    console.log('Created temp customer:', EMAIL);
  }

  console.log('Login →', EMAIL, '/', PASSWORD);
  await mongoose.connection.close();
  process.exit(0);
};

run().catch((e) => { console.error(e); process.exit(1); });
