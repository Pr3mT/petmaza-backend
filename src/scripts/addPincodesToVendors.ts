import mongoose from 'mongoose';
import dotenv from 'dotenv';
import VendorDetails from '../models/VendorDetails';

dotenv.config();

const addPincodesToVendors = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MONGODB_URI is not defined');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Common pincodes from major Indian cities
    const commonPincodes = [
      '400001', '400002', '400003', '400004', '400005', // Mumbai
      '110001', '110002', '110003', '110004', '110005', // Delhi
      '560001', '560002', '560003', '560004', '560005', // Bangalore
      '700001', '700002', '700003', '700004', '700005', // Kolkata
      '411001', '411002', '411003', '411004', '411005', // Pune
      '600001', '600002', '600003', '600004', '600005', // Chennai
      '500001', '500002', '500003', '500004', '500005', // Hyderabad
      '380001', '380002', '380003', '380004', '380005', // Ahmedabad
    ];

    // Add these pincodes to all vendors
    const result = await VendorDetails.updateMany(
      {},
      { $addToSet: { serviceablePincodes: { $each: commonPincodes } } }
    );

    console.log(`✅ Updated ${result.modifiedCount} vendor details with common pincodes`);

    // Verify
    const vendorsWith400001 = await VendorDetails.countDocuments({
      serviceablePincodes: '400001',
    });

    console.log(`📍 Vendors servicing pincode 400001: ${vendorsWith400001}`);

    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

addPincodesToVendors();
