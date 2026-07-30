/**
 * WeeklyAccountsService
 *
 * The order-by-order P&L, cut into Sunday→Saturday weeks (IST).
 *
 * This is deliberately NOT AnalyticsService. That one reports `order.totalProfit`
 * — selling price minus purchase price — which ignores the courier we pay, the
 * delivery charge and platform fee we collect, coupon discounts and the payment
 * gateway's cut. Every figure here is money that actually moved:
 *
 *   customer pays  grandTotal (goods − discount + delivery charge + platform fee)
 *   Razorpay keeps GATEWAY_FEE_PERCENT of it, plus GST on that fee
 *   we receive     grandTotal − fee − GST                    ← real money in
 *   we pay vendor  accepted purchase price of their items
 *                  + their courier cost, but ONLY when the vendor booked it
 *   we pay courier directly when an admin booked it (PLATFORM shipments)
 *   NET PROFIT   = received − vendor payout − our own courier cost
 *
 * Week assignment is by ORDER DATE (IST). An order placed Saturday and shipped
 * Monday still belongs to the week it was sold in, with its cost against it —
 * costs are matched to the order, not to the day cash moved.
 *
 * Read-only: .find()/.lean() only, nothing here writes to the database.
 */

import Order from '../models/Order';
import ShippingDetails from '../models/ShippingDetails';
import VendorPayout from '../models/VendorPayout';
import VendorDetails from '../models/VendorDetails';
import { computeOrderPayouts, ShippingDetailsLike } from './VendorPayoutService';

// Populate targets. Imported for their side effect (model registration) so this
// service also works from a standalone script, where nothing else has loaded
// them and .populate() would throw MissingSchemaError.
import '../models/User';
import '../models/Product';
import '../models/PrimeProduct';

// Razorpay's cut on every captured payment: a percentage of the amount, plus
// GST on that fee. ₹1,000 collected → ₹20 fee + ₹3.60 GST = ₹23.60 deducted,
// ₹976.40 settled to the bank. Override per-environment if the plan changes.
export const GATEWAY_FEE_PERCENT = Number(process.env.RAZORPAY_FEE_PERCENT ?? 2);
export const GATEWAY_FEE_GST_PERCENT = Number(process.env.RAZORPAY_FEE_GST_PERCENT ?? 18);

/** Orders at or under this value are ₹1 test/promo checkouts — listed, never totalled. */
const TEST_ORDER_MAX = 1;

/**
 * Payment ids that never went through the gateway (legacy admin-marked-paid
 * orders). No gateway fee was charged on these, so none is deducted.
 */
const isGatewayPayment = (paymentId?: string | null): boolean =>
  !!paymentId &&
  !paymentId.startsWith('MANUAL_') &&
  !paymentId.startsWith('test_') &&
  !paymentId.startsWith('pay_demo_') &&
  !paymentId.startsWith('pay_test_');

// ── IST week boundaries ─────────────────────────────────────────────────────
// Render runs UTC. A Sunday 03:00 IST order is Saturday 21:30 UTC, so using the
// server's local date would file it under the previous week. Everything below
// shifts the instant into IST first and reads it with the getUTC* accessors.

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const istWall = (d: Date | number) => new Date(new Date(d).getTime() + IST_OFFSET_MS);
const fromIstWall = (wallMs: number) => new Date(wallMs - IST_OFFSET_MS);

/** Midnight IST on the Sunday that opens the week containing `instant`. */
export const weekStartOf = (instant: Date): Date => {
  const w = istWall(instant);
  return fromIstWall(Date.UTC(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate() - w.getUTCDay()));
};

/** 23:59:59.999 IST on the Saturday that closes the week. */
export const weekEndOf = (weekStart: Date): Date => new Date(weekStart.getTime() + WEEK_MS - 1);

/** YYYY-MM-DD of the IST Sunday — the id a week is requested and filed under. */
export const weekKeyOf = (weekStart: Date): string => istWall(weekStart).toISOString().slice(0, 10);

/**
 * Resolve a `weekStart` query value to the Sunday of that week. A bare
 * YYYY-MM-DD is read as an IST date, so any day in a week returns that week.
 */
