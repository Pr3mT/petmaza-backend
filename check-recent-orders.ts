// @ts-nocheck
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function checkRecentOrders() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MONGODB_URI is not defined');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Direct query to orders collection
    const db = mongoose.connection.db;
    if (!db) {
      console.error('❌ Database connection not established');
      return;
    }

    const ordersCollection = db.collection('orders');
    
    // Get recent orders (last 10)
    const recentOrders = await ordersCollection
      .find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📦 RECENT ORDERS (Last 10)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (recentOrders.length === 0) {
      console.log('No orders found.\n');
    } else {
      // Get vendor names
      const vendorsCollection = db.collection('users');
      const ramesh = await vendorsCollection.findOne({ email: /rameshshirke/i });
      const divesh = await vendorsCollection.findOne({ email: /diveshdoke/i });

      // Group orders by customer and time
      const orderGroups = new Map();
      
      for (const order of recentOrders) {
        const customerId = order.customer_id?.toString();
        const timeKey = new Date(order.createdAt).toISOString().slice(0, 16); // Group by minute
        const groupKey = `${customerId}_${timeKey}`;
        
        if (!orderGroups.has(groupKey)) {
          orderGroups.set(groupKey, []);
        }
        orderGroups.get(groupKey).push(order);
      }

      let groupNum = 1;
      for (const [key, orders] of orderGroups) {
        const firstOrder = orders[0];
        const orderTime = new Date(firstOrder.createdAt).toLocaleString();

        if (orders.length > 1) {
          console.log(`🔀 SPLIT ORDER GROUP ${groupNum} (${orders.length} separate orders)`);
          console.log(`   Time: ${orderTime}`);
          console.log(`   Customer ID: ${firstOrder.customer_id.toString().slice(-8)}\n`);

          orders.forEach((order: any, idx: number) => {
            const vendorId = order.assignedVendorId?.toString();
            let vendorName = 'Unknown';
            if (vendorId === ramesh?._id.toString()) {
              vendorName = 'RameshShirke';
            } else if (vendorId === divesh?._id.toString()) {
              vendorName = 'DiveshDoke';
            }

            console.log(`   📦 Order ${idx + 1}: #${order._id.toString().slice(-8)}`);
            console.log(`      Fulfiller: ${vendorName}`);
            console.log(`      Status: ${order.status}`);
            console.log(`      Total: ₹${order.total}`);
            console.log(`      Items: ${order.items.length} product(s)`);
            console.log(`      Split Shipment: ${order.isSplitShipment ? 'YES ✅' : 'NO'}`);
            console.log('');
          });
        } else {
          const order = orders[0];
          const vendorId = order.assignedVendorId?.toString();
          let vendorName = 'Unknown';
          if (vendorId === ramesh?._id.toString()) {
            vendorName = 'RameshShirke';
          } else if (vendorId === divesh?._id.toString()) {
            vendorName = 'DiveshDoke';
          }

          console.log(`📦 Single Order ${groupNum}: #${order._id.toString().slice(-8)}`);
          console.log(`   Fulfiller: ${vendorName}`);
          console.log(`   Status: ${order.status}`);
          console.log(`   Total: ₹${order.total}`);
          console.log(`   Time: ${orderTime}`);
          console.log(`   Items: ${order.items.length} product(s)`);
          console.log(`   Split Shipment: ${order.isSplitShipment ? 'YES ✅' : 'NO'}`);
          console.log('');
        }
        groupNum++;
      }
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💡 WHERE TO VIEW ORDERS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('As RameshShirke (rameshshirke@gmail.com):');
    console.log('   → Login → Orders page');
    console.log('   → Will see ONLY orders assigned to Ramesh\n');
    console.log('As DiveshDoke (diveshdoke@gmail.com):');
    console.log('   → Login → Orders page');
    console.log('   → Will see ONLY orders assigned to Divesh\n');
    console.log('As Customer:');
    console.log('   → Login → My Orders');
    console.log('   → Should see ALL orders (both split orders)\n');

    await mongoose.disconnect();
    console.log('✅ Check complete\n');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

checkRecentOrders();
