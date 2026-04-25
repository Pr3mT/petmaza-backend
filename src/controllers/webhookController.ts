/**
 * webhookController.ts
 *
 * Handles inbound Razorpay webhook events server-side.
 * This is the safety net: if the frontend fails to call /api/orders/:id after
 * payment (tab closed, network drop, etc.), this webhook marks the order Paid
 * and records the Transaction — so no money is ever lost silently.
 *
 * Razorpay signs every webhook request with HMAC-SHA256 over the raw body.
 * The route MUST receive the raw Buffer (express.raw), NOT parsed JSON.
 *
 * Env vars required:
 *   RAZORPAY_WEBHOOK_SECRET  — set in Razorpay Dashboard → Webhooks
 */

import crypto from 'crypto';
import { Request, Response } from 'express';
import Order from '../models/Order';
import Transaction from '../models/Transaction';
import logger from '../config/logger';
import { io } from '../server';
import {
  sendPaymentSuccessEmail,
  sendPaymentFailureEmail,
} from '../services/emailer';

// ─── Signature Verification ────────────────────────────────────────────────
/**
 * Verifies the X-Razorpay-Signature header.
 * Razorpay signs: HMAC-SHA256(rawBody, WEBHOOK_SECRET)
 * Returns true if the signature matches, false otherwise.
 */
function verifyRazorpaySignature(rawBody: Buffer, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    logger.warn('[Webhook] RAZORPAY_WEBHOOK_SECRET not set — rejecting all webhooks');
    return false;
  }
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(expectedSig, 'hex'),
    Buffer.from(signature, 'hex')
  );
}

// ─── Helper: resolve DB order from payment entity ─────────────────────────
/**
 * Tries several strategies to find the DB Order document from a Razorpay
 * payment entity:
 *   1. notes.db_order_id   (set when createPaymentOrder is called with db_order_id)
 *   2. razorpay_order_id   (stored on the Order when the Razorpay order was created)
 *   3. payment_id          (stored after frontend callback — idempotency guard)
 */
async function findOrderFromPayment(paymentEntity: any) {
  // Strategy 1: notes.db_order_id
  const dbOrderId = paymentEntity?.notes?.db_order_id;
  if (dbOrderId) {
    const order = await Order.findById(dbOrderId).populate('customer_id', 'email name');
    if (order) return order;
  }

  // Strategy 2: razorpay_order_id stored on the Order document
  const razorpayOrderId = paymentEntity?.order_id;
  if (razorpayOrderId) {
    const order = await Order.findOne({ razorpay_order_id: razorpayOrderId }).populate('customer_id', 'email name');
    if (order) return order;
  }

  // Strategy 3: payment already saved on the order (idempotency)
  const paymentId = paymentEntity?.id;
  if (paymentId) {
    const order = await Order.findOne({ payment_id: paymentId }).populate('customer_id', 'email name');
    if (order) return order;
  }

  return null;
}

// ─── Helper: resolve transaction type from order ──────────────────────────
function resolveTransactionType(order: any): string {
  if (order.isPrime) return 'prime_product';
  // Use delivery type field if present, fall back to standard
  if (order.deliveryType === 'express') return 'express_delivery';
  return 'standard_delivery';
}

// ─── Event Handlers ────────────────────────────────────────────────────────

/**
 * Handles payment.captured and order.paid events.
 * Marks the order as Paid and creates a Transaction record.
 * Safe to call multiple times (idempotent — checks if already Paid).
 */