export const resolveWeekStart = (input?: string | Date | null): Date => {
  if (!input) return weekStartOf(new Date());
  if (input instanceof Date) return weekStartOf(input);
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(input).trim());
  if (ymd) {
    return weekStartOf(fromIstWall(Date.UTC(+ymd[1], +ymd[2] - 1, +ymd[3])));
  }
  const parsed = new Date(input);
  if (isNaN(parsed.getTime())) throw new Error('Invalid weekStart — expected YYYY-MM-DD');
  return weekStartOf(parsed);
};

const IST = 'Asia/Kolkata';
const istDate = (d?: Date | string | null): string =>
  d ? new Date(d).toLocaleDateString('en-IN', { timeZone: IST, day: '2-digit', month: 'short', year: 'numeric' }) : '';
const istDateTime = (d?: Date | string | null): string =>
  d
    ? new Date(d).toLocaleString('en-IN', {
        timeZone: IST, day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: false,
      })
    : '';

/** "19 Jul 2026 – 25 Jul 2026" */
export const weekLabelOf = (weekStart: Date): string =>
  `${istDate(weekStart)} – ${istDate(weekEndOf(weekStart))}`;

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const num = (n: any) => Number(n) || 0;

const VENDOR_TYPE_LABEL: Record<string, string> = {
  PRIME: 'Prime Vendor',
  MY_SHOP: 'My Shop',
  WAREHOUSE_FULFILLER: 'Warehouse Fulfiller',
  QUICK_SHOP: 'Quick Shop',
  QUICK: 'Quick Shop',
};

// ── Row shape ───────────────────────────────────────────────────────────────

export interface WeeklyAccountRow {
  weekKey: string;
  weekLabel: string;
  orderDate: string;
  orderId: string;
  orderRef: string;
  channel: 'NORMAL' | 'PRIME' | 'QUICK';
  orderStatus: string;
  splitShipment: boolean;
  razorpayOrderId: string;

  customerName: string;
  customerPhone: string;
  customerCity: string;
  customerPincode: string;

  vendorName: string;
  vendorType: string;
  vendorPhone: string;
  vendorShop: string;

  products: string;
  itemCount: number;
  totalQty: number;

  /** What we quoted the vendor before they accepted (= accepted when never adjusted). */
  vendorQuotedCost: number;
  /** What the vendor accepted — the rate we actually owe on the goods. */
  vendorAcceptedCost: number;
  priceAdjusted: boolean;

  goodsAmount: number;
  discount: number;
  deliveryCharged: number;
  platformFeeCharged: number;
  orderTotal: number;

  paymentStatus: string;
  paymentReceived: boolean;
  paymentId: string;
  deliveryChargeReceived: 'YES' | 'NO' | 'NOT CHARGED';
  platformFeeReceived: 'YES' | 'NO' | 'NOT CHARGED';

  gatewayFee: number;
  gatewayFeeGst: number;
  gatewayDeduction: number;
  netReceived: number;

  shipped: boolean;
  shippedOn: string;
  courierName: string;
  trackingId: string;
  courierCost: number;
  courierArrangedBy: 'VENDOR' | 'PLATFORM' | 'NOT FILED';
  courierCostOnPetmaza: number;
  courierReimbursedToVendor: number;
  deliveryMargin: number;
  deliveredOn: string;

  vendorProductPayout: number;
  vendorTotalPayout: number;
  vendorPayoutStatus: 'Paid' | 'Partially Paid' | 'Pending' | 'Nothing payable';
  vendorPaidOn: string;
  vendorPaymentRef: string;

  netProfit: number;
  profitRatio: number | null;

  countedInTotals: boolean;
  testOrder: boolean;
  notes: string;
}

export interface WeeklySummary {
  weekKey: string;
  weekLabel: string;
  weekStart: string;
  weekEnd: string;
  orders: number;
  paidOrders: number;
  unpaidOrders: number;
  failedOrders: number;
  refundedOrders: number;
  cancelledOrders: number;
  testOrders: number;

  goodsAmount: number;
  discount: number;
  deliveryCharged: number;
  platformFeeCharged: number;
  customerPaid: number;

  gatewayFee: number;
  gatewayFeeGst: number;
  gatewayDeduction: number;
  netReceived: number;

  vendorProductPayout: number;
  courierReimbursedToVendor: number;
  vendorTotalPayout: number;
  vendorPayoutSettled: number;
  vendorPayoutPending: number;

  courierCostOnPetmaza: number;
  deliveryMargin: number;

  netProfit: number;
  profitRatio: number | null;

