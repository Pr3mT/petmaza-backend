/**
 * vendorOrderSanitizer.ts
 *
 * Strips customer-facing financial fields from order documents before sending
 * them to vendor/fulfiller dashboards.
 *
 * Vendors should see:
 *   - product (name, images), quantity, purchasePrice, purchaseSubtotal, selectedVariant
 *   - status, dates, delivery address, customer contact (name/phone for delivery)
 *   - totalPurchasePrice (their total earnings for the order)
 *
 * Vendors must NOT see:
 *   - selling price, subtotal, total, grandTotal
 *   - platform fee, delivery cost, shipping charges
 *   - discount amount, coupon code
 *   - profit / profit percentage
 *   - payment ID / payment link
 */

/** Fields removed from the top-level order object */
const ORDER_HIDDEN_FIELDS = new Set([
  'total',
  'totalProfit',
  'deliveryCost',
  'shippingCharges',
  'platformFee',
  'grandTotal',
  'subtotalBeforeCharges',
  'discountAmount',
  'couponCode',
  'payment_id',
  'payment_link',
  'refundAmount',
]);

/** Fields removed from each order item */
const ITEM_HIDDEN_FIELDS = new Set([
  'sellingPrice',
  'subtotal',
  'profit',
  'profitPercentage',
]);

/**
 * Sanitize a single order document (plain object or Mongoose doc) for vendor consumption.
 * Works with both `.lean()` results and `.toObject()` results.
 */
export function sanitizeOrderForVendor(order: any): any {
  if (!order) return order;

  // Convert Mongoose document to plain object if needed
  const plain = typeof order.toObject === 'function' ? order.toObject() : { ...order };

  // Remove top-level sensitive fields
  for (const field of ORDER_HIDDEN_FIELDS) {
    delete plain[field];
  }

  // Sanitize items array
  if (Array.isArray(plain.items)) {
    plain.items = plain.items.map((item: any) => {
      const sanitizedItem = { ...item };
      for (const field of ITEM_HIDDEN_FIELDS) {
        delete sanitizedItem[field];
      }
      return sanitizedItem;
    });
  }

  return plain;
}

/**
 * Sanitize an array of orders for vendor consumption.
 */
export function sanitizeOrdersForVendor(orders: any[]): any[] {
  return orders.map(sanitizeOrderForVendor);
}
