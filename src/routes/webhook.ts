/**
 * webhook.ts
 *
 * Route for Razorpay webhook events.
 *
 * IMPORTANT: This route uses express.raw() to receive the unparsed body as a
 * Buffer. Razorpay signature verification REQUIRES the raw bytes — once
 * express.json() parses the body the signature cannot be verified correctly.
 *
 * This route is registered in server.ts BEFORE express.json() for this reason.
 */

import express from 'express';
import { razorpayWebhookHandler } from '../controllers/webhookController';

const router = express.Router();

/**
 * POST /api/webhooks/razorpay
 *
 * Razorpay Dashboard → Webhooks → set URL to:
 *   https://your-domain.com/api/webhooks/razorpay
 *
 * Required events to enable in Dashboard:
 *   - payment.captured
 *   - payment.failed
 *   - order.paid
 *   - payment.link.paid  (if you use payment links)
 */
router.post(
  '/razorpay',
  // express.raw() keeps body as Buffer — must come BEFORE any JSON parser
  express.raw({ type: ['application/json', 'text/plain', '*/*'], limit: '1mb' }),
  razorpayWebhookHandler
);

export default router;
