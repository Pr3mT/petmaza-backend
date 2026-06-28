/**
 * orderMaintenance.ts
 * Cancels abandoned unpaid orders so they don't linger looking "placed".
 *
 * An order is created unpaid at checkout; if the customer never completes payment
 * it would otherwise sit forever. We cancel such orders after
 * UNPAID_ORDER_TTL_MINUTES (default 180 — 3 hours).
 * 3 hours gives Razorpay time to retry webhooks even if the backend was sleeping
 * (Render free tier cold-start). Razorpay retries webhooks at 15m, 45m, 2h.
 *
 * Status scope: PENDING (awaiting vendor accept) AND ACCEPTED — MY_SHOP vendors
 * auto-accept orders at creation (before payment), so an abandoned MY_SHOP order
 * sits in ACCEPTED while still unpaid. PRIME orders via cart also start PENDING.
 * NOTE: PRIME orders via createPrimeOrder start as ASSIGNED (stock decremented at
 * creation) — those are NOT included here since cancelling them needs stock restoration.
 * Paid orders are never touched (payment_status !== 'Paid' guard). No stock to
 * restore for PENDING/ACCEPTED orders — fulfilment/sales recording are deferred until payment.
 */
import Order from '../models/Order';
import logger from '../config/logger';

export async function cancelAbandonedUnpaidOrders(
  ttlMinutes: number = Number(process.env.UNPAID_ORDER_TTL_MINUTES) || 180
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
