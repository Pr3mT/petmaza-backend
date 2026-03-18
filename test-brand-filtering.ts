import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from './src/models/Product';
import Brand from './src/models/Brand';

dotenv.config();

async function testBrandFiltering() {
  try {
    console.log('🔄 Connecting to MongoDB...\n');
    await mongoose.connect(process.env.MONGODB_URI!);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🧪 TESTING BRAND FILTERING');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Get some brands
    const brands = await Brand.find({ isActive: true }).limit(5);
    
    if (brands.length === 0) {
      console.log('❌ No brands found!');
      await mongoose.disconnect();
      return;
    }

    console.log(`Found ${brands.length} brands:\n`);

    for (const brand of brands) {
      console.log(`\n📦 Brand: ${brand.name} (ID: ${brand._id})`);
      console.log('─'.repeat(50));
      
      // Count products for this brand
      const productCount = await Product.countDocuments({
        brand_id: brand._id,
        isActive: true
      });
      
      console.log(`Total products: ${productCount}`);
      
      if (productCount > 0) {
        // Get products by category
        const categories = await Product.distinct('mainCategory', {
          brand_id: brand._id,
          isActive: true
        });
        
        for (const category of categories) {
          const catProducts = await Product.find({
            brand_id: brand._id,
            mainCategory: category,
            isActive: true
          }).select('name mainCategory subCategory');
          
          console.log(`\n  ${category} (${catProducts.length} products):`);
          catProducts.forEach(p => {
            console.log(`    • ${p.name} [${p.subCategory}]`);
          });
        }
      } else {
        console.log('  ⚠️  No products associated with this brand');
      }
      
      console.log();
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Test completed!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

testBrandFiltering();
