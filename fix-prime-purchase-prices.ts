/**
 * Migration script: Fix prime orders where purchasePrice / totalPurchasePrice = 0
 *                   and also fix grandTotal = 0 (never set by createOrder loop).
 *
 * For every prime order item that has purchasePrice = 0, the script:
 *   1. Looks up the PrimeProduct listing (vendor_id + product_id)
 *   2. Falls back to the Product's own purchasePrice
 *   3. Recalculates purchaseSubtotal, profit, profitPercentage per item
 *   4. Recalculates totalPurchasePrice and totalProfit on the order
 *   5. Sets grandTotal = total when grandTotal = 0
 *   6. Saves the corrected values to MongoDB
 *
 * Run with:  npx ts-node fix-prime-purchase-prices.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from './src/models/Order';
import PrimeProduct from './src/models/PrimeProduct';
import Product from './src/models/Product';

dotenv.config();

async function fixPrimePurchasePrices() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('🔌 Connected to MongoDB\n');

  // Find all prime orders that have at least one item with purchasePrice = 0
  // OR have grandTotal = 0
  const orders = await Order.find({
    isPrime: true,
    $or: [
      { 'items.purchasePrice': 0 },
      { grandTotal: 0 },
    ],
  }).lean();

  console.log(`Found ${orders.length} prime order(s) with purchasePrice = 0\n`);

  let fixedCount = 0;
  let skippedCount = 0;

  for (const order of orders) {
    const vendorId = order.assignedVendorId?.toString();
    if (!vendorId) {
      console.log(`⚠️  Order ${order._id} — no assignedVendorId, skipping`);
      skippedCount++;
      continue;
    }

    let changed = false;
    const updatedItems = await Promise.all(
      order.items.map(async (item: any) => {
        if (item.purchasePrice && item.purchasePrice > 0) {
          return item; // Already correct
        }

        const productId = item.product_id?.toString();
        if (!productId) return item;

        // 1. Try PrimeProduct listing
        const primeListing = await PrimeProduct.findOne({
          vendor_id: vendorId,
          product_id: productId,
        }).select('purchasePrice').lean();

        let purchasePrice: number = (primeListing as any)?.purchasePrice || 0;

        // 2. Fall back to Product.purchasePrice
        if (!purchasePrice) {
          const product = await Product.findById(productId).select('purchasePrice name').lean();
          purchasePrice = (product as any)?.purchasePrice || 0;
          if (purchasePrice) {
            console.log(`  → ${(product as any)?.name}: using Product.purchasePrice = ₹${purchasePrice}`);
          }
        } else {
          console.log(`  → productId ${productId}: using PrimeProduct.purchasePrice = ₹${purchasePrice}`);
        }

        if (!purchasePrice) {
          console.log(`  ⚠️  productId ${productId}: no purchasePrice found anywhere, leaving as 0`);
          return item;
        }

        changed = true;
        const purchaseSubtotal = purchasePrice * item.quantity;
        const profit = item.subtotal - purchaseSubtotal;
        const profitPercentage = item.subtotal > 0 ? (profit / item.subtotal) * 100 : 0;

        return {
          ...item,
          purchasePrice,
          purchaseSubtotal,
          profit,
          profitPercentage,
        };
      })
    );

    if (!changed) {
      // Item purchase prices are all > 0, but totalPurchasePrice or grandTotal may still be 0
      const itemsArr = order.items as any[];
      const recalcPurchase = itemsArr.reduce(
        (sum: number, i: any) => sum + (i.purchaseSubtotal || i.purchasePrice * i.quantity || 0), 0
      );
      const orderTotal = (order as any).total || 0;
      const needsPurchaseFix = recalcPurchase > 0 && ((order as any).totalPurchasePrice || 0) === 0;
      const needsGrandTotalFix = orderTotal > 0 && !((order as any).grandTotal);

      if (needsPurchaseFix || needsGrandTotalFix) {
        const updates: any = {};
        if (needsPurchaseFix) {
          updates.totalPurchasePrice = recalcPurchase;
          updates.totalProfit = orderTotal - recalcPurchase;
        }
        if (needsGrandTotalFix) {
          updates.grandTotal = orderTotal;
        }
        await Order.updateOne({ _id: order._id }, { $set: updates });
        console.log(
          `✅ Fixed order ${order._id} —` +
          (needsPurchaseFix ? ` totalPurchasePrice: 0 → ₹${recalcPurchase}` : '') +
          (needsGrandTotalFix ? ` grandTotal: 0 → ₹${orderTotal}` : '') +
          ' (items were already correct)'
        );
        fixedCount++;
      } else {
        console.log(`Order ${order._id} — nothing to fix, skipping`);
        skippedCount++;
      }
      continue;
    }

    const totalPurchasePrice = updatedItems.reduce(
      (sum: number, i: any) => sum + (i.purchaseSubtotal || i.purchasePrice * i.quantity || 0),
      0
    );
    const orderTotal = (order as any).total || 0;
    const totalProfit = orderTotal - totalPurchasePrice;
    const grandTotal = (order as any).grandTotal || orderTotal; // fix 0 grandTotal

    // Bulk-update items and totals using positional updates
    // Easier to replace items array entirely via direct update
    await Order.updateOne(
      { _id: order._id },
      {
        $set: {
          items: updatedItems,
          totalPurchasePrice,
          totalProfit,
          grandTotal,
        },
      }
    );

    console.log(
      `✅ Fixed order ${order._id} — totalPurchasePrice: 0 → ₹${totalPurchasePrice}, totalProfit → ₹${totalProfit}, grandTotal → ₹${grandTotal}`
    );
    fixedCount++;
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Fixed   : ${fixedCount}`);
  console.log(`   Skipped : ${skippedCount}`);
  console.log(`   Total   : ${orders.length}`);

  await mongoose.disconnect();
  console.log('\n🔌 Disconnected from MongoDB');
}

fixPrimePurchasePrices().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
