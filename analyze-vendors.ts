import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User';

dotenv.config();

async function fixVendorTypes() {
  try {
    await mongoose.connect(process.env.MONGODB_URI as string);
    console.log('✅ Connected to MongoDB\n');

    // Find all vendors
    const vendors = await User.find({ role: 'vendor' });
    console.log(`Found ${vendors.length} vendors\n`);

    if (vendors.length === 0) {
      console.log('❌ No vendors found in database!');
      console.log('\nYou need to create vendors first. Check if users with role="vendor" exist.');
      await mongoose.disconnect();
      process.exit(0);
    }

    // Show current vendor types
    console.log('=== CURRENT VENDOR TYPES ===');
    vendors.forEach(v => {
      console.log(`${v.name} (${v.email}): vendorType = "${v.vendorType || 'UNDEFINED'}"`);
    });

    // Count by type
    const typeCount: any = {};
    vendors.forEach(v => {
      const type = v.vendorType || 'UNDEFINED';
      typeCount[type] = (typeCount[type] || 0) + 1;
    });

    console.log('\n=== VENDOR TYPE SUMMARY ===');
    Object.entries(typeCount).forEach(([type, count]) => {
      console.log(`${type}: ${count}`);
    });

    // Check if any need fixing
    const needsFix = vendors.filter(v => 
      !v.vendorType || 
      !['PRIME', 'MY_SHOP', 'WAREHOUSE_FULFILLER'].includes(v.vendorType)
    );

    if (needsFix.length > 0) {
      console.log(`\n⚠️  Found ${needsFix.length} vendors with incorrect/missing vendorType:`);
      needsFix.forEach(v => {
        console.log(`- ${v.name} (${v.email}): "${v.vendorType || 'UNDEFINED'}"`);
      });

      console.log('\n🔧 Suggested fixes (run these in MongoDB or update manually):');
      needsFix.forEach(v => {
        // Try to determine correct type based on email or name
        let suggestedType = 'MY_SHOP'; // default
        
        if (v.email?.includes('prime') || v.name?.toLowerCase().includes('prime')) {
          suggestedType = 'PRIME';
        } else if (v.email?.includes('fulfiller') || v.email?.includes('warehouse')) {
          suggestedType = 'WAREHOUSE_FULFILLER';
        } else if (v.email?.includes('shop') || v.email?.includes('myshop')) {
          suggestedType = 'MY_SHOP';
        }

        console.log(`\ndb.users.updateOne(
  { _id: ObjectId("${v._id}") },
  { $set: { vendorType: "${suggestedType}" } }
);`);
      });
    } else {
      console.log('\n✅ All vendors have valid vendorType values!');
    }

    // Check orders
    const Order = mongoose.model('Order');
    const totalOrders = await Order.countDocuments();
    const ordersWithVendor = await Order.countDocuments({ 
      assignedVendorId: { $exists: true, $ne: null } 
    });

    console.log(`\n=== ORDERS ===`);
    console.log(`Total orders: ${totalOrders}`);
    console.log(`Orders with assigned vendor: ${ordersWithVendor}`);
    console.log(`Orders without vendor: ${totalOrders - ordersWithVendor}`);

    if (ordersWithVendor > 0) {
      console.log('\n✅ You have orders with vendors assigned!');
      console.log('The vendor billing page should show data once vendor types are fixed.');
    } else if (totalOrders > 0) {
      console.log('\n⚠️  You have orders but none are assigned to vendors yet.');
      console.log('Orders need to be accepted/assigned to vendors to appear in billing.');
    } else {
      console.log('\n⚠️  No orders in database yet.');
      console.log('Place some orders to see vendor billing data.');
    }

    await mongoose.disconnect();
    console.log('\n✅ Analysis complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixVendorTypes();
