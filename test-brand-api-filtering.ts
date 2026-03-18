import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from './src/models/Product';
import Brand from './src/models/Brand';

dotenv.config();

async function testBrandAPIFiltering() {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🧪 TESTING BRAND API FILTERING');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Get a few brands to test
    const pedigree = await Brand.findOne({ name: 'Pedigree' });
    const whiskas = await Brand.findOne({ name: 'Whiskas' });
    const trixie = await Brand.findOne({ name: 'Trixie' });

    if (!pedigree || !whiskas || !trixie) {
      console.log('❌ Brands not found!');
      await mongoose.disconnect();
      return;
    }

    // TEST 1: Filter by Pedigree
    console.log(`\n📦 TEST 1: Filtering by Pedigree (ID: ${pedigree._id})`);
    console.log('─'.repeat(50));
    
    const pedigreeProducts = await Product.find({
      brand_id: pedigree._id,
      isActive: true
    }).select('name mainCategory subCategory');
    
    console.log(`Found ${pedigreeProducts.length} Pedigree products:`);
    pedigreeProducts.forEach(p => {
      console.log(`  • ${p.name} [${p.mainCategory} - ${p.subCategory}]`);
    });

    // TEST 2: Filter by Whiskas
    console.log(`\n📦 TEST 2: Filtering by Whiskas (ID: ${whiskas._id})`);
    console.log('─'.repeat(50));
    
    const whiskasProducts = await Product.find({
      brand_id: whiskas._id,
      isActive: true
    }).select('name mainCategory subCategory');
    
    console.log(`Found ${whiskasProducts.length} Whiskas products:`);
    whiskasProducts.forEach(p => {
      console.log(`  • ${p.name} [${p.mainCategory} - ${p.subCategory}]`);
    });

    // TEST 3: Filter by Trixie
    console.log(`\n📦 TEST 3: Filtering by Trixie (ID: ${trixie._id})`);
    console.log('─'.repeat(50));
    
    const trixieProducts = await Product.find({
      brand_id: trixie._id,
      isActive: true
    }).select('name mainCategory subCategory');
    
    console.log(`Found ${trixieProducts.length} Trixie products:`);
    trixieProducts.forEach(p => {
      console.log(`  • ${p.name} [${p.mainCategory} - ${p.subCategory}]`);
    });

    // TEST 4: Check if there are any products WITHOUT brand_id
    console.log(`\n⚠️  TEST 4: Products without brand_id`);
    console.log('─'.repeat(50));
    
    const noBrand = await Product.find({
      $or: [
        { brand_id: null },
        { brand_id: { $exists: false } }
      ],
      isActive: true
    }).select('name mainCategory');
    
    if (noBrand.length > 0) {
      console.log(`❌ Found ${noBrand.length} products without brand_id:`);
      noBrand.forEach(p => {
        console.log(`  • ${p.name}`);
      });
    } else {
      console.log(`✅ All products have brand_id assigned`);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Test completed!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

testBrandAPIFiltering();
