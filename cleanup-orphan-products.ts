/**
 * Cleanup Orphaned Prime Products
 * 
 * Finds Product documents with isPrime=true that have NO corresponding
 * PrimeProduct listing (the vendor deleted the listing but the Product remained).
 * 
 * Usage: npx ts-node cleanup-orphan-products.ts
 * 
 * First run will show orphans without deleting (dry run).
 * Pass --delete to actually remove them.
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import Product from './src/models/Product';
import PrimeProduct from './src/models/PrimeProduct';

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || '';
const shouldDelete = process.argv.includes('--delete');

async function main() {
  if (!MONGO_URI) {
    console.error('❌ No MONGODB_URI found in .env');
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB\n');

  // Find all Prime products
  const primeProducts = await Product.find({ isPrime: true }).lean();
  console.log(`Found ${primeProducts.length} Product(s) with isPrime=true\n`);

  // Find all PrimeProduct listings
  const primeListings = await PrimeProduct.find({}).lean();
  const listedProductIds = new Set(
    primeListings.map((l: any) => l.product_id?.toString())
  );

  console.log(`Found ${primeListings.length} PrimeProduct listing(s)\n`);

  // Find orphans: isPrime Products with no PrimeProduct listing
  const orphans = primeProducts.filter(
    (p) => !listedProductIds.has(p._id.toString())
  );

  if (orphans.length === 0) {
    console.log('✅ No orphaned Prime products found. Everything is clean!');
  } else {
    console.log(`⚠️  Found ${orphans.length} ORPHANED Prime product(s):\n`);
    orphans.forEach((p, i) => {
      console.log(`  ${i + 1}. "${p.name}" (ID: ${p._id})`);
      console.log(`     Brand: ${p.brand_id}, MRP: ₹${p.mrp}, Selling: ₹${p.sellingPrice}`);
      console.log(`     isActive: ${p.isActive}, Created: ${p.createdAt}`);
      console.log('');
    });

    if (shouldDelete) {
      const orphanIds = orphans.map((p) => p._id);
      const result = await Product.deleteMany({ _id: { $in: orphanIds } });
      console.log(`🗑️  Deleted ${result.deletedCount} orphaned product(s) from database.`);
    } else {
      console.log('ℹ️  This was a DRY RUN. To actually delete, run:');
      console.log('   npx ts-node cleanup-orphan-products.ts --delete');
    }
  }

  await mongoose.disconnect();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
