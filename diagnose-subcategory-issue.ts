import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from './src/models/Product';

dotenv.config();

async function diagnoseSubcategoryIssue() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('✅ Connected to MongoDB\n');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 DIAGNOSING SUBCATEGORY FILTER ISSUE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Check all Dog products
    const totalDogProducts = await Product.countDocuments({ 
      mainCategory: 'Dog',
      isActive: true 
    });
    console.log(`📊 Total active Dog products: ${totalDogProducts}`);

    // Check Dog products by subcategory
    const dogSubcategories = ['Dog Food', 'Dog Medicine', 'Dog Accessories', 'Dog Toys'];
    
    console.log('\n📋 Products by Subcategory:');
    console.log('─'.repeat(50));
    
    for (const subCat of dogSubcategories) {
      const count = await Product.countDocuments({ 
        mainCategory: 'Dog',
        subCategory: subCat,
        isActive: true 
      });
      console.log(`   ${subCat}: ${count} products`);
      
      if (count > 0 && count < 5) {
        // Show actual products if very few
        const products = await Product.find({ 
          mainCategory: 'Dog',
          subCategory: subCat,
          isActive: true 
        }).select('name subCategory').limit(10);
        
        products.forEach(p => {
          console.log(`      - ${p.name}`);
        });
      }
    }

    // Check for Dog products without subCategory set
    const productsWithoutSubCategory = await Product.countDocuments({
      mainCategory: 'Dog',
      $or: [
        { subCategory: { $exists: false } },
        { subCategory: null },
        { subCategory: '' }
      ],
      isActive: true
    });
    
    console.log(`\n⚠️  Dog products WITHOUT subCategory: ${productsWithoutSubCategory}`);

    // Check for products with only category_id (old system)
    const productsWithOldCategory = await Product.find({
      mainCategory: 'Dog',
      category_id: { $exists: true, $ne: null },
      isActive: true
    }).select('name category_id subCategory mainCategory').limit(5).populate('category_id', 'name');
    
    if (productsWithOldCategory.length > 0) {
      console.log('\n📝 Sample products with category_id:');
      console.log('─'.repeat(50));
      productsWithOldCategory.forEach(p => {
        console.log(`   - ${p.name}`);
        console.log(`     category_id: ${(p.category_id as any)?.name || 'N/A'}`);
        console.log(`     subCategory: ${p.subCategory || 'NOT SET'}`);
      });
    }

    // Test actual API query for Dog Medicine
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🧪 TESTING DOG MEDICINE FILTER');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const dogMedicineProducts = await Product.find({
      mainCategory: 'Dog',
      subCategory: 'Dog Medicine',
      isActive: true
    }).select('name subCategory brand_id').populate('brand_id', 'name').limit(20);
    
    console.log(`Found ${dogMedicineProducts.length} Dog Medicine products:`);
    
    if (dogMedicineProducts.length === 0) {
      console.log('   ❌ NO PRODUCTS FOUND - This is the problem!');
      console.log('   Solutions:');
      console.log('      1. Products may have incorrect subCategory values');
      console.log('      2. Products may not have subCategory field set');
      console.log('      3. Need to populate subCategory from category_id');
    } else {
      // Group by product name to find duplicates
      const productNames = new Map<string, number>();
      dogMedicineProducts.forEach(p => {
        const count = productNames.get(p.name) || 0;
        productNames.set(p.name, count + 1);
      });
      
      const duplicates = Array.from(productNames.entries()).filter(([_, count]) => count > 1);
      
      if (duplicates.length > 0) {
        console.log('\n   ⚠️  DUPLICATE PRODUCTS FOUND:');
        duplicates.forEach(([name, count]) => {
          console.log(`      - "${name}" appears ${count} times`);
        });
      } else {
        console.log('   ✅ No duplicate products');
      }
      
      console.log('\n   Products list:');
      dogMedicineProducts.slice(0, 10).forEach((p, idx) => {
        console.log(`      ${idx + 1}. ${p.name} (Brand: ${(p.brand_id as any)?.name || 'N/A'})`);
      });
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💡 RECOMMENDATIONS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    if (productsWithoutSubCategory > 0) {
      console.log('⚠️  Issue: Products are missing subCategory field');
      console.log('   Fix: Run migration to populate subCategory from category_id');
    }
    
    if (dogMedicineProducts.length < 5) {
      console.log('⚠️  Issue: Very few products in Dog Medicine category');
      console.log('   Fix: Ensure products are correctly categorized');
    }

    await mongoose.disconnect();
    console.log('\n✅ Diagnostic complete');
    
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

diagnoseSubcategoryIssue();
