import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from './src/models/Product';

dotenv.config();

async function fixProductCategories() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('✅ Connected to MongoDB\n');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔧 FIXING PRODUCT CATEGORIES');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    let fixedCount = 0;

    // Define patterns to identify correct categories based on product names
    const patterns = [
      // DOG products
      { namePattern: /puppy|dog|canine/i, correctMain: 'Dog' },
      { namePattern: /collar|leash|harness/i, correctMain: 'Dog', correctSub: 'Dog Accessories' },
      
      // CAT products
      { namePattern: /kitten|cat|feline/i, correctMain: 'Cat' },
      
      // FISH products
      { namePattern: /aquarium|fish food|tetra|goldfish/i, correctMain: 'Fish' },
      
      // BIRD products
      { namePattern: /bird|parrot|budgie|cage/i, correctMain: 'Bird' },
      
      // SMALL ANIMAL products
      { namePattern: /rabbit|hamster|guinea pig|grass house/i, correctMain: 'Small Animals' },
    ];

    // Get all products with potentially wrong categories
    const allProducts = await Product.find({ isActive: true });
    
    console.log(`📦 Checking ${allProducts.length} products...\n`);

    for (const product of allProducts) {
      let needsUpdate = false;
      let updates: any = {};

      // Check if product name matches any pattern
      for (const pattern of patterns) {
        if (pattern.namePattern.test(product.name)) {
          // Check if mainCategory needs correction
          if (product.mainCategory !== pattern.correctMain) {
            updates.mainCategory = pattern.correctMain;
            needsUpdate = true;
            
            // Auto-correct subCategory based on current subCategory
            if (product.subCategory) {
              const currentSubWords = product.subCategory.split(' ');
              const lastWord = currentSubWords[currentSubWords.length - 1];
              
              // Keep the type (Food, Medicine, Toys, Accessories) but fix the animal
              if (lastWord === 'Food') {
                updates.subCategory = `${pattern.correctMain} Food`;
              } else if (lastWord === 'Medicine') {
                updates.subCategory = `${pattern.correctMain} Medicine`;
              } else if (lastWord === 'Toys') {
                updates.subCategory = `${pattern.correctMain} Toys`;
              } else if (lastWord === 'Accessories') {
                updates.subCategory = `${pattern.correctMain} Accessories`;
              } else if (product.subCategory.includes('Tank') || product.subCategory.includes('Aquarium')) {
                updates.subCategory = 'Aquarium Accessories';
              }
            }
          }
          
          // Apply specific subCategory if pattern specifies it
          if (pattern.correctSub && product.subCategory !== pattern.correctSub) {
            updates.subCategory = pattern.correctSub;
            needsUpdate = true;
          }
          
          break; // Stop after first match
        }
      }

      if (needsUpdate && Object.keys(updates).length > 0) {
        await Product.findByIdAndUpdate(product._id, updates);
        console.log(`✅ Fixed: ${product.name}`);
        console.log(`   Old: ${product.mainCategory} > ${product.subCategory}`);
        console.log(`   New: ${updates.mainCategory || product.mainCategory} > ${updates.subCategory || product.subCategory}\n`);
        fixedCount++;
      }
    }

    if (fixedCount === 0) {
      console.log('✨ No products needed fixing - all categories are correct!\n');
    } else {
      console.log(`\n✅ Fixed ${fixedCount} products\n`);
    }

    // Show updated counts
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 UPDATED PRODUCT COUNTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const categories = ['Dog', 'Cat', 'Fish', 'Bird', 'Small Animals'];
    
    for (const mainCat of categories) {
      const count = await Product.countDocuments({ 
        mainCategory: mainCat,
        isActive: true 
      });
      console.log(`${mainCat}: ${count} products`);
      
      const subCategories = await Product.distinct('subCategory', {
        mainCategory: mainCat,
        isActive: true
      });
      
      for (const subCat of subCategories) {
        const subCount = await Product.countDocuments({ 
          mainCategory: mainCat,
          subCategory: subCat,
          isActive: true 
        });
        console.log(`   └─ ${subCat}: ${subCount}`);
      }
      console.log();
    }

    await mongoose.disconnect();
    console.log('✅ Done');
    
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

fixProductCategories();
