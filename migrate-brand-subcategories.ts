import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Brand from './src/models/Brand';

dotenv.config();

const DEFAULT_BRAND_SUBCATEGORIES: Record<string, string[]> = {
  'Pedigree': ['Dog Food', 'Dog Treats'],
  'Royal Canin': ['Dog Food', 'Cat Food'],
  'Whiskas': ['Cat Food', 'Cat Treats'],
  'Drools': ['Dog Food'],
  'Meo': ['Cat Food'],
  'Me-O': ['Cat Food'],
  'Trixie': ['Dog Toys', 'Cat Toys', 'Dog Accessories', 'Cat Accessories', 'Small Animal Toys'],
  'PetSafe': ['Dog Accessories', 'Cat Accessories'],
  'Himalaya': ['Dog Medicine', 'Cat Medicine', 'Small Animal Medicine'],
  'Tetra': ['Fish Food'],
  'TetraMin': ['Fish Food'],
  'Taiyo': ['Fish Food', 'Bird Food'],
  'Vitapol': ['Bird Food', 'Small Animal Food'],
  'Aqua One': ['Fish Food', 'Aquarium Accessories'],
  'Kong': ['Dog Toys'],
  'Flexi': ['Dog Accessories'],
  'Pawzone': ['Dog Accessories', 'Cat Accessories'],
  'Petmate': ['Dog Accessories', 'Cat Accessories'],
};

async function migrateBrands() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('✅ Connected to MongoDB\n');

    console.log('📦 Fetching all brands...');
    const brands = await Brand.find();
    console.log(`Found ${brands.length} brands\n`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const brand of brands) {
      // Skip if brand already has subcategories
      if (brand.subcategories && brand.subcategories.length > 0) {
        console.log(`⏭️  Skipped: ${brand.name} (already has subcategories)`);
        skippedCount++;
        continue;
      }

      // Try to find default subcategories for this brand
      const defaultSubcategories = DEFAULT_BRAND_SUBCATEGORIES[brand.name];

      if (defaultSubcategories) {
        brand.subcategories = defaultSubcategories;
        await brand.save();
        console.log(`✅ Updated: ${brand.name} - Added subcategories: ${defaultSubcategories.join(', ')}`);
        updatedCount++;
      } else {
        console.log(`⚠️  No default subcategories for: ${brand.name} (needs manual configuration)`);
        skippedCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✨ Migration completed!');
    console.log(`✅ Updated: ${updatedCount} brands`);
    console.log(`⏭️  Skipped: ${skippedCount} brands`);
    console.log('='.repeat(60) + '\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error migrating brands:', error);
    process.exit(1);
  }
}

migrateBrands();
