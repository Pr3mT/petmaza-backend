import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Define Product schema inline to avoid import issues
const productSchema = new mongoose.Schema({
  name: String,
  mainCategory: String,
  subCategory: String,
}, { collection: 'products' });

const Product = mongoose.model('Product', productSchema);

async function checkProducts() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check total products
    const totalCount = await Product.countDocuments();
    console.log('\n📊 Total Products:', totalCount);

    // Check products by mainCategory
    const categories = await Product.aggregate([
      {
        $group: {
          _id: '$mainCategory',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    console.log('\n🐾 Products by Main Category:');
    categories.forEach(cat => {
      console.log(`   ${cat._id || 'MISSING'}: ${cat.count} products`);
    });

    // Check for products without mainCategory
    const missingMainCategory = await Product.countDocuments({ 
      $or: [
        { mainCategory: { $exists: false } },
        { mainCategory: null },
        { mainCategory: '' }
      ]
    });

    if (missingMainCategory > 0) {
      console.log(`\n⚠️  WARNING: ${missingMainCategory} products are missing mainCategory field!`);
      
      // Show sample products without mainCategory
      const samples = await Product.find({ 
        $or: [
          { mainCategory: { $exists: false } },
          { mainCategory: null },
          { mainCategory: '' }
        ]
      }).limit(5).select('name mainCategory subCategory');
      
      console.log('\n📝 Sample products without mainCategory:');
      samples.forEach(p => {
        console.log(`   - ${p.name}`);
        console.log(`     mainCategory: ${p.mainCategory || 'MISSING'}`);
        console.log(`     subCategory: ${p.subCategory || 'MISSING'}`);
      });
    }

    // Sample Dog products
    console.log('\n🐕 Sample Dog Products:');
    const dogProducts = await Product.find({ mainCategory: 'Dog' })
      .limit(3)
      .select('name mainCategory subCategory');
    
    if (dogProducts.length === 0) {
      console.log('   ❌ No Dog products found!');
    } else {
      dogProducts.forEach(p => {
        console.log(`   ✅ ${p.name}`);
        console.log(`      Category: ${p.mainCategory} - ${p.subCategory}`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkProducts();
