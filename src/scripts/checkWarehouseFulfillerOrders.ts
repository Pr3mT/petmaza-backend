import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from '../models/Order';
import User from '../models/User';

dotenv.config();

const checkOrders = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('MONGODB_URI is not defined');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB\n');

    // Find warehouse fulfiller
    const fulfiller = await User.findOne({
      vendorType: 'WAREHOUSE_FULFILLER',
    });

    if (!fulfiller) {
      console.log('❌ No warehouse fulfiller found in database');
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log('✅ Warehouse Fulfiller found:');
    console.log(`   ID: ${fulfiller._id}`);
    console.log(`   Email: ${fulfiller.email}`);
    console.log(`   Name: ${fulfiller.name}\n`);

    // Find all orders
    const allOrders = await Order.find({}).populate('customer_id', 'name email');
    console.log(`📦 Total orders in database: ${allOrders.length}\n`);

    // Find orders assigned to warehouse fulfiller
    const fulfillerOrders = await Order.find({
      assignedVendorId: fulfiller._id,
    }).populate('customer_id', 'name email');

    console.log(`📋 Orders assigned to Warehouse Fulfiller: ${fulfillerOrders.length}`);
    
    if (fulfillerOrders.length > 0) {
      fulfillerOrders.forEach((order, index) => {
        const customer = order.customer_id as any;
        console.log(`\n   Order ${index + 1}:`);
        console.log(`   - ID: ${order._id}`);
        console.log(`   - Customer: ${customer?.name || 'N/A'}`);
        console.log(`   - Status: ${order.status}`);
        console.log(`   - Total: ₹${order.total}`);
        console.log(`   - Items: ${order.items.length}`);
        console.log(`   - Created: ${order.createdAt}`);
      });
    } else {
      console.log('   No orders found for warehouse fulfiller');
    }

    // Check recent orders
    console.log('\n📊 Recent orders (last 5):');
    const recentOrders = await Order.find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('customer_id', 'name email')
      .populate('assignedVendorId', 'name vendorType');

    if (recentOrders.length > 0) {
      recentOrders.forEach((order, index) => {
        const customer = order.customer_id as any;
        const vendor = order.assignedVendorId as any;
        console.log(`\n   ${index + 1}. Order ${order._id.toString().slice(-8)}`);
        console.log(`      Customer: ${customer?.name || 'N/A'}`);
        console.log(`      Status: ${order.status}`);
        console.log(`      Assigned to: ${vendor?.name || 'Not assigned'} (${vendor?.vendorType || 'N/A'})`);
        console.log(`      isPrime: ${order.isPrime}`);
        console.log(`      Created: ${order.createdAt}`);
      });
    }

    await mongoose.disconnect();
    console.log('\n\nDisconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

checkOrders();
