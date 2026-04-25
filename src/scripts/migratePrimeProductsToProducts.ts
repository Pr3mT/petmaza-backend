/**
 * One-time data migration: Merge PrimeProduct collection → Product collection
 *
 * For each PrimeProduct document:
 *   1. Find the referenced Product by product_id
 *   2. Update that Product with all prime-specific fields (isPrime, primeVendor_id, stock, etc.)
 *   3. Map vendorPrice → sellingPrice, vendorMRP → mrp (field names used after unification)
 *
 * After migration:
 *   - The primeproducts collection is renamed to primeproducts_backup (safe archive)
 *   - Code already uses Product collection for all prime operations
 *
 * Run with: npx ts-node src/scripts/migratePrimeProductsToProducts.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../models/Product';
import PrimeProduct from '../models/PrimeProduct';

dotenv.config();

async function migrate() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI is not defined in .env');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB');

  // Count how many PrimeProduct docs exist
  const total = await PrimeProduct.countDocuments();
  console.log(`📦 Found ${total} PrimeProduct documents to migrate`);

  if (total === 0) {
    console.log('✅ Nothing to migrate. Exiting.');
    await mongoose.connection.close();
    return;
  }

  // Fetch all prime listings
  const primeListings = await PrimeProduct.find({}).lean();

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const listing of primeListings) {
    try {
      const productId = listing.product_id;

      // Check the target Product exists
      const product = await Product.findById(productId);
      if (!product) {
        console.warn(`  ⚠️  Product ${productId} not found — skipping listing ${listing._id}`);
        skipped++;
        continue;
      }

      // Build the update payload — map PrimeProduct field names to unified Product field names
      const update: Record<string, any> = {
        isPrime: true,
        primeVendor_id: listing.vendor_id,
        // vendorPrice IS the sellingPrice in the unified model
        sellingPrice: listing.vendorPrice,
        // vendorMRP IS the mrp in the unified model
        mrp: listing.vendorMRP,
        stock: listing.stock ?? 0,
        isAvailable: listing.isAvailable !== false,
        isActive: listing.isActive !== false,
        minOrderQuantity: listing.minOrderQuantity ?? 1,
        maxOrderQuantity: listing.maxOrderQuantity ?? 100,
        deliveryTime: listing.deliveryTime ?? '3-5 business days',
        ordersCount: listing.ordersCount ?? 0,
        soldQuantity: listing.soldQuantity ?? 0,
        views: listing.views ?? 0,
      };

      // Only overwrite purchasePrice if the PrimeProduct had a real value
      if (listing.purchasePrice && listing.purchasePrice > 0) {
        update.purchasePrice = listing.purchasePrice;
      }

      // Only overwrite optional text/image fields if they were set
      if (listing.deliveryNotes) update.deliveryNotes = listing.deliveryNotes;
      if (listing.vendorImages && listing.vendorImages.length > 0) {
        update.vendorImages = listing.vendorImages;
      }

      await Product.findByIdAndUpdate(productId, { $set: update });

      migrated++;
      console.log(`  ✅ [${migrated}/${total}] Migrated product: ${product.name} (${productId})`);
    } catch (err: any) {
      console.error(`  ❌ Error migrating listing ${listing._id}:`, err.message);
      errors++;
    }
  }

  console.log('\n── Migration Summary ──────────────────────────');
  console.log(`  Total :  ${total}`);
  console.log(`  ✅ Migrated : ${migrated}`);
  console.log(`  ⚠️  Skipped  : ${skipped}`);
  console.log(`  ❌ Errors   : ${errors}`);

  if (errors === 0 && skipped === 0) {
    // Rename old collection to a backup so data is never lost
    console.log('\n🗄️  Renaming primeproducts → primeproducts_backup...');
    try {
      await mongoose.connection.db!.collection('primeproducts').rename('primeproducts_backup', { dropTarget: true });
      console.log('✅ Old collection archived as primeproducts_backup');
    } catch (renameErr: any) {
      // Collection may not exist if it was already empty
      console.warn('⚠️  Could not rename collection (may already be gone):', renameErr.message);
    }
  } else {
    console.log('\n⚠️  Migration had errors/skips — primeproducts collection NOT archived. Fix issues and re-run.');
  }

  await mongoose.connection.close();
  console.log('\n🎉 Migration complete! Products collection now holds all prime product data.');
}

migrate().catch((err) => {
  console.error('❌ Fatal migration error:', err);
  process.exit(1);
});
