import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from './src/models/Product';
import Brand from './src/models/Brand';

dotenv.config();

async function finalBrandTest() {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎯 FINAL BRAND FILTERING TEST');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Simulate clicking Pedigree brand from home page
    const pedigree = await Brand.findOne({ name: 'Pedigree' });
    if (!pedigree) {
      console.log('❌ Pedigree brand not found!');
      await mongoose.disconnect();
      return;
    }

    console.log(`✅ User clicks "Pedigree" brand on home page`);
    console.log(`   URL: /products?brand=${pedigree._id}\n`);

    // Simulate API call: GET /products?brand_id={id}&isActive=true
    console.log(`📞 API Call: GET /products?brand_id=${pedigree._id}&isActive=true\n`);
    
    const products = await Product.find({
      brand_id: pedigree._id,
      isActive: true
    }).populate('brand_id', 'name').select('name mainCategory subCategory brand_id');

    console.log(`📦 Response: ${products.length} products found\n`);
    
    if (products.length > 0) {
      console.log('Products returned:');
      products.forEach(p => {
        console.log(`  ✓ ${p.name}`);
        console.log(`    Category: ${p.mainCategory} - ${p.subCategory}`);
        console.log(`    Brand: ${(p.brand_id as any).name}\n`);
      });
      console.log('✅ SUCCESS: Brand filtering is working correctly!');
    } else {
      console.log('❌ ERROR: No products returned - brand filtering not working');
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

finalBrandTest();
