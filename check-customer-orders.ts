import mongoose from 'mongoose';
import Order from './src/models/Order';
import User from './src/models/User';
import dotenv from 'dotenv';

dotenv.config();

const checkCustomerOrders = async () => {
  try {
    console.log('\n=== Connecting to Database ===');
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('✅ Connected to MongoDB\n');

    // Find customer
    const customer = await User.findOne({ email: 'samrudhiamrutkar15@gmail.com' });
    if (!customer) {
      console.log('❌ Customer not found');
      process.exit(1);
    }

    console.log(`📧 Customer: ${customer.name} (${customer.email})`);
    console.log(`🆔 Customer ID: ${customer._id}\n`);

    // Get all orders for this customer
    const allOrders = await Order.find({ customer_id: customer._id })
      .populate('items.product_id', 'name isPrime')
      .populate('assignedVendorId', 'name vendorType')
      .sort({ createdAt: -1 });

    console.log(`📦 Total Orders Found: ${allOrders.length}\n`);
    console.log('=' .repeat(80));

    allOrders.forEach((order, index) => {
      console.log(`\n${index + 1}. Order #${order._id.toString().slice(-8).toUpperCase()}`);
      console.log(`   Created: ${order.createdAt.toLocaleString()}`);
      console.log(`   Status: ${order.status}`);
      console.log(`   Total: ₹${order.total}`);
      console.log(`   IsPrime: ${order.isPrime ? 'YES' : 'NO'}`);
      console.log(`   IsSplitShipment: ${order.isSplitShipment ? 'YES' : 'NO'}`);
      console.log(`   Vendor: ${order.assignedVendorId ? (order.assignedVendorId as any).name : 'Not Assigned'}`);
      console.log(`   Vendor Type: ${order.assignedVendorId ? (order.assignedVendorId as any).vendorType : 'N/A'}`);
      console.log(`   Items: ${order.items.length}`);
      order.items.forEach((item: any, i: number) => {
        const product = item.product_id;
        console.log(`      ${i + 1}. ${product ? product.name : 'Unknown'} (x${item.quantity}) - ${product?.isPrime ? 'PRIME' : 'NORMAL'}`);
      });
    });

    console.log('\n' + '='.repeat(80));
    console.log('\n📊 Summary:');
    console.log(`   Total Product Items Across All Orders: ${allOrders.reduce((sum, o) => sum + o.items.length, 0)}`);
    console.log(`   Prime Orders: ${allOrders.filter(o => o.isPrime).length}`);
    console.log(`   Normal Orders: ${allOrders.filter(o => !o.isPrime).length}`);
    console.log(`   Split Shipments: ${allOrders.filter(o => o.isSplitShipment).length}`);
    
    const statusCounts: any = {};
    allOrders.forEach(o => {
      statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
    });
    console.log('\n   Status Breakdown:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`      ${status}: ${count}`);
    });

    console.log('\n✅ Analysis Complete\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

checkCustomerOrders();
