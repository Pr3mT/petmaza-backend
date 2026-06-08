/**
 * orderMaintenance.ts
 * Cancels abandoned unpaid orders so they don't linger looking "placed".
 *
 * An order is created PENDING/unpaid at checkout; if the customer never completes
 * payment it would otherwise sit forever. We cancel PENDING orders that are still
 * unpaid after UNPAID_ORDER_TTL_MINUTES (default 60). Paid orders are never
 * touched. Stock isn't restored because vendor fulfilment / sales recording are
 * deferred until payment, so nothing was reserved for an unpaid order.
 */
import Order from '../models/Order';
import logger from '../config/logger';

export async function cancelAbandonedUnpaidOrders(
  ttlMinutes: number = Number(process.env.UNPAID_ORDER_TTL_MINUTES) || 60
): Promise<number> {
  const cutoff = new Date(Date.now() - ttlMinutes * 60 * 1000);

  const res = await Order.updateMany(
    {
      status: 'PENDING',
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