  /** Shipped orders with no courier cost on record — real profit is lower by these. */
  missingCourierCost: number;
}

// ── Core builder ────────────────────────────────────────────────────────────

const itemLine = (name: string, qty: number, sold: number, rate: number, quoted: number | null): string => {
  const parts = [`${name} x${qty}`];
  if (sold > 0) parts.push(`sold ₹${round2(sold)}/u`);
  parts.push(`vendor ₹${round2(rate)}/u`);
  if (quoted != null && round2(quoted) !== round2(rate)) parts.push(`quoted ₹${round2(quoted)}/u`);
  parts.push(`vendor total ₹${round2(rate * qty)}`);
  return parts.join(' | ');
};

/**
 * Every order created between two instants, costed. Rows are one per ORDER —
 * a multi-vendor order sums its vendors rather than repeating the order's
 * revenue on each, so a column can always be summed straight down.
 *
 * `withDetail: false` skips the customer/vendor/product joins and leaves those
 * descriptive columns blank. Every money figure is still exact, so the week
 * index (which shows totals only) can span months without paying for lookups
 * it never displays.
 */
export const buildRows = async (from: Date, to: Date, withDetail = true): Promise<WeeklyAccountRow[]> => {
  const query = Order.find({ createdAt: { $gte: from, $lte: to } }).sort({ createdAt: 1 });
  if (withDetail) {
    query
      .populate('customer_id', 'name email phone')
      .populate('assignedVendorId', 'name email phone vendorType')
      .populate('items.vendor_id', 'name email phone vendorType')
      .populate('items.product_id', 'name')
      .populate('items.primeProduct_id', 'name');
  }
  const orders = await query.lean();

  if (orders.length === 0) return [];

  const orderIds = orders.map((o: any) => o._id);

  const [shippingDocs, payouts] = await Promise.all([
    ShippingDetails.find({ order_id: { $in: orderIds } }).lean(),
    VendorPayout.find({ order_id: { $in: orderIds } }).lean(),
  ]);

  const shippingByOrder = new Map<string, any>(
    shippingDocs.map((s: any) => [String(s.order_id), s])
  );
  const payoutsByOrder = new Map<string, any[]>();
  for (const p of payouts as any[]) {
    const key = String(p.order_id);
    const list = payoutsByOrder.get(key);
    if (list) list.push(p);
    else payoutsByOrder.set(key, [p]);
  }

  // Vendor shop names, one query for every vendor seen in the window.
  const vendorIds = new Set<string>();
  if (withDetail) {
    for (const o of orders as any[]) {
      if (o.assignedVendorId?._id) vendorIds.add(String(o.assignedVendorId._id));
      for (const it of o.items || []) if (it.vendor_id?._id) vendorIds.add(String(it.vendor_id._id));
    }
  }
  const vendorDetails = vendorIds.size
    ? await VendorDetails.find({ vendor_id: { $in: [...vendorIds] } }).select('vendor_id shopName vendorType').lean()
    : [];
  const shopByVendor = new Map<string, any>(vendorDetails.map((v: any) => [String(v.vendor_id), v]));

  const rows: WeeklyAccountRow[] = [];

  for (const order of orders as any[]) {
    const orderId = String(order._id);
    const shippingDoc = (shippingByOrder.get(orderId) || null) as ShippingDetailsLike | null;
    const breakdowns = computeOrderPayouts(order, shippingDoc);
    const settled = payoutsByOrder.get(orderId) || [];
    const settledByVendor = new Map<string, any>(settled.map((p: any) => [String(p.vendor_id), p]));
    const notes: string[] = [];

    // ── Vendor identity (usually one; joined when an order spans vendors) ────
    const vendorUsers = new Map<string, any>();
    if (order.assignedVendorId?._id) vendorUsers.set(String(order.assignedVendorId._id), order.assignedVendorId);
    for (const it of order.items || []) {
      if (it.vendor_id?._id) vendorUsers.set(String(it.vendor_id._id), it.vendor_id);
    }
    const vendorList = breakdowns.length
      ? breakdowns.map((b) => vendorUsers.get(b.vendorId)).filter(Boolean)
      : [...vendorUsers.values()];
    const vendorName = !withDetail
      ? ''
      : vendorList.map((v: any) => v.name).filter(Boolean).join(' | ') || 'Not assigned';
    const vendorType = vendorList
      .map((v: any) => VENDOR_TYPE_LABEL[v.vendorType] || v.vendorType || '')
      .filter(Boolean)
      .join(' | ');
    const vendorPhone = vendorList.map((v: any) => v.phone).filter(Boolean).join(' | ');
    const vendorShop = vendorList
      .map((v: any) => shopByVendor.get(String(v._id))?.shopName)
      .filter(Boolean)
      .join(' | ');

    // ── Products, and the rate the vendor accepted per unit ─────────────────
    // The order snapshots the name at purchase time; fall back to the live
    // product only for orders placed before snapshotting existed.
    const soldByProduct = new Map<string, number>();
    const nameByProduct = new Map<string, string>();
    for (const it of order.items || []) {
      const pid = String(it.product_id?._id || it.product_id || it.primeProduct_id?._id || it.primeProduct_id || '');
      if (!pid) continue;
      soldByProduct.set(pid, num(it.sellingPrice));
      const snapshot = it.productName || it.product_id?.name || it.primeProduct_id?.name;
      if (snapshot) nameByProduct.set(pid, snapshot);
    }

    const payoutItems = breakdowns.flatMap((b) => b.items);
    const products = !withDetail
      ? ''
      : payoutItems
          .map((li) =>
            itemLine(
              nameByProduct.get(li.productId) || li.productName,
              li.quantity,
              soldByProduct.get(li.productId) ?? 0,
              li.purchasePrice,
              li.quotedPrice
            )
          )
          .join('  ||  ');
    const totalQty = payoutItems.reduce((s, li) => s + li.quantity, 0);
    const priceAdjusted = payoutItems.some((li) => li.priceAdjusted);
    const vendorAcceptedCost = round2(breakdowns.reduce((s, b) => s + b.productAmount, 0));
    const vendorQuotedCost = round2(
      payoutItems.reduce((s, li) => s + (li.quotedPrice ?? li.purchasePrice) * li.quantity, 0)
    );

    // ── What the customer was billed ────────────────────────────────────────
    const goodsAmount = round2(
      num(order.subtotalBeforeCharges) > 0
        ? order.subtotalBeforeCharges
        : (order.items || []).reduce(
            (s: number, it: any) => s + (num(it.subtotal) || num(it.sellingPrice) * (it.quantity || 1)),
            0
          )
    );
    const discount = round2(order.discountAmount);
    const deliveryCharged = round2(order.shippingCharges);
    const platformFeeCharged = round2(order.platformFee);
    const orderTotal = round2(num(order.grandTotal) || num(order.total));

    const paymentStatus = order.payment_status || 'Pending';
    const paymentReceived = paymentStatus === 'Paid';
    const paymentId = order.payment_id || '';

    const collected = (charged: number): 'YES' | 'NO' | 'NOT CHARGED' =>
      charged <= 0 ? 'NOT CHARGED' : paymentReceived ? 'YES' : 'NO';

    // ── The gateway's cut ───────────────────────────────────────────────────
    // Charged on the captured payment. Split checkouts share one Razorpay
    // payment, but the fee is a flat percentage, so per-order pro-rating adds
    // back up to exactly the fee on the whole payment.
    const feeApplies = paymentReceived && isGatewayPayment(paymentId);
    if (paymentReceived && !feeApplies) notes.push('marked paid outside the gateway — no gateway fee');
    const gatewayFee = feeApplies ? round2((orderTotal * GATEWAY_FEE_PERCENT) / 100) : 0;
    const gatewayFeeGst = feeApplies ? round2((gatewayFee * GATEWAY_FEE_GST_PERCENT) / 100) : 0;
    const gatewayDeduction = round2(gatewayFee + gatewayFeeGst);
    const netReceived = paymentReceived ? round2(orderTotal - gatewayDeduction) : 0;

    // ── Courier ─────────────────────────────────────────────────────────────
    const shipped = !!shippingDoc;
    const courierCost = round2((shippingDoc as any)?.shipping_cost);
    const courierArrangedBy: 'VENDOR' | 'PLATFORM' | 'NOT FILED' = shippingDoc
      ? ((shippingDoc.shipping_arranged_by || 'VENDOR') as 'VENDOR' | 'PLATFORM')
      : 'NOT FILED';
    const courierReimbursedToVendor = round2(
      breakdowns.reduce((s, b) => s + b.shippingReimbursement, 0)
    );
    // A courier an admin booked is Petmaza's own bill, not a vendor reimbursement.
    const courierCostOnPetmaza = courierArrangedBy === 'PLATFORM' ? courierCost : 0;
    const deliveryMargin = round2(deliveryCharged - courierReimbursedToVendor - courierCostOnPetmaza);
    if (shipped && courierCost === 0) notes.push('shipped but courier cost not filled in');
    if (!shipped && ['PICKED_UP', 'IN_TRANSIT', 'DELIVERED'].includes(String(order.status))) {
      notes.push('no shipping record — courier cost unknown');
    }

    // ── Vendor payout ───────────────────────────────────────────────────────
    // A settled payout reports the frozen amount it was paid at, never today's
    // recomputation, so a later price edit can't rewrite history.
    let vendorProductPayout = 0;
    let vendorTotalPayout = 0;
    for (const b of breakdowns) {
      const paid = settledByVendor.get(b.vendorId);
      vendorProductPayout += paid ? num(paid.productAmount) : b.productAmount;
      vendorTotalPayout += paid ? num(paid.totalAmount) : b.totalAmount;
    }
    vendorProductPayout = round2(vendorProductPayout);
    vendorTotalPayout = round2(vendorTotalPayout);

    const paidCount = breakdowns.filter((b) => settledByVendor.has(b.vendorId)).length;
    const vendorPayoutStatus: WeeklyAccountRow['vendorPayoutStatus'] =
      breakdowns.length === 0
        ? 'Nothing payable'
        : paidCount === 0
        ? 'Pending'
        : paidCount === breakdowns.length
        ? 'Paid'
        : 'Partially Paid';
    const vendorPaidOn = settled.map((p: any) => istDate(p.paidAt)).filter(Boolean).join(' | ');
    const vendorPaymentRef = settled
      .map((p: any) => [p.paymentMethod, p.paymentReference].filter(Boolean).join(' '))
      .filter(Boolean)
      .join(' | ');

    // ── Bottom line ─────────────────────────────────────────────────────────
    const testOrder = orderTotal <= TEST_ORDER_MAX;
    if (testOrder) notes.push('₹1 test/promo checkout — excluded from totals');
    if (paymentStatus === 'Refunded') notes.push('refunded — gateway fee is not returned to us');

    const netProfit = round2(netReceived - vendorTotalPayout - courierCostOnPetmaza);
    const countedInTotals = paymentReceived && !testOrder;

    const weekStart = weekStartOf(order.createdAt);

    rows.push({
      weekKey: weekKeyOf(weekStart),
      weekLabel: weekLabelOf(weekStart),
      orderDate: istDateTime(order.createdAt),
      orderId,
      orderRef: orderId.slice(-8).toUpperCase(),
      channel: order.orderChannel === 'QUICK' ? 'QUICK' : order.isPrime ? 'PRIME' : 'NORMAL',
      orderStatus: String(order.status || ''),
      splitShipment: !!order.isSplitShipment,
      razorpayOrderId: order.razorpay_order_id || '',

      customerName: order.customer_id?.name || 'Unknown',
      customerPhone: order.customerAddress?.phone || order.customer_id?.phone || '',
      customerCity: order.customerAddress?.city || '',
      customerPincode: order.customerPincode || order.customerAddress?.pincode || '',

      vendorName,
      vendorType,
      vendorPhone,
      vendorShop,

      products,
      itemCount: (order.items || []).length,
      totalQty,
      vendorQuotedCost,
      vendorAcceptedCost,
      priceAdjusted,

      goodsAmount,
      discount,
      deliveryCharged,
      platformFeeCharged,
      orderTotal,

      paymentStatus,
      paymentReceived,
      paymentId,
      deliveryChargeReceived: collected(deliveryCharged),
      platformFeeReceived: collected(platformFeeCharged),

      gatewayFee,
      gatewayFeeGst,
      gatewayDeduction,
      netReceived,

      shipped,
      shippedOn: istDateTime((shippingDoc as any)?.created_at),
      courierName: (shippingDoc as any)?.shipping_company || '',
      trackingId: (shippingDoc as any)?.tracking_id || '',
      courierCost,
      courierArrangedBy,
      courierCostOnPetmaza,
      courierReimbursedToVendor,
      deliveryMargin,
      deliveredOn: istDateTime(order.deliveredAt),

      vendorProductPayout,
      vendorTotalPayout,
      vendorPayoutStatus,
      vendorPaidOn,
      vendorPaymentRef,

      netProfit,
      profitRatio: orderTotal > 0 ? round2((netProfit / orderTotal) * 100) : null,

      countedInTotals,
      testOrder,
      notes: notes.join('; '),
    });
  }

  return rows;
};

