/**
 * VENDOR DETAILS RECOVERY SCRIPT
 * --------------------------------
 * This script restores the vendorDetails collection by inferring data from:
 *   1. Users collection  → vendor_id, vendorType, shopName, pickupAddress,
 *                          serviceablePincodes, isApproved
 *   2. Products collection → prime-product counts for PRIME vendors
 *
 * Run with:  npx ts-node restore-vendor-details.ts
 *
 * Safe to re-run — uses updateOne with upsert:true so existing docs are NOT overwritten.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

// ── Loose schemas so we can query any field without strict mode ──────────────
const UserSchema = new mongoose.Schema({}, { strict: false });
const ProductSchema = new mongoose.Schema({}, { strict: false });
const VendorDetailsSchema = new mongoose.Schema({}, { strict: false, timestamps: true });

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set in .env');
  }

  console.log('Connecting to MongoDB…');
  await mongoose.connect(uri);
  console.log('Connected.\n');

  // Register models — cast to any to avoid TS union-type signature conflicts
  const User: any          = mongoose.models['User']          || mongoose.model('User',          UserSchema);
  const Product: any       = mongoose.models['Product']       || mongoose.model('Product',       ProductSchema);
  const VendorDetails: any = mongoose.models['VendorDetails'] || mongoose.model('VendorDetails', VendorDetailsSchema);

  // ── Step 1: Fetch all vendor accounts ───────────────────────────────────────
  const vendors: any[] = await User.find({ role: 'vendor' }).lean();
  console.log(`Found ${vendors.length} vendor user(s).\n`);

  if (vendors.length === 0) {
    console.log('No vendor users found — nothing to restore.');
    await mongoose.disconnect();
    return;
  }

  let created  = 0;
  let skipped  = 0;  // already had a vendorDetails doc
  let warnings = 0;

  for (const user of vendors) {
    const vendorId   = user._id;
    const vendorType = user.vendorType || 'MY_SHOP';   // fallback type
    const addr       = user.address || {};

    // ── Build pickupAddress (required fields in schema) ──────────────────────
    // Use whatever the user saved; fall back to placeholder so the doc is valid.
    const pickupAddress = {
      street  : addr.street   || 'Address not available',
      city    : addr.city     || 'City not available',
      state   : addr.state    || 'State not available',
      pincode : addr.pincode  || '000000',
    };

    const hasPlaceholder = Object.values(pickupAddress).some(v =>
      (v as string).includes('not available') || v === '000000'
    );
    if (hasPlaceholder) {
      console.warn(
        `  ⚠  ${user.name} (${vendorId}) — address incomplete; placeholder used. UPDATE MANUALLY.`
      );
      warnings++;
    }

    // ── Prime-product stats (only meaningful for PRIME vendors) ──────────────
    let totalPrimeProducts  = 0;
    let activePrimeProducts = 0;

    if (vendorType === 'PRIME') {
      totalPrimeProducts  = await Product.countDocuments({ isPrime: true, primeVendor_id: vendorId });
      activePrimeProducts = await Product.countDocuments({ isPrime: true, primeVendor_id: vendorId, isActive: true });
    }

    // ── Upsert (insert only if missing; never overwrite existing data) ────────
    const filter = { vendor_id: vendorId };

    const existing = await VendorDetails.findOne(filter).lean();
    if (existing) {
      console.log(`  ↩  Skipped  ${user.name} — vendorDetails doc already exists.`);
      skipped++;
      continue;
    }

    const doc = {
      vendor_id            : vendorId,
      vendorType           : vendorType,
      shopName             : user.name,           // best available — update if you know the real shop name
      pickupAddress        : pickupAddress,
      serviceablePincodes  : user.pincodesServed  || [],
      isApproved           : user.isApproved      ?? false,

      // Stats — restored from live product data
      totalPrimeProducts,
      activePrimeProducts,

      // All financial/KYC fields that cannot be inferred are left at schema defaults
      // (panCard, aadharCard, bankDetails, billingDetails, brandsHandled, etc.)
      // You must fill these in manually or re-collect from vendors.

      // Timestamps
      createdAt : user.createdAt ?? new Date(),
      updatedAt : new Date(),
    };

    await VendorDetails.create(doc);

    console.log(
      `  ✔  Restored  ${user.name}  |  type: ${vendorType}  |  approved: ${user.isApproved}` +
      (vendorType === 'PRIME' ? `  |  primeProducts: ${totalPrimeProducts}` : '')
    );
    created++;
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════');
  console.log(`  Restored : ${created}`);
  console.log(`  Skipped  : ${skipped} (already existed)`);
  console.log(`  Warnings : ${warnings} (incomplete address — fix manually)`);
  console.log('═══════════════════════════════════════════\n');

  if (warnings > 0) {
    console.log('ACTION REQUIRED:');
    console.log('  Some vendors had missing address data. Open MongoDB Compass / Atlas,');
    console.log('  find those docs in vendorDetails, and update pickupAddress manually.\n');
  }

  const missing = [
    'panCard', 'aadharCard', 'bankDetails', 'billingDetails',
    'brandsHandled', 'assignedSubcategories', 'businessType',
    'yearsInBusiness', 'returnPolicy',
  ];
  console.log('FIELDS THAT COULD NOT BE RECOVERED (not stored in User/Product):');
  missing.forEach(f => console.log(`  • ${f}`));
  console.log('\nThese must be re-collected from each vendor or filled in manually.\n');

  await mongoose.disconnect();
  console.log('Done. MongoDB disconnected.');
}

main().catch(err => {
  console.error('Recovery failed:', err);
  process.exit(1);
});