async function handlePaymentCaptured(paymentEntity: any): Promise<void> {
  const paymentId: string = paymentEntity?.id;
  const razorpayOrderId: string = paymentEntity?.order_id;
  // Razorpay amounts are in paise — convert to rupees
  const amountRupees: number = (paymentEntity?.amount ?? 0) / 100;

  const order = await findOrderFromPayment(paymentEntity);
  if (!order) {
    logger.warn(`[Webhook] payment.captured — could not find DB order for payment ${paymentId} / razorpay_order ${razorpayOrderId}`);
    return;
  }

  // ── Idempotency guard — don't double-process ────────────────────────────
  if (order.payment_status === 'Paid') {
    logger.info(`[Webhook] payment.captured — order ${order._id} already Paid, skipping`);
    return;
  }

  // ── Mark order as Paid ──────────────────────────────────────────────────
  order.payment_status = 'Paid';
  order.payment_id = paymentId;
  order.payment_gateway = 'razorpay';
  await order.save();
  logger.info(`[Webhook] ✅ Order ${order._id} marked as Paid via webhook (payment: ${paymentId})`);

  // ── Create Transaction record ───────────────────────────────────────────
  try {
    const customerId = (order.customer_id as any)?._id?.toString?.() ?? order.customer_id?.toString();
    await Transaction.create({
      transactionId: paymentId,                    // Razorpay pay_xxx — globally unique
      customerId,
      orderId: order._id,
      transactionType: resolveTransactionType(order),
      amount: amountRupees,
      payment_id: paymentId,
      payment_gateway: 'razorpay',
      payment_status: 'Paid',
      description: `Order payment captured via Razorpay webhook`,
      metadata: {
        razorpay_order_id: razorpayOrderId,
        method: paymentEntity?.method,
        bank: paymentEntity?.bank,
        wallet: paymentEntity?.wallet,
        vpa: paymentEntity?.vpa,
        email: paymentEntity?.email,
        contact: paymentEntity?.contact,
      },
    });
    logger.info(`[Webhook] ✅ Transaction record created for payment ${paymentId}`);
  } catch (txErr: any) {
    // Duplicate key = already exists (e.g. webhook retried) — not a real error
    if (txErr?.code === 11000) {
      logger.info(`[Webhook] Transaction ${paymentId} already exists (duplicate webhook), skipping`);
    } else {
      logger.error(`[Webhook] ❌ Failed to create Transaction record: ${txErr.message}`);
    }
  }

  // ── Notify customer via WebSocket ───────────────────────────────────────
  try {
    const customerId = (order.customer_id as any)?._id?.toString?.() ?? order.customer_id?.toString();
    io.to(`customer:${customerId}`).emit('payment:success', {
      orderId: order._id,
      paymentId,
      amount: amountRupees,
    });
  } catch (wsErr: any) {
    logger.warn(`[Webhook] WebSocket emit failed: ${wsErr.message}`);
  }

  // ── Send payment receipt email ──────────────────────────────────────────
  try {
    const customer = order.customer_id as any;
    if (customer?.email) {
      const orderId = order._id.toString().slice(-8).toUpperCase();
      sendPaymentSuccessEmail(
        customer.email,
        customer.name || 'Customer',
        orderId,
        order.total ?? 0,
        paymentId,
        {
          items: order.items,
          customerAddress: order.customerAddress,
          paymentGateway: 'Razorpay',
          paymentMethod: paymentEntity?.method || 'Online Payment',
        }
      )
        .then(() => logger.info(`[Webhook] ✅ Payment receipt email sent to ${customer.email}`))
        .catch((e: any) => logger.error(`[Webhook] ❌ Receipt email failed: ${e.message}`));
    }
  } catch (emailErr: any) {
    logger.warn(`[Webhook] Email send failed: ${emailErr.message}`);
  }
}

/**
 * Handles payment.failed event.
 * Marks the order as Failed (only if it was still Pending).
 */
