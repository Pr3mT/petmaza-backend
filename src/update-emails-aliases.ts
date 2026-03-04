import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User';

dotenv.config();

/**
 * OPTION 1: Gmail Aliases - All emails go to samrudhiamrutkar15@gmail.com
 * You can filter them in Gmail using the + part
 */
const updateEmailsWithAliases = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('✅ Connected to MongoDB\n');
    console.log('🔧 OPTION 1: Updating emails with Gmail aliases...\n');

    // Update Admin
    const admin = await User.findOne({ email: 'admin@petmaza.com' });
    if (admin) {
      admin.email = 'samrudhiamrutkar15+admin@gmail.com';
      await admin.save();
      console.log('✅ Admin email updated to: samrudhiamrutkar15+admin@gmail.com');
    }

    // Update My Shop Manager
    const myShop = await User.findOne({ email: 'myshop@petmaza.com' });
    if (myShop) {
      myShop.email = 'samrudhiamrutkar15+shop@gmail.com';
      await myShop.save();
      console.log('✅ My Shop email updated to: samrudhiamrutkar15+shop@gmail.com');
    }

    // Update Warehouse Fulfiller
    const warehouse = await User.findOne({ email: 'fulfiller@petmaza.com' });
    if (warehouse) {
      warehouse.email = 'samrudhiamrutkar15+warehouse@gmail.com';
      await warehouse.save();
      console.log('✅ Warehouse email updated to: samrudhiamrutkar15+warehouse@gmail.com');
    }

    // Update Prime Vendor
    const prime = await User.findOne({ email: 'prime@petmaza.com' });
    if (prime) {
      prime.email = 'samrudhiamrutkar15+prime@gmail.com';
      await prime.save();
      console.log('✅ Prime Vendor email updated to: samrudhiamrutkar15+prime@gmail.com');
    }

    // Update Customer (keep as is)
    const customer = await User.findOne({ email: 'customer@petmaza.com' });
    if (customer) {
      customer.email = 'samrudhiamrutkar15@gmail.com';
      await customer.save();
      console.log('✅ Customer email updated to: samrudhiamrutkar15@gmail.com');
    }

    console.log('\n✅ ALL EMAILS UPDATED!\n');
    console.log('📧 All emails will now go to: samrudhiamrutkar15@gmail.com');
    console.log('🎯 You can filter them in Gmail using these labels:');
    console.log('   - From: samrudhiamrutkar15+admin@gmail.com');
    console.log('   - From: samrudhiamrutkar15+shop@gmail.com');
    console.log('   - From: samrudhiamrutkar15+warehouse@gmail.com');
    console.log('   - From: samrudhiamrutkar15+prime@gmail.com\n');

    // Update .env ADMIN_EMAILS
    console.log('📝 UPDATE YOUR .env FILE:');
    console.log('ADMIN_EMAILS=samrudhiamrutkar15+admin@gmail.com\n');

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

updateEmailsWithAliases();
