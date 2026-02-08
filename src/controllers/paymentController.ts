import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import Order from '../models/Order';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth';
import { getRazorpayInstance } from '../config/razorpay';
import { io } from '../server';

export const createPaymentOrder = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { amount, currency = 'INR', receipt } = req.body;

    if (!amount || amount <= 0) {
      return next(new AppError('Invalid amount', 400));
    }

    const razorpay = getRazorpayInstance();

    if (!razorpay || process.env.SKIP_PAYMENT === 'true') {
      // Test mode - return mock payment order
      const mockOrderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      return res.status(200).json({
        success: true,
        data: {
          id: mockOrderId,
          entity: 'order',
          amount: amount * 100, // Razorpay uses paise
          amount_paid: 0,
          amount_due: amount * 100,
          currency,
          receipt: receipt || `receipt_${Date.now()}`,
          status: 'created',
          attempts: 0,
          created_at: Date.now(),
        },
      });
    }

    const options = {
      amount: amount * 100, // Convert to paise
      currency,
      receipt: receipt || `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);

    res.status(200).json({
      success: true,
      data: order,
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

    // Verify signature
    const text = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(text)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return next(new AppError('Invalid payment signature', 400));
    }

    // Payment is verified
    res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      data: {
        order_id: razorpay_order_id,
        payment_id: razorpay_payment_id,
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

    const order = await Order.findById(order_id);
    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    // Check if user owns this order
    if (order.customer_id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return next(new AppError('Access denied', 403));
    }

    // Update order payment status
    order.payment_status = 'Paid';
    order.payment_id = payment_id || `test_payment_${Date.now()}`;

    // Payment completion does NOT change order status to ASSIGNED
    // Order should remain PENDING until vendor accepts it
    // ASSIGNED status is set when vendor accepts the order

    await order.save();

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

