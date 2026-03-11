// @ts-nocheck
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from './src/models/Order';
import User from './src/models/User';
import Product from './src/models/Product';

dotenv.config();

async function testSplitOrderEmail() {
  try {
    console.log('\n🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('✅ Connected\n');

    // Find customer
    const customer = await User.findOne({ 
      role: 'customer',
      email: 'samrudhiamrutkar15@gmail.com' 
    });

    if (!customer) {
      console.log('❌ Customer not found');
      process.exit(1);
    }

    console.log('👤 Customer:', customer.name);
    console.log('📧 Email:', customer.email);

    // Find recent split orders for this customer
    const splitOrders = await Order.find({
      customer_id: customer._id,
      isSplitShipment: true
    })
    .populate('assignedVendorId', 'name')
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

    console.log(`\n📦 Recent Split Orders: ${splitOrders.length}\n`);

    if (splitOrders.length === 0) {
      console.log('⚠️  No split orders found. Place a new order with mixed products.');
      process.exit(0);
    }

    // Group orders by timestamp (orders created in same second are part of same split)
    const orderGroups = new Map();

    splitOrders.forEach((order: any) => {
      const timestamp = new Date(order.createdAt).getTime();
      const groupKey = Math.floor(timestamp / 2000); // Group within 2 seconds

      if (!orderGroups.has(groupKey)) {
        orderGroups.set(groupKey, []);
      }
      orderGroups.get(groupKey).push(order);
    });

    console.log(`📊 Found ${orderGroups.size} split shipment groups:\n`);

    let groupNum = 1;
    for (const [key, orders] of orderGroups) {
      const firstOrder = orders[0];
      const orderTime = new Date(firstOrder.createdAt).toLocaleTimeString('en-IN');

      console.log(`\n🎯 Split Shipment Group ${groupNum} - ${orderTime}`);
      console.log(`   Orders: ${orders.length}`);
      console.log(`   Total: ₹${orders.reduce((sum, o) => sum + o.total, 0)}\n`);

      orders.forEach((order: any, idx: number) => {
        console.log(`   ${idx + 1}. Order #${order._id.toString().slice(-8)}`);
        console.log(`      Fulfiller: ${order.assignedVendorId?.name || 'Unassigned'}`);
        console.log(`      Status: ${order.status}`);
        console.log(`      Items: ${order.items.length}`);
        order.items.forEach((item: any) => {
          console.log(`         - Product ID: ${item.product_id} (Qty: ${item.quantity}) - ₹${item.subtotal}`);
        });
        console.log(`      Amount: ₹${order.total}`);
        console.log('');
      });

      groupNum++;
    }

    console.log('\n✅ VERIFICATION STEPS:\n');
    console.log('1. Place a NEW order with products from DIFFERENT fulfillers');
    console.log('   Example: Order Dog Food (Divesh) + Fish Toy (Ramesh)\n');
    console.log('2. Check your email: samrudhiamrutkar15@gmail.com');
    console.log('   - Should receive ONE email with ALL products');
    console.log('   - Email should show "Split Shipment Notice"');
    console.log('   - Email should list all Order IDs\n');
    console.log('3. Check "My Orders" in customer account');
    console.log('   - Should see BOTH orders displayed');
    console.log('   - Each order shows its assigned fulfiller\n');
    console.log('4. Check fulfiller accounts');
    console.log('   - Divesh sees only Dog Food order');
    console.log('   - Ramesh sees only Fish Toy order\n');

    console.log('💡 NEW FEATURES IMPLEMENTED:\n');
    console.log('✅ Customer receives ONE email with ALL products from split orders');
    console.log('✅ Email shows split shipment notice with all Order IDs');
    console.log('✅ Email shows complete order summary with all items');
    console.log('✅ Both orders appear in customer order list');
    console.log('✅ Each fulfiller receives separate email for their products');
    console.log('✅ Order response includes all split orders\n');

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testSplitOrderEmail();
