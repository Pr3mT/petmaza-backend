import mongoose from 'mongoose';
import Category from './src/models/Category';
import dotenv from 'dotenv';

dotenv.config();

const CATEGORIES_AND_SUBCATEGORIES = {
  'Dog': [
    'Dog Food', 'Dog Toys', 'Dog Accessories', 'Dog Medicine', 
    'Dog Grooming', 'Dog Health', 'Dog Treats', 'Dog Bowls & Feeders',
    'Dog Beds & Furniture', 'Dog Collars & Leashes', 'Dog Training & Behavior'
  ],
  'Cat': [
    'Cat Food', 'Cat Toys', 'Cat Accessories', 'Cat Medicine',
    'Cat Grooming', 'Cat Litter', 'Cat Treats', 'Cat Bowls & Feeders',
    'Cat Beds & Furniture', 'Cat Scratchers'
  ],
  'Fish': [
    'Fish Food', 'Aquarium Tanks', 'Aquarium Filters', 'Aquarium Decor',
    'Aquarium Lights', 'Aquarium Accessories', 'Fish Medicine',
    'Water Treatment', 'Air Pumps'
  ],
  'Bird': [
    'Bird Food', 'Bird Cages', 'Bird Toys', 'Bird Accessories',
    'Bird Medicine', 'Bird Perches', 'Bird Treats', 'Bird Baths'
  ],
  'Small Animals': [
    'Small Animal Food', 'Small Animal Cages', 'Small Animal Toys',
    'Small Animal Accessories', 'Small Animal Medicine',
    'Small Animal Bedding', 'Small Animal Treats'
  ]
};

async function seedCategories() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI as string);
    console.log('Connected to MongoDB');

    // First, create main categories if they don't exist
    for (const mainCategoryName of Object.keys(CATEGORIES_AND_SUBCATEGORIES)) {
      let mainCategory = await Category.findOne({ name: mainCategoryName, parentCategoryId: null });
      
      if (!mainCategory) {
        mainCategory = await Category.create({
          name: mainCategoryName,
          description: `Products for ${mainCategoryName.toLowerCase()}`,
          parentCategoryId: null,
          isActive: true
        });
        console.log(`✓ Created main category: ${mainCategoryName}`);
      } else {
        console.log(`→ Main category already exists: ${mainCategoryName}`);
      }

      // Create subcategories
      const subcategories = CATEGORIES_AND_SUBCATEGORIES[mainCategoryName as keyof typeof CATEGORIES_AND_SUBCATEGORIES];
      
      for (const subName of subcategories) {
        const existingSub = await Category.findOne({ 
          name: subName,
          parentCategoryId: mainCategory._id 
        });

        if (!existingSub) {
          await Category.create({
            name: subName,
            description: `${subName} products`,
            parentCategoryId: mainCategory._id,
            isActive: true
          });
          console.log(`  ✓ Created subcategory: ${subName}`);
        } else {
          console.log(`  → Subcategory already exists: ${subName}`);
        }
      }
    }

    console.log('\n✅ All categories and subcategories seeded successfully!');
    
    // Count totals
    const mainCount = await Category.countDocuments({ parentCategoryId: null });
    const subCount = await Category.countDocuments({ parentCategoryId: { $ne: null } });
    
    console.log(`\nTotal main categories: ${mainCount}`);
    console.log(`Total subcategories: ${subCount}`);
    
  } catch (error) {
    console.error('Error seeding categories:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

seedCategories();