/**
 * Totals for one week. Only paid, non-test orders contribute money; everything
 * else is still counted in the order tallies so nothing goes missing.
 */
export const summarize = (weekStart: Date, rows: WeeklyAccountRow[]): WeeklySummary => {
  const counted = rows.filter((r) => r.countedInTotals);
  const sum = (arr: WeeklyAccountRow[], pick: (r: WeeklyAccountRow) => number) =>
    round2(arr.reduce((s, r) => s + pick(r), 0));

  const customerPaid = sum(counted, (r) => r.orderTotal);
  const netProfit = sum(counted, (r) => r.netProfit);

  return {
    weekKey: weekKeyOf(weekStart),
    weekLabel: weekLabelOf(weekStart),
    weekStart: weekStart.toISOString(),
    weekEnd: weekEndOf(weekStart).toISOString(),

    orders: rows.length,
    paidOrders: counted.length,
    unpaidOrders: rows.filter((r) => r.paymentStatus === 'Pending').length,
    failedOrders: rows.filter((r) => r.paymentStatus === 'Failed').length,
    refundedOrders: rows.filter((r) => r.paymentStatus === 'Refunded').length,
    cancelledOrders: rows.filter((r) => r.orderStatus === 'CANCELLED').length,
    testOrders: rows.filter((r) => r.testOrder).length,

    goodsAmount: sum(counted, (r) => r.goodsAmount),
    discount: sum(counted, (r) => r.discount),
    deliveryCharged: sum(counted, (r) => r.deliveryCharged),
    platformFeeCharged: sum(counted, (r) => r.platformFeeCharged),
    customerPaid,

    gatewayFee: sum(counted, (r) => r.gatewayFee),
    gatewayFeeGst: sum(counted, (r) => r.gatewayFeeGst),
    gatewayDeduction: sum(counted, (r) => r.gatewayDeduction),
    netReceived: sum(counted, (r) => r.netReceived),

    vendorProductPayout: sum(counted, (r) => r.vendorProductPayout),
    courierReimbursedToVendor: sum(counted, (r) => r.courierReimbursedToVendor),
    vendorTotalPayout: sum(counted, (r) => r.vendorTotalPayout),
    vendorPayoutSettled: sum(counted.filter((r) => r.vendorPayoutStatus === 'Paid'), (r) => r.vendorTotalPayout),
    vendorPayoutPending: sum(
      counted.filter((r) => r.vendorPayoutStatus === 'Pending' || r.vendorPayoutStatus === 'Partially Paid'),
      (r) => r.vendorTotalPayout
    ),

    courierCostOnPetmaza: sum(counted, (r) => r.courierCostOnPetmaza),
    deliveryMargin: sum(counted, (r) => r.deliveryMargin),

    netProfit,
    profitRatio: customerPaid > 0 ? round2((netProfit / customerPaid) * 100) : null,

    missingCourierCost: counted.filter((r) => r.shipped && r.courierCost === 0).length,
  };
};

