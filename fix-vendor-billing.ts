import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User';
import Order from './src/models/Order';

dotenv.config();

async function fixVendorBillingData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI as string);
    console.log('✅ Connected to MongoDB\n');

    // Step 1: Check ALL users with role vendor
    const allVendors = await User.find({ role: 'vendor' });
    console.log('=== ALL VENDORS (role="vendor") ===');
    console.log(`Total: ${allVendors.length}\n`);

    if (allVendors.length === 0) {
      console.log('❌ NO VENDORS FOUND!');
      console.log('You need to create vendor accounts first.');
      console.log('\nVendors are users with role="vendor"');
      await mongoose.disconnect();
      process.exit(0);
    }

    // Show each vendor
    let fixed = 0;
    for (const vendor of allVendors) {
      const currentType = vendor.vendorType;
      console.log(`📋 ${vendor.name} (${vendor.email})`);
      console.log(`   Current vendorType: "${currentType || 'NOT SET'}"`);
      console.log(`   isApproved: ${vendor.isApproved}`);

      // Fix if needed
      if (!currentType || !['PRIME', 'MY_SHOP', 'WAREHOUSE_FULFILLER'].includes(currentType)) {
        let newType = 'MY_SHOP'; // default

        const email = vendor.email?.toLowerCase() || '';
        const name = vendor.name?.toLowerCase() || '';

        if (email.includes('prime') || name.includes('prime')) {
          newType = 'PRIME';
        } else if (email.includes('fulfiller') || email.includes('warehouse') || name.includes('fulfiller') || name.includes('warehouse')) {
          newType = 'WAREHOUSE_FULFILLER';
        }

        console.log(`   🔧 FIXING: Setting vendorType to "${newType}"`);
        vendor.vendorType = newType as any;
        await vendor.save();
        fixed++;
      } else {
        console.log(`   ✅ vendorType is valid`);
      }
      console.log('');
    }

    if (fixed > 0) {
      console.log(`\n✅ Fixed ${fixed} vendor(s) with missing/invalid vendorType\n`);
    }

    // Step 2: Check orders
    console.log('=== ORDERS ===');
    const totalOrders = await Order.countDocuments();
    console.log(`Total orders in database: ${totalOrders}`);

    if (totalOrders === 0) {
      console.log('❌ NO ORDERS FOUND!');
      console.log('Place some orders first to see billing data.');
      await mongoose.disconnect();
      process.exit(0);
    }

    const ordersWithVendor = await Order.countDocuments({ 
      assignedVendorId: { $exists: true, $ne: null } 
    });
    const ordersWithoutVendor = totalOrders - ordersWithVendor;

    console.log(`Orders WITH assigned vendor: ${ordersWithVendor}`);
    console.log(`Orders WITHOUT vendor: ${ordersWithoutVendor}`);

    // Check order statuses
    const statusCounts = await Order.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    console.log('\nOrder status distribution:');
    statusCounts.forEach((s: any) => {
      console.log(`  ${s._id}: ${s.count}`);
    });

    // Show sample orders
    if (ordersWithVendor > 0) {
      console.log('\n=== SAMPLE ORDERS WITH VENDORS ===');
      const sampleOrders = await Order.find({ 
        assignedVendorId: { $exists: true, $ne: null } 
      })
        .populate('assignedVendorId', 'name email vendorType')
        .limit(3)
        .lean();

      sampleOrders.forEach((order: any, idx) => {
        const vendor = order.assignedVendorId;
        console.log(`\n${idx + 1}. Order ${order._id}`);
        console.log(`   Status: ${order.status}`);
        console.log(`   Total: ₹${order.total}`);
        console.log(`   Vendor: ${vendor?.name} (${vendor?.vendorType})`);
      });
    }

    if (ordersWithoutVendor > 0) {
      console.log('\n⚠️  ORDERS WITHOUT VENDORS:');
      const sampleUnassigned = await Order.find({ 
        $or: [
          { assignedVendorId: { $exists: false } },
          { assignedVendorId: null }
        ]
      }).limit(3).lean();

      sampleUnassigned.forEach((order: any, idx) => {
        console.log(`\n${idx + 1}. Order ${order._id}`);
        console.log(`   Status: ${order.status}`);
        console.log(`   Total: ₹${order.total}`);
        console.log(`   ⚠️  NO VENDOR ASSIGNED`);
      });

      console.log('\n💡 TIP: For orders to show in billing:');
      console.log('   - Orders must have assignedVendorId field set');
      console.log('   - Vendors must accept/be assigned to orders');
      console.log('   - Status should not be CANCELLED or REJECTED');
    }

    // Step 3: Test the exact query used by billing API
    console.log('\n=== TESTING BILLING QUERY ===');
    
    const billingVendors = await User.find({
      role: 'vendor',
      vendorType: { $in: ['PRIME', 'MY_SHOP', 'WAREHOUSE_FULFILLER'] }
    }).select('name email vendorType');

    console.log(`\nVendors that WILL appear in billing: ${billingVendors.length}`);
    billingVendors.forEach(v => {
      console.log(`  ✅ ${v.name} - ${v.vendorType}`);
    });

    const billingOrders = await Order.find({
      assignedVendorId: { $exists: true, $ne: null },
      status: { $nin: ['CANCELLED', 'REJECTED'] }
    }).countDocuments();

    console.log(`\nOrders that WILL appear in billing: ${billingOrders}`);

    console.log('\n' + '='.repeat(60));
    if (billingVendors.length > 0 && billingOrders > 0) {
      console.log('✅ SUCCESS! Your billing page should show data now!');
      console.log(`   ${billingVendors.length} vendors × ${billingOrders} orders`);
    } else if (billingVendors.length === 0) {
      console.log('❌ ISSUE: No vendors with valid vendorType found');
    } else if (billingOrders === 0) {
      console.log('❌ ISSUE: No orders assigned to vendors yet');
      console.log('   Orders need assignedVendorId to appear in billing');
    }
    console.log('='.repeat(60));

    console.log('\n✅ Analysis complete! Refresh your vendor billing page.');
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

fixVendorBillingData();
