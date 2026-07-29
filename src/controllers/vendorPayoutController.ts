/**
 * vendorPayoutController
 *
 * Daily, order-based vendor settlement — replaces the Mon–Sun weekly invoice.
 *
 * Pending payouts are never stored: they are derived live from orders through
 * VendorPayoutService, so a price correction or a courier cost entered late is
 * always reflected. Paying writes a VendorPayout snapshot, which freezes the
 * amount and (via the unique order+vendor index) makes a second payment for the
 * same order impossible — including from the legacy weekly screen.
 */

import { Response, NextFunction } from 'express';
import Order from '../models/Order';
import ShippingDetails from '../models/ShippingDetails';
import VendorPayout from '../models/VendorPayout';
import { AuthRequest } from '../middlewares/auth';
import { AppError } from '../middlewares/errorHandler';
import logger from '../config/logger';
import {
  PAYABLE_STATUSES,
  computeOrderPayouts,
  computeVendorPayoutForOrder,
  payableDateOf,
  dayKeyOf,
  ShippingDetailsLike,
} from '../services/VendorPayoutService';

const DEFAULT_WINDOW_DAYS = 30;

const vendorTypeLabel = (vendorType?: string): string => {
  switch (vendorType) {
    case 'PRIME':
      return 'Prime Vendor';
    case 'MY_SHOP':
      return 'My Shop';
    case 'WAREHOUSE_FULFILLER':
      return 'Fulfiller';
    case 'QUICK':
      return 'Quick Shop';
    default:
      return vendorType || 'Vendor';
  }
};

const dayLabel = (date: Date): string => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
};

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const endOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

/**
 * GET /admin/vendor-daily-payouts
 *
 * Query: from, to (YYYY-MM-DD), date (single day shorthand), vendorId,
 *        status (Pending | Paid | Partially Paid)
 *
 * Returns one group per vendor per day, each holding the orders payable that
 * day with a product-wise breakdown.
 */
