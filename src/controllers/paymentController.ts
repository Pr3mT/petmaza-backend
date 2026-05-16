import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import Order from '../models/Order';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest, isAdminRole } from '../middlewares/auth';
import { getRazorpayInstance } from '../config/razorpay';
import { io } from '../server';
import { sendPaymentSuccessEmail, sendPaymentFailureEmail } from '../services/emailer';
import logger from '../config/logger';
import { logSecurityEvent } from '../utils/paymentSecurityLogger';

// Tolerance in rupees for floating-point comparisons (₹0.50)
const AMOUNT_TOLERANCE = 0.5;

export const createPaymentOrder = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    /**
     * SECURITY: The `amount` field from the frontend is INTENTIONALLY IGNORED.
     * The authoritative payment amount is always fetched from the DB Order document.
     * If a hacker modifies the amount in transit, we detect the mismatch and block.
     */
    const { currency = 'INR', receipt, db_order_id } = req.body;
    const frontendAmount: number | undefined = req.body.amount; // captured only for tamper detection

    // db_order_id is mandatory — we must look up the DB-authoritative total
    if (!db_order_id) {
      return next(new AppError('Order reference is required to initiate payment', 400));
    }

    // ── Fetch the order and verify ownership ─────────────────────────────────
    const dbOrder = await Order.findById(db_order_id);
    if (!dbOrder) {
      return next(new AppError('Order not found', 404));
    }

    if (dbOrder.customer_id.toString() !== req.user._id.toString()) {
      await logSecurityEvent({
        event: 'UNAUTHORIZED_ORDER_ACCESS',
        severity: 'HIGH',
        userId: req.user._id,
        orderId: db_order_id,
        ipAddress: req.ip ?? req.socket?.remoteAddress,
        userAgent: req.headers['user-agent'],
        details: `User ${req.user._id} attempted to pay for order ${db_order_id} owned by ${dbOrder.customer_id}`,
      });
      return next(new AppError('Access denied', 403));
    }

    if (dbOrder.payment_status === 'Paid') {
      return next(new AppError('This order has already been paid', 400));
    }

    // ── Server-authoritative amount (DB total) ────────────────────────────────
    const serverAmount: number = dbOrder.grandTotal || dbOrder.total;

    if (!serverAmount || serverAmount <= 0) {
      return next(new AppError('Order total is invalid. Please contact support.', 400));
    }

    // ── Tamper detection: compare frontend amount with DB total ───────────────
    if (frontendAmount !== undefined && Math.abs(frontendAmount - serverAmount) > AMOUNT_TOLERANCE) {
      await logSecurityEvent({
        event: 'PAYMENT_AMOUNT_TAMPERING',
        severity: 'CRITICAL',
        userId: req.user._id,
        orderId: db_order_id,
        ipAddress: req.ip ?? req.socket?.remoteAddress,
        userAgent: req.headers['user-agent'],
        expected: serverAmount,
        received: frontendAmount,
        details:
          `Payment amount tampering detected! ` +
          `Frontend sent ₹${frontendAmount}, server DB total is ₹${serverAmount} ` +
          `for order ${db_order_id}`,
      });
      return next(
        new AppError(
          'Payment amount validation failed. The order total has changed — please refresh and retry.',
          400
        )
      );
    }

    const razorpay = getRazorpayInstance();

    // ── Test / skip-payment mode ─────────────────────────────────────────────
    if (!razorpay || process.env.SKIP_PAYMENT === 'true') {
      const mockOrderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      return res.status(200).json({
        success: true,
        testMode: true,
        data: {
          id: mockOrderId,
          entity: 'order',
          amount: Math.round(serverAmount * 100), // paise, using server amount
          amount_paid: 0,
          amount_due: Math.round(serverAmount * 100),
          currency,
          receipt: receipt || `receipt_${Date.now()}`,
          status: 'created',
          attempts: 0,
          created_at: Date.now(),
        },
      });
    }

    // ── Create Razorpay order using server-verified amount ────────────────────
    const options: any = {
      amount: Math.round(serverAmount * 100), // paise, ALWAYS from DB
      currency,
      receipt: receipt || `receipt_${Date.now()}`,
      notes: { db_order_id },
    };

    const razorpayOrder = await razorpay.orders.create(options);

    // Store the Razorpay order_id on the DB Order for webhook resolution
    if (razorpayOrder?.id) {
      await Order.findByIdAndUpdate(db_order_id, {
        $set: { razorpay_order_id: razorpayOrder.id },
      });
    }

    logger.info(
      `[createPaymentOrder] ✅ Razorpay order created: ${razorpayOrder.id} | ` +
        `DB order: ${db_order_id} | Amount: ₹${serverAmount}`
    );

    res.status(200).json({
      success: true,
      data: razorpayOrder,
    });
  } catch (error: any) {
    next(new AppError(error.message || 'Failed to create payment order', 500));
  }
};

