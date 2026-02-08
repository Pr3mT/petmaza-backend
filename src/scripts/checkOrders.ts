import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from '../models/Order';
import User from '../models/User';
import VendorDetails from '../models/VendorDetails';

dotenv.config();

const checkOrders = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('✅ Connected to MongoDB\n');

    // Check all orders
    const orders = await Order.find({}).lean();
    console.log(`Total orders in database: ${orders.length}\n`);

    for (const order of orders) {
      console.log(`Order ID: ${order._id}`);
      console.log(`Status: ${order.status}`);
      console.log(`Customer Pincode: ${order.customerPincode}`);
      console.log(`AssignedVendorId: ${order.assignedVendorId || 'NONE'}`);
      console.log(`Payment Status: ${order.payment_status}`);
      console.log(`Items: ${order.items.length}`);
      console.log('---');
    }

    // Check vendor "myshop@petmaza.com"
    const myShopVendor = await User.findOne({ email: 'myshop@petmaza.com' });
    if (myShopVendor) {
      console.log(`\nMyShop Vendor ID: ${myShopVendor._id}`);
      
      const vendorDetails = await VendorDetails.findOne({ vendor_id: myShopVendor._id });
      if (vendorDetails) {
        console.log(`Serviceable Pincodes: ${vendorDetails.serviceablePincodes.join(', ')}`);
        console.log(`Is Approved: ${vendorDetails.isApproved}`);
      }
    }

    await mongoose.connection.close();
    console.log('\n✅ Done');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

checkOrders();
