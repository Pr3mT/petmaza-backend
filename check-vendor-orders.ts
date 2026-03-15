import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from './src/models/Order';
import User from './src/models/User';

dotenv.config();

async function checkVendorOrders() {
  try {
    await mongoose.connect(process.env.MONGODB_URI as string);
    console.log('✅ Connected to MongoDB\n');

    // Check vendors
    console.log('=== VENDORS IN DATABASE ===');
    const vendors = await User.find({ role: 'vendor' }).select('name email vendorType role');
    console.log(`Total vendors: ${vendors.length}`);
    vendors.forEach(v => {
      console.log(`- ${v.name} (${v.email}) - Type: ${v.vendorType}`);
    });

    // Check all orders
    console.log('\n=== ORDERS IN DATABASE ===');
    const totalOrders = await Order.countDocuments();
    console.log(`Total orders: ${totalOrders}`);

    // Check orders by status
    console.log('\n=== ORDERS BY STATUS ===');
    const ordersByStatus = await Order.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    ordersByStatus.forEach(s => {
      console.log(`${s._id}: ${s.count} orders`);
    });

    // Check orders with assignedVendorId
    console.log('\n=== ORDERS WITH ASSIGNED VENDOR ===');
    const ordersWithVendor = await Order.countDocuments({ 
      assignedVendorId: { $exists: true, $ne: null } 
    });
    console.log(`Orders with assignedVendorId: ${ordersWithVendor}`);

    // Check orders without assignedVendorId
    const ordersWithoutVendor = await Order.countDocuments({ 
      $or: [
        { assignedVendorId: { $exists: false } },
        { assignedVendorId: null }
      ]
    });
    console.log(`Orders without assignedVendorId: ${ordersWithoutVendor}`);

    // Sample orders with vendor assigned
    if (ordersWithVendor > 0) {
      console.log('\n=== SAMPLE ORDERS WITH VENDORS ===');
      const sampleOrders = await Order.find({ 
        assignedVendorId: { $exists: true, $ne: null } 
      })
        .populate('assignedVendorId', 'name email vendorType')
        .populate('customer_id', 'name email')
        .limit(5)
        .select('order_id status total assignedVendorId customer_id createdAt')
        .lean();

      sampleOrders.forEach(order => {
        const vendor = order.assignedVendorId as any;
        const customer = order.customer_id as any;
        console.log(`\nOrder ID: ${order._id}`);
        console.log(`  Status: ${order.status}`);
        console.log(`  Total: ₹${order.total}`);
        console.log(`  Vendor: ${vendor?.name} (${vendor?.vendorType})`);
        console.log(`  Customer: ${customer?.name}`);
        console.log(`  Created: ${order.createdAt}`);
      });
    }

    // Sample orders without vendor
    if (ordersWithoutVendor > 0) {
      console.log('\n=== SAMPLE ORDERS WITHOUT VENDORS ===');
      const sampleOrdersNoVendor = await Order.find({ 
        $or: [
          { assignedVendorId: { $exists: false } },
          { assignedVendorId: null }
        ]
      })
        .populate('customer_id', 'name email')
        .limit(5)
        .select('order_id status total customer_id createdAt items')
        .lean();

      sampleOrdersNoVendor.forEach(order => {
        const customer = order.customer_id as any;
        console.log(`\nOrder ID: ${order._id}`);
        console.log(`  Status: ${order.status}`);
        console.log(`  Total: ₹${order.total}`);
        console.log(`  Customer: ${customer?.name}`);
        console.log(`  Items: ${order.items?.length || 0}`);
        console.log(`  Created: ${order.createdAt}`);
        console.log(`  ⚠️  NO VENDOR ASSIGNED`);
      });
    }

    console.log('\n✅ Diagnostic complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkVendorOrders();
