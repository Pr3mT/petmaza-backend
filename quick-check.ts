// Quick database check for vendor billing
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const checkDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI as string);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    
    // Check vendors
    const vendorsCollection = db?.collection('users');
    const allVendors = await vendorsCollection?.find({ role: 'vendor' }).toArray();
    console.log('=== ALL VENDORS ===');
    console.log('Total vendors with role="vendor":', allVendors?.length || 0);
    
    if (allVendors && allVendors.length > 0) {
      allVendors.forEach((v: any) => {
        console.log(`- ${v.name || 'No name'} (${v.email}) - Type: ${v.vendorType || 'NO TYPE'}`);
      });
    }

    // Count by vendor type
    const primeCount = allVendors?.filter((v: any) => v.vendorType === 'PRIME').length || 0;
    const myShopCount = allVendors?.filter((v: any) => v.vendorType === 'MY_SHOP').length || 0;
    const fulfillerCount = allVendors?.filter((v: any) => v.vendorType === 'WAREHOUSE_FULFILLER').length || 0;
    
    console.log(`\nPRIME: ${primeCount}, MY_SHOP: ${myShopCount}, WAREHOUSE_FULFILLER: ${fulfillerCount}`);

    // Check orders
    const ordersCollection = db?.collection('orders');
    const totalOrders = await ordersCollection?.countDocuments() || 0;
    console.log(`\n=== ORDERS ===`);
    console.log('Total orders:', totalOrders);

    if (totalOrders > 0) {
      // Orders with assignedVendorId
      const withVendor = await ordersCollection?.countDocuments({ 
        assignedVendorId: { $exists: true, $ne: null } 
      }) || 0;
      
      console.log('Orders with assignedVendorId:', withVendor);
      console.log('Orders without assignedVendorId:', totalOrders - withVendor);

      // Get sample order with vendor
      if (withVendor > 0) {
        const sampleOrder = await ordersCollection?.findOne({ 
          assignedVendorId: { $exists: true, $ne: null } 
        });
        console.log('\nSample order with vendor:');
        console.log('- ID:', sampleOrder?._id);
        console.log('- Status:', sampleOrder?.status);
        console.log('- Total:', sampleOrder?.total);
        console.log('- Vendor ID:', sampleOrder?.assignedVendorId);
      }

      // Order statuses
      const statuses = await ordersCollection?.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]).toArray() || [];
      
      console.log('\nOrder statuses:');
      statuses.forEach((s: any) => {
        console.log(`- ${s._id || 'null'}: ${s.count}`);
      });
    }

    await mongoose.disconnect();
    console.log('\n✅ Check complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

checkDatabase();
