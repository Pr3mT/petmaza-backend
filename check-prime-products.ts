import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from './src/models/Product';
import User from './src/models/User';
import Brand from './src/models/Brand';

dotenv.config();

async function checkPrimeProducts() {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('🔌 Connected to MongoDB\n');

    // Find all PRIME products WITHOUT populate first
    const primeProducts = await Product.find({ isPrime: true }).lean();

    console.log(`📦 Found ${primeProducts.length} PRIME products:\n`);

    for (const product of primeProducts) {
      console.log('─'.repeat(80));
      console.log(`Product: ${product.name}`);
      console.log(`ID: ${product._id}`);
      console.log(`Brand ID: ${product.brand_id}`);
      console.log(`Main Category: ${product.mainCategory || '❌ MISSING'}`);
      console.log(`SubCategory: ${product.subCategory || '❌ MISSING'}`);
      console.log(`isPrime: ${product.isPrime}`);
      console.log(`isActive: ${product.isActive}`);
      console.log(`PrimeVendor ID: ${product.primeVendor_id || 'Not set'}`);
      console.log(`MRP: ₹${product.mrp || 0}`);
      console.log(`Selling Price: ₹${product.sellingPrice || 0}`);
      console.log(`Has Variants: ${product.hasVariants}`);
      console.log(`Created: ${product.createdAt}`);
    }

    console.log('\n' + '='.repeat(80));
    
    // Check if "foxtail" product exists
    const foxtailProduct = primeProducts.find(p => 
      p.name.toLowerCase().includes('foxtail')
    );

    if (foxtailProduct) {
      console.log('\n✅ Foxtail product found!');
      console.log('Details:');
      console.log(JSON.stringify(foxtailProduct, null, 2));
    } else {
      console.log('\n❌ Foxtail product NOT found in PRIME products');
      
      // Check if it exists as non-prime
      const anyFoxtail = await Product.findOne({ 
        name: { $regex: 'foxtail', $options: 'i' } 
      }).lean();
      
      if (anyFoxtail) {
        console.log('⚠️  But found a foxtail product (not marked as PRIME):');
        console.log(JSON.stringify(anyFoxtail, null, 2));
      }
    }

    // Check for products missing mainCategory or subCategory
    const missingCategoryInfo = primeProducts.filter(p => !p.mainCategory || !p.subCategory);
    if (missingCategoryInfo.length > 0) {
      console.log(`\n⚠️  ${missingCategoryInfo.length} PRIME products missing category info:`);
      missingCategoryInfo.forEach(p => {
        console.log(`  - ${p.name}: mainCategory=${p.mainCategory || 'MISSING'}, subCategory=${p.subCategory || 'MISSING'}`);
      });
    }

    // Test query that customers would use
    console.log('\n' + '='.repeat(80));
    console.log('Testing customer query (Cat products):');
    const catProducts = await Product.find({
      mainCategory: 'Cat',
      isActive: true
    }).select('name mainCategory subCategory isPrime').lean();
    
    console.log(`Found ${catProducts.length} Cat products visible to customers:`);
    catProducts.forEach(p => {
      const primeTag = p.isPrime ? '🌟 PRIME' : '🏪 MY_SHOP';
      console.log(`  ${primeTag} - ${p.name} (${p.subCategory})`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

checkPrimeProducts();
