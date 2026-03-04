import mongoose from 'mongoose';
import User from './src/models/User';
import dotenv from 'dotenv';

dotenv.config();

async function checkFulfiller() {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('✅ Connected to MongoDB');

    const warehouseFulfiller = await User.findOne({
      role: 'vendor',
      vendorType: 'WAREHOUSE_FULFILLER',
      isApproved: true,
    });

    const myShopManager = await User.findOne({
      role: 'vendor',
      vendorType: 'MY_SHOP',
      isApproved: true,
    });

    console.log('\n📦 FULFILLMENT SETUP:');
    console.log('==========================================');
    
    if (warehouseFulfiller) {
      console.log('⚠️  WAREHOUSE_FULFILLER FOUND:');
      console.log(`   Name: ${warehouseFulfiller.name}`);
      console.log(`   Email: ${warehouseFulfiller.email}`);
      console.log(`   ID: ${warehouseFulfiller._id}`);
      console.log('\n📌 ALL NORMAL ORDERS GO TO WAREHOUSE FIRST!');
      console.log('   MY_SHOP only gets orders if warehouse rejects them.');
    } else {
      console.log('✅ NO WAREHOUSE_FULFILLER found');
      console.log('   Orders will go directly to MY_SHOP');
    }

    console.log('\n');

    if (myShopManager) {
      console.log('✅ MY_SHOP MANAGER FOUND:');
      console.log(`   Name: ${myShopManager.name}`);
      console.log(`   Email: ${myShopManager.email}`);
      console.log(`   ID: ${myShopManager._id}`);
    } else {
      console.log('❌ NO MY_SHOP MANAGER found');
    }

    console.log('\n==========================================\n');

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkFulfiller();
