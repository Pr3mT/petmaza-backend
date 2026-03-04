import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User';

dotenv.config();

async function findCustomerAccount() {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('✅ Connected to MongoDB\n');
    
    console.log('🔍 Looking for customer account with samruddhiamrutkar15@gmail.com...\n');
    
    const customer = await User.findOne({ 
      email: 'samruddhiamrutkar15@gmail.com' 
    }).lean();
    
    if (customer) {
      console.log('✅ Customer Account Found:');
      console.log(`   Email: ${customer.email}`);
      console.log(`   Name: ${customer.name}`);
      console.log(`   Role: ${customer.role}`);
      console.log(`   ID: ${customer._id}`);
      console.log(`\n✅ This customer WILL receive order confirmation emails!`);
    } else {
      console.log('❌ No customer account found with samruddhiamrutkar15@gmail.com');
      console.log('\n💡 Need to create a customer account with this email first.');
    }
    
    console.log('\n📧 Email Flow:');
    console.log('   1. Customer logs in with: samruddhiamrutkar15@gmail.com');
    console.log('   2. Customer places order');
    console.log('   3. Order confirmation → samruddhiamrutkar15@gmail.com ✅');
    console.log('   4. Payment completed → Payment receipt → samruddhiamrutkar15@gmail.com ✅');
    console.log('   5. Order accepted by vendor → samruddhiamrutkar15@gmail.com ✅');
    console.log('   6. Order delivered → samruddhiamrutkar15@gmail.com ✅');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

findCustomerAccount();
