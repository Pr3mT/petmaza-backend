import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User';
import Order from '../models/Order';

dotenv.config();

async function testWorkflow() {
  try {
    await mongoose.connect(process.env.MONGODB_URI as string);
    console.log('✓ Connected to MongoDB\n');

    // 1. Find warehouse fulfiller
    console.log('=== STEP 1: WAREHOUSE FULFILLER ===');
    const warehouseFulfiller = await User.findOne({ 
      role: 'vendor', 
      vendorType: 'WAREHOUSE_FULFILLER' 
    });
    
    if (warehouseFulfiller) {
      console.log('✓ Warehouse Fulfiller Found:');
      console.log('  Email:', warehouseFulfiller.email);
      console.log('  ID:', warehouseFulfiller._id);
      
      // Check orders assigned to warehouse fulfiller
      const fulfillerOrders = await Order.find({ 
        assignedVendorId: warehouseFulfiller._id 
      }).sort({ createdAt: -1 }).limit(5);
      
      console.log(`\n  Orders assigned to Warehouse Fulfiller: ${fulfillerOrders.length}`);
      fulfillerOrders.forEach((order, i) => {
        console.log(`  ${i+1}. Order ${order._id.toString().substring(0, 8)}: ${order.status} (₹${order.total})`);
      });
    } else {
      console.log('✗ No Warehouse Fulfiller found!');
    }

    // 2. Find MY_SHOP vendor
    console.log('\n\n=== STEP 2: MY_SHOP VENDOR ===');
    const myShop = await User.findOne({ 
      role: 'vendor', 
      vendorType: 'MY_SHOP',
      isApproved: true
    });
    
    if (!myShop) {
      console.log('✗ NO MY_SHOP VENDOR FOUND!');
      await mongoose.connection.close();
      process.exit(1);
    }

    console.log('✓ MY_SHOP Vendor Found:');
    console.log('  Email:', myShop.email);
    console.log('  Name:', myShop.name);
    console.log('  ID:', myShop._id);
    console.log('  VendorType:', myShop.vendorType);
    console.log('  Approved:', myShop.isApproved);

    // 3. Check orders assigned to MY_SHOP vendor
    console.log('\n\n=== STEP 3: ORDERS ASSIGNED TO MY_SHOP ===');
    const myShopOrders = await Order.find({ 
      assignedVendorId: myShop._id 
    })
    .populate('customer_id', 'name email phone')
    .sort({ createdAt: -1 });
    
    console.log(`Total orders: ${myShopOrders.length}\n`);

    // 4. Show PENDING orders (rejected by fulfiller)
    console.log('=== PENDING ORDERS (Rejected by Fulfiller) ===');
    const pendingOrders = myShopOrders.filter(o => o.status === 'PENDING');
    
    if (pendingOrders.length === 0) {
      console.log('No pending orders for MY_SHOP vendor');
    } else {
      console.log(`✓ Found ${pendingOrders.length} PENDING order(s):\n`);
      
      pendingOrders.forEach((order, i) => {
        console.log(`${i+1}. Order Details:`);
        console.log(`   ID: ${order._id}`);
        console.log(`   Status: ${order.status}`);
        console.log(`   Total: ₹${order.total}`);
        console.log(`   Customer: ${(order.customer_id as any)?.name || 'N/A'}`);
        console.log(`   Phone: ${(order.customer_id as any)?.phone || 'N/A'}`);
        console.log(`   Items: ${order.items.length}`);
        console.log(`   Assigned to: ${order.assignedVendorId}`);
        console.log(`   Matches MY_SHOP ID: ${order.assignedVendorId?.toString() === myShop._id.toString()}`);
        if (order.rejectionReason) {
          console.log(`   ⚠️  Rejection Reason: ${order.rejectionReason}`);
        }
        console.log('');
      });
    }

    // 5. Show other order statuses
    console.log('\n=== OTHER ORDER STATUSES ===');
    const statusCounts = myShopOrders.reduce((acc: any, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {});
    
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });

    // 6. API endpoint info
    console.log('\n\n=== API ENDPOINTS FOR MY_SHOP VENDOR ===');
    console.log('Login credentials:');
    console.log(`  Email: ${myShop.email}`);
    console.log(`  (Use your password)`);
    console.log('\nAPI Endpoints:');
    console.log('  GET  /api/my-shop-vendor/orders         - Get all orders');
    console.log('  POST /api/my-shop-vendor/orders/:id/accept  - Accept pending order');
    console.log('  POST /api/my-shop-vendor/orders/:id/refund  - Refund order (if cant fulfill)');
    console.log('  POST /api/my-shop-vendor/orders/:id/packed  - Mark as packed');
    console.log('  POST /api/my-shop-vendor/orders/:id/picked-up - Mark as picked up');
    console.log('  POST /api/my-shop-vendor/orders/:id/in-transit - Mark in transit');
    console.log('  POST /api/my-shop-vendor/orders/:id/delivered - Mark delivered');

    console.log('\n\nFrontend URLs:');
    console.log('  Dashboard: http://localhost:3000/my-shop-vendor/dashboard');
    console.log('  Orders:    http://localhost:3000/my-shop-vendor/orders');
    
    console.log('\n\n=== WORKFLOW SUMMARY ===');
    console.log('1. Customer places order → Warehouse Fulfiller (PENDING)');
    console.log('2. Fulfiller Accepts → Fulfiller processes order');
    console.log('3. Fulfiller Rejects → MY_SHOP Vendor (PENDING)');
    console.log('4. MY_SHOP Accepts → Stock reduced, MY_SHOP processes order');
    console.log('5. MY_SHOP Can\'t Fulfill → Refund customer, restore stock');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testWorkflow();
