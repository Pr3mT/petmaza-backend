import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User';

dotenv.config();

const fixFulfillerName = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('MONGODB_URI is not defined');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Find the warehouse fulfiller account
    const fulfiller = await User.findOne({ 
      email: 'fulfiller@petmaza.com',
      vendorType: 'WAREHOUSE_FULFILLER'
    });

    if (!fulfiller) {
      console.log('❌ Warehouse fulfiller account not found');
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log('📋 Current Account Info:');
    console.log(`Name: ${fulfiller.name}`);
    console.log(`Email: ${fulfiller.email}`);
    console.log(`Vendor Type: ${fulfiller.vendorType}\n`);

    // Update the name
    fulfiller.name = 'Warehouse Fulfiller - Petmaza';
    await fulfiller.save();

    console.log('✅ Updated Account Info:');
    console.log(`Name: ${fulfiller.name}`);
    console.log(`Email: ${fulfiller.email}`);
    console.log(`Vendor Type: ${fulfiller.vendorType}`);
    console.log('\n🎉 Name updated successfully!');

    await mongoose.disconnect();
    console.log('✅ Done');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

fixFulfillerName();