/** One week: its rows and its totals. */
export const buildWeeklyReport = async (weekStartInput?: string | Date | null) => {
  const weekStart = resolveWeekStart(weekStartInput);
  const weekEnd = weekEndOf(weekStart);
  const rows = await buildRows(weekStart, weekEnd);
  return { weekStart, weekEnd, rows, summary: summarize(weekStart, rows) };
};

/**
 * Every week from `weeks` weeks ago to today, newest first — the index the
 * report screen lists, one downloadable CSV per entry. Weeks with no orders are
 * included so a blank week is visibly blank rather than missing.
 */
export const buildWeekIndex = async (weeks = 26): Promise<WeeklySummary[]> => {
  const currentWeekStart = weekStartOf(new Date());
  const span = Math.max(1, Math.min(Math.trunc(weeks) || 26, 104));
  const firstWeekStart = new Date(currentWeekStart.getTime() - (span - 1) * WEEK_MS);

  // Totals only — the descriptive joins are skipped; the CSV/detail call makes them.
  const rows = await buildRows(firstWeekStart, weekEndOf(currentWeekStart), false);
  const byWeek = new Map<string, WeeklyAccountRow[]>();
  for (const r of rows) {
    const list = byWeek.get(r.weekKey);
    if (list) list.push(r);
    else byWeek.set(r.weekKey, [r]);
  }

  const out: WeeklySummary[] = [];
  for (let i = 0; i < span; i++) {
    const weekStart = new Date(currentWeekStart.getTime() - i * WEEK_MS);
    out.push(summarize(weekStart, byWeek.get(weekKeyOf(weekStart)) || []));
  }
  return out;
};

