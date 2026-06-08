/**
 * paymentGuard.ts
 * Server-side gate that proves an order was actually paid before any code path
 * marks it `payment_status: 'Paid'`.
 *
 * Why: the order is created PENDING at checkout and the client used to be able to
 * PUT { payment_status: 'Paid' } directly — trusted with no verification — which
 * let a logged-in user mark an order paid without paying. This asks Razorpay
 * directly whether the payment is captured AND belongs to this order's razorpay
 * order id (so a captured payment from a different/cheaper order can't be reused).
 * Razorpay enforces payment.amount === order.amount, and our razorpay order amount
 * is the server-computed combined total, so an order-id match also pins the amount.
 *
 * Split shipments share one razorpay_order_id, so this works per-order without any
 * combined-sum bookkeeping.
 */
import { getRazorpayInstance } from '../config/razorpay';
import { AppError } from '../middlewares/errorHandler';
import logger from '../config/logger';

export async function assertCapturedPaymentForOrder(params: {
  razorpayOrderId?: string | null;
  paymentId?: string | null;
}): Promise<void> {
  const { razorpayOrderId, paymentId } = params;

  // Test/dev escape hatch is gated ONLY on the server env, never on client input.
  if (process.env.SKIP_PAYMENT === 'true') return;

  const razorpay = getRazorpayInstance();
  if (!razorpay) {
    throw new AppError('Payment gateway not configured', 500);
  }
  if (!razorpayOrderId) {
    throw new AppError('No payment session exists for this order; cannot confirm payment.', 400);
  }
  if (!paymentId || paymentId.startsWith('MANUAL_') || paymentId.startsWith('test_') || paymentId.startsWith('pay_demo_') || paymentId.startsWith('pay_test_')) {
    throw new AppError('A valid gateway payment id is required to confirm payment.', 400);
  }

  let payment: any;
  try {
    payment = await razorpay.payments.fetch(paymentId);
  } catch (err: any) {
    logger.error(`[paymentGuard] Razorpay fetch failed for ${paymentId}: ${err?.message}`);
    throw new AppError('Could not verify payment with the gateway. Please try again.', 502);
  }

  if (!payment || payment.status !== 'captured') {
    throw new AppError(`Payment is not captured (status: ${payment?.status ?? 'unknown'}).`, 400);
  }
  if (payment.order_id !== razorpayOrderId) {
    logger.warn(`[paymentGuard] payment ${paymentId} order_id ${payment.order_id} != order's ${razorpayOrderId}`);
    throw new AppError('Payment does not belong to this order.', 400);
  }
}