export const verifyPayment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return next(new AppError('Missing payment verification data', 400));
    }

    if (process.env.SKIP_PAYMENT === 'true') {
      // Test mode - skip verification
      return res.status(200).json({
        success: true,
        message: 'Payment verified (test mode)',
        data: {
          order_id: razorpay_order_id,
          payment_id: razorpay_payment_id,
        },
      });
    }

    const razorpay = getRazorpayInstance();
    if (!razorpay) {
      return next(new AppError('Payment gateway not configured', 500));
    }

    // ── Step 1: Verify HMAC-SHA256 signature ──────────────────────────────────
    // Razorpay signs: HMAC-SHA256(razorpay_order_id + "|" + razorpay_payment_id, KEY_SECRET)
    const text = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(text)
      .digest('hex');

    // Constant-time comparison prevents timing attacks.
    // Razorpay signatures are 64-char hex strings (32 bytes). Normalize length
    // so timingSafeEqual never throws on a length mismatch.
    const sigLen = generatedSignature.length;
    const normalizedReceived = razorpay_signature.padEnd(sigLen, '0').slice(0, sigLen);
    const signaturesMatch = crypto.timingSafeEqual(
      Buffer.from(generatedSignature, 'hex'),
      Buffer.from(normalizedReceived, 'hex')
    );

    if (!signaturesMatch) {
      await logSecurityEvent({
        event: 'INVALID_PAYMENT_SIGNATURE',
        severity: 'CRITICAL',
        userId: req.user._id,
        ipAddress: req.ip ?? req.socket?.remoteAddress,
        userAgent: req.headers['user-agent'],
        details: `Invalid Razorpay signature for payment ${razorpay_payment_id}, order ${razorpay_order_id}`,
        received: razorpay_signature,
        expected: 'valid HMAC-SHA256 signature',
      });
      return next(new AppError('Invalid payment signature', 400));
    }

    // ── Step 2: Fetch the actual payment from Razorpay API ────────────────────
    // This is the critical post-payment amount verification step.
    // We never trust the amount from the frontend — we ask Razorpay directly.
    let razorpayPayment: any;
    try {
      razorpayPayment = await razorpay.payments.fetch(razorpay_payment_id);
    } catch (fetchErr: any) {
      logger.error(`[verifyPayment] Could not fetch payment ${razorpay_payment_id} from Razorpay: ${fetchErr.message}`);
      return next(new AppError('Could not verify payment details with payment gateway', 500));
    }

    if (!razorpayPayment || razorpayPayment.status !== 'captured') {
      return next(
        new AppError(
          `Payment is not captured yet (status: ${razorpayPayment?.status ?? 'unknown'}). Please wait a moment and retry.`,
          400
        )
      );
    }

    const amountPaidRupees = razorpayPayment.amount / 100; // paise → rupees

    // ── Step 3: Cross-check paid amount against DB order total ────────────────
    const dbOrder = await Order.findOne({ razorpay_order_id });
    if (dbOrder) {
      const expectedAmount = dbOrder.grandTotal || dbOrder.total;

      if (Math.abs(amountPaidRupees - expectedAmount) > AMOUNT_TOLERANCE) {
        await logSecurityEvent({
          event: 'PAYMENT_AMOUNT_MISMATCH_POST_PAYMENT',
          severity: 'CRITICAL',
          userId: req.user._id,
          orderId: dbOrder._id,
          ipAddress: req.ip ?? req.socket?.remoteAddress,
          userAgent: req.headers['user-agent'],
          expected: expectedAmount,
          received: amountPaidRupees,
          details:
            `POST-PAYMENT AMOUNT MISMATCH: Razorpay captured ₹${amountPaidRupees} but ` +
            `DB order total is ₹${expectedAmount} for order ${dbOrder._id} (payment: ${razorpay_payment_id})`,
        });
        return next(
          new AppError(
            'Payment amount does not match the order total. This transaction has been flagged for review. Please contact support.',
            400
          )
        );
      }

      logger.info(
        `[verifyPayment] ✅ Amount verified: ₹${amountPaidRupees} paid, ₹${expectedAmount} expected | ` +
          `Order: ${dbOrder._id} | Payment: ${razorpay_payment_id}`
      );
    } else {
      // No DB order found by razorpay_order_id — could be a timing issue; log but don't block
      logger.warn(
        `[verifyPayment] ⚠️ Could not find DB order for razorpay_order_id ${razorpay_order_id} during amount check`
      );
    }

    // ── Step 4: Idempotency guard — detect replay attacks ────────────────────
    const alreadyPaid = await Order.findOne({ payment_id: razorpay_payment_id });
    if (alreadyPaid) {
      await logSecurityEvent({
        event: 'PAYMENT_REPLAY_ATTACK',
        severity: 'HIGH',
        userId: req.user._id,
        orderId: alreadyPaid._id,
        ipAddress: req.ip ?? req.socket?.remoteAddress,
        userAgent: req.headers['user-agent'],
        details: `Payment ID ${razorpay_payment_id} already used for order ${alreadyPaid._id}`,
      });
      // Return success idempotently — the payment was already processed
      return res.status(200).json({
        success: true,
        message: 'Payment already verified',
        data: { order_id: razorpay_order_id, payment_id: razorpay_payment_id },
      });
    }

    // ── All checks passed ─────────────────────────────────────────────────────
    res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      data: {
        order_id: razorpay_order_id,
        payment_id: razorpay_payment_id,
        amount_paid: amountPaidRupees,
      },
    });
  } catch (error: any) {
    next(new AppError(error.message || 'Payment verification failed', 500));
  }
};

