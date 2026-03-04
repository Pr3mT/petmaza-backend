import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User';
import VendorDetails from './src/models/VendorDetails';

dotenv.config();

const checkFulfillerAccount = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('MONGODB_URI is not defined');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Find all vendor accounts
    console.log('📋 ALL VENDOR ACCOUNTS:\n');
    const vendors = await User.find({ role: 'vendor' });
    
    for (const vendor of vendors) {
      console.log('─────────────────────────────────');
      console.log(`Name: ${vendor.name}`);
      console.log(`Email: ${vendor.email}`);
      console.log(`Vendor Type: ${vendor.vendorType || 'NOT SET'}`);
      console.log(`ID: ${vendor._id}`);
      console.log(`Phone: ${vendor.phone || 'N/A'}`);
      console.log(`Approved: ${vendor.isApproved}`);
      
      // Check vendor details
      const details = await VendorDetails.findOne({ vendor_id: vendor._id });
      if (details) {
        console.log(`Shop Name: ${details.shopName || 'N/A'}`);
        console.log(`Vendor Details Type: ${details.vendorType || 'N/A'}`);
      }
      console.log('');
    }

    console.log('\n🔍 WAREHOUSE FULFILLER ACCOUNTS ONLY:\n');
    const fulfillers = await User.find({ 
      role: 'vendor',
      vendorType: 'WAREHOUSE_FULFILLER' 
    });

    if (fulfillers.length === 0) {
      console.log('❌ No WAREHOUSE_FULFILLER accounts found!');
    } else {
      fulfillers.forEach(fulfiller => {
        console.log(`✅ ${fulfiller.name} (${fulfiller.email})`);
      });
    }

    console.log('\n🔍 Checking for "samruddhi" or "amrutkar" in names:\n');
    const samruddhiUsers = await User.find({ 
      $or: [
        { name: { $regex: /samruddhi/i } },
        { name: { $regex: /amrutkar/i } }
      ]
    });

    if (samruddhiUsers.length > 0) {
      samruddhiUsers.forEach(user => {
        console.log('─────────────────────────────────');
        console.log(`Name: ${user.name}`);
        console.log(`Email: ${user.email}`);
        console.log(`Role: ${user.role}`);
        console.log(`Vendor Type: ${user.vendorType || 'NOT SET'}`);
        console.log(`ID: ${user._id}`);
      });
    } else {
      console.log('No users found with "samruddhi" or "amrutkar" in name');
    }

    await mongoose.disconnect();
    console.log('\n✅ Done');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

checkFulfillerAccount();
