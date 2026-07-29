/**
 * VendorPayoutService
 *
 * Single source of truth for "what does Petmaza owe this vendor for this order".
 *
 * Two rules drive every number in here:
 *
 *  1. PRODUCT-WISE. A vendor is paid for the line items that are THEIRS
 *     (`order.items[].vendor_id`), never for the whole order. Multi-vendor
 *     orders split across vendors; the customer's selling price is irrelevant,
 *     only the accepted purchase price (`purchaseSubtotal`) is owed.
 *
 *  2. SHIPPING FOLLOWS WHOEVER BOOKED IT. If the vendor arranged the courier
 *     (`ShippingDetails.shipping_arranged_by === 'VENDOR'`) their out-of-pocket
 *     courier cost is reimbursed on top of the product price. If an admin
 *     arranged it ('PLATFORM'), Petmaza already paid the courier directly and
 *     the vendor gets product price only.
 *
 * The customer's delivery charge (`order.shippingCharges`) and the platform fee
 * are Petmaza revenue and never appear in a vendor payout.
 *
 * Payouts become payable once the parcel SHIPS, not on delivery — vendors are
 * settled daily on an order basis.
 */

import { Types } from 'mongoose';

/**
 * An order is payable to its vendors from the moment it is handed to a courier.
 * PACKED is deliberately excluded: nothing has shipped yet.
 */
export const PAYABLE_STATUSES = [
  'READY_TO_SHIP',
  'PICKED_UP',
  'IN_TRANSIT',
  'DELIVERED',
] as const;

/**
 * Statuses that void a payout even if the order once shipped. Kept as one list
 * so the daily payout run, the legacy weekly view and the wallet all agree.
 */
export const NON_PAYABLE_STATUSES = [
  'PENDING',
  'ASSIGNED',
  'ACCEPTED',
  'REJECTED',
  'PACKED',
  'CANCELLED',
  'REFUND_INITIATED',
  'REFUNDED',
] as const;

export const isPayableStatus = (status: any): boolean =>
  PAYABLE_STATUSES.includes(String(status) as any);

export interface PayoutLineItem {
  productId: string;
  productName: string;
  quantity: number;
  /** Vendor's accepted unit purchase price — what we pay them per unit. */
  purchasePrice: number;
  /** quantity × purchasePrice, snapshotted on the order at acceptance. */
  purchaseSubtotal: number;
  priceAdjusted: boolean;
  quotedPrice: number | null;
}

export interface VendorPayoutBreakdown {
  vendorId: string;
  items: PayoutLineItem[];
  /** Σ purchaseSubtotal across THIS vendor's items only. */
  productAmount: number;
  /** Who booked the courier: 'VENDOR', 'PLATFORM', or null when nothing filed yet. */
  shippingArrangedBy: 'VENDOR' | 'PLATFORM' | null;
  /** Courier cost on record, whoever paid it. Shown for transparency. */
  shippingCost: number;
  /** The part of shippingCost we actually owe this vendor (0 for PLATFORM). */
  shippingReimbursement: number;
  /** productAmount + shippingReimbursement. */
  totalAmount: number;
}

/** Minimal shape this service needs from a ShippingDetails doc. */
export interface ShippingDetailsLike {
  order_id: Types.ObjectId | string;
  vendor_id?: Types.ObjectId | string | null;
  shipping_cost?: number | null;
  shipping_arranged_by?: 'VENDOR' | 'PLATFORM' | null;
  created_at?: Date | null;
}

const idOf = (value: any): string | null => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value._id) return String(value._id);
  return String(value);
};

/**
 * The date an order became payable — when the courier record was filed (the
 * moment it shipped). Falls back to the delivery date, then the order's last
 * update, so legacy orders with no shipping record still land on a day.
 */
export const payableDateOf = (order: any, shippingDoc?: ShippingDetailsLike | null): Date =>
  new Date(
    shippingDoc?.created_at || order?.deliveredAt || order?.updatedAt || order?.createdAt || Date.now()
  );

/** Local (IST-on-server) YYYY-MM-DD key for grouping a payout into its day. */
export const dayKeyOf = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/**
 * Split one order into per-vendor payout breakdowns.
 *
 * Items are grouped by `item.vendor_id`. Legacy orders whose items predate
 * per-item vendor stamping fall back to `order.assignedVendorId` so they are
 * still billable instead of silently vanishing from payouts.
 *
 * Only ONE ShippingDetails record exists per order (order_id is unique), so at
 * most one vendor on a multi-vendor order can be reimbursed for courier cost —
 * the vendor named on that record.
 */
export const computeOrderPayouts = (
  order: any,
  shippingDoc?: ShippingDetailsLike | null
): VendorPayoutBreakdown[] => {
  const fallbackVendorId = idOf(order?.assignedVendorId);
  const groups = new Map<string, PayoutLineItem[]>();

  for (const item of order?.items || []) {
    const vendorId = idOf(item?.vendor_id) || fallbackVendorId;
    if (!vendorId) continue; // unassigned line — nobody to pay yet

    const product = item.product_id || item.primeProduct_id;
    const quantity = Number(item.quantity) || 1;
    const purchasePrice = Number(item.purchasePrice) || 0;
    const purchaseSubtotal =
      item.purchaseSubtotal !== undefined && item.purchaseSubtotal !== null
        ? Number(item.purchaseSubtotal) || 0
        : quantity * purchasePrice;

    const line: PayoutLineItem = {
      productId: idOf(product) || 'N/A',
      productName: (product && product.name) || item.name || 'Unknown Product',
      quantity,
      purchasePrice,
      purchaseSubtotal,
      priceAdjusted: !!item.priceAdjusted,
      quotedPrice:
        item.quotedPurchasePrice !== undefined && item.quotedPurchasePrice !== null
          ? Number(item.quotedPurchasePrice)
          : null,
    };

    const existing = groups.get(vendorId);
    if (existing) existing.push(line);
    else groups.set(vendorId, [line]);
  }

  // Records written before shipping billing existed have no flag; they were the
  // vendor's own courier, so treat a missing value as VENDOR.
  const arrangedBy = shippingDoc ? shippingDoc.shipping_arranged_by || 'VENDOR' : null;
  const shippingCost = Number(shippingDoc?.shipping_cost) || 0;
  const reimbursableVendorId = idOf(shippingDoc?.vendor_id);

  return [...groups.entries()].map(([vendorId, items]) => {
    const productAmount = items.reduce((sum, i) => sum + i.purchaseSubtotal, 0);

    // Reimburse the courier only when the vendor booked it AND this is the
    // vendor named on the shipping record.
    const shippingReimbursement =
      arrangedBy === 'VENDOR' && (!reimbursableVendorId || reimbursableVendorId === vendorId)
        ? shippingCost
        : 0;

    return {
      vendorId,
      items,
      productAmount,
      shippingArrangedBy: arrangedBy,
      // Only surface a cost figure to the vendor it concerns.
      shippingCost:
        !reimbursableVendorId || reimbursableVendorId === vendorId ? shippingCost : 0,
      shippingReimbursement,
      totalAmount: productAmount + shippingReimbursement,
    };
  });
};

/**
 * What a single vendor is owed on a single order. Returns null when the vendor
 * has no line items on it.
 */
export const computeVendorPayoutForOrder = (
  order: any,
  vendorId: string,
  shippingDoc?: ShippingDetailsLike | null
): VendorPayoutBreakdown | null =>
  computeOrderPayouts(order, shippingDoc).find((p) => p.vendorId === String(vendorId)) || null;
