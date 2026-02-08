import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Import models to register their schemas BEFORE connecting
import User from '../models/User';
import Order from '../models/Order';
import VendorDetails from '../models/VendorDetails';
import VendorProductPricing from '../models/VendorProductPricing';
import Product from '../models/Product';

const debugPendingOrders = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pet-marketplace');
    console.log('Connected to MongoDB');

    // Get all orders (without populate to avoid schema issues)
    const allOrders = await Order.find({})
      .sort({ createdAt: -1 })
      .limit(10);

    console.log(`\n📦 Total orders found: ${allOrders.length}\n`);

    for (const order of allOrders) {
      console.log(`Order ID: ${order._id}`);
      console.log(`  Status: ${order.status}`);
      console.log(`  Payment Status: ${order.payment_status}`);
      console.log(`  Customer Pincode: ${order.customerPincode}`);
      console.log(`  Assigned Vendor ID: ${order.assignedVendorId || 'null/undefined'}`);
      console.log(`  Items: ${order.items.length}`);
      order.items.forEach((item, idx) => {
        console.log(`    Item ${idx + 1}: Product ${item.product_id}, Qty: ${item.quantity}`);
      });
      console.log('');
    }

    // Check pending/assigned orders
    const pendingOrders = await Order.find({
      status: { $in: ['PENDING', 'ASSIGNED'] },
    });

    console.log(`\n🔍 Orders with status PENDING or ASSIGNED: ${pendingOrders.length}`);
    
    const ordersWithoutVendor = await Order.find({
      status: { $in: ['PENDING', 'ASSIGNED'] },
      $or: [
        { assignedVendorId: { $exists: false } },
        { assignedVendorId: null },
      ],
    });

    console.log(`🔍 Orders without assignedVendorId: ${ordersWithoutVendor.length}`);

    // Get all vendors
    const vendors = await VendorDetails.find({ isApproved: true });
    console.log(`\n👥 Approved vendors: ${vendors.length}`);

    for (const vendor of vendors) {
      console.log(`\nVendor ID: ${vendor.vendor_id}`);
      console.log(`  Type: ${vendor.vendorType}`);
      console.log(`  Serviceable Pincodes: ${vendor.serviceablePincodes.join(', ')}`);
      console.log(`  Approved: ${vendor.isApproved}`);

      // Check if vendor has products for orders
      if (ordersWithoutVendor.length > 0) {
        const order = ordersWithoutVendor[0];
        console.log(`\n  Checking if vendor can fulfill order ${order._id} (pincode: ${order.customerPincode}):`);
        
        const servesPincode = vendor.serviceablePincodes.includes(order.customerPincode);
        console.log(`    Serves pincode: ${servesPincode}`);

        if (servesPincode) {
          let hasAllProducts = true;
          for (const item of order.items) {
            const pricing = await VendorProductPricing.findOne({
              vendor_id: vendor.vendor_id,
              product_id: item.product_id,
              isActive: true,
              availableStock: { $gte: item.quantity },
            });
            console.log(`    Product ${item.product_id}, Qty needed: ${item.quantity}, Available: ${pricing ? pricing.availableStock : 0}`);
            if (!pricing) {
              hasAllProducts = false;
            }
          }
          console.log(`    Has all products: ${hasAllProducts}`);
        }
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

debugPendingOrders();

