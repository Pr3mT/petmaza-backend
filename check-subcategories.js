import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const productSchema = new mongoose.Schema({
  mainCategory: String,
  subCategory: String,
}, { collection: 'products' });

const Product = mongoose.model('Product', productSchema);

async function checkSubcategories() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');

    // Check subcategories for each pet type
    const petTypes = ['Dog', 'Cat', 'Fish', 'Bird', 'Small Animals'];
    
    for (const petType of petTypes) {
      const subcategories = await Product.aggregate([
        { $match: { mainCategory: petType } },
        { $group: { _id: '$subCategory', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]);

      console.log(`\n🐾 ${petType} Subcategories (${subcategories.length}):`);
      subcategories.forEach(sub => {
        console.log(`   ✓ "${sub._id}" (${sub.count} products)`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkSubcategories();
