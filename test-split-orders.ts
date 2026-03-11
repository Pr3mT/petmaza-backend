// @ts-nocheck
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from './src/models/Order';
import User from './src/models/User';
import VendorDetails from './src/models/VendorDetails';
import Product from './src/models/Product';

dotenv.config();

/**
 * Test script to verify split order functionality
 * Scenario: Customer orders mixed products from different fulfillers
 * Expected: Each fulfiller receives ONLY their assigned products
 */
async function testSplitOrders() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MONGODB_URI is not defined');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 SPLIT ORDER TEST - Fulfiller Assignment');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // 1. Get all warehouse fulfillers
    const fulfillers = await User.find({
      vendorType: 'WAREHOUSE_FULFILLER',
      isApproved: true,
    });

    if (fulfillers.length === 0) {
      console.log('❌ No warehouse fulfillers found!');
      console.log('   Please create fulfillers first via Admin → Fulfiller Master\n');
      await mongoose.disconnect();
      return;
    }

    console.log(`✅ Found ${fulfillers.length} Warehouse Fulfillers:\n`);

    // Display each fulfiller's assigned subcategories
    for (const fulfiller of fulfillers) {
      const details = await VendorDetails.findOne({ vendor_id: fulfiller._id });
      console.log(`👤 ${fulfiller.name}`);
      console.log(`   Email: ${fulfiller.email}`);
      
      if (details && details.assignedSubcategories && details.assignedSubcategories.length > 0) {
        console.log(`   ✅ Handles ${details.assignedSubcategories.length} subcategories:`);
        details.assignedSubcategories.forEach(sub => {
          console.log(`      • ${sub}`);
        });
      } else {
        console.log(`   ⚠️  NO subcategories assigned!`);
      }
      console.log('');
    }

    // 2. Check recent orders to see split order behavior
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📦 RECENT ORDERS (Last 10 orders)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const recentOrders = await Order.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('customer_id', 'name email')
      .populate('assignedVendorId', 'name vendorType')
      .populate('items.product_id', 'name subCategory mainCategory');

    if (recentOrders.length === 0) {
      console.log('No orders found. Place a test order to see split functionality.\n');
    } else {
      // Group orders by customer and time to identify split shipments
      const ordersByCustomerAndTime = new Map();

      recentOrders.forEach((order: any) => {
        const customer = order.customer_id;
        const timeKey = new Date(order.createdAt).toLocaleString();
        const key = `${customer?._id}_${timeKey}`;
        
        if (!ordersByCustomerAndTime.has(key)) {
          ordersByCustomerAndTime.set(key, []);
        }
        ordersByCustomerAndTime.get(key).push(order);
      });

      let orderNumber = 1;
      for (const [key, orders] of ordersByCustomerAndTime) {
        const firstOrder = orders[0] as any;
        const customer = firstOrder.customer_id;

        if (orders.length > 1) {
          console.log(`🔀 SPLIT ORDER GROUP ${orderNumber} (${orders.length} separate orders)`);
          console.log(`   Customer: ${customer?.name || 'N/A'}`);
          console.log(`   Time: ${new Date(firstOrder.createdAt).toLocaleString()}`);
          console.log(`   Total Orders: ${orders.length}\n`);

          orders.forEach((order: any, idx: number) => {
            const vendor = order.assignedVendorId;
            console.log(`   📦 Order ${idx + 1}: #${order._id.toString().slice(-8)}`);
            console.log(`      Fulfiller: ${vendor?.name || 'Not assigned'} (${vendor?.vendorType || 'N/A'})`);
            console.log(`      Status: ${order.status}`);
            console.log(`      Total: ₹${order.total}`);
            console.log(`      Split Shipment: ${order.isSplitShipment ? 'YES ✅' : 'NO'}`);
            console.log(`      Products (${order.items.length} items):`);
            
            order.items.forEach((item: any) => {
              const product = item.product_id;
              if (product) {
                console.log(`         • ${product.name}`);
                console.log(`           Category: ${product.mainCategory || 'N/A'} → ${product.subCategory || 'N/A'}`);
                console.log(`           Qty: ${item.quantity} × ₹${item.price} = ₹${item.subtotal}`);
              }
            });
            console.log('');
          });
        } else {
          const order = orders[0] as any;
          const vendor = order.assignedVendorId;
          
          console.log(`📦 Single Order ${orderNumber}: #${order._id.toString().slice(-8)}`);
          console.log(`   Customer: ${customer?.name || 'N/A'}`);
          console.log(`   Fulfiller: ${vendor?.name || 'Not assigned'} (${vendor?.vendorType || 'N/A'})`);
          console.log(`   Status: ${order.status}`);
          console.log(`   Total: ₹${order.total}`);
          console.log(`   Time: ${new Date(order.createdAt).toLocaleString()}`);
          console.log(`   Products:`);
          
          order.items.forEach((item: any) => {
            const product = item.product_id;
            if (product) {
              console.log(`      • ${product.name} (${product.subCategory || 'No subcategory'})`);
            }
          });
          console.log('');
        }

        orderNumber++;
      }
    }

    // 3. Show test scenario expectations
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🧪 TEST SCENARIO');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('When customer orders mixed products:');
    console.log('Example: Fish Toy + Dog Food + Cat Food\n');
    
    console.log('Expected Result:');
    const ramesh = fulfillers.find(f => f.name?.includes('Ramesh'));
    const divesh = fulfillers.find(f => f.name?.includes('Divesh'));
    
    if (ramesh && divesh) {
      const rameshDetails = await VendorDetails.findOne({ vendor_id: ramesh._id });
      const diveshDetails = await VendorDetails.findOne({ vendor_id: divesh._id });
      
      console.log(`   📦 Order 1 → ${ramesh.name}`);
      console.log(`      Products: Fish Toy (Fish Toys & Accessories)`);
      console.log(`      Status: PENDING`);
      console.log(`      Email sent to: ${ramesh.email}\n`);
      
      console.log(`   📦 Order 2 → ${divesh.name}`);
      console.log(`      Products: Dog Food + Cat Food`);
      console.log(`      Status: PENDING`);
      console.log(`      Email sent to: ${divesh.email}\n`);
      
      console.log('✅ Both fulfillers receive ONLY their assigned products');
      console.log('✅ Each order marked as isSplitShipment: true');
    } else {
      console.log('   ⚠️  Test requires Ramesh and Divesh fulfillers to be set up\n');
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💡 HOW TO TEST');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('1. Log in as customer on frontend');
    console.log('2. Add products from different categories:');
    console.log('   - Add Fish Toy (handled by Ramesh)');
    console.log('   - Add Dog Food (handled by Divesh)');
    console.log('   - Add Cat Food (handled by Divesh)');
    console.log('3. Complete checkout');
    console.log('4. Run this script again to see split orders');
    console.log('5. Check fulfiller email inboxes - each should receive their order\n');

    await mongoose.disconnect();
    console.log('✅ Test complete - Disconnected from MongoDB\n');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

testSplitOrders();
