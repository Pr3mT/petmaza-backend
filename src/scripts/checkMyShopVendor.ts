import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User';
import Order from '../models/Order';

dotenv.config();

async function checkMyShopVendor() {
  try {
    await mongoose.connect(process.env.MONGODB_URI as string);
    console.log('Connected to MongoDB');

    // Check for MY_SHOP vendor
    const myShop = await User.findOne({ role: 'vendor', vendorType: 'MY_SHOP' });
    
    if (myShop) {
      console.log('\n✓ MY_SHOP Vendor Found:');
      console.log('  Email:', myShop.email);
      console.log('  Name:', myShop.name);
      console.log('  ID:', myShop._id);
      console.log('  Approved:', myShop.isApproved);
      
      // Check orders assigned to this vendor
      const orders = await Order.find({ assignedVendorId: myShop._id })
        .sort({ createdAt: -1 })
        .limit(5);
      
      console.log(`\n  Orders assigned to MY_SHOP: ${orders.length}`);
      orders.forEach(order => {
        console.log(`    - Order ${order._id}: ${order.status}, Total: ₹${order.total}`);
      });
    } else {
      console.log('\n✗ NO MY_SHOP VENDOR FOUND!');
      console.log('\nSearching for all vendors:');
      const vendors = await User.find({ role: 'vendor' }).select('email name vendorType isApproved');
      vendors.forEach(v => {
        console.log(`  - ${v.email}: ${v.vendorType} (Approved: ${v.isApproved})`);
      });
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkMyShopVendor();
