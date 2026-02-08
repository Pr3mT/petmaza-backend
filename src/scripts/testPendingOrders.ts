import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from '../models/Order';
import VendorDetails from '../models/VendorDetails';
import VendorProductPricing from '../models/VendorProductPricing';
import User from '../models/User';

dotenv.config();

const testPendingOrders = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pet-marketplace');
    console.log('✅ Connected to MongoDB\n');

    // Get a vendor user
    const vendorUser = await User.findOne({ role: 'vendor' });
    if (!vendorUser) {
      console.log('❌ No vendor user found');
      await mongoose.connection.close();
      process.exit(1);
    }

    console.log(`🔍 Testing with vendor: ${vendorUser._id} (${vendorUser.email})\n`);

    // Get vendor details
    const vendorDetails = await VendorDetails.findOne({ 
      vendor_id: vendorUser._id,
      isApproved: true 
    });

    if (!vendorDetails) {
      console.log('❌ Vendor not found or not approved');
      const allVendorDetails = await VendorDetails.find({});
      console.log(`\nTotal vendors in DB: ${allVendorDetails.length}`);
      allVendorDetails.forEach(v => {
        console.log(`  - Vendor ID: ${v.vendor_id}, Approved: ${v.isApproved}, Type: ${v.vendorType}`);
      });
      await mongoose.connection.close();
      process.exit(1);
    }

    console.log(`✅ Vendor found:`);
    console.log(`   Type: ${vendorDetails.vendorType}`);
    console.log(`   Pincodes: ${vendorDetails.serviceablePincodes.join(', ')}\n`);

    // Get all pending/assigned orders
    const allPendingOrders = await Order.find({
      status: { $in: ['PENDING', 'ASSIGNED'] },
    }).sort({ createdAt: -1 });

    console.log(`📦 Found ${allPendingOrders.length} orders with status PENDING or ASSIGNED\n`);

    if (allPendingOrders.length === 0) {
      console.log('❌ No pending/assigned orders found in database');
      await mongoose.connection.close();
      process.exit(0);
    }

    // Filter unassigned orders
    const unassignedOrders = allPendingOrders.filter(order => {
      const hasVendor = order.assignedVendorId && order.assignedVendorId.toString() !== '';
      return !hasVendor;
    });

    console.log(`📦 Found ${unassignedOrders.length} unassigned orders\n`);

    if (unassignedOrders.length === 0) {
      console.log('❌ All orders are already assigned to vendors');
      allPendingOrders.forEach(order => {
        console.log(`   Order ${order._id}: assignedVendorId = ${order.assignedVendorId}`);
      });
      await mongoose.connection.close();
      process.exit(0);
    }

    // Test each order
    for (const order of unassignedOrders) {
      console.log(`\n🔍 Testing Order ${order._id}:`);
      console.log(`   Status: ${order.status}`);
      console.log(`   Pincode: ${order.customerPincode}`);
      console.log(`   Items: ${order.items.length}`);

      // Check pincode
      const servesPincode = vendorDetails.serviceablePincodes.includes(order.customerPincode);
      console.log(`   ✅ Serves pincode: ${servesPincode}`);

      if (!servesPincode) {
        console.log(`   ❌ SKIPPED - Vendor doesn't serve pincode ${order.customerPincode}`);
        continue;
      }

      // Check products
      let hasAllProducts = true;
      for (const item of order.items) {
        const pricing = await VendorProductPricing.findOne({
          vendor_id: vendorUser._id,
          product_id: item.product_id,
          isActive: true,
          availableStock: { $gte: item.quantity },
        });

        if (!pricing) {
          console.log(`   ❌ SKIPPED - Product ${item.product_id} not in stock (need ${item.quantity})`);
          hasAllProducts = false;
          
          // Check if product exists at all
          const anyPricing = await VendorProductPricing.findOne({
            vendor_id: vendorUser._id,
            product_id: item.product_id,
          });
          if (anyPricing) {
            console.log(`      (Product exists but stock: ${anyPricing.availableStock}, isActive: ${anyPricing.isActive})`);
          } else {
            console.log(`      (Product not found for this vendor)`);
          }
          break;
        } else {
          console.log(`   ✅ Product ${item.product_id}: Stock ${pricing.availableStock} >= Need ${item.quantity}`);
        }
      }

      if (hasAllProducts) {
        console.log(`   ✅ ORDER IS ELIGIBLE FOR THIS VENDOR!`);
      }
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

testPendingOrders();

