/**
 * applyVendorPriceAdjustments.ts
 *
 * When a vendor/fulfiller accepts an order, they may adjust the per-item
 * purchase price (the price the platform pays them) to reflect the day's
 * market movement. This helper applies those overrides to the order items
 * in-place and recomputes the dependent totals so that vendor bills — which
 * are derived from `purchaseSubtotal` — reflect the accepted prices.
 *
 * The original platform-quoted price is snapshotted into `quotedPurchasePrice`
 * the first time an item is adjusted, so admin can compare quoted vs accepted.
 */

export interface VendorPriceUpdate {
  index: number; // position of the item in order.items
  purchasePrice: number; // new accepted unit purchase price
}

export interface PriceAdjustmentResult {
  changed: boolean;
  totalPurchasePrice: number;
  totalProfit: number;
}

/**
 * Mutates `items` in place. Works on Mongoose subdocuments and plain objects.
 * No hard cap is enforced — any non-negative price is accepted.
 */
export function applyVendorPriceAdjustments(
  items: any[],
  updates?: VendorPriceUpdate[] | null
): PriceAdjustmentResult {
  let changed = false;

  if (Array.isArray(updates)) {
    for (const upd of updates) {
      const idx = Number(upd?.index);
      const newPrice = Number(upd?.purchasePrice);

      if (!Number.isInteger(idx) || idx < 0 || idx >= items.length) continue;
      if (isNaN(newPrice) || newPrice < 0) continue;

      const item = items[idx];
      const currentPrice = Number(item.purchasePrice) || 0;
      if (newPrice === currentPrice) continue;

      // Snapshot the original quoted price only once.
      if (item.quotedPurchasePrice == null) {
        item.quotedPurchasePrice = currentPrice;
      }

      item.purchasePrice = newPrice;
      item.purchaseSubtotal = newPrice * item.quantity;
      item.profit = (Number(item.subtotal) || 0) - item.purchaseSubtotal;
      item.profitPercentage =
        item.subtotal > 0 ? (item.profit / item.subtotal) * 100 : 0;
      item.priceAdjusted = true;
      changed = true;
    }
  }

  const totalPurchasePrice = items.reduce(
    (s, it) => s + (Number(it.purchaseSubtotal) || 0),
    0
  );
  const totalProfit = items.reduce((s, it) => s + (Number(it.profit) || 0), 0);

  return { changed, totalPurchasePrice, totalProfit };
}