export const generatePaymentLink = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { order_id, amount, description, customer_name, customer_email, customer_contact } = req.body;

    if (!order_id || !amount) {
      return next(new AppError('Order ID and amount are required', 400));
    }

    const razorpay = getRazorpayInstance();

    if (!razorpay || process.env.SKIP_PAYMENT === 'true') {
      // Test mode - return mock payment link
      const mockPaymentLink = `https://test.razorpay.com/payment/${order_id}`;
      return res.status(200).json({
        success: true,
        data: {
          id: `plink_${Date.now()}`,
          short_url: mockPaymentLink,
          amount: amount * 100,
          currency: 'INR',
          description: description || 'Order payment',
          customer: {
            name: customer_name || 'Customer',
            email: customer_email || 'customer@example.com',
            contact: customer_contact || '9999999999',
          },
          notify: {
            sms: true,
            email: true,
          },
          reminder_enable: true,
          created_at: Date.now(),
        },
      });
    }

    const options: any = {
      amount: amount * 100, // Convert to paise
      currency: 'INR',
      description: description || 'Order payment',
      customer: {
        name: customer_name,
        email: customer_email,
        contact: customer_contact,
      },
      notify: {
        sms: true,
        email: true,
      },
      reminder_enable: true,
      // Pass db order_id in notes so the webhook can resolve the DB order
      notes: { db_order_id: order_id },
    };

    const paymentLink = await razorpay.paymentLink.create(options);

    // Update order with payment link
    const order = await Order.findById(order_id);
    if (order) {
      order.payment_link = paymentLink.short_url;
      await order.save();

      // Notify customer via WebSocket
      io.to(`customer:${order.customer_id}`).emit('payment:link:generated', {
        orderId: order._id,
        paymentLink: paymentLink.short_url,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Payment link generated successfully',
      data: paymentLink,
    });
  } catch (error: any) {
    next(new AppError(error.message || 'Failed to generate payment link', 500));
  }
};

