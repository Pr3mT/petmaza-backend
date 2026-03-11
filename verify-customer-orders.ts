// @ts-nocheck
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function verifyCustomerOrders() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MONGODB_URI is not defined');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    if (!db) {
      console.error('❌ Database connection not established');
      return;
    }

    const ordersCollection = db.collection('orders');
    const usersCollection = db.collection('users');
    
    // Get the customer user
    const customer = await usersCollection.findOne({ role: 'customer' });
    if (!customer) {
      console.log('❌ No customer found in database\n');
      await mongoose.disconnect();
      return;
    }

    console.log('👤 Customer Found:');
    console.log(`   Name: ${customer.name}`);
    console.log(`   Email: ${customer.email}`);
    console.log(`   Customer ID: ${customer._id}\n`);

    // Get all orders for this customer
    const customerOrders = await ordersCollection
      .find({ customer_id: customer._id })
      .sort({ createdAt: -1 })
      .toArray();

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📦 ALL ORDERS FOR ${customer.name.toUpperCase()}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (customerOrders.length === 0) {
      console.log('❌ No orders found for this customer\n');
    } else {
      console.log(`✅ Found ${customerOrders.length} total orders:\n`);

      // Get vendor details
      const ramesh = await usersCollection.findOne({ email: /rameshshirke/i });
      const divesh = await usersCollection.findOne({ email: /diveshdoke/i });

      customerOrders.forEach((order: any, idx: number) => {
        const vendorId = order.assignedVendorId?.toString();
        let vendorName = 'Unknown';
        if (vendorId === ramesh?._id.toString()) {
          vendorName = 'RameshShirke';
        } else if (vendorId === divesh?._id.toString()) {
          vendorName = 'DiveshDoke';
        }

        console.log(`${idx + 1}. Order #${order._id.toString().slice(-8)}`);
        console.log(`   Fulfiller: ${vendorName}`);
        console.log(`   Status: ${order.status}`);
        console.log(`   Total: ₹${order.total}`);
        console.log(`   Items: ${order.items.length} product(s)`);
        console.log(`   Split Shipment: ${order.isSplitShipment ? 'YES ✅' : 'NO'}`);
        console.log(`   Created: ${new Date(order.createdAt).toLocaleString()}`);
        console.log(`   Customer ID: ${order.customer_id.toString() === customer._id.toString() ? '✅ MATCHES' : '❌ MISMATCH'}\n`);
      });

      // Check for split orders grouped by time
      const splitOrderGroups = new Map();
      customerOrders.forEach(order => {
        if (order.isSplitShipment) {
          const timeKey = new Date(order.createdAt).toISOString().slice(0, 16);
          if (!splitOrderGroups.has(timeKey)) {
            splitOrderGroups.set(timeKey, []);
          }
          splitOrderGroups.get(timeKey).push(order);
        }
      });

      if (splitOrderGroups.size > 0) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🔀 SPLIT ORDER GROUPS');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        let groupNum = 1;
        for (const [time, orders] of splitOrderGroups) {
          console.log(`Group ${groupNum}: ${new Date(time).toLocaleString()}`);
          console.log(`   ${orders.length} separate orders created:`);
          orders.forEach((order: any) => {
            const vendorId = order.assignedVendorId?.toString();
            let vendorName = 'Unknown';
            if (vendorId === ramesh?._id.toString()) {
              vendorName = 'RameshShirke';
            } else if (vendorId === divesh?._id.toString()) {
              vendorName = 'DiveshDoke';
            }
            console.log(`   - Order #${order._id.toString().slice(-8)} → ${vendorName} (₹${order.total})`);
          });
          console.log('');
          groupNum++;
        }
      }
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📱 CUSTOMER VIEW (Frontend /orders page)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`When ${customer.name} logs in and goes to "My Orders":`)
    console.log(`   ✅ Should see ALL ${customerOrders.length} orders listed above`);
    console.log(`   ✅ API endpoint: GET /api/orders/my`);
    console.log(`   ✅ Query: { customer_id: "${customer._id}" }\n`);

    if (customerOrders.length < 2) {
      console.log('⚠️  ISSUE: Customer should see multiple orders if split order was placed\n');
    }

    await mongoose.disconnect();
    console.log('✅ Verification complete\n');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

verifyCustomerOrders();
