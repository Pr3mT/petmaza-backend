import nodemailer from 'nodemailer';
import EmailLog from '../models/EmailLog';
import logger from '../config/logger';

// Initialize transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true' || false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export interface EmailOptions {
  to: string;
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
  trigger: string;
  orderId?: string;
  userId?: string;
}

/**
 * Send email and log the attempt
 */
export async function sendEmail(options: EmailOptions) {
  try {
    const { to, cc, bcc, subject, html, trigger, orderId, userId } = options;

    // Verify transporter connection
    await transporter.verify();

    // Send email
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      cc,
      bcc,
      subject,
      html,
    });

    // Log successful email
    await EmailLog.create({
      recipient: to,
      subject,
      body: html,
      status: 'sent',
      trigger,
      timestamp: new Date(),
      messageId: info.messageId,
      orderId,
      userId,
    });

    logger.info(`Email sent successfully: ${subject} to ${to}`);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    logger.error(`Email send failed: ${error.message}`);

    // Log failed email
    try {
      await EmailLog.create({
        recipient: options.to,
        subject: options.subject,
        body: options.html,
        status: 'failed',
        trigger: options.trigger,
        timestamp: new Date(),
        error: error.message,
        orderId: options.orderId,
        userId: options.userId,
      });
    } catch (logError) {
      logger.error(`Failed to log email: ${logError}`);
    }

    throw error;
  }
}

/**
 * Send order confirmation email to customer
 */
export async function sendOrderConfirmationEmail(
  customerEmail: string,
  customerName: string,
  orderId: string,
  orderData: any
) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #ffd700; padding: 20px; text-align: center;">
        <h1 style="margin: 0; color: #333;">🐾 PETMAZA</h1>
      </div>
      
      <div style="padding: 20px;">
        <h2>Order Confirmation</h2>
        <p>Hi ${customerName},</p>
        
        <p>Thank you for your order! We're excited to help you find the perfect pet products.</p>
        
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3>Order Details</h3>
          <p><strong>Order ID:</strong> ${orderId}</p>
          <p><strong>Order Date:</strong> ${new Date().toLocaleDateString('en-IN')}</p>
          <p><strong>Total Amount:</strong> ₹${(orderData.totalAmount || 0).toFixed(2)}</p>
          <p><strong>Status:</strong> <span style="color: #ff9800; font-weight: bold;">Pending</span></p>
        </div>
        
        <h3>Items Ordered:</h3>
        <ul>
          ${orderData.items.map((item: any) => `<li>${item.product?.name || 'Product'} - Qty: ${item.quantity}</li>`).join('')}
        </ul>
        
        <p><strong>Delivery Address:</strong><br>
        ${orderData.customerAddress}</p>
        
        <div style="background-color: #e8f5e9; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h4 style="margin-top: 0;">What's Next?</h4>
          <p>✓ Payment will be verified</p>
          <p>✓ Order will be assigned to nearest vendor</p>
          <p>✓ You'll receive updates via email</p>
        </div>
        
        <p style="color: #666; font-size: 12px;">
          If you have any questions, please contact our support team at support@petmaza.com
        </p>
      </div>
      
      <div style="background-color: #f5f5f5; padding: 20px; text-align: center; border-top: 1px solid #ddd;">
        <p style="color: #999; font-size: 12px;">© 2026 Petmaza. All rights reserved.</p>
      </div>
    </div>
  `;

  return sendEmail({
    to: customerEmail,
    subject: `Order Confirmation - ${orderId}`,
    html,
    trigger: 'order_confirmation',
    orderId,
  });
}

/**
 * Send order status update email
 */
export async function sendOrderStatusUpdateEmail(
  customerEmail: string,
  customerName: string,
  orderId: string,
  status: string,
  vendorName?: string
) {
  const statusMessages: Record<string, { title: string; icon: string; description: string }> = {
    confirmed: {
      title: 'Order Confirmed',
      icon: '✓',
      description: 'Your order has been confirmed and assigned to a vendor.',
    },
    processing: {
      title: 'Order Processing',
      icon: '⚙️',
      description: 'Your order is being prepared for shipment.',
    },
    shipped: {
      title: 'Order Shipped',
      icon: '🚚',
      description: 'Your order is on its way! Check tracking details below.',
    },
    delivered: {
      title: 'Order Delivered',
      icon: '📦',
      description: 'Your order has been successfully delivered. Thank you for shopping with us!',
    },
    cancelled: {
      title: 'Order Cancelled',
      icon: '❌',
      description: 'Your order has been cancelled. A refund will be processed shortly.',
    },
  };

  const statusInfo = statusMessages[status.toLowerCase()] || statusMessages.processing;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #ffd700; padding: 20px; text-align: center;">
        <h1 style="margin: 0; color: #333;">🐾 PETMAZA</h1>
      </div>
      
      <div style="padding: 20px;">
        <div style="background-color: #e3f2fd; padding: 20px; border-radius: 5px; text-align: center; margin: 20px 0;">
          <h2 style="margin: 0; font-size: 36px;">${statusInfo.icon}</h2>
          <h2 style="margin: 10px 0 0 0; color: #1976d2;">${statusInfo.title}</h2>
        </div>
        
        <p>Hi ${customerName},</p>
        <p>${statusInfo.description}</p>
        
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Order ID:</strong> ${orderId}</p>
          <p><strong>Status:</strong> <span style="color: #1976d2; font-weight: bold;">${status.toUpperCase()}</span></p>
          ${vendorName ? `<p><strong>Assigned Vendor:</strong> ${vendorName}</p>` : ''}
          <p><strong>Last Updated:</strong> ${new Date().toLocaleString('en-IN')}</p>
        </div>
        
        <p style="color: #666; font-size: 12px;">
          Track your order anytime on our website. If you have any questions, please contact our support team at support@petmaza.com
        </p>
      </div>
      
      <div style="background-color: #f5f5f5; padding: 20px; text-align: center; border-top: 1px solid #ddd;">
        <p style="color: #999; font-size: 12px;">© 2026 Petmaza. All rights reserved.</p>
      </div>
    </div>
  `;

  return sendEmail({
    to: customerEmail,
    subject: `Order ${statusInfo.title} - ${orderId}`,
    html,
    trigger: 'order_status_update',
    orderId,
  });
}