// ── CSV ─────────────────────────────────────────────────────────────────────

const csvCell = (value: any): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'YES' : 'NO';
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const CSV_COLUMNS: { header: string; pick: (r: WeeklyAccountRow) => any }[] = [
  { header: 'Week', pick: (r) => r.weekLabel },
  { header: 'Order Date (IST)', pick: (r) => r.orderDate },
  { header: 'Order Ref', pick: (r) => r.orderRef },
  { header: 'Order ID', pick: (r) => r.orderId },
  { header: 'Channel', pick: (r) => r.channel },
  { header: 'Order Status', pick: (r) => r.orderStatus },
  { header: 'Split Shipment', pick: (r) => r.splitShipment },

  { header: 'Customer', pick: (r) => r.customerName },
  { header: 'Customer Phone', pick: (r) => r.customerPhone },
  { header: 'City', pick: (r) => r.customerCity },
  { header: 'Pincode', pick: (r) => r.customerPincode },

  { header: 'Vendor', pick: (r) => r.vendorName },
  { header: 'Vendor Type', pick: (r) => r.vendorType },
  { header: 'Vendor Shop', pick: (r) => r.vendorShop },
  { header: 'Vendor Phone', pick: (r) => r.vendorPhone },

  { header: 'Products (sold rate | vendor rate)', pick: (r) => r.products },
  { header: 'Items', pick: (r) => r.itemCount },
  { header: 'Total Qty', pick: (r) => r.totalQty },
  { header: 'Vendor Cost Quoted', pick: (r) => r.vendorQuotedCost },
  { header: 'Vendor Cost Accepted', pick: (r) => r.vendorAcceptedCost },
  { header: 'Rate Adjusted By Vendor', pick: (r) => r.priceAdjusted },

  { header: 'Goods Amount', pick: (r) => r.goodsAmount },
  { header: 'Discount', pick: (r) => r.discount },
  { header: 'Delivery Charge Billed', pick: (r) => r.deliveryCharged },
  { header: 'Platform Fee Billed', pick: (r) => r.platformFeeCharged },
  { header: 'Order Total (customer pays)', pick: (r) => r.orderTotal },

  { header: 'Payment Status', pick: (r) => r.paymentStatus },
  { header: 'Payment Received', pick: (r) => r.paymentReceived },
  { header: 'Payment ID', pick: (r) => r.paymentId },
  { header: 'Razorpay Order ID', pick: (r) => r.razorpayOrderId },
  { header: 'Delivery Charge Received', pick: (r) => r.deliveryChargeReceived },
  { header: 'Platform Fee Received', pick: (r) => r.platformFeeReceived },

  { header: `Razorpay Fee (${GATEWAY_FEE_PERCENT}%)`, pick: (r) => r.gatewayFee },
  { header: `GST on Fee (${GATEWAY_FEE_GST_PERCENT}%)`, pick: (r) => r.gatewayFeeGst },
  { header: 'Razorpay Deduction', pick: (r) => r.gatewayDeduction },
  { header: 'Net Received From Razorpay', pick: (r) => r.netReceived },

  { header: 'Shipped', pick: (r) => r.shipped },
  { header: 'Shipped On (IST)', pick: (r) => r.shippedOn },
  { header: 'Courier', pick: (r) => r.courierName },
  { header: 'Tracking ID', pick: (r) => r.trackingId },
  { header: 'Courier Cost', pick: (r) => r.courierCost },
  { header: 'Courier Arranged By', pick: (r) => r.courierArrangedBy },
  { header: 'Courier Cost On Petmaza', pick: (r) => r.courierCostOnPetmaza },
  { header: 'Courier Reimbursed To Vendor', pick: (r) => r.courierReimbursedToVendor },
  { header: 'Delivery Margin', pick: (r) => r.deliveryMargin },
  { header: 'Delivered On (IST)', pick: (r) => r.deliveredOn },

  { header: 'Vendor Product Payout', pick: (r) => r.vendorProductPayout },
  { header: 'Vendor Total Payout', pick: (r) => r.vendorTotalPayout },
  { header: 'Vendor Payout Status', pick: (r) => r.vendorPayoutStatus },
  { header: 'Vendor Paid On', pick: (r) => r.vendorPaidOn },
  { header: 'Vendor Payment Ref', pick: (r) => r.vendorPaymentRef },

  { header: 'NET PROFIT', pick: (r) => r.netProfit },
  { header: 'Profit Ratio %', pick: (r) => (r.profitRatio == null ? '' : r.profitRatio) },
  { header: 'Counted In Totals', pick: (r) => r.countedInTotals },
  { header: 'Test Order', pick: (r) => r.testOrder },
  { header: 'Notes', pick: (r) => r.notes },
];

