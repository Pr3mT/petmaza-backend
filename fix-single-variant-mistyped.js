/**
 * fix-single-variant-mistyped.js
 *
 * WHY: Some products were created as "Multiple Variant" type in the admin panel
 *      but actually only have a single variant.  These should be plain
 *      single-variant (hasVariants = false) products with the variant data
 *      promoted to top-level fields.
 *
 * WHAT IT DOES:
 *  1. Finds every product where hasVariants=true AND variants.length === 1
 *  2. Promotes the single variant's price / weight / stock to top-level
 *  3. Sets hasVariants=false and clears the variants array
 *  4. Logs a summary of every product that was changed
 *
 * RUN: node fix-single-variant-mistyped.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌  MONGODB_URI not found in .env');
  process.exit(1);
}

// ── Minimal inline schema (avoids TypeScript compilation) ──────────────────
const variantSchema = new mongoose.Schema(
  {
    size:               { type: String },
    weight:             { type: Number },
    unit:               { type: String },
    displayWeight:      { type: String },
    mrp:                { type: Number },
    sellingPercentage:  { type: Number },
    sellingPrice:       { type: Number },
    discount:           { type: Number },
    purchasePercentage: { type: Number },
    purchasePrice:      { type: Number },
    stock:              { type: Number, default: 0 },
    isActive:           { type: Boolean, default: true },
    totalSoldWebsite:   { type: Number, default: 0 },
    totalSoldStore:     { type: Number, default: 0 },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name:               { type: String },
    hasVariants:        { type: Boolean, default: false },
    variants:           [variantSchema],
    weight:             { type: Number },
    unit:               { type: String },
    displayWeight:      { type: String },
    mrp:                { type: Number },
    sellingPercentage:  { type: Number },
    sellingPrice:       { type: Number },
    discount:           { type: Number, default: 0 },
    purchasePercentage: { type: Number },
    purchasePrice:      { type: Number },
    stock:              { type: Number, default: 0 },
    isActive:           { type: Boolean, default: true },
  },
  { strict: false, timestamps: true }
);

const Product = mongoose.model('Product', productSchema);

// ── Main ───────────────────────────────────────────────────────────────────
async function fixSingleVariantMistyped() {
  console.log('🔗  Connecting to MongoDB …');
  await mongoose.connect(MONGODB_URI);
  console.log('✅  Connected\n');

  // Find all products that are typed as multi-variant but only have 1 entry
  const candidates = await Product.find({ hasVariants: true }).lean();

  const mistyped = candidates.filter(
    (p) => Array.isArray(p.variants) && p.variants.length === 1
  );

  console.log(`🔍  Products with hasVariants=true : ${candidates.length}`);
  console.log(`⚠️   Of those, single-variant (mistyped): ${mistyped.length}\n`);

  if (mistyped.length === 0) {
    console.log('✅  Nothing to fix — all done.');
    await mongoose.disconnect();
    return;
  }

  let fixed = 0;
  let errors = 0;

  for (const product of mistyped) {
    const v = product.variants[0]; // the one and only variant

    // Build the update — promote variant fields to top level
    const update = {
      hasVariants: false,
      variants:    [],
      // weight / display
      ...(v.weight        !== undefined && { weight: v.weight }),
      ...(v.unit          !== undefined && { unit: v.unit }),
      ...(v.displayWeight !== undefined && { displayWeight: v.displayWeight }),
      // pricing
      ...(v.mrp               !== undefined && { mrp: v.mrp }),
      ...(v.sellingPercentage !== undefined && { sellingPercentage: v.sellingPercentage }),
      ...(v.sellingPrice      !== undefined && { sellingPrice: v.sellingPrice }),
      ...(v.discount          !== undefined && { discount: v.discount }),
      ...(v.purchasePercentage !== undefined && { purchasePercentage: v.purchasePercentage }),
      ...(v.purchasePrice     !== undefined && { purchasePrice: v.purchasePrice }),
      // stock
      ...(v.stock !== undefined && { stock: v.stock }),
    };

    try {
      await Product.updateOne({ _id: product._id }, { $set: update });
      console.log(
        `  ✅  Fixed: "${product.name}" (${product._id})`
        + `  →  MRP: ₹${v.mrp ?? '?'}  |  Price: ₹${v.sellingPrice ?? '?'}`
        + `  |  Weight: ${v.displayWeight ?? v.weight ?? '?'}`
      );
      fixed++;
    } catch (err) {
      console.error(`  ❌  Failed: "${product.name}" (${product._id}) — ${err.message}`);
      errors++;
    }
  }

  console.log('\n══════════════════════════════════════');
  console.log(`  Total mistyped found : ${mistyped.length}`);
  console.log(`  Successfully fixed   : ${fixed}`);
  console.log(`  Errors               : ${errors}`);
  console.log('══════════════════════════════════════\n');

  await mongoose.disconnect();
  console.log('🔌  Disconnected from MongoDB');
}

fixSingleVariantMistyped().catch((err) => {
  console.error('❌  Unexpected error:', err);
  process.exit(1);
});
