// @ts-nocheck
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function findOrderCustomer() {
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
    
    // Get recent split orders
    const recentOrders = await ordersCollection
      .find({ isSplitShipment: true })
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();

    if (recentOrders.length === 0) {
      console.log('❌ No split orders found\n');
      await mongoose.disconnect();
      return;
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 FINDING CUSTOMER WHO PLACED SPLIT ORDERS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const customerIds = [...new Set(recentOrders.map(o => o.customer_id.toString()))];
    
    for (const customerId of customerIds) {
      const customer = await usersCollection.findOne({ _id: new mongoose.Types.ObjectId(customerId) });
      
      if (customer) {
        console.log(`👤 Customer Found:`);
        console.log(`   Name: ${customer.name}`);
        console.log(`   Email: ${customer.email}`);
        console.log(`   Phone: ${customer.phone || 'N/A'}`);
        console.log(`   Customer ID: ${customer._id}\n`);

        // Get all orders for this customer
        const customerOrders = await ordersCollection
          .find({ customer_id: new mongoose.Types.ObjectId(customerId) })
          .sort({ createdAt: -1 })
          .toArray();

        console.log(`📦 Orders Count: ${customerOrders.length} total`);
        console.log(`   Split Orders: ${customerOrders.filter(o => o.isSplitShipment).length}`);
        console.log(`   Regular Orders: ${customerOrders.filter(o => !o.isSplitShipment).length}\n`);

        // Get vendor details
        const ramesh = await usersCollection.findOne({ email: /rameshshirke/i });
        const divesh = await usersCollection.findOne({ email: /diveshdoke/i });

        // Show recent orders (last 5)
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('RECENT ORDERS FOR ' + customer.name.toUpperCase());
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        customerOrders.slice(0, 5).forEach((order, idx) => {
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
          console.log(`   Split: ${order.isSplitShipment ? 'YES ✅' : 'NO'}`);
          console.log(`   Created: ${new Date(order.createdAt).toLocaleString()}\n`);
        });

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📱 TO SEE ALL ORDERS AS CUSTOMER');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log(`1. Login to frontend with:`);
        console.log(`   Email: ${customer.email}`);
        console.log(`   Password: (Your customer password)\n`);
        console.log(`2. Go to: My Orders / Order History`);
        console.log(`   URL: http://localhost:3000/orders\n`);
        console.log(`3. You should see ALL ${customerOrders.length} orders listed above\n`);

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📝 NOTE');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log('If you only see 1 order (Dog Food from Divesh):');
        console.log('   - You might be logged in as DIVESH (fulfiller)');
        console.log('   - Fulfillers only see THEIR assigned orders');
        console.log('   - Logout and login as CUSTOMER to see all orders\n');
      }
    }

    await mongoose.disconnect();
    console.log('✅ Search complete\n');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

findOrderCustomer();
