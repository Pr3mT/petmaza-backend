/**
 * orderMaintenance.ts
 * Cancels abandoned unpaid orders so they don't linger looking "placed".
 *
 * An order is created unpaid at checkout; if the customer never completes payment
 * it would otherwise sit forever. We cancel such orders after
 * UNPAID_ORDER_TTL_MINUTES (default 60).
 *
 * Status scope: PENDING (awaiting vendor accept) AND ACCEPTED — MY_SHOP vendors
 * auto-accept orders at creation (before payment), so an abandoned MY_SHOP order
 * sits in ACCEPTED while still unpaid. Both are pre-fulfilment states; vendors are
 * only notified after payment, so an unpaid order is never actually being worked.
 * Paid orders are never touched (payment_status !== 'Paid' guard). No stock to
 * restore — fulfilment/sales recording are deferred until payment.
 */
import Order from '../models/Order';
import logger from '../config/logger';

export async function cancelAbandonedUnpaidOrders(
  ttlMinutes: number = Number(process.env.UNPAID_ORDER_TTL_MINUTES) || 60
): Promise<number> {
  const cutoff = new Date(Date.now() - ttlMinutes * 60 * 1000);

  const res = await Order.updateMany(
    {
      status: { $in: ['PENDING', 'ACCEPTED'] },
      payment_status: { $ne: 'Paid' },
      createdAt: { $lt: cutoff },
    },
    {
      $set: {
        status: 'CANCELLED',
        payment_status: 'Failed',
        assignedVendorId: null,
        assignedVendors: [],
      },
      $unset: { acceptanceDeadline: '' },
    }
  );

  const n = res.modifiedCount ?? 0;
  if (n > 0) {
    logger.info(`[OrderMaintenance] Auto-cancelled ${n} abandoned unpaid order(s) older than ${ttlMinutes} min`);
  }
  return n;
}