/**
 * Send payment success email
 */
export async function sendPaymentSuccessEmail(
  customerEmail: string,
  customerName: string,
  orderId: string,
  amount: number,
  paymentId: string
) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #ffd700; padding: 20px; text-align: center;">
        <h1 style="margin: 0; color: #333;">🐾 PETMAZA</h1>
      </div>
      
      <div style="padding: 20px;">
        <div style="background-color: #c8e6c9; padding: 20px; border-radius: 5px; text-align: center; margin: 20px 0;">
          <h2 style="margin: 0; font-size: 36px;">✓</h2>
          <h2 style="margin: 10px 0 0 0; color: #2e7d32;">Payment Successful!</h2>
        </div>
        
        <p>Hi ${customerName},</p>
        <p>Your payment has been received successfully. Your order is now confirmed and will be processed shortly.</p>
        
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Payment Details</h3>
          <p><strong>Order ID:</strong> ${orderId}</p>
          <p><strong>Payment ID:</strong> ${paymentId}</p>
          <p><strong>Amount Paid:</strong> <span style="font-size: 18px; color: #2e7d32; font-weight: bold;">₹${amount.toFixed(2)}</span></p>
          <p><strong>Date & Time:</strong> ${new Date().toLocaleString('en-IN')}</p>
        </div>
        
        <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h4 style="margin-top: 0;">Invoice</h4>
          <p>Your invoice has been attached to this email. You can also download it from your account dashboard.</p>
        </div>
        
        <p style="color: #666; font-size: 12px;">
          Thank you for your purchase! If you need any assistance, please contact support@petmaza.com
        </p>
      </div>
      
      <div style="background-color: #f5f5f5; padding: 20px; text-align: center; border-top: 1px solid #ddd;">
        <p style="color: #999; font-size: 12px;">© 2026 Petmaza. All rights reserved.</p>
      </div>
    </div>
  `;

  return sendEmail({
    to: customerEmail,
    subject: `Payment Confirmed - Order ${orderId}`,
    html,
    trigger: 'payment_success',
    orderId,
  });
}

/**
 * Send payment failure email
 */
export async function sendPaymentFailureEmail(
  customerEmail: string,
  customerName: string,
  orderId: string,
  amount: number,
  reason: string
) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #ffd700; padding: 20px; text-align: center;">
        <h1 style="margin: 0; color: #333;">🐾 PETMAZA</h1>
      </div>
      
      <div style="padding: 20px;">
        <div style="background-color: #ffebee; padding: 20px; border-radius: 5px; text-align: center; margin: 20px 0;">
          <h2 style="margin: 0; font-size: 36px;">⚠️</h2>
          <h2 style="margin: 10px 0 0 0; color: #c62828;">Payment Failed</h2>
        </div>
        
        <p>Hi ${customerName},</p>
        <p>Unfortunately, your payment could not be processed. Please review the details below and try again.</p>
        
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Payment Details</h3>
          <p><strong>Order ID:</strong> ${orderId}</p>
          <p><strong>Amount:</strong> ₹${amount.toFixed(2)}</p>
          <p><strong>Reason:</strong> <span style="color: #c62828;">${reason}</span></p>
          <p><strong>Date & Time:</strong> ${new Date().toLocaleString('en-IN')}</p>
        </div>
        
        <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h4 style="margin-top: 0;">What should you do?</h4>
          <p>1. Check your payment details</p>
          <p>2. Ensure you have sufficient funds</p>
          <p>3. Try a different payment method</p>
          <p>4. Contact your bank if the issue persists</p>
        </div>
        
        <p>
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/checkout" style="display: inline-block; background-color: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Retry Payment</a>
        </p>
        
        <p style="color: #666; font-size: 12px; margin-top: 20px;">
          If you need assistance, please contact our support team at support@petmaza.com
        </p>
      </div>
      
      <div style="background-color: #f5f5f5; padding: 20px; text-align: center; border-top: 1px solid #ddd;">
        <p style="color: #999; font-size: 12px;">© 2026 Petmaza. All rights reserved.</p>
      </div>
    </div>
  `;

  return sendEmail({
    to: customerEmail,
    subject: `Payment Failed - Order ${orderId}`,
    html,
    trigger: 'payment_failure',
    orderId,
  });
}

