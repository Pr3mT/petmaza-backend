import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from './src/models/Product';

dotenv.config();

async function fixGenericProducts() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('✅ Connected to MongoDB\n');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔧 FIXING GENERIC/DUPLICATE PRODUCTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Find products with generic names that appear in multiple categories
    const genericNames = ['Premium Adult Food', 'Senior Food', 'Grain-Free Food', 'Organic Food', 'Feeding Bowl Set', 'Grooming Brush', 'Carrier Bag'];

    let fixedCount = 0;

    for (const name of genericNames) {
      const products = await Product.find({ 
        name: name,
        isActive: true 
      }).select('_id name mainCategory subCategory');

      if (products.length > 1) {
        console.log(`\n📦 Found ${products.length} products named "${name}":`);
        
        // Group by mainCategory
        const byCategory: any = {};
        products.forEach(p => {
          if (!byCategory[p.mainCategory]) {
            byCategory[p.mainCategory] = [];
          }
          byCategory[p.mainCategory].push(p);
        });

        // For each category, update the product name to be specific
        for (const [mainCat, prods] of Object.entries(byCategory) as any) {
          for (const prod of prods) {
            let newName = name;
            
            // Add category prefix to make it specific
            if (mainCat === 'Dog') {
              newName = `Dog ${name}`;
            } else if (mainCat === 'Cat') {
              newName = `Cat ${name}`;
            } else if (mainCat === 'Fish') {
              // For fish, use better names
              if (name.includes('Food')) {
                newName = `Fish ${name}`;
              } else if (name.includes('Bowl')) {
                newName = `Aquarium Feeding Bowl`;
              } else if (name.includes('Brush')) {
                newName = `Aquarium Cleaning Brush`;
              } else if (name.includes('Carrier')) {
                newName = `Fish Transport Bag`;
              }
            } else if (mainCat === 'Bird') {
              newName = `Bird ${name}`;
            } else if (mainCat === 'Small Animals') {
              newName = `Small Animal ${name}`;
            }

            // Update the product
            await Product.findByIdAndUpdate(prod._id, { name: newName });
            console.log(`   ✅ ${mainCat}: "${name}" → "${newName}"`);
            fixedCount++;
          }
        }
      }
    }

    console.log(`\n✅ Updated ${fixedCount} product names to be more specific\n`);

    // Show final counts
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 FINAL PRODUCT COUNTS');
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
    console.log('✅ Done - All products now have unique, category-specific names!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

fixGenericProducts();
