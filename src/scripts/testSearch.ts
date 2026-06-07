import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../models/Product';
import {
  parseQuery,
  resolveMatchingBrandIds,
  buildRelevancePipeline,
} from '../services/searchRelevance';

dotenv.config();

// Run the relevance engine the same way the /search endpoint does.
async function runSearch(q: string, limit = 8) {
  const parsed = parseQuery(q);
  const brandIds = await resolveMatchingBrandIds(parsed);
  const pipeline = buildRelevancePipeline(parsed, brandIds, {
    baseMatch: { isActive: true },
    sortBy: 'relevance',
    skip: 0,
    limit,
    projectFields: { _id: 1, name: 1, images: 1, sellingPrice: 1, _relScore: 1, brand_id: 1 },
  });
  // Keep the score visible for inspection (override the lite projection).
  pipeline[pipeline.length - 1].$facet.data[pipeline[pipeline.length - 1].$facet.data.length - 1] = {
    $project: { name: 1, _relScore: 1, brand: '$_brand.name' },
  };
  const [result] = await Product.aggregate(pipeline);
  return result?.data || [];
}

const testSearch = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MONGODB_URI is not defined');
      process.exit(1);
    }
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Pick a few real brand names from the DB to test brand search.
    const Brand = (await import('../models/Brand')).default;
    const sampleBrands = await Brand.find({}).select('name').limit(3).lean();
    const brandNames = sampleBrands.map((b: any) => b.name);

    const queries = [
      'leash',
      'dog food',
      'foods',        // plural → should match "food"
      'puppy',        // synonym → should match "dog"
      ...brandNames,  // brand-name search (the big new capability)
    ];

    for (const q of queries) {
      const rows = await runSearch(q, 6);
      console.log(`🔍 "${q}" → ${rows.length} result(s)`);
      rows.forEach((r: any) =>
        console.log(`     [${Math.round(r._relScore)}] ${r.name}${r.brand ? `  ·  ${r.brand}` : ''}`)
      );
      console.log('');
    }

    await mongoose.connection.close();
    console.log('✅ Done');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

testSearch();