/**
 * Send vendor order notification
 */
export async function sendVendorOrderNotificationEmail(
  vendorEmail: string,
  vendorName: string,
  orderId: string,
  orderData: any
) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #ffd700; padding: 20px; text-align: center;">
        <h1 style="margin: 0; color: #333;">🐾 PETMAZA Vendor Portal</h1>
      </div>
      
      <div style="padding: 20px;">
        <div style="background-color: #e8f5e9; padding: 20px; border-radius: 5px; text-align: center; margin: 20px 0;">
          <h2 style="margin: 0; font-size: 28px;">📦</h2>
          <h2 style="margin: 10px 0 0 0; color: #2e7d32;">New Order Assigned</h2>
        </div>
        
        <p>Hi ${vendorName},</p>
        <p>A new order has been assigned to you. Please review the details and process it as soon as possible.</p>
        
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3>Order Details</h3>
          <p><strong>Order ID:</strong> ${orderId}</p>
          <p><strong>Customer Name:</strong> ${orderData.customerName || 'N/A'}</p>
          <p><strong>Total Amount:</strong> ₹${(orderData.totalAmount || 0).toFixed(2)}</p>
          <p><strong>Delivery Pincode:</strong> ${orderData.customerPincode || 'N/A'}</p>
        </div>
        
        <h3>Items to Deliver:</h3>
        <ul>
          ${orderData.items.map((item: any) => `<li>${item.product?.name || 'Product'} - Qty: ${item.quantity}</li>`).join('')}
        </ul>
        
        <p>
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/vendor/orders/${orderId}" style="display: inline-block; background-color: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Order Details</a>
        </p>
      </div>
      
      <div style="background-color: #f5f5f5; padding: 20px; text-align: center; border-top: 1px solid #ddd;">
        <p style="color: #999; font-size: 12px;">© 2026 Petmaza. All rights reserved.</p>
      </div>
    </div>
  `;

  return sendEmail({
    to: vendorEmail,
    subject: `New Order Assigned - ${orderId}`,
    html,
    trigger: 'vendor_order_notification',
    orderId,
  });
}

/**
 * Send admin order notification
 */
export async function sendAdminOrderNotificationEmail(
  adminEmail: string,
  orderId: string,
  orderData: any
) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #ffd700; padding: 20px; text-align: center;">
        <h1 style="margin: 0; color: #333;">🐾 PETMAZA Admin Dashboard</h1>
      </div>
      
      <div style="padding: 20px;">
        <h2>New Order Created</h2>
        
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Order ID:</strong> ${orderId}</p>
          <p><strong>Customer:</strong> ${orderData.customerName || 'N/A'}</p>
          <p><strong>Amount:</strong> ₹${(orderData.totalAmount || 0).toFixed(2)}</p>
          <p><strong>Items:</strong> ${orderData.items.length}</p>
          <p><strong>Status:</strong> Pending Assignment</p>
          <p><strong>Created At:</strong> ${new Date().toLocaleString('en-IN')}</p>
        </div>
        
        <p>
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin/orders/${orderId}" style="display: inline-block; background-color: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Order in Dashboard</a>
        </p>
      </div>
    </div>
  `;

  return sendEmail({
    to: adminEmail,
    subject: `[ADMIN] New Order - ${orderId}`,
    html,
    trigger: 'admin_order_notification',
    orderId,
  });
}
