import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User';
import Order from '../models/Order';

dotenv.config();

async function checkOrderAssignment() {
  try {
    await mongoose.connect(process.env.MONGODB_URI as string);
    console.log('Connected to MongoDB\n');

    // Get the MY_SHOP vendor
    const myShop = await User.findOne({ role: 'vendor', vendorType: 'MY_SHOP' });
    
    if (!myShop) {
      console.log('NO MY_SHOP VENDOR FOUND!');
      return;
    }

    console.log('MY_SHOP Vendor:');
    console.log('  ID:', myShop._id.toString());
    console.log('  Email:', myShop.email);
    console.log('  Name:', myShop.name);
    console.log('  VendorType:', myShop.vendorType);
    console.log('  Role:', myShop.role);
    console.log('  Approved:', myShop.isApproved);

    // Get orders assigned to this vendor
    console.log('\n=== ALL Orders Assigned to MY_SHOP ===');
    const allOrders = await Order.find({ assignedVendorId: myShop._id })
      .populate('customer_id', 'name email phone')
      .sort({ createdAt: -1 });
    
    console.log(`Total orders: ${allOrders.length}\n`);
    
    allOrders.forEach((order, index) => {
      console.log(`${index + 1}. Order ID: ${order._id}`);
      console.log(`   Status: ${order.status}`);
      console.log(`   Total: ₹${order.total}`);
      console.log(`   Customer: ${(order.customer_id as any)?.name || 'N/A'}`);
      console.log(`   Assigned Vendor ID: ${order.assignedVendorId}`);
      console.log(`   Matches MY_SHOP ID: ${order.assignedVendorId?.toString() === myShop._id.toString()}`);
      if (order.rejectionReason) {
        console.log(`   Rejection Reason: ${order.rejectionReason}`);
      }
      console.log('');
    });

    // Check PENDING orders specifically
    console.log('\n=== PENDING Orders ===');
    const pendingOrders = await Order.find({ 
      assignedVendorId: myShop._id,
      status: 'PENDING'
    });
    console.log(`Total PENDING orders: ${pendingOrders.length}`);
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkOrderAssignment();
