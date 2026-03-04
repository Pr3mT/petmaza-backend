import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User';
import Order from './models/Order';

dotenv.config();

const checkSetup = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('✅ Connected to MongoDB\n');

    // Check vendors
    console.log('👥 VENDORS IN DATABASE:');
    const vendors = await User.find({ role: 'vendor' }).select('_id name email role vendorType').lean();
    
    if (vendors.length === 0) {
      console.log('   ❌ NO VENDORS FOUND!');
    } else {
      vendors.forEach((v: any, i: number) => {
        console.log(`   ${i + 1}. ${v.name}`);
        console.log(`      ID: ${v._id}`);
        console.log(`      Email: ${v.email}`);
        console.log(`      Type: ${v.vendorType || 'Not specified'}`);
      });
    }

    // Check orders with assignment
    console.log('\n\n📦 RECENT ORDERS:');
    const orders = await Order.find()
      .select('_id status assignedVendorId isPrime createdAt')
      .populate('customer_id', 'name')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();
    
    if (orders.length === 0) {
      console.log('   ❌ NO ORDERS FOUND!');
    } else {
      orders.forEach((o: any, i: number) => {
        console.log(`   ${i + 1}. Order: ${o._id}`);
        console.log(`      Status: ${o.status}`);
        console.log(`      Assigned: ${o.assignedVendorId ? 'YES' : 'NO'}`);
        console.log(`      Prime: ${o.isPrime ? 'YES' : 'NO'}`);
      });
    }

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

checkSetup();
