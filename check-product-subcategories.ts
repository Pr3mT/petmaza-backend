// @ts-nocheck
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from './src/models/Product';
import User from './src/models/User';
import VendorDetails from './src/models/VendorDetails';

dotenv.config();

async function checkProducts() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MONGODB_URI is not defined');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 CHECKING PRODUCT SUBCATEGORIES');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Find the specific products from the order
    const plushToy = await Product.findOne({ name: /Plush Toy Collection/i });
    const puppyFood = await Product.findOne({ name: /Puppy.*Junior Food/i });

    if (plushToy) {
      console.log('📦 Plush Toy Collection:');
      console.log(`   ID: ${plushToy._id}`);
      console.log(`   Main Category: ${plushToy.mainCategory}`);
      console.log(`   Sub Category: ${plushToy.subCategory}`);
      console.log(`   Expected Handler: Should go to Ramesh (handles Dog Toys)\n`);
    } else {
      console.log('⚠️  Plush Toy Collection not found in database\n');
    }

    if (puppyFood) {
      console.log('📦 Puppy/Junior Food:');
      console.log(`   ID: ${puppyFood._id}`);
      console.log(`   Main Category: ${puppyFood.mainCategory}`);
      console.log(`   Sub Category: ${puppyFood.subCategory}`);
      console.log(`   Expected Handler: Should go to Divesh (handles Dog Food)\n`);
    } else {
      console.log('⚠️  Puppy/Junior Food not found in database\n');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👥 FULFILLER ASSIGNMENTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const ramesh = await User.findOne({ email: /rameshshirke/i });
    const divesh = await User.findOne({ email: /diveshdoke/i });

    if (ramesh) {
      const rameshDetails = await VendorDetails.findOne({ vendor_id: ramesh._id });
      console.log('👤 Ramesh Shirke:');
      if (rameshDetails && rameshDetails.assignedSubcategories) {
        console.log(`   Handles ${rameshDetails.assignedSubcategories.length} subcategories:`);
        const handlesDogToys = rameshDetails.assignedSubcategories.includes('Dog Toys');
        const handlesDogFood = rameshDetails.assignedSubcategories.includes('Dog Food');
        console.log(`   ✅ Dog Toys: ${handlesDogToys ? 'YES' : 'NO'}`);
        console.log(`   ✅ Dog Food: ${handlesDogFood ? 'YES' : 'NO'}\n`);
      }
    }

    if (divesh) {
      const diveshDetails = await VendorDetails.findOne({ vendor_id: divesh._id });
      console.log('👤 Divesh Doke:');
      if (diveshDetails && diveshDetails.assignedSubcategories) {
        console.log(`   Handles ${diveshDetails.assignedSubcategories.length} subcategories:`);
        const handlesDogToys = diveshDetails.assignedSubcategories.includes('Dog Toys');
        const handlesDogFood = diveshDetails.assignedSubcategories.includes('Dog Food');
        console.log(`   ✅ Dog Toys: ${handlesDogToys ? 'YES' : 'NO'}`);
        console.log(`   ✅ Dog Food: ${handlesDogFood ? 'YES' : 'NO'}\n`);
      }
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎯 EXPECTED SPLIT ORDER ROUTING');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('If customer orders BOTH products:');
    console.log('   📦 Plush Toy Collection (Dog Toys)');
    console.log('      → Should go to: Ramesh\n');
    console.log('   📦 Puppy/Junior Food (Dog Food)');
    console.log('      → Should go to: Divesh\n');
    console.log('Result: 2 SEPARATE ORDERS created');
    console.log('   Order 1: Ramesh gets Plush Toy Collection');
    console.log('   Order 2: Divesh gets Puppy/Junior Food\n');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  IMPORTANT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('If the order in the screenshot went entirely to Ramesh:');
    console.log('   1. It was placed BEFORE the split order fix');
    console.log('   2. Or the backend server was not restarted\n');
    console.log('To test the NEW split logic:');
    console.log('   1. Restart backend server: npm start');
    console.log('   2. Place a NEW order with both products');
    console.log('   3. Check that 2 separate orders are created\n');

    await mongoose.disconnect();
    console.log('✅ Check complete\n');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

checkProducts();
