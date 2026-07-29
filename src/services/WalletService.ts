import Wallet from '../models/Wallet';
import Order from '../models/Order';
import ShippingDetails from '../models/ShippingDetails';
import VendorPayout from '../models/VendorPayout';
import {
  PAYABLE_STATUSES,
  computeVendorPayoutForOrder,
  ShippingDetailsLike,
} from './VendorPayoutService';

/**
 * WalletService
 *
 * A vendor's wallet balance is DERIVED, never accumulated: it is the sum of the
 * payouts they have earned (shipped orders, their line items, plus courier cost
 * only when they arranged the courier) minus the payouts already settled in
 * VendorPayout. Incremental credit/debit drifts the moment an order is edited,
 * cancelled or paid from a different screen; deriving cannot.
 *
 * The Wallet document is kept as a cache so existing readers still work.
 */
export class WalletService {
  // Get or create wallet for vendor
  static async getOrCreateWallet(vendor_id: string) {
    let wallet = await Wallet.findOne({ vendor_id });

    if (!wallet) {
      wallet = await Wallet.create({
        vendor_id,
        balance: 0,
        totalEarnings: 0,
      });
    }

    return wallet;
  }

  /**
   * Recompute what the vendor is owed right now.
   * Returns lifetime earnings, the unpaid balance, and the settled total.
   */
  static async computeOutstanding(vendor_id: string) {
    const orders = await Order.find({
      status: { $in: PAYABLE_STATUSES },
      payment_status: { $nin: ['Failed', 'Refunded'] },
      $or: [
        { 'items.vendor_id': vendor_id },
        { assignedVendorId: vendor_id },
        { assignedVendors: vendor_id },
      ],
    }).lean();

    const shippingDocs = await ShippingDetails.find({
      order_id: { $in: orders.map((o) => o._id) },
    })
      .select('order_id vendor_id shipping_cost shipping_arranged_by created_at')
      .lean();
    const shippingByOrder = new Map<string, ShippingDetailsLike>(
      shippingDocs.map((sd) => [sd.order_id.toString(), sd as unknown as ShippingDetailsLike])
    );

    const settled = await VendorPayout.find({ vendor_id }).select('order_id totalAmount').lean();
    const settledOrderIds = new Set(settled.map((p) => p.order_id.toString()));
    const paidTotal = settled.reduce((sum, p) => sum + (Number(p.totalAmount) || 0), 0);

    let totalEarnings = 0;
    let balance = 0;
    let pendingOrders = 0;

    for (const order of orders) {
      const payout = computeVendorPayoutForOrder(
        order,
        vendor_id,
        shippingByOrder.get(order._id.toString()) || null
      );
      if (!payout) continue;

      totalEarnings += payout.totalAmount;
      if (!settledOrderIds.has(order._id.toString())) {
        balance += payout.totalAmount;
        pendingOrders += 1;
      }
    }

    return { balance, totalEarnings, paidTotal, pendingOrders };
  }

  /**
   * Kept for backwards compatibility. Balances are derived now, so this only
   * refreshes the cached document rather than adding to a running total.
   */
  static async addEarnings(vendor_id: string, _order_id: string, _amount: number) {
    return this.getWalletBalance(vendor_id);
  }

  // Get wallet balance (recomputed, then cached on the document)
  static async getWalletBalance(vendor_id: string) {
    const wallet = await this.getOrCreateWallet(vendor_id);
    const { balance, totalEarnings } = await this.computeOutstanding(vendor_id);

    wallet.balance = balance;
    wallet.totalEarnings = totalEarnings;
    await wallet.save();

    return wallet;
  }

  /**
   * Refresh the cached balance after a payout was recorded. The balance falls
   * out of the VendorPayout records themselves, so there is nothing to zero.
   */
  static async resetWallet(vendor_id: string) {
    const wallet = await this.getWalletBalance(vendor_id);
    wallet.lastBillingDate = new Date();
    await wallet.save();
    return wallet;
  }

  /**
   * Vendor earnings over a period — same product-wise, shipping-aware math as
   * the payout screens, so a vendor's app and the admin's payout list agree.
   */
  static async getVendorEarnings(vendor_id: string, startDate?: Date, endDate?: Date) {
    const query: any = {
      status: { $in: PAYABLE_STATUSES },
      payment_status: { $nin: ['Failed', 'Refunded'] },
      $or: [
        { 'items.vendor_id': vendor_id },
        { assignedVendorId: vendor_id },
        { assignedVendors: vendor_id },
      ],
    };

    if (startDate || endDate) {
      query.updatedAt = {};
      if (startDate) query.updatedAt.$gte = startDate;
      if (endDate) query.updatedAt.$lte = endDate;
    }

    const orders = await Order.find(query);

    const shippingDocs = await ShippingDetails.find({
      order_id: { $in: orders.map((o) => o._id) },
    })
      .select('order_id vendor_id shipping_cost shipping_arranged_by created_at')
      .lean();
    const shippingByOrder = new Map<string, ShippingDetailsLike>(
      shippingDocs.map((sd) => [sd.order_id.toString(), sd as unknown as ShippingDetailsLike])
    );

    let totalEarnings = 0;
    let shippingReimbursed = 0;
    const billableOrders: any[] = [];

    for (const order of orders) {
      const payout = computeVendorPayoutForOrder(
        order,
        vendor_id,
        shippingByOrder.get(order._id.toString()) || null
      );
      if (!payout) continue;
      totalEarnings += payout.totalAmount;
      shippingReimbursed += payout.shippingReimbursement;
      billableOrders.push(order);
    }

    return {
      orders: billableOrders.length,
      totalEarnings,
      shippingReimbursed,
      ordersList: billableOrders,
    };
  }
}