export const completePayment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { order_id, payment_id } = req.body;

    if (!order_id) {
      return next(new AppError('Order ID is required', 400));
    }

    const order = await Order.findById(order_id).populate('customer_id', 'email name');
    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    // Check if user owns this order
    if (order.customer_id.toString() !== req.user._id.toString() && !isAdminRole(req.user.role)) {
      return next(new AppError('Access denied', 403));
    }

    // Idempotency: already paid orders should not be double-processed
    if (order.payment_status === 'Paid') {
      return res.status(200).json({
        success: true,
        message: 'Order already marked as paid',
        data: { order },
      });
    }

    // ── SECURITY: Verify payment amount via Razorpay API before marking Paid ──
    // Skip in test mode only
    const razorpay = getRazorpayInstance();
    if (razorpay && process.env.SKIP_PAYMENT !== 'true' && payment_id && !payment_id.startsWith('test_')) {
      try {
        const razorpayPayment = await razorpay.payments.fetch(payment_id);

        if (!razorpayPayment || razorpayPayment.status !== 'captured') {
          return next(
            new AppError(
              `Payment ${payment_id} has not been captured (status: ${razorpayPayment?.status ?? 'unknown'})`,
              400
            )
          );
        }

        const amountPaidRupees = (razorpayPayment.amount as number) / 100;
        const expectedAmount = order.grandTotal || order.total;

        if (Math.abs(amountPaidRupees - expectedAmount) > AMOUNT_TOLERANCE) {
          await logSecurityEvent({
            event: 'PAYMENT_AMOUNT_MISMATCH_POST_PAYMENT',
            severity: 'CRITICAL',
            userId: req.user._id,
            orderId: order._id,
            ipAddress: req.ip ?? req.socket?.remoteAddress,
            userAgent: req.headers['user-agent'],
            expected: expectedAmount,
            received: amountPaidRupees,
            details:
              `completePayment amount mismatch: Razorpay captured ₹${amountPaidRupees}, ` +
              `DB order total ₹${expectedAmount} | Order: ${order._id} | Payment: ${payment_id}`,
          });
          return next(
            new AppError(
              'Payment amount does not match the order total. This transaction has been flagged. Please contact support.',
              400
            )
          );
        }

        logger.info(
          `[completePayment] ✅ Amount verified: ₹${amountPaidRupees} paid | Order: ${order._id}`
        );
      } catch (fetchErr: any) {
        // If Razorpay API is unreachable, log a warning but proceed (webhook is the safety net)
        logger.warn(
          `[completePayment] ⚠️ Could not fetch payment ${payment_id} from Razorpay for amount check: ${fetchErr.message}`
        );
      }
    }

    // Update order payment status
    order.payment_status = 'Paid';
    order.payment_id = payment_id || `test_payment_${Date.now()}`;

    // Payment completion does NOT change order status to ASSIGNED
    // Order should remain PENDING until vendor accepts it
    // ASSIGNED status is set when vendor accepts the order

    await order.save();

    // Send payment success email to customer with full receipt
    try {
      const customerEmail = (order.customer_id as any)?.email;
      const customerName = (order.customer_id as any)?.name;

      if (customerEmail) {
        // Populate items to show product names in receipt
        const populatedOrder = await order.populate('items.product_id');
        
        logger.info('[completePayment] Sending payment receipt email to:', customerEmail);
        sendPaymentSuccessEmail(
          customerEmail,
          customerName || 'Customer',
          `#${order._id.toString().slice(-8)}`,
          order.total || 0,
          order.payment_id,
          {
            items: populatedOrder.items,
            customerAddress: order.customerAddress,
            paymentGateway: order.payment_gateway || 'Razorpay',
            paymentMethod: 'Online Payment',
          }
        ).then(() => logger.info('[completePayment] ✅ Payment receipt email sent'))
         .catch((e: any) => logger.error('[completePayment] ❌ Payment receipt email failed:', e.message));
      } else {
        logger.info('[completePayment] ⚠️ No customer email found, skipping receipt email');
      }
    } catch (emailError: any) {
      logger.error('[completePayment] ❌ Payment success email error:', emailError.message);
      // Don't fail the payment completion if email fails
    }

    res.status(200).json({
      success: true,
      message: 'Payment completed successfully',
      data: {
        order,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Handle payment failure
 */
export const handlePaymentFailure = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { order_id, reason } = req.body;

    if (!order_id) {
      return next(new AppError('Order ID is required', 400));
    }

    const order = await Order.findById(order_id).populate('customer_id', 'email name');
    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    // Check if user owns this order
    if (order.customer_id.toString() !== req.user._id.toString() && !isAdminRole(req.user.role)) {
      return next(new AppError('Access denied', 403));
    }

    if (order.payment_status === 'Paid') {
      return next(new AppError('Paid orders cannot be marked as failed', 400));
    }

    // Update order payment status
    order.payment_status = 'Failed';
    if (order.status === 'PENDING') {
      order.status = 'CANCELLED';
    }
    order.assignedVendorId = null as any;
    order.assignedVendors = [] as any;
    order.acceptanceDeadline = undefined;

    await order.save();

    // Send payment failure email to customer
    try {
      const customerEmail = (order.customer_id as any)?.email;
      const customerName = (order.customer_id as any)?.name;

      if (customerEmail) {
        await sendPaymentFailureEmail(
          customerEmail,
          customerName || 'Customer',
          order_id,
          order.total || 0,
          reason || 'Payment was declined by your bank'
        );
      }
    } catch (emailError: any) {
      console.error('Failed to send payment failure email:', emailError.message);
      // Don't fail the error handling if email fails
    }

    res.status(200).json({
      success: true,
      message: 'Payment failure recorded',
      data: {
        order,
      },
    });
  } catch (error: any) {
    next(error);
  }
};