/**
 * The week as a CSV: the header row first so any spreadsheet or script can read
 * it straight, then a blank line and a labelled summary block underneath.
 * Prefixed with a UTF-8 BOM so Excel renders ₹ instead of mojibake.
 */
export const toCsv = (rows: WeeklyAccountRow[], summary: WeeklySummary): string => {
  const lines: string[] = [];
  lines.push(CSV_COLUMNS.map((c) => csvCell(c.header)).join(','));
  for (const r of rows) lines.push(CSV_COLUMNS.map((c) => csvCell(c.pick(r))).join(','));

  const s = summary;
  const block: [string, any][] = [
    ['WEEK', s.weekLabel],
    ['Orders placed', s.orders],
    ['Paid orders (counted below)', s.paidOrders],
    ['Unpaid / Failed / Refunded / Cancelled', `${s.unpaidOrders} / ${s.failedOrders} / ${s.refundedOrders} / ${s.cancelledOrders}`],
    ['₹1 test orders excluded', s.testOrders],
    ['', ''],
    ['MONEY IN (paid orders)', ''],
    ['Goods sold', s.goodsAmount],
    ['Discounts given', -s.discount],
    ['Delivery charge collected', s.deliveryCharged],
    ['Platform fee collected', s.platformFeeCharged],
    ['Customer paid (total)', s.customerPaid],
    ['', ''],
    ['GATEWAY', ''],
    [`Razorpay fee (${GATEWAY_FEE_PERCENT}%)`, -s.gatewayFee],
    [`GST on fee (${GATEWAY_FEE_GST_PERCENT}%)`, -s.gatewayFeeGst],
    ['Total deducted by Razorpay', -s.gatewayDeduction],
    ['NET RECEIVED IN BANK', s.netReceived],
    ['', ''],
    ['MONEY OUT', ''],
    ['Vendor product payout', -s.vendorProductPayout],
    ['Courier reimbursed to vendors', -s.courierReimbursedToVendor],
    ['Total payable to vendors', -s.vendorTotalPayout],
    ['  of which already settled', s.vendorPayoutSettled],
    ['  of which still pending', s.vendorPayoutPending],
    ['Courier paid by Petmaza directly', -s.courierCostOnPetmaza],
    ['', ''],
    ['Delivery margin (collected − couriers)', s.deliveryMargin],
    ['NET PROFIT', s.netProfit],
    ['PROFIT RATIO %', s.profitRatio == null ? '' : s.profitRatio],
    ['', ''],
    ['Shipped orders missing a courier cost', s.missingCourierCost],
    ['Note', s.missingCourierCost > 0 ? 'Real profit is LOWER by whatever those shipments cost.' : 'All shipped orders have a courier cost on record.'],
  ];

  lines.push('');
  lines.push('SUMMARY,Amount (INR)');
  for (const [label, value] of block) lines.push(`${csvCell(label)},${csvCell(value)}`);

  return '﻿' + lines.join('\r\n');
};

/** petmaza-accounts-2026-07-19-to-2026-07-25.csv */
export const csvFileName = (weekStart: Date): string => {
  const end = istWall(weekEndOf(weekStart)).toISOString().slice(0, 10);
  return `petmaza-accounts-${weekKeyOf(weekStart)}-to-${end}.csv`;
};
