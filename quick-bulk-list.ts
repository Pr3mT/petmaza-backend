/**
 * Bulk-list the shared Petmaza catalog into one Quick shop's listings.
 *
 * Mirrors quickShopController.upsertListing exactly (same query as getCatalog,
 * same upsert on the {vendor_id, product_id} unique index), so the result is
 * identical to a shop admin adding every product by hand in the vendor panel.
 *
 * READ-ONLY BY DEFAULT. Pass --write to actually upsert.
 *
 *   npx ts-node quick-bulk-list.ts                    # dry run: report only
 *   npx ts-node quick-bulk-list.ts --write            # create/update listings
 *   npx ts-node quick-bulk-list.ts --write --stock=25
 *
 * Flags:
 *   --vendor=<id>     shop to list into (default Royal Pet Store)
 *   --stock=<n>       stock per listing (default 10)
 *   --include-prime   also list isPrime products (default: skipped)
 *   --skip-variants   skip hasVariants products (default: they ARE included)
 *   --only-new        never touch a listing that already exists
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from './src/models/Product';
import QuickProductListing from './src/models/QuickProductListing';
import User from './src/models/User';

dotenv.config();

const arg = (name: string, fallback?: string) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : fallback;
};
const flag = (name: string) => process.argv.includes(`--${name}`);

const VENDOR_ID = arg('vendor', '6a66e284f63a7e85d3621b09')!;
const STOCK = Number(arg('stock', '10'));
const WRITE = flag('write');
const INCLUDE_PRIME = flag('include-prime');
const SKIP_VARIANTS = flag('skip-variants');
const ONLY_NEW = flag('only-new');

// Same price the main storefront shows. getDisplayPricing on the client falls
// back to mrp * sellingPercentage when sellingPrice is absent, so mirror that
// rather than listing something at ₹0.
const priceOf = (p: any): number => {
  if (p.sellingPrice) return Math.round(p.sellingPrice);
  if (p.mrp && p.sellingPercentage) return Math.round(p.mrp * (p.sellingPercentage / 100));
  if (p.mrp) return Math.round(p.mrp * 0.8);
  return 0;
};

(async () => {
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log(`Connected. mode=${WRITE ? 'WRITE' : 'DRY RUN'}\n`);

  const vendor = await User.findById(VENDOR_ID).select('name email role');
  if (!vendor) throw new Error(`No user ${VENDOR_ID}`);
  console.log(`Shop: ${vendor.name} <${vendor.email}> role=${vendor.role}`);

  // Identical to getCatalog: active products that aren't another shop's private
  // Quick-only product.
  //
  // Promotional products are excluded UNCONDITIONALLY. The one-per-account
  // lifetime limit lives in orderController's findClaimedPromoProductIds(),
  // which createQuickOrder never calls — Quick has no promo logic at all — so a
  // listed promo product is repeatable at its promo price through Quick. Drop
  // this filter only once createQuickOrder is guarded.
  const query: any = {
    isActive: true,
    quickOwnerVendorId: { $exists: false },
    isPromotional: { $ne: true },
  };
  if (!INCLUDE_PRIME) query.isPrime = { $ne: true };

  const products = await Product.find(query)
    .select('name mrp sellingPrice sellingPercentage hasVariants variants isPrime mainCategory subCategory stock inStock')
    .lean();

  const existing = await QuickProductListing.find({ vendor_id: VENDOR_ID }).select('product_id').lean();
  const already = new Set(existing.map((l: any) => String(l.product_id)));

  const skipped: Record<string, number> = {};
  const skip = (why: string) => { skipped[why] = (skipped[why] || 0) + 1; };
  const todo: { id: string; name: string; price: number; isNew: boolean }[] = [];

  for (const p of products as any[]) {
    const price = priceOf(p);
    if (!price) { skip('no usable price'); continue; }
    if (SKIP_VARIANTS && p.hasVariants) { skip('has variants'); continue; }
    const isNew = !already.has(String(p._id));
    if (ONLY_NEW && !isNew) { skip('already listed'); continue; }
    todo.push({ id: String(p._id), name: p.name, price, isNew });
  }

  const variantCount = (products as any[]).filter((p) => p.hasVariants).length;
  console.log(`\nCatalog matched : ${products.length}`);
  console.log(`Already listed  : ${already.size}`);
  console.log(`To upsert       : ${todo.length}  (new ${todo.filter((t) => t.isNew).length}, update ${todo.filter((t) => !t.isNew).length})`);
  console.log(`Of those, variant products: ${variantCount}`);
  console.log(`Stock per listing: ${STOCK}`);
  if (Object.keys(skipped).length) console.log('Skipped:', skipped);

  console.log('\nSample (first 10):');
  todo.slice(0, 10).forEach((t) => console.log(`  ${t.isNew ? '+' : '~'} ₹${t.price}  ${t.name}`));

  if (!WRITE) {
    console.log('\nDRY RUN — nothing written. Re-run with --write to apply.');
    await mongoose.disconnect();
    return;
  }

  const ops = todo.map((t) => ({
    updateOne: {
      filter: { vendor_id: new mongoose.Types.ObjectId(VENDOR_ID), product_id: new mongoose.Types.ObjectId(t.id) },
      update: { $set: { sellingPrice: t.price, stock: STOCK, isActive: true } },
      upsert: true,
    },
  }));

  const res = await QuickProductListing.bulkWrite(ops, { ordered: false });
  console.log(`\nDone. inserted=${res.upsertedCount} modified=${res.modifiedCount} matched=${res.matchedCount}`);
  console.log(`Total listings now: ${await QuickProductListing.countDocuments({ vendor_id: VENDOR_ID })}`);

  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
