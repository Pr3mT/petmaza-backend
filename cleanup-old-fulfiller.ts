import mongoose from 'mongoose';
import User from './src/models/User';
import VendorDetails from './src/models/VendorDetails';
import dotenv from 'dotenv';

dotenv.config();

async function cleanupOldFulfiller() {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('✅ Connected to MongoDB\n');

    // Find the old fulfiller account (the one with no subcategories)
    const oldFulfiller = await User.findOne({
      email: 'fulfiller@petmaza.com',
      vendorType: 'WAREHOUSE_FULFILLER'
    });

    if (!oldFulfiller) {
      console.log('❌ Old fulfiller account not found.');
      return;
    }

    console.log(`🔍 Found old fulfiller:`);
    console.log(`   Name: ${oldFulfiller.name}`);
    console.log(`   Email: ${oldFulfiller.email}`);
    console.log(`   ID: ${oldFulfiller._id}`);

    // Delete vendor details
    const vendorDetails = await VendorDetails.findOne({ vendor_id: oldFulfiller._id });
    if (vendorDetails) {
      await VendorDetails.deleteOne({ _id: vendorDetails._id });
      console.log('\n✅ Deleted vendor details');
    }

    // Delete user account
    await User.deleteOne({ _id: oldFulfiller._id });
    console.log('✅ Deleted user account');

    console.log('\n🎉 Cleanup complete! Only RameshShirke & DiveshDoke remain.');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

cleanupOldFulfiller();
