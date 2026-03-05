import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import EmailLog from '../models/EmailLog';
import logger from '../config/logger';
import { generatePaymentReceiptPDF } from './pdfGenerator';

// Load environment variables
dotenv.config();

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
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
  }>;
}

/**
 * Send email and log the attempt
 */
export async function sendEmail(options: EmailOptions) {
  try {
    const { to, cc, bcc, subject, html, trigger, orderId, userId, attachments } = options;

    // Send email directly without verification (verified once at startup)
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      cc,
      bcc,
      subject,
      html,
      attachments,
    });

    logger.info(`Email sent successfully: ${subject} to ${to}`);

    // Log successful email (non-blocking, don't fail email if logging fails)
    EmailLog.create({
      recipient: to,
      subject,
      body: html,
      status: 'sent',
      trigger,
      timestamp: new Date(),
      messageId: info.messageId,
      orderId,
      userId,
    }).catch((logError) => {
      logger.error(`Failed to log sent email: ${logError.message}`);
    });

    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    logger.error(`Email send failed: ${error.message}`);

    // Log failed email (non-blocking)
    EmailLog.create({
      recipient: options.to,
      subject: options.subject,
      body: options.html,
      status: 'failed',
      trigger: options.trigger,
      timestamp: new Date(),
      error: error.message,
      orderId: options.orderId,
      userId: options.userId,
    }).catch((logError) => {
      logger.error(`Failed to log failed email: ${logError.message}`);
    });

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
          ${orderData.items.map((item: any) => `<li>${item.product_id?.name || 'Product'} - Qty: ${item.quantity}</li>`).join('')}
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
  paymentId: string,
  orderData?: {
    items?: any[];
    customerAddress?: any;
    paymentGateway?: string;
    paymentMethod?: string;
  }
) {
  const itemsHtml = orderData?.items
    ? `
      <div style="margin: 20px 0;">
        <h3>Items Ordered:</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background-color: #f5f5f5; border-bottom: 2px solid #ddd;">
              <th style="padding: 10px; text-align: left;">Product</th>
              <th style="padding: 10px; text-align: center;">Qty</th>
              <th style="padding: 10px; text-align: right;">Price</th>
            </tr>
          </thead>
          <tbody>
            ${orderData.items
              .map(
                (item: any) => `
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px;">${item.product_id?.name || 'Product'}</td>
                <td style="padding: 10px; text-align: center;">${item.quantity}</td>
                <td style="padding: 10px; text-align: right;">₹${item.subtotal.toFixed(2)}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
          <tfoot>
            <tr style="border-top: 2px solid #ddd; font-weight: bold;">
              <td colspan="2" style="padding: 10px; text-align: right;">Total:</td>
              <td style="padding: 10px; text-align: right; color: #2e7d32; font-size: 18px;">₹${amount.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `
    : '';

  const addressHtml = orderData?.customerAddress
    ? `
      <div style="margin-top: 20px;">
        <h4 style="margin-bottom: 10px;">Delivery Address:</h4>
        <p style="background-color: #f9f9f9; padding: 10px; border-left: 3px solid #ffd700; margin: 0;">
          ${orderData.customerAddress.street}<br>
          ${orderData.customerAddress.city}, ${orderData.customerAddress.state}<br>
          Pincode: ${orderData.customerAddress.pincode}
        </p>
      </div>
    `
    : '';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #ddd;">
      <!-- Header -->
      <div style="background-color: #ffd700; padding: 25px; text-align: center;">
        <h1 style="margin: 0; color: #333; font-size: 32px;">🐾 PETMAZA</h1>
        <p style="margin: 5px 0 0 0; color: #555; font-size: 14px;">Payment Receipt</p>
      </div>
      
      <!-- Success Banner -->
      <div style="background-color: #c8e6c9; padding: 25px; text-align: center;">
        <div style="background-color: #2e7d32; color: white; width: 60px; height: 60px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 36px; margin-bottom: 10px;">✓</div>
        <h2 style="margin: 10px 0 5px 0; color: #2e7d32; font-size: 28px;">Payment Successful!</h2>
        <p style="margin: 0; color: #555;">Your order has been confirmed</p>
      </div>
      
      <div style="padding: 30px;">
        <p style="font-size: 16px; margin-bottom: 20px;">Hi <strong>${customerName}</strong>,</p>
        <p style="color: #555; line-height: 1.6;">
          Thank you for your payment! Your transaction has been completed successfully and your order is now confirmed. 
          We'll process your order shortly and keep you updated via email.
        </p>
        
        <!-- Payment Receipt -->
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #e0e0e0;">
          <h3 style="margin-top: 0; color: #333; border-bottom: 2px solid #ffd700; padding-bottom: 10px;">Payment Receipt</h3>
          
          <table style="width: 100%; margin-top: 15px;">
            <tr>
              <td style="padding: 8px 0; color: #666; width: 40%;">Order ID:</td>
              <td style="padding: 8px 0; font-weight: bold; color: #333;">${orderId}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Transaction ID:</td>
              <td style="padding: 8px 0; font-family: monospace; color: #333; font-size: 12px;">${paymentId}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Payment Gateway:</td>
              <td style="padding: 8px 0; color: #333;">
                <strong>${orderData?.paymentGateway || 'Razorpay'}</strong>
                ${orderData?.paymentMethod ? ` - ${orderData.paymentMethod}` : ''}
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Transaction Date:</td>
              <td style="padding: 8px 0; color: #333;">${new Date().toLocaleString('en-IN', {
                dateStyle: 'full',
                timeStyle: 'short',
              })}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Payment Status:</td>
              <td style="padding: 8px 0;">
                <span style="background-color: #c8e6c9; color: #2e7d32; padding: 4px 12px; border-radius: 12px; font-weight: bold; font-size: 12px;">PAID</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 0; color: #666; font-size: 18px; border-top: 2px solid #ddd; padding-top: 15px;">Amount Paid:</td>
              <td style="padding: 12px 0; font-size: 24px; font-weight: bold; color: #2e7d32; border-top: 2px solid #ddd; padding-top: 15px;">₹${amount.toFixed(2)}</td>
            </tr>
          </table>
        </div>
        
        ${itemsHtml}
        ${addressHtml}
        
        <!-- What's Next -->
        <div style="background-color: #e3f2fd; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #2196f3;">
          <h4 style="margin-top: 0; color: #1976d2;">📦 What's Next?</h4>
          <ul style="margin: 10px 0; padding-left: 20px; color: #555; line-height: 1.8;">
            <li>Your order will be assigned to nearest vendor</li>
            <li>Vendor will confirm product availability</li>
            <li>You'll receive shipping updates via email</li>
            <li>Expected delivery: 2-5 business days</li>
          </ul>
          <p style="margin: 15px 0 0 0;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/orders" style="display: inline-block; background-color: #2196f3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Track Your Order</a>
          </p>
        </div>
        
        <!-- Important Note -->
        <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
          <p style="margin: 0; color: #856404; font-size: 14px;">
            <strong>📄 Note:</strong> Please save this receipt for your records. You can also view and download your invoice from your account dashboard.
          </p>
        </div>
        
        <!-- Support -->
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
          <p style="color: #666; font-size: 14px; margin: 0;">Need help? Contact us:</p>
          <p style="margin: 5px 0;">
            <a href="mailto:support@petmaza.com" style="color: #2196f3; text-decoration: none;">support@petmaza.com</a>
          </p>
        </div>
      </div>
      
      <!-- Footer -->
      <div style="background-color: #f5f5f5; padding: 20px; text-align: center; border-top: 1px solid #ddd;">
        <p style="color: #999; font-size: 12px; margin: 5px 0;">This is an automated receipt. Please do not reply to this email.</p>
        <p style="color: #999; font-size: 12px; margin: 5px 0;">© ${new Date().getFullYear()} Petmaza. All rights reserved.</p>
      </div>
    </div>
  `;

  // Generate PDF attachment
  let pdfBuffer: Buffer | undefined;
  try {
    pdfBuffer = await generatePaymentReceiptPDF({
      orderId,
      customerName,
      customerEmail,
      transactionId: paymentId,
      transactionDate: new Date().toLocaleString('en-IN', {
        dateStyle: 'full',
        timeStyle: 'short',
      }),
      amount,
      paymentGateway: orderData?.paymentGateway || 'Razorpay',
      paymentMethod: orderData?.paymentMethod || 'Online Payment',
      items: orderData?.items,
      customerAddress: orderData?.customerAddress,
    });
    console.log('Payment receipt PDF generated successfully');
  } catch (pdfError) {
    console.error('Failed to generate payment receipt PDF:', pdfError);
    // Continue without PDF if generation fails
  }

  return sendEmail({
    to: customerEmail,
    subject: `Payment Receipt - Order ${orderId}`,
    html,
    trigger: 'payment_success',
    orderId,
    attachments: pdfBuffer
      ? [
          {
            filename: `Payment_Receipt_${orderId.replace('#', '')}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ]
      : undefined,
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
          ${orderData.items.map((item: any) => `<li>${item.product_id?.name || 'Product'} - Qty: ${item.quantity}</li>`).join('')}
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

/**
 * Send admin notification for delivered orders
 */
export async function sendAdminDeliveryNotificationEmail(
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
        <div style="background-color: #e8f5e9; padding: 20px; border-radius: 5px; text-align: center; margin: 20px 0;">
          <h2 style="margin: 0; font-size: 28px;">✅</h2>
          <h2 style="margin: 10px 0 0 0; color: #2e7d32;">Order Delivered Successfully</h2>
        </div>
        
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Delivery Details</h3>
          <p><strong>Order ID:</strong> ${orderId}</p>
          <p><strong>Customer:</strong> ${orderData.customerName || 'N/A'}</p>
          <p><strong>Order Amount:</strong> ₹${(orderData.totalAmount || 0).toFixed(2)}</p>
          <p><strong>Items Count:</strong> ${orderData.items?.length || 0}</p>
          <p><strong>Status:</strong> <span style="color: #2e7d32; font-weight: bold;">DELIVERED</span></p>
          <p><strong>Delivered At:</strong> ${orderData.deliveredAt || new Date().toLocaleString('en-IN')}</p>
          <p><strong>Delivered By:</strong> ${orderData.vendorName || 'Vendor'}</p>
        </div>
        
        <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h4 style="margin-top: 0;">📦 Items Delivered:</h4>
          <ul style="margin: 10px 0; padding-left: 20px;">
            ${orderData.items?.map((item: any) => `<li>${item.product_id?.name || 'Product'} - Qty: ${item.quantity} - ₹${(item.sellingPrice || 0).toFixed(2)}</li>`).join('') || '<li>No items</li>'}
          </ul>
        </div>
        
        <p>
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin/orders/${orderId.replace('#', '')}" style="display: inline-block; background-color: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Order Details</a>
        </p>
      </div>
      
      <div style="background-color: #f5f5f5; padding: 20px; text-align: center; border-top: 1px solid #ddd;">
        <p style="color: #999; font-size: 12px;">© 2026 Petmaza. All rights reserved.</p>
      </div>
    </div>
  `;

  return sendEmail({
    to: adminEmail,
    subject: `[ADMIN] Order Delivered - ${orderId}`,
    html,
    trigger: 'admin_delivery_notification',
    orderId,
  });
}

/**
 * Send fulfiller/warehouse delivery notification
 */
export async function sendFulfillerDeliveryNotificationEmail(
  fulfillerEmail: string,
  fulfillerName: string,
  orderId: string,
  orderData: any
) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #ffd700; padding: 20px; text-align: center;">
        <h1 style="margin: 0; color: #333;">🐾 PETMAZA Fulfiller Portal</h1>
      </div>
      
      <div style="padding: 20px;">
        <div style="background-color: #fff3cd; padding: 20px; border-radius: 5px; text-align: center; margin: 20px 0;">
          <h2 style="margin: 0; font-size: 28px;">📦</h2>
          <h2 style="margin: 10px 0 0 0; color: #ff6f00;">Order Ready for Delivery</h2>
        </div>
        
        <p>Hi ${fulfillerName},</p>
        <p>A new order has been assigned to you for delivery. Please prepare and deliver the items as soon as possible.</p>
        
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3>Delivery Assignment Details</h3>
          <p><strong>Order ID:</strong> ${orderId}</p>
          <p><strong>Customer Name:</strong> ${orderData.customerName || 'N/A'}</p>
          <p><strong>Delivery Address:</strong><br>${orderData.customerAddress || 'N/A'}</p>
          <p><strong>Customer Phone:</strong> ${orderData.customerPhone || 'Contact in order details'}</p>
          <p><strong>Total Amount:</strong> ₹${(orderData.totalAmount || 0).toFixed(2)}</p>
          <p><strong>Delivery Pincode:</strong> ${orderData.customerPincode || 'N/A'}</p>
        </div>
        
        <h3>Items to Deliver:</h3>
        <ul>
          ${orderData.items.map((item: any) => `<li>${item.product_id?.name || 'Product'} - Qty: ${item.quantity}</li>`).join('')}
        </ul>
        
        <div style="background-color: #e8f5e9; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h4 style="margin-top: 0;">Instructions:</h4>
          <p>1. Verify items match the order</p>
          <p>2. Pack items securely</p>
          <p>3. Deliver to the provided address</p>
          <p>4. Get customer signature/confirmation</p>
          <p>5. Update delivery status in the portal</p>
        </div>
        
        <p>
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/fulfiller/deliveries/${orderId}" style="display: inline-block; background-color: #ff6f00; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Delivery Details</a>
        </p>
      </div>
      
      <div style="background-color: #f5f5f5; padding: 20px; text-align: center; border-top: 1px solid #ddd;">
        <p style="color: #999; font-size: 12px;">© 2026 Petmaza. All rights reserved.</p>
      </div>
    </div>
  `;

  return sendEmail({
    to: fulfillerEmail,
    subject: `Delivery Assignment - ${orderId}`,
    html,
    trigger: 'fulfiller_delivery_notification',
    orderId,
  });
}

/**
 * Send delivery completed notification to customer
 */
export async function sendDeliveryCompletedEmail(
  customerEmail: string,
  customerName: string,
  orderId: string,
  deliveryDate: string
) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #ffd700; padding: 20px; text-align: center;">
        <h1 style="margin: 0; color: #333;">🐾 PETMAZA</h1>
      </div>
      
      <div style="padding: 20px;">
        <div style="background-color: #c8e6c9; padding: 20px; border-radius: 5px; text-align: center; margin: 20px 0;">
          <h2 style="margin: 0; font-size: 36px;">📦</h2>
          <h2 style="margin: 10px 0 0 0; color: #2e7d32;">Delivery Complete!</h2>
        </div>
        
        <p>Hi ${customerName},</p>
        <p>Your order has been successfully delivered! Thank you for shopping with Petmaza.</p>
        
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Order ID:</strong> ${orderId}</p>
          <p><strong>Delivered On:</strong> ${deliveryDate}</p>
          <p><strong>Status:</strong> <span style="color: #2e7d32; font-weight: bold;">DELIVERED</span></p>
        </div>
        
        <div style="background-color: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h4 style="margin-top: 0;">What's Next?</h4>
          <p>✓ You can review products in your account</p>
          <p>✓ Submit ratings and feedback</p>
          <p>✓ Continue shopping for more pet products</p>
        </div>
        
        <p>
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/orders/${orderId}" style="display: inline-block; background-color: #2e7d32; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Order Details</a>
        </p>
        
        <p style="color: #666; font-size: 12px; margin-top: 20px;">
          If you have any issues with your delivery, please contact support@petmaza.com
        </p>
      </div>
      
      <div style="background-color: #f5f5f5; padding: 20px; text-align: center; border-top: 1px solid #ddd;">
        <p style="color: #999; font-size: 12px;">© 2026 Petmaza. All rights reserved.</p>
      </div>
    </div>
  `;

  return sendEmail({
    to: customerEmail,
    subject: `Order Delivered - ${orderId}`,
    html,
    trigger: 'delivery_completed',
    orderId,
  });
}

/**
 * Send order accepted notification to customer
 */
export async function sendOrderAcceptedEmail(
  customerEmail: string,
  customerName: string,
  orderId: string,
  vendorName: string,
  estimatedDelivery?: string
) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #ffd700; padding: 20px; text-align: center;">
        <h1 style="margin: 0; color: #333;">🐾 PETMAZA</h1>
      </div>
      
      <div style="padding: 20px;">
        <div style="background-color: #c8e6c9; padding: 20px; border-radius: 5px; text-align: center; margin: 20px 0;">
          <h2 style="margin: 0; font-size: 36px;">✓</h2>
          <h2 style="margin: 10px 0 0 0; color: #2e7d32;">Products Available!</h2>
          <p style="margin: 10px 0 0 0; font-size: 14px;">Your order has been accepted</p>
        </div>
        
        <p>Hi ${customerName},</p>
        <p>Great news! Your order has been accepted by our vendor. All products are available and your order is being prepared for delivery.</p>
        
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Order ID:</strong> ${orderId}</p>
          <p><strong>Status:</strong> <span style="color: #2e7d32; font-weight: bold;">ACCEPTED</span></p>
          ${estimatedDelivery ? `<p><strong>Estimated Delivery:</strong> ${estimatedDelivery}</p>` : ''}
        </div>
        
        <div style="background-color: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h4 style="margin-top: 0;">What happens next?</h4>
          <p>✓ Your order is being prepared</p>
          <p>✓ Products will be packed carefully</p>
          <p>✓ You'll receive tracking updates via email</p>
          <p>✓ Expected delivery within 2-5 business days</p>
        </div>
        
        <p>
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/orders/${orderId}" style="display: inline-block; background-color: #2e7d32; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Track Your Order</a>
        </p>
        
        <p style="color: #666; font-size: 12px; margin-top: 20px;">
          If you have any questions, please contact support@petmaza.com
        </p>
      </div>
      
      <div style="background-color: #f5f5f5; padding: 20px; text-align: center; border-top: 1px solid #ddd;">
        <p style="color: #999; font-size: 12px;">© 2026 Petmaza. All rights reserved.</p>
      </div>
    </div>
  `;

  return sendEmail({
    to: customerEmail,
    subject: `Order Accepted - ${orderId} ✓`,
    html,
    trigger: 'order_accepted',
    orderId,
  });
}

/**
 * Send order rejected notification to customer
 */
export async function sendOrderRejectedEmail(
  customerEmail: string,
  customerName: string,
  orderId: string,
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
          <h2 style="margin: 10px 0 0 0; color: #c62828;">Products Not Available</h2>
          <p style="margin: 10px 0 0 0; font-size: 14px;">Order could not be fulfilled</p>
        </div>
        
        <p>Hi ${customerName},</p>
        <p>We're sorry to inform you that your order could not be processed at this time.</p>
        
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Order ID:</strong> ${orderId}</p>
          <p><strong>Status:</strong> <span style="color: #c62828; font-weight: bold;">UNABLE TO FULFILL</span></p>
          <p><strong>Reason:</strong> ${reason}</p>
        </div>
        
        <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h4 style="margin-top: 0;">What should you do?</h4>
          <p>✓ No payment has been charged</p>
          <p>✓ Try placing a new order with alternative products</p>
          <p>✓ Check product availability on our website</p>
          <p>✓ Contact us for product recommendations</p>
        </div>
        
        <p>
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/products" style="display: inline-block; background-color: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Browse Products</a>
        </p>
        
        <p style="color: #666; font-size: 12px; margin-top: 20px;">
          We apologize for the inconvenience. If you have questions, please contact support@petmaza.com
        </p>
      </div>
      
      <div style="background-color: #f5f5f5; padding: 20px; text-align: center; border-top: 1px solid #ddd;">
        <p style="color: #999; font-size: 12px;">© 2026 Petmaza. All rights reserved.</p>
      </div>
    </div>
  `;

  return sendEmail({
    to: customerEmail,
    subject: `Order Update - ${orderId}`,
    html,
    trigger: 'order_rejected',
    orderId,
  });
}

/**
 * Send order shipped notification to customer
 */
export async function sendOrderShippedEmail(
  customerEmail: string,
  customerName: string,
  orderId: string,
  trackingInfo?: string,
  estimatedDelivery?: string
) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #ffd700; padding: 20px; text-align: center;">
        <h1 style="margin: 0; color: #333;">🐾 PETMAZA</h1>
      </div>
      
      <div style="padding: 20px;">
        <div style="background-color: #e3f2fd; padding: 20px; border-radius: 5px; text-align: center; margin: 20px 0;">
          <h2 style="margin: 0; font-size: 36px;">🚚</h2>
          <h2 style="margin: 10px 0 0 0; color: #1976d2;">Your Order is On The Way!</h2>
          <p style="margin: 10px 0 0 0; font-size: 14px;">Products have been shipped</p>
        </div>
        
        <p>Hi ${customerName},</p>
        <p>Great news! Your order has been picked up by our delivery partner and is on its way to you.</p>
        
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Order ID:</strong> ${orderId}</p>
          <p><strong>Status:</strong> <span style="color: #1976d2; font-weight: bold;">IN TRANSIT</span></p>
          ${trackingInfo ? `<p><strong>Tracking Info:</strong> ${trackingInfo}</p>` : ''}
          ${estimatedDelivery ? `<p><strong>Estimated Delivery:</strong> ${estimatedDelivery}</p>` : ''}
        </div>
        
        <div style="background-color: #c8e6c9; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #2e7d32;">
          <h4 style="margin-top: 0;">🎉 Order Accepted & Ready for Delivery!</h4>
          <p style="margin: 5px 0;">✓ Products confirmed available</p>
          <p style="margin: 5px 0;">✓ Carefully packed and sealed</p>
          <p style="margin: 5px 0;">✓ Out for delivery</p>
          <p style="margin: 5px 0;">✓ Arriving soon at your doorstep</p>
        </div>
        
        <div style="background-color: #fff3e0; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h4 style="margin-top: 0;">📍 Track Your Delivery</h4>
          <p>You can track your order status in real-time from your account dashboard.</p>
        </div>
        
        <p>
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/orders/${orderId}" style="display: inline-block; background-color: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Track Order</a>
        </p>
        
        <p style="color: #666; font-size: 12px; margin-top: 20px;">
          If you have any questions about your delivery, please contact support@petmaza.com
        </p>
      </div>
      
      <div style="background-color: #f5f5f5; padding: 20px; text-align: center; border-top: 1px solid #ddd;">
        <p style="color: #999; font-size: 12px;">© ${new Date().getFullYear()} Petmaza. All rights reserved.</p>
      </div>
    </div>
  `;

  return sendEmail({
    to: customerEmail,
    subject: `Order Shipped - ${orderId} 🚚`,
    html,
    trigger: 'order_shipped',
    orderId,
  });
}

/**
 * Send refund initiated notification to customer
 */
export async function sendRefundInitiatedEmail(
  customerEmail: string,
  customerName: string,
  orderId: string,
  refundAmount: number,
  reason: string
) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #ffd700; padding: 20px; text-align: center;">
        <h1 style="margin: 0; color: #333;">🐾 PETMAZA</h1>
      </div>
      
      <div style="padding: 20px;">
        <div style="background-color: #fff3e0; padding: 20px; border-radius: 5px; text-align: center; margin: 20px 0;">
          <h2 style="margin: 0; font-size: 36px;">💰</h2>
          <h2 style="margin: 10px 0 0 0; color: #f57c00;">Refund Initiated</h2>
          <p style="margin: 10px 0 0 0; font-size: 14px;">Your refund is being processed</p>
        </div>
        
        <p>Hi ${customerName},</p>
        <p>We're sorry that your order couldn't be fulfilled. We've initiated a refund for your order.</p>
        
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Order ID:</strong> ${orderId}</p>
          <p><strong>Refund Amount:</strong> <span style="color: #2e7d32; font-size: 18px; font-weight: bold;">₹${refundAmount.toFixed(2)}</span></p>
          <p><strong>Reason:</strong> ${reason}</p>
          <p><strong>Status:</strong> <span style="color: #f57c00; font-weight: bold;">REFUND INITIATED</span></p>
        </div>
        
        <div style="background-color: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #1976d2;">
          <h4 style="margin-top: 0;">⏱️ Refund Timeline</h4>
          <p style="margin: 5px 0;">Your refund has been <strong>initiated</strong> and will be credited to your account within <strong>6-7 working days</strong>.</p>
          <p style="margin: 10px 0 5px 0; font-size: 14px;">The amount will be refunded to:</p>
          <p style="margin: 5px 0;">✓ Original payment method used during purchase</p>
          <p style="margin: 5px 0;">✓ Same account/card used for payment</p>
        </div>
        
        <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h4 style="margin-top: 0;">📝 Important Information</h4>
          <p style="margin: 5px 0;">• Refund processing time: 6-7 working days</p>
          <p style="margin: 5px 0;">• You will receive a confirmation once the refund is credited</p>
          <p style="margin: 5px 0;">• If you don't receive the refund within 10 working days, please contact us</p>
          <p style="margin: 5px 0;">• We apologize for the inconvenience caused</p>
        </div>
        
        <div style="text-align: center; margin: 25px 0;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/products" style="display: inline-block; background-color: #2e7d32; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-right: 10px;">Browse Products</a>
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/orders" style="display: inline-block; background-color: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">View Orders</a>
        </div>
        
        <p style="color: #666; font-size: 12px; margin-top: 20px;">
          We apologize for the inconvenience. If you have any questions about your refund, please contact support@petmaza.com or call our customer care.
        </p>
      </div>
      
      <div style="background-color: #f5f5f5; padding: 20px; text-align: center; border-top: 1px solid #ddd;">
        <p style="color: #999; font-size: 12px;">© ${new Date().getFullYear()} Petmaza. All rights reserved.</p>
      </div>
    </div>
  `;

  return sendEmail({
    to: customerEmail,
    subject: `Refund Initiated - Order ${orderId}`,
    html,
    trigger: 'refund_initiated',
    orderId,
  });
}

// ========================================
// QUEUED EMAIL FUNCTIONS (NON-BLOCKING)
// ========================================

import { emailQueue } from '../utils/emailQueue';

/**
 * Queue order confirmation email (non-blocking)
 * Returns immediately without waiting for email to send
 */
export function queueOrderConfirmationEmail(
  customerEmail: string,
  customerName: string,
  orderId: string,
  orderData: any
): string {
  return emailQueue.add(async () => {
    await sendOrderConfirmationEmail(customerEmail, customerName, orderId, orderData);
  });
}

/**
 * Queue vendor notification email (non-blocking)
 */
export function queueVendorOrderNotificationEmail(
  vendorEmail: string,
  vendorName: string,
  orderId: string,
  orderData: any
): string {
  return emailQueue.add(async () => {
    await sendVendorOrderNotificationEmail(vendorEmail, vendorName, orderId, orderData);
  });
}

/**
 * Queue order status update email (non-blocking)
 */
export function queueOrderStatusUpdateEmail(
  customerEmail: string,
  customerName: string,
  orderId: string,
  status: string,
  vendorName?: string
): string {
  return emailQueue.add(async () => {
    await sendOrderStatusUpdateEmail(customerEmail, customerName, orderId, status, vendorName);
  });
}

/**
 * Queue payment success email (non-blocking)
 */
export function queuePaymentSuccessEmail(
  customerEmail: string,
  customerName: string,
  orderId: string,
  amount: number,
  razorpayPaymentId: string,
  orderDetails: any
): string {
  return emailQueue.add(async () => {
    await sendPaymentSuccessEmail(customerEmail, customerName, orderId, amount, razorpayPaymentId, orderDetails);
  });
}

/**
 * Queue order accepted email (non-blocking)
 */
export function queueOrderAcceptedEmail(
  customerEmail: string,
  customerName: string,
  orderId: string,
  vendorName: string,
  estimatedDelivery: string
): string {
  return emailQueue.add(async () => {
    await sendOrderAcceptedEmail(customerEmail, customerName, orderId, vendorName, estimatedDelivery);
  });
}