export const getVendorDailyPayouts = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { from, to, date, vendorId, status } = req.query as Record<string, string>;

    // Resolve the reporting window. `date` is shorthand for a single day.
    let rangeStart: Date;
    let rangeEnd: Date;
    if (date) {
      rangeStart = startOfDay(new Date(date));
      rangeEnd = endOfDay(new Date(date));
    } else {
      rangeEnd = to ? endOfDay(new Date(to)) : endOfDay(new Date());
      rangeStart = from
        ? startOfDay(new Date(from))
        : startOfDay(new Date(rangeEnd.getTime() - DEFAULT_WINDOW_DAYS * 24 * 60 * 60 * 1000));
    }
    if (isNaN(rangeStart.getTime()) || isNaN(rangeEnd.getTime())) {
      return next(new AppError('Invalid date range', 400));
    }

    // Everything that has shipped. Failed/refunded payments are never payable;
    // unpaid-but-shipped orders are included and flagged so an admin can see
    // exactly what they are about to pay for.
    const orderFilter: any = {
      status: { $in: PAYABLE_STATUSES },
      payment_status: { $nin: ['Failed', 'Refunded'] },
    };

    const orders = await Order.find(orderFilter)
      .populate('assignedVendorId', 'name email phone vendorType')
      .populate('items.vendor_id', 'name email phone vendorType')
      .populate('items.product_id', 'name images')
      .populate('items.primeProduct_id', 'name images')
      .populate('customer_id', 'name email phone')
      .sort({ updatedAt: -1 })
      .lean();

    const shippingDocs = await ShippingDetails.find({
      order_id: { $in: orders.map((o) => o._id) },
    })
      .select('order_id vendor_id shipping_cost shipping_arranged_by created_at')
      .lean();
    const shippingByOrder = new Map<string, ShippingDetailsLike>(
      shippingDocs.map((sd) => [sd.order_id.toString(), sd as unknown as ShippingDetailsLike])
    );

    // Already-settled payouts, keyed order+vendor.
    const paidPayouts = await VendorPayout.find({
      order_id: { $in: orders.map((o) => o._id) },
    })
      .populate('paidBy', 'name email')
      .lean();
    const paidByOrderVendor = new Map<string, any>(
      paidPayouts.map((p) => [`${p.order_id.toString()}_${p.vendor_id.toString()}`, p])
    );

    // Vendor display info: prefer the populated per-item vendor, fall back to
    // the order-level assigned vendor for legacy orders.
    const vendorInfo = new Map<string, any>();
    for (const order of orders) {
      const assigned = order.assignedVendorId as any;
      if (assigned?._id) vendorInfo.set(assigned._id.toString(), assigned);
      for (const item of (order as any).items || []) {
        const v = item.vendor_id;
        if (v?._id) vendorInfo.set(v._id.toString(), v);
      }
    }

    const groups = new Map<string, any>();

    for (const order of orders) {
      const shippingDoc = shippingByOrder.get(order._id.toString()) || null;
      const payableAt = payableDateOf(order, shippingDoc);
      if (payableAt < rangeStart || payableAt > rangeEnd) continue;

      const breakdowns = computeOrderPayouts(order, shippingDoc);

      for (const payout of breakdowns) {
        if (vendorId && payout.vendorId !== String(vendorId)) continue;

        const dayKey = dayKeyOf(payableAt);
        const groupKey = `${payout.vendorId}_${dayKey}`;
        const settled = paidByOrderVendor.get(`${order._id.toString()}_${payout.vendorId}`);

        if (!groups.has(groupKey)) {
          const vendor = vendorInfo.get(payout.vendorId);
          groups.set(groupKey, {
            id: groupKey,
            date: dayKey,
            dateLabel: dayLabel(payableAt),
            vendorId: payout.vendorId,
            vendorName: vendor?.name || 'Unknown Vendor',
            vendorEmail: vendor?.email || null,
            vendorPhone: vendor?.phone || null,
            vendorType: vendorTypeLabel(vendor?.vendorType),
            totalAmount: 0,
            productAmount: 0,
            shippingReimbursement: 0,
            pendingAmount: 0,
            paidAmount: 0,
            status: 'Pending',
            orders: [],
          });
        }

        const group = groups.get(groupKey);
        // A settled payout reports its frozen figures, not today's recomputation.
        const amount = settled ? settled.totalAmount : payout.totalAmount;
        const productAmount = settled ? settled.productAmount : payout.productAmount;
        const reimbursement = settled ? settled.shippingReimbursement : payout.shippingReimbursement;

        group.totalAmount += amount;
        group.productAmount += productAmount;
        group.shippingReimbursement += reimbursement;
        if (settled) group.paidAmount += amount;
        else group.pendingAmount += amount;

        group.orders.push({
          orderId: order._id.toString(),
          orderRef: order._id.toString().slice(-8).toUpperCase(),
          orderDate: order.createdAt,
          shippedAt: shippingDoc?.created_at || null,
          payableDate: dayKey,
          orderStatus: order.status,
          paymentStatus: (order as any).payment_status || 'Pending',
          customerName: (order.customer_id as any)?.name || null,
          items: payout.items,
          productAmount,
          // Null until courier details are filed — the admin sees "not shipped
          // details yet" rather than a misleading ₹0 vendor cost.
          shippingArrangedBy: payout.shippingArrangedBy,
          shippingCost: payout.shippingCost,
          shippingReimbursement: reimbursement,
          totalAmount: amount,
          status: settled ? 'Paid' : 'Pending',
          paidAt: settled?.paidAt || null,
          paidBy: settled?.paidBy?.name || null,
          paymentMethod: settled?.paymentMethod || null,
          paymentReference: settled?.paymentReference || null,
        });
      }
    }

    let result = [...groups.values()].map((group) => {
      const paidCount = group.orders.filter((o: any) => o.status === 'Paid').length;
      group.status =
        paidCount === 0 ? 'Pending' : paidCount === group.orders.length ? 'Paid' : 'Partially Paid';
      return group;
    });

    if (status) result = result.filter((g) => g.status === status);

    // Newest day first, then largest outstanding amount.
    result.sort((a, b) =>
      a.date === b.date ? b.pendingAmount - a.pendingAmount : a.date < b.date ? 1 : -1
    );

    const summary = result.reduce(
      (acc, g) => {
        acc.totalAmount += g.totalAmount;
        acc.pendingAmount += g.pendingAmount;
        acc.paidAmount += g.paidAmount;
        return acc;
      },
      { totalAmount: 0, pendingAmount: 0, paidAmount: 0, groups: 0 }
    );
    summary.groups = result.length;

    res.status(200).json({
      success: true,
      data: result,
      summary,
      range: { from: rangeStart.toISOString(), to: rangeEnd.toISOString() },
    });
  } catch (error: any) {
    logger.error('[getVendorDailyPayouts] Error:', error);
    next(error);
  }
};

/**
 * POST /admin/vendor-daily-payouts/mark-paid
 *
 * Body: { vendorId, orderIds: string[], paymentMethod?, paymentReference?, notes? }
 *
 * Freezes a payout per order. Orders already settled for this vendor are
 * skipped rather than erroring, so a double-tap or a retry is harmless.
 */
