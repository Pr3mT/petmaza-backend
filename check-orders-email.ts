import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from './src/models/Order';

dotenv.config();

async function checkRecentOrders() {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('✅ Connected to MongoDB\n');
    
    console.log('🔍 Checking last 5 orders...\n');
    const orders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('customer_id', 'email name')
      .lean();
    
    if (orders.length === 0) {
      console.log('❌ No orders found in database');
      process.exit(0);
    }
    
    orders.forEach((order: any, index) => {
      console.log(`\n📦 Order #${index + 1}:`);
      console.log(`   Order ID: ${order._id}`);
      console.log(`   Created: ${order.createdAt}`);
      console.log(`   Status: ${order.status}`);
      console.log(`   Payment Status: ${order.payment_status}`);
      console.log(`   Total: ₹${order.total}`);
      console.log(`   Customer Email: ${order.customer_id?.email || '❌ NOT POPULATED'}`);
      console.log(`   Customer Name: ${order.customer_id?.name || '❌ NOT POPULATED'}`);
      console.log(`   Payment ID: ${order.payment_id || 'Not set'}`);
    });
    
    console.log('\n\n💡 If customer email is "NOT POPULATED", that\'s why emails aren\'t being sent!');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

checkRecentOrders();
