/**
 * seedQuickPricing
 *
 * One-off migration for the switch to Petmaza-set Quick pricing.
 *
 * Before: each dark store set its own sellingPrice on its QuickProductListing,
 * and OrderRoutingService aliased purchasePrice = sellingPrice, so Petmaza's
 * margin on every Quick line item was exactly zero.
 *
 * After: Petmaza sets Product.quickSellingPrice / .quickPurchasePrice and the
 * shop only declares stock. This script seeds both:
 *
 *   quickSellingPrice  = the price shops already listed the product at, so
 *                        nothing changes for the customer on day one. Where
 *                        several shops listed it differently the LOWEST is
 *                        taken — that is what a customer would have been quoted
 *                        anyway, since the router fell back to the cheapest
 *                        in-range shop. Every divergence is printed.
 *
 *   quickPurchasePrice = the SAME purchase price Petmaza already pays for that
 *                        product as a normal (non-Quick) product. For a variant
 *                        product there is no top-level purchasePrice — it lives
 *                        on variants[] — so the cheapest active variant's cost
 *                        is used, mirroring how the app prices those products
 *                        everywhere else. Falls back to mrp * purchasePercentage
 *                        when only a percentage is on record.
 *
 * A product is SKIPPED, never guessed at, when it has no purchase price on
 * record, or when its purchase price is not below the selling price — listing
 * that would mean losing money on every Quick order. Both cases are printed so
 * they can be priced by hand.
 *
 *   npx ts-node --transpile-only src/scripts/seedQuickPricing.ts          # dry run
 *   npx ts-node --transpile-only src/scripts/seedQuickPricing.ts --apply  # write
 *
 * Dry run by default on purpose: dev and prod share one Atlas database.
 * Products that already carry a quickSellingPrice are never touched, so this is
 * safe to re-run.
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../models/Product';
import QuickProductListing from '../models/QuickProductListing';

dotenv.config();

const APPLY = process.argv.includes('--apply');
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * What Petmaza already pays for this product as a normal product.
 * Explicit price wins; otherwise derive from the percentage against MRP, which
 * is how the rest of the catalogue stores cost for percentage-priced products.
 */
const costOf = (p: any): number => {
  const explicit = Number(p?.purchasePrice) || 0;
  if (explicit > 0) return explicit;
  const mrp = Number(p?.mrp) || 0;
  const pct = Number(p?.purchasePercentage) || 0;
  return mrp > 0 && pct > 0 ? round2((mrp * pct) / 100) : 0;
};

const purchaseOf = (product: any): number => {
  if (!product?.hasVariants) return costOf(product);
  // Variant products carry no top-level cost — take the cheapest ACTIVE
  // variant, the same one the storefront prices against.
  const costs = (product.variants || [])
    .filter((v: any) => v?.isActive !== false)
    .map(costOf)
    .filter((c: number) => c > 0);
  return costs.length ? Math.min(...costs) : 0;
};

const run = async () => {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('MONGODB_URI is not defined');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log(`Connected. Mode: ${APPLY ? 'APPLY (writes)' : 'DRY RUN (no writes)'}\n`);

  const listings = await QuickProductListing.find({}).select('product_id sellingPrice').lean();
  if (!listings.length) {
    console.log('No Quick listings found — nothing to seed.');
    await mongoose.disconnect();
    return;
  }

  // product id -> every price a shop listed it at
  const pricesByProduct = new Map<string, number[]>();
  for (const l of listings) {
    const pid = String(l.product_id);
    const price = Number(l.sellingPrice) || 0;
    if (price <= 0) continue;
    pricesByProduct.set(pid, [...(pricesByProduct.get(pid) || []), price]);
  }

  const products = await Product.find({ _id: { $in: [...pricesByProduct.keys()] } })
    .select('_id name quickSellingPrice quickPurchasePrice purchasePrice purchasePercentage mrp hasVariants variants')
    .lean();

  let seeded = 0;
  let skipped = 0;
  let marginTotal = 0;
  const divergent: string[] = [];
  const noCost: string[] = [];
  const loss: string[] = [];

  for (const product of products) {
    const pid = String(product._id);
    const prices = pricesByProduct.get(pid) || [];
    if (!prices.length) continue;

    // Already priced for Quick — never overwrite a deliberate rate.
    if (Number((product as any).quickSellingPrice) > 0) {
      skipped++;
      continue;
    }

    const selling = Math.min(...prices);
    const high = Math.max(...prices);
    if (high !== selling) {
      divergent.push(`  ${product.name}: ${prices.length} shops, ₹${selling}–₹${high} → taking ₹${selling}`);
    }

    const purchase = purchaseOf(product);
    if (purchase <= 0) {
      noCost.push(`  ${product.name} (sells ₹${selling}) — no purchase price on record`);
      continue;
    }
    if (purchase >= selling) {
      loss.push(`  ${product.name}: cost ₹${purchase} vs sells ₹${selling} — would lose ₹${round2(purchase - selling)}`);
      continue;
    }

    if (APPLY) {
      await Product.updateOne(
        { _id: product._id },
        { $set: { quickSellingPrice: selling, quickPurchasePrice: purchase } }
      );
    }
    marginTotal += selling - purchase;
    seeded++;
  }

  if (divergent.length) {
    console.log(`Listed at different prices by different shops (${divergent.length}):`);
    divergent.forEach((d) => console.log(d));
    console.log('');
  }
  if (noCost.length) {
    console.log(`SKIPPED — no purchase price on record (${noCost.length}), price these by hand:`);
    noCost.forEach((d) => console.log(d));
    console.log('');
  }
  if (loss.length) {
    console.log(`SKIPPED — cost is not below selling (${loss.length}), review these:`);
    loss.forEach((d) => console.log(d));
    console.log('');
  }

  console.log(`Products with Quick listings : ${products.length}`);
  console.log(`Seeded                       : ${seeded}`);
  console.log(`Skipped (already priced)     : ${skipped}`);
  console.log(`Skipped (needs a decision)   : ${noCost.length + loss.length}`);
  if (seeded) {
    console.log(
      `Avg margin per seeded product: ₹${round2(marginTotal / seeded)} ` +
        `(₹${round2(marginTotal)} across ${seeded})`
    );
  }
  if (!APPLY) console.log('\nDRY RUN — nothing was written. Re-run with --apply to commit.');

  await mongoose.disconnect();
};

run().catch(async (e) => {
  console.error('Failed:', e);
  await mongoose.disconnect();
  process.exit(1);
});
