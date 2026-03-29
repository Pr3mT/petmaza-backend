import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User';
import VendorDetails from './src/models/VendorDetails';

dotenv.config();

const approvePrimeVendor3 = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/petmaza');
    console.log('✅ Connected to MongoDB');

    // Find Prime Vendor 3
    const vendor = await User.findOne({
      name: 'PrimeVendor2',
      role: 'vendor',
      vendorType: 'PRIME'
    });

    if (!vendor) {
      console.log('❌ Prime Vendor 2 not found. Searching for any unapproved Prime vendors...');
      
      // List all Prime vendors
      const allPrimeVendors = await User.find({
        role: 'vendor',
        vendorType: 'PRIME'
      }).select('name email isApproved');
      
      console.log('\n📋 All Prime Vendors in database:');
      allPrimeVendors.forEach((v, i) => {
        console.log(`${i + 1}. ${v.name} (${v.email}) - Approved: ${v.isApproved}`);
      });
      
      // Approve all unapproved Prime vendors
      const unapprovedCount = await User.updateMany(
        { role: 'vendor', vendorType: 'PRIME', isApproved: false },
        { isApproved: true }
      );
      
      console.log(`\n✅ Approved ${unapprovedCount.modifiedCount} Prime vendor(s)`);
      
      // Also update VendorDetails
      const vendorDetailsUpdate = await VendorDetails.updateMany(
        { vendorType: 'PRIME', isApproved: false },
        { isApproved: true, approvedAt: new Date() }
      );
      
      console.log(`✅ Updated ${vendorDetailsUpdate.modifiedCount} VendorDetails record(s)`);
      
    } else {
      // Approve the specific vendor
      vendor.isApproved = true;
      await vendor.save();
      console.log(`✅ Approved vendor: ${vendor.name} (${vendor.email})`);
      
      // Update vendor details
      await VendorDetails.findOneAndUpdate(
        { vendor_id: vendor._id },
        { isApproved: true, approvedAt: new Date() }
      );
      console.log('✅ Updated VendorDetails');
    }

    console.log('\n✅ Done! You can now create products.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

approvePrimeVendor3();
