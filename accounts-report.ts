/**
 * Read-only accounts / profitability report.
 *
 * For every order ever placed: what the customer paid (goods + delivery charge +
 * platform fee), what the vendor is owed (goods purchase cost + the courier cost
 * the vendor actually paid), and what PETMAZA keeps.
 *
 *   npx ts-node --transpile-only accounts-report.ts
 *
 * Writes accounts-report-<date>.csv next to the script (REPORT_OUT_DIR overrides).
 * NEVER writes to the database - .find() / .lean() only.
 *
 * ₹1 promotional test checkouts are excluded from all revenue math (PROMO_MAX).
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import Order from './src/models/Order';
import ShippingDetails from './src/models/ShippingDetails';
import User from './src/models/User';

dotenv.config();

// Orders at or below this value are promotional / test checkouts, not real trade.
const PROMO_MAX = 1;

// Statuses where the goods actually moved - these are the orders money is owed on.
const FULFILLED = ['PACKED', 'READY_TO_SHIP', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED'];

const inr = (n: number) => `₹${(Math.round(n * 100) / 100).toLocaleString('en-IN')}`;
const pct = (num: number, den: number) => (den === 0 ? '—' : `${((num / den) * 100).toFixed(1)}%`);

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI!);

  const orders = await Order.find({}).sort({ createdAt: 1 }).lean();
  const shippingDocs = await ShippingDetails.find({}).lean();
  const users = await User.find({}).select('name email role').lean();

  const shipByOrder = new Map(shippingDocs.map((s: any) => [String(s.order_id), s]));
  const userById = new Map(users.map((u: any) => [String(u._id), u]));
  const nameOf = (id: any) => (id ? userById.get(String(id))?.name || String(id).slice(-6) : '—');

  const rows: any[] = [];

  for (const o of orders as any[]) {
    const revenue = Number(o.grandTotal ?? o.total) || 0;
    const goodsRevenue =
      Number(o.subtotalBeforeCharges) > 0
        ? Number(o.subtotalBeforeCharges)
        : (o.items || []).reduce(
            (s: number, it: any) => s + (Number(it.subtotal) || (Number(it.sellingPrice) || 0) * (it.quantity || 1)),
            0
          );

    // Vendor's goods cost. totalPurchasePrice is authoritative; fall back to item sum.
    const goodsCost =
      Number(o.totalPurchasePrice) > 0
        ? Number(o.totalPurchasePrice)
        : (o.items || []).reduce(
            (s: number, it: any) =>
              s + (Number(it.purchaseSubtotal) || (Number(it.purchasePrice) || 0) * (it.quantity || 1)),
            0
          );

    const ship = shipByOrder.get(String(o._id));
    const hasShipDoc = !!ship;
    const courierRecorded = ship && ship.shipping_cost != null && Number(ship.shipping_cost) > 0;
    const courierCost = courierRecorded ? Number(ship.shipping_cost) : 0;

    const deliveryCollected = Number(o.shippingCharges) || 0;
    const platformFee = Number(o.platformFee) || 0;
    const discount = Number(o.discountAmount) || 0;

    const vendorPayout = goodsCost + courierCost;
    const net = revenue - vendorPayout;

    // Which vendor is owed: order-level assignment, else the first item's vendor.
    const vendorId = o.assignedVendorId || (o.items || []).find((it: any) => it.vendor_id)?.vendor_id;

    const status = String(o.status || '').toUpperCase();
    const paid = o.payment_status === 'Paid';
    const isPromo = revenue <= PROMO_MAX;
    const counts = paid && FULFILLED.includes(status) && !isPromo;

    rows.push({
      date: o.createdAt ? new Date(o.createdAt).toISOString().slice(0, 10) : '',
      id: String(o._id),
      customer: nameOf(o.customer_id),
      vendor: nameOf(vendorId),
      status,
      payment: o.payment_status,
      goodsRevenue,
      deliveryCollected,
      platformFee,
      discount,
      revenue,
      goodsCost,
      courierCost,
      hasShipDoc,
      courierRecorded,
      vendorPayout,
      net,
      isPromo,
      counts,
      splitKey: o.razorpay_order_id || '',
    });
  }

  // ── Console summary ──────────────────────────────────────────────────────
  const promo = rows.filter((r) => r.isPromo);
  const real = rows.filter((r) => !r.isPromo);
  const billable = rows.filter((r) => r.counts);
  const missingCourier = billable.filter((r) => !r.courierRecorded);

  const sum = (arr: any[], k: string) => arr.reduce((s, r) => s + (Number(r[k]) || 0), 0);

  console.log('\n══════════ PETMAZA ACCOUNTS REPORT ══════════');
  console.log(`Generated: ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`);
  console.log(`Orders in DB: ${rows.length}  |  ₹1 promo excluded: ${promo.length}  |  real orders: ${real.length}`);
  console.log(`Billable (Paid + fulfilled + non-promo): ${billable.length}\n`);

  console.log('── REVENUE (billable orders) ──');
  console.log(`  Goods sold to customer   : ${inr(sum(billable, 'goodsRevenue'))}`);
  console.log(`  Delivery charge collected: ${inr(sum(billable, 'deliveryCollected'))}`);
  console.log(`  Platform fee collected   : ${inr(sum(billable, 'platformFee'))}`);
  console.log(`  Discounts given          : -${inr(sum(billable, 'discount'))}`);
  console.log(`  TOTAL REVENUE            : ${inr(sum(billable, 'revenue'))}`);

  console.log('\n── COST ──');
  console.log(`  Goods purchase cost      : ${inr(sum(billable, 'goodsCost'))}`);
  console.log(`  Courier paid (recorded)  : ${inr(sum(billable, 'courierCost'))}`);
  console.log(`  TOTAL VENDOR PAYOUT      : ${inr(sum(billable, 'vendorPayout'))}`);

  const rev = sum(billable, 'revenue');
  const netTotal = sum(billable, 'net');
  console.log('\n── PROFIT ──');
  console.log(`  Gross margin on goods    : ${inr(sum(billable, 'goodsRevenue') - sum(billable, 'goodsCost'))}`);
  console.log(`  NET (before Razorpay fee): ${inr(netTotal)}   margin ${pct(netTotal, rev)}`);
  console.log(`  Razorpay ~2% + GST est.  : -${inr(rev * 0.0236)}`);
  console.log(`  NET after gateway        : ${inr(netTotal - rev * 0.0236)}`);

  const delColl = sum(billable, 'deliveryCollected');
  const courPaid = sum(billable, 'courierCost');
  console.log('\n── DELIVERY ECONOMICS ──');
  console.log(`  Collected from customers : ${inr(delColl)}`);
  console.log(`  Paid to couriers         : ${inr(courPaid)}`);
  console.log(`  SHORTFALL absorbed       : ${inr(delColl - courPaid)}`);

  if (missingCourier.length) {
    console.log(`\n⚠  ${missingCourier.length} billable order(s) have NO courier cost recorded.`);
    console.log('   Real profit is LOWER than the figure above by whatever these cost.');
    missingCourier.forEach((r) =>
      console.log(`     ${r.date}  ${r.id.slice(-6)}  ${r.customer} → ${r.vendor}  rev ${inr(r.revenue)}  ${r.hasShipDoc ? '(ship doc exists, cost blank)' : '(no shipping doc at all)'}`)
    );
  }

  // Per-vendor payout
  console.log('\n── PAYOUT BY VENDOR (billable) ──');
  const byVendor = new Map<string, any>();
  billable.forEach((r) => {
    const v = byVendor.get(r.vendor) || { orders: 0, goods: 0, courier: 0, payout: 0, revenue: 0 };
    v.orders++; v.goods += r.goodsCost; v.courier += r.courierCost; v.payout += r.vendorPayout; v.revenue += r.revenue;
    byVendor.set(r.vendor, v);
  });
  [...byVendor.entries()].sort((a, b) => b[1].payout - a[1].payout).forEach(([name, v]) =>
    console.log(`  ${name.padEnd(22)} ${String(v.orders).padStart(2)} ord  goods ${inr(v.goods).padStart(9)}  courier ${inr(v.courier).padStart(8)}  → PAY ${inr(v.payout)}`)
  );

  console.log('\n── EXCLUDED ₹1 PROMO ORDERS ──');
  console.log(`  ${promo.length} order(s), total ${inr(sum(promo, 'revenue'))} — not counted anywhere above.`);

  // ── CSV ──────────────────────────────────────────────────────────────────
  const outDir = process.env.REPORT_OUT_DIR || __dirname;
  const stamp = new Date().toISOString().slice(0, 10);
  const csvPath = path.join(outDir, `accounts-report-${stamp}.csv`);
  const header = [
    'Date', 'OrderID', 'Customer', 'Vendor', 'Status', 'Payment',
    'GoodsRevenue', 'DeliveryCharged', 'PlatformFee', 'Discount', 'TotalPaidByCustomer',
    'GoodsCost', 'CourierCostPaid', 'CourierRecorded', 'VendorPayout', 'PlatformNet',
    'CountedInTotals', 'PromoOrder', 'RazorpayOrderId',
  ].join(',');
  const lines = rows.map((r) =>
    [
      r.date, r.id, `"${r.customer}"`, `"${r.vendor}"`, r.status, r.payment,
      r.goodsRevenue, r.deliveryCollected, r.platformFee, r.discount, r.revenue,
      r.goodsCost, r.courierCost, r.courierRecorded ? 'YES' : 'NO', r.vendorPayout, r.net,
      r.counts ? 'YES' : 'NO', r.isPromo ? 'YES' : 'NO', r.splitKey,
    ].join(',')
  );
  fs.writeFileSync(csvPath, [header, ...lines].join('\n'));
  console.log(`\n✔ CSV written: ${csvPath}`);

  await mongoose.connection.close();
  process.exit(0);
};

run().catch((e) => { console.error(e); process.exit(1); });