export const markDailyPayoutPaid = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { vendorId, orderIds, paymentMethod, paymentReference, notes } = req.body;

    if (!vendorId || !/^[a-f\d]{24}$/i.test(String(vendorId))) {
      return next(new AppError('A valid vendorId is required', 400));
    }
    const ids = (Array.isArray(orderIds) ? orderIds : []).filter((id: any) =>
      /^[a-f\d]{24}$/i.test(String(id))
    );
    if (!ids.length) {
      return next(new AppError('At least one valid orderId is required', 400));
    }

    const orders = await Order.find({ _id: { $in: ids } })
      .populate('items.product_id', 'name')
      .populate('items.primeProduct_id', 'name');
    if (!orders.length) {
      return next(new AppError('No matching orders found', 404));
    }

    const shippingDocs = await ShippingDetails.find({ order_id: { $in: ids } })
      .select('order_id vendor_id shipping_cost shipping_arranged_by created_at')
      .lean();
    const shippingByOrder = new Map<string, ShippingDetailsLike>(
      shippingDocs.map((sd) => [sd.order_id.toString(), sd as unknown as ShippingDetailsLike])
    );

    const paidAt = new Date();
    const created: any[] = [];
    const skipped: { orderId: string; reason: string }[] = [];

    for (const order of orders) {
      const orderId = order._id.toString();

      if (!PAYABLE_STATUSES.includes(order.status as any)) {
        skipped.push({ orderId, reason: `Order is ${order.status} — not payable` });
        continue;
      }

      const shippingDoc = shippingByOrder.get(orderId) || null;
      const payout = computeVendorPayoutForOrder(order, String(vendorId), shippingDoc);
      if (!payout) {
        skipped.push({ orderId, reason: 'Vendor has no items on this order' });
        continue;
      }

      try {
        const doc = await VendorPayout.create({
          order_id: order._id,
          vendor_id: vendorId,
          items: payout.items.map((i) => ({
            product_id: /^[a-f\d]{24}$/i.test(i.productId) ? i.productId : undefined,
            productName: i.productName,
            quantity: i.quantity,
            purchasePrice: i.purchasePrice,
            purchaseSubtotal: i.purchaseSubtotal,
          })),
          productAmount: payout.productAmount,
          shippingArrangedBy: payout.shippingArrangedBy,
          shippingCost: payout.shippingCost,
          shippingReimbursement: payout.shippingReimbursement,
          totalAmount: payout.totalAmount,
          payableDate: payableDateOf(order, shippingDoc),
          status: 'paid',
          paidAt,
          paidBy: req.user._id,
          paymentMethod,
          paymentReference,
          notes,
        });
        created.push(doc);
      } catch (err: any) {
        // Unique (order_id, vendor_id) — already settled elsewhere.
        if (err?.code === 11000) {
          skipped.push({ orderId, reason: 'Already paid' });
          continue;
        }
        throw err;
      }
    }

    const totalPaid = created.reduce((sum, p) => sum + p.totalAmount, 0);

    // Refresh the cached wallet — the balance is derived from unpaid payouts,
    // so the records just written drop out of it automatically.
    if (created.length) {
      try {
        const { WalletService } = await import('../services/WalletService');
        await WalletService.resetWallet(String(vendorId));
      } catch (walletError: any) {
        // Non-blocking: the payout record is the source of truth, not the wallet.
        logger.error('[markDailyPayoutPaid] Wallet refresh failed:', walletError.message);
      }
    }

    logger.info(
      `[markDailyPayoutPaid] vendor=${vendorId} paid=${created.length} skipped=${skipped.length} total=₹${totalPaid} by ${req.user._id}`
    );

    res.status(200).json({
      success: true,
      message: `${created.length} order payout(s) marked paid${
        skipped.length ? `, ${skipped.length} skipped` : ''
      }`,
      data: { paidCount: created.length, totalPaid, skipped, paidAt },
    });
  } catch (error: any) {
    logger.error('[markDailyPayoutPaid] Error:', error.message);
    next(error);
  }
};

/**
 * GET /admin/vendor-daily-payouts/history
 * Settled payouts, newest first — the audit trail of what was actually paid.
 */
export const getVendorPayoutHistory = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { vendorId, from, to, limit } = req.query as Record<string, string>;

    const query: any = {};
    if (vendorId && /^[a-f\d]{24}$/i.test(vendorId)) query.vendor_id = vendorId;
    if (from || to) {
      query.paidAt = {};
      if (from) query.paidAt.$gte = startOfDay(new Date(from));
      if (to) query.paidAt.$lte = endOfDay(new Date(to));
    }

    const payouts = await VendorPayout.find(query)
      .populate('vendor_id', 'name email phone vendorType')
      .populate('paidBy', 'name email')
      .sort({ paidAt: -1 })
      .limit(Math.min(Number(limit) || 200, 500))
      .lean();

    res.status(200).json({
      success: true,
      data: payouts.map((p) => ({
        id: p._id,
        orderId: p.order_id,
        orderRef: p.order_id.toString().slice(-8).toUpperCase(),
        vendorId: (p.vendor_id as any)?._id || p.vendor_id,
        vendorName: (p.vendor_id as any)?.name || 'Unknown Vendor',
        vendorType: vendorTypeLabel((p.vendor_id as any)?.vendorType),
        items: p.items,
        productAmount: p.productAmount,
        shippingArrangedBy: p.shippingArrangedBy,
        shippingReimbursement: p.shippingReimbursement,
        totalAmount: p.totalAmount,
        payableDate: p.payableDate,
        paidAt: p.paidAt,
        paidBy: (p.paidBy as any)?.name || null,
        paymentMethod: p.paymentMethod || null,
        paymentReference: p.paymentReference || null,
        notes: p.notes || null,
      })),
    });
  } catch (error: any) {
    logger.error('[getVendorPayoutHistory] Error:', error);
    next(error);
  }
};