async function handlePaymentFailed(paymentEntity: any): Promise<void> {
  const paymentId: string = paymentEntity?.id;
  const razorpayOrderId: string = paymentEntity?.order_id;

  const order = await findOrderFromPayment(paymentEntity);
  if (!order) {
    logger.warn(`[Webhook] payment.failed — could not find DB order for payment ${paymentId}`);
    return;
  }

  // Don't overwrite a successful payment
  if (order.payment_status === 'Paid') {
    logger.info(`[Webhook] payment.failed for already-Paid order ${order._id} — ignoring`);
    return;
  }

  order.payment_status = 'Failed';
  order.payment_id = paymentId;
  await order.save();
  logger.info(`[Webhook] ⚠️ Order ${order._id} marked as Failed via webhook`);

  // ── Create a failed Transaction record ─────────────────────────────────
  try {
    const customerId = (order.customer_id as any)?._id?.toString?.() ?? order.customer_id?.toString();
    await Transaction.create({
      transactionId: paymentId,
      customerId,
      orderId: order._id,
      transactionType: resolveTransactionType(order),
      amount: (paymentEntity?.amount ?? 0) / 100,
      payment_id: paymentId,
      payment_gateway: 'razorpay',
      payment_status: 'Failed',
      description: `Payment failed — ${paymentEntity?.error_description || 'unknown reason'}`,
      metadata: {
        razorpay_order_id: razorpayOrderId,
        error_code: paymentEntity?.error_code,
        error_description: paymentEntity?.error_description,
        error_reason: paymentEntity?.error_reason,
      },
    });
  } catch (txErr: any) {
    if (txErr?.code !== 11000) {
      logger.error(`[Webhook] Failed to create failed-Transaction record: ${txErr.message}`);
    }
  }

  // ── Notify customer via WebSocket ───────────────────────────────────────
  try {
    const customerId = (order.customer_id as any)?._id?.toString?.() ?? order.customer_id?.toString();
    io.to(`customer:${customerId}`).emit('payment:failed', { orderId: order._id });
  } catch (wsErr: any) {
    logger.warn(`[Webhook] WebSocket emit failed: ${wsErr.message}`);
  }

  // ── Send failure email ──────────────────────────────────────────────────
  try {
    const customer = order.customer_id as any;
    if (customer?.email) {
      const orderId = order._id.toString().slice(-8).toUpperCase();
      sendPaymentFailureEmail(
        customer.email,
        customer.name || 'Customer',
        orderId,
        (order.total ?? 0),
        paymentEntity?.error_description || 'Payment was declined'
      )
        .then(() => logger.info(`[Webhook] ✅ Payment failure email sent`))
        .catch((e: any) => logger.error(`[Webhook] ❌ Failure email error: ${e.message}`));
    }
  } catch (emailErr: any) {
    logger.warn(`[Webhook] Email send failed: ${emailErr.message}`);
  }
}

// ─── Main Webhook Handler ──────────────────────────────────────────────────
/**
 * POST /api/webhooks/razorpay
 *
 * Razorpay calls this URL for every payment event configured in the dashboard.
 * Must respond with HTTP 200 quickly — all heavy work is async/non-blocking.
 */
export const razorpayWebhookHandler = async (req: Request, res: Response): Promise<void> => {
  // req.body is a raw Buffer because the route uses express.raw()
  const rawBody: Buffer = req.body;
  const signature = req.headers['x-razorpay-signature'] as string | undefined;

  // ── Always respond 200 immediately to prevent Razorpay retries ─────────
  // (Do this before any async work so Razorpay considers it delivered)
  res.status(200).json({ received: true });

  // ── Validate signature ──────────────────────────────────────────────────
  if (!signature) {
    logger.warn('[Webhook] Missing X-Razorpay-Signature header');
    return;
  }

  if (!verifyRazorpaySignature(rawBody, signature)) {
    logger.warn('[Webhook] ❌ Invalid webhook signature — request rejected');
    return;
  }

  // ── Parse body ──────────────────────────────────────────────────────────
  let event: any;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    logger.error('[Webhook] Failed to parse webhook body as JSON');
    return;
  }

  const eventType: string = event?.event;
  logger.info(`[Webhook] Received event: ${eventType}`);

  // ── Dispatch to correct handler ─────────────────────────────────────────
  try {
    switch (eventType) {
      // payment.captured fires when money is successfully debited
      case 'payment.captured':
        await handlePaymentCaptured(event?.payload?.payment?.entity);
        break;

      // order.paid fires when a Razorpay order is fully paid
      // The payment entity is nested under payload.payment
      case 'order.paid':
        await handlePaymentCaptured(event?.payload?.payment?.entity);
        break;

      // payment.link.paid fires when a payment link order is completed
      case 'payment.link.paid':
        await handlePaymentCaptured(event?.payload?.payment?.entity);
        break;

      case 'payment.failed':
        await handlePaymentFailed(event?.payload?.payment?.entity);
        break;

      default:
        logger.info(`[Webhook] Unhandled event type: ${eventType} — ignoring`);
    }
  } catch (err: any) {
    // Never let an error here cause a 500 — Razorpay already got 200
    logger.error(`[Webhook] ❌ Error processing event ${eventType}: ${err.message}`);
  }
};
