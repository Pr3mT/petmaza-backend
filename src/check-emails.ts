import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User';

dotenv.config();

const setupEmails = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('✅ Connected to MongoDB\n');

    console.log('📧 CURRENT USER EMAILS:\n');
    const users = await User.find().select('name email role vendorType').lean();
    
    users.forEach((u: any) => {
      console.log(`${u.role.toUpperCase()}: ${u.name}`);
      console.log(`   Current Email: ${u.email}`);
      console.log(`   Type: ${u.vendorType || 'N/A'}\n`);
    });

    console.log('\n💡 RECOMMENDED EMAIL SETUP:\n');
    console.log('For proper email management, update user emails to:');
    console.log('');
    console.log('1. ADMIN:');
    console.log('   Email: admin.petmaza@gmail.com (or your admin email)');
    console.log('   Purpose: Receives all admin notifications');
    console.log('');
    console.log('2. MY_SHOP VENDOR (Shop Manager):');
    console.log('   Email: shop.petmaza@gmail.com (or shop manager email)');
    console.log('   Purpose: Receives MY_SHOP order assignments');
    console.log('');
    console.log('3. WAREHOUSE FULFILLER:');
    console.log('   Email: warehouse.petmaza@gmail.com (or warehouse email)');
    console.log('   Purpose: Receives warehouse order assignments');
    console.log('');
    console.log('4. PRIME VENDOR:');
    console.log('   Email: vendor.petmaza@gmail.com (or vendor email)');
    console.log('   Purpose: Receives Prime order notifications');
    console.log('');
    console.log('5. CUSTOMER (You):');
    console.log('   Email: samrudhiamrutkar15@gmail.com');
    console.log('   Purpose: Test orders and customer experience');
    console.log('');
    console.log('\n📝 TO UPDATE EMAILS:');
    console.log('Run: npm run update-emails');
    console.log('Or manually update in MongoDB/Admin dashboard');

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

setupEmails();
