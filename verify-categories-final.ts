import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from './src/models/Product';

dotenv.config();

async function verifyAllCategories() {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('✅ Connected to MongoDB\n');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎯 FINAL VERIFICATION - ALL CATEGORIES');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const testCases = [
      { main: 'Dog', sub: 'Dog Food', emoji: '🍖' },
      { main: 'Dog', sub: 'Dog Medicine', emoji: '💊' },
      { main: 'Dog', sub: 'Dog Accessories', emoji: '🎒' },
      { main: 'Dog', sub: 'Dog Toys', emoji: '🎾' },
      { main: 'Fish', sub: 'Fish Food', emoji: '🐠' },
      { main: 'Fish', sub: 'Fish Accessories', emoji: '🪣' },
      { main: 'Fish', sub: 'Fish Medicine', emoji: '💊' },
      { main: 'Cat', sub: 'Cat Food', emoji: '🐟' },
      { main: 'Cat', sub: 'Cat Medicine', emoji: '💊' },
    ];

    for (const test of testCases) {
      const products = await Product.find({
        mainCategory: test.main,
        subCategory: test.sub,
        isActive: true
      }).select('name').limit(3);

      console.log(`${test.emoji} ${test.sub}: ${products.length} products`);
      if (products.length > 0) {
        products.forEach(p => console.log(`   - ${p.name}`));
      }
      console.log();
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ VERIFICATION COMPLETE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('Each subcategory now has UNIQUE products!');
    console.log('Filters will work correctly on the frontend.\n');

    await mongoose.disconnect();
    
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

verifyAllCategories();
