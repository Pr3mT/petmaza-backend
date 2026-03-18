import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from './src/models/Product';

dotenv.config();

async function testFishProducts() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('✅ Connected to MongoDB\n');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🐠 FISH PRODUCTS ANALYSIS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Check all Fish products
    const totalFishProducts = await Product.countDocuments({ 
      mainCategory: 'Fish',
      isActive: true 
    });
    console.log(`📊 Total active Fish products: ${totalFishProducts}\n`);

    // Check unique subcategories for Fish
    const fishSubCategories = await Product.distinct('subCategory', {
      mainCategory: 'Fish',
      isActive: true
    });
    
    console.log('📋 Available Fish Subcategories in Database:');
    console.log('─'.repeat(50));
    for (const subCat of fishSubCategories) {
      const count = await Product.countDocuments({ 
        mainCategory: 'Fish',
        subCategory: subCat,
        isActive: true 
      });
      console.log(`   ${subCat}: ${count} products`);
      
      // Show product names
      const products = await Product.find({ 
        mainCategory: 'Fish',
        subCategory: subCat,
        isActive: true 
      }).select('name').limit(5);
      
      products.forEach(p => {
        console.log(`      - ${p.name}`);
      });
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🧪 TEST API QUERY: Fish Accessories');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const fishAccessories = await Product.find({
      mainCategory: 'Fish',
      subCategory: 'Fish Accessories',
      isActive: true
    }).select('name subCategory');
    
    console.log(`Query: { mainCategory: 'Fish', subCategory: 'Fish Accessories' }`);
    console.log(`Result: ${fishAccessories.length} products\n`);
    
    if (fishAccessories.length > 0) {
      console.log('Products found:');
      fishAccessories.forEach((p, idx) => {
        console.log(`   ${idx + 1}. ${p.name} (subCategory: ${p.subCategory})`);
      });
    } else {
      console.log('❌ NO PRODUCTS FOUND for "Fish Accessories"');
      console.log('\nTrying alternative subcategory names...\n');
      
      const alternatives = ['Aquarium Accessories', 'Fish Accessory', 'Accessories'];
      for (const alt of alternatives) {
        const result = await Product.countDocuments({
          mainCategory: 'Fish',
          subCategory: alt,
          isActive: true
        });
        if (result > 0) {
          console.log(`✅ Found ${result} products with subCategory: "${alt}"`);
        }
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🐕 DOG PRODUCTS ANALYSIS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const dogSubCategories = await Product.distinct('subCategory', {
      mainCategory: 'Dog',
      isActive: true
    });
    
    console.log('📋 Available Dog Subcategories in Database:');
    console.log('─'.repeat(50));
    for (const subCat of dogSubCategories) {
      const count = await Product.countDocuments({ 
        mainCategory: 'Dog',
        subCategory: subCat,
        isActive: true 
      });
      console.log(`   ${subCat}: ${count} products`);
    }

    await mongoose.disconnect();
    console.log('\n✅ Test complete');
    
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

testFishProducts();
