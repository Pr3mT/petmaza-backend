/**
 * Verification Script for Fulfiller Setup
 * Run this to check current fulfiller configuration
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User').default;
const VendorDetails = require('./src/models/VendorDetails').default;
const Order = require('./src/models/Order').default;

async function verifyFulfillers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // 1. Check MY_SHOP vendor
    const myShopVendor = await User.findOne({
      role: 'vendor',
      vendorType: 'MY_SHOP',
      isApproved: true,
    });

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📦 MY_SHOP VENDOR STATUS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (myShopVendor) {
      console.log(`✅ MY_SHOP vendor exists`);
      console.log(`   Name: ${myShopVendor.name}`);
      console.log(`   Email: ${myShopVendor.email}`);
      console.log(`   ID: ${myShopVendor._id}`);
    } else {
      console.log('❌ NO MY_SHOP vendor found! Orders will fail if fulfillers reject.');
    }
    console.log('');

    // 2. Check warehouse fulfillers
    const fulfillers = await User.find({
      role: 'vendor',
      vendorType: 'WAREHOUSE_FULFILLER',
      isApproved: true,
    });

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🏭 WAREHOUSE FULFILLERS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (fulfillers.length === 0) {
      console.log('❌ NO warehouse fulfillers found!');
      console.log('   All orders will go directly to MY_SHOP vendor.');
      console.log('');
    } else {
      console.log(`Found ${fulfillers.length} warehouse fulfiller(s):\n`);
      
      for (const fulfiller of fulfillers) {
        const details = await VendorDetails.findOne({ vendor_id: fulfiller._id });
        
        console.log(`👤 ${fulfiller.name || 'Unnamed'}`);
        console.log(`   Email: ${fulfiller.email}`);
        console.log(`   ID: ${fulfiller._id}`);
        console.log(`   Phone: ${fulfiller.phone || 'N/A'}`);
        
        if (details && details.assignedSubcategories && details.assignedSubcategories.length > 0) {
          console.log(`   ✅ Assigned Subcategories (${details.assignedSubcategories.length}):`);
          details.assignedSubcategories.forEach(sub => {
            console.log(`      • ${sub}`);
          });
        } else {
          console.log(`   ⚠️  NO subcategories assigned!`);
        }
        console.log('');
      }
    }

    // 3. Check recent orders
    const recentOrders = await Order.find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('assignedVendorId', 'name email vendorType')
      .populate('items.product_id', 'name subCategory');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 RECENT ORDERS (Last 5)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (recentOrders.length === 0) {
      console.log('No orders found in database.');
    } else {
      recentOrders.forEach(order => {
        const vendor = order.assignedVendorId;
        console.log(`\n📦 Order: #${order._id.toString().slice(-8)}`);
        console.log(`   Status: ${order.status}`);
        console.log(`   Total: ₹${order.total}`);
        console.log(`   Created: ${order.createdAt.toLocaleString()}`);
        
        if (vendor) {
          console.log(`   Assigned to: ${vendor.name} (${vendor.vendorType})`);
        } else {
          console.log(`   ⚠️  NOT ASSIGNED to any vendor!`);
        }
        
        console.log(`   Products:`);
        order.items.forEach(item => {
          const product = item.product_id;
          if (product) {
            console.log(`      • ${product.name} (${product.subCategory || 'No subcategory'})`);
          }
        });
      });
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💡 RECOMMENDATIONS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (fulfillers.length === 0) {
      console.log('1. ⚠️  Create warehouse fulfillers via Admin → Fulfiller Master');
      console.log('2. ⚠️  Assign subcategories to each fulfiller');
    } else {
      let hasUnassigned = false;
      for (const fulfiller of fulfillers) {
        const details = await VendorDetails.findOne({ vendor_id: fulfiller._id });
        if (!details || !details.assignedSubcategories || details.assignedSubcategories.length === 0) {
          hasUnassigned = true;
          console.log(`⚠️  ${fulfiller.name} has NO assigned subcategories!`);
        }
      }
      
      if (!hasUnassigned) {
        console.log('✅ All fulfillers have assigned subcategories');
      }
    }
    
    if (!myShopVendor) {
      console.log('❌ Create MY_SHOP vendor as fallback!');
    }

    console.log('\n🎯 Expected Flow:');
    console.log('   1. Customer orders Dog Food');
    console.log('   2. System finds Divesh (handles Dog Food)');
    console.log('   3. Order assigned to Divesh (status: PENDING)');
    console.log('   4. Divesh logs in → sees order');
    console.log('   5. If Divesh rejects → order goes to MY_SHOP');
    console.log('   6. If no fulfiller matches → order goes directly to MY_SHOP');
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

verifyFulfillers();
