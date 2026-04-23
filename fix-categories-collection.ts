import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Category from './src/models/Category';

dotenv.config();

// Exactly matching the CATEGORY_MAPPINGS used in the frontend
const CATEGORY_STRUCTURE: Record<string, string[]> = {
  Dog:           ['Dog Food', 'Dog Accessories', 'Dog Medicine', 'Dog Toys'],
  Cat:           ['Cat Food', 'Cat Accessories', 'Cat Medicine', 'Cat Toys'],
  Fish:          ['Fish Food', 'Fish Accessories', 'Fish Medicine', 'Fish Tank Supplies'],
  Bird:          ['Bird Food', 'Bird Accessories', 'Bird Medicine', 'Bird Toys'],
  'Small Animals': ['Small Animal Food', 'Small Animal Accessories', 'Small Animal Medicine', 'Small Animal Toys'],
};

async function fixCategoriesCollection() {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('Connected to MongoDB');

    // Count existing
    const existingCount = await Category.countDocuments();
    console.log(`\nFound ${existingCount} existing category documents — deleting all...`);

    await Category.deleteMany({});
    console.log('✅ All old categories deleted\n');

    // Create parent categories
    const parents: Record<string, mongoose.Types.ObjectId> = {};
    for (const mainCat of Object.keys(CATEGORY_STRUCTURE)) {
      const doc = await Category.create({ name: mainCat, isActive: true });
      parents[mainCat] = doc._id as mongoose.Types.ObjectId;
      console.log(`  ➕ Parent: ${mainCat} (${doc._id})`);
    }

    // Create sub-categories
    let subCount = 0;
    for (const [mainCat, subs] of Object.entries(CATEGORY_STRUCTURE)) {
      for (const sub of subs) {
        await Category.create({ name: sub, parentCategoryId: parents[mainCat], isActive: true });
        console.log(`     └─ ${sub}`);
        subCount++;
      }
    }

    const total = await Category.countDocuments();
    console.log(`\n========== SUMMARY ==========`);
    console.log(`✅ Created ${Object.keys(CATEGORY_STRUCTURE).length} parent categories`);
    console.log(`✅ Created ${subCount} sub-categories`);
    console.log(`✅ Total in collection: ${total} (was ${existingCount})`);

    await mongoose.connection.close();
    console.log('\nDone. Connection closed.');
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

fixCategoriesCollection();
