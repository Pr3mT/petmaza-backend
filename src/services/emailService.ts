import nodemailer from 'nodemailer';
import logger from '../config/logger';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      await this.transporter.sendMail({
        from: `"${process.env.EMAIL_FROM_NAME || 'PET Marketplace'}" <${process.env.SMTP_USER}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });
      logger.info(`Email sent successfully to ${options.to}`);
      return true;
    } catch (error) {
      logger.error('Email sending failed:', error);
      return false;
    }
  }

  // Order confirmation email
  async sendOrderConfirmation(customerEmail: string, orderId: string, orderDetails: any) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .order-details { background-color: white; padding: 15px; margin: 10px 0; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
          .button { display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Order Confirmed!</h1>
          </div>
          <div class="content">
            <p>Thank you for your order!</p>
            <div class="order-details">
              <h3>Order #${orderId}</h3>
              <p><strong>Total:</strong> ₹${orderDetails.total}</p>
              <p><strong>Payment Status:</strong> ${orderDetails.payment_status}</p>
              <p><strong>Delivery Address:</strong></p>
              <p>${orderDetails.customerAddress.street}<br>
                 ${orderDetails.customerAddress.city}, ${orderDetails.customerAddress.state}<br>
                 ${orderDetails.customerAddress.pincode}</p>
            </div>
            <p style="text-align: center; margin-top: 20px;">
              <a href="${process.env.FRONTEND_URL}/orders/${orderId}" class="button">Track Your Order</a>
            </p>
          </div>
          <div class="footer">
            <p>© 2024 PET Marketplace. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: customerEmail,
      subject: `Order Confirmation #${orderId}`,
      html,
    });
  }

  // Order status update email
  async sendOrderStatusUpdate(customerEmail: string, orderId: string, status: string, trackingDetails?: any) {
    const statusMessages: Record<string, string> = {
      ASSIGNED: 'Your order has been assigned to a vendor',
      ACCEPTED: 'Your order has been accepted and is being prepared',
      PACKED: 'Your order has been packed and is ready for pickup',
      PICKED_UP: 'Your order has been picked up by the courier',
      IN_TRANSIT: 'Your order is on its way',
      DELIVERED: 'Your order has been delivered',
      CANCELLED: 'Your order has been cancelled',
    };

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2196F3; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .status-box { background-color: white; padding: 15px; margin: 10px 0; border-left: 4px solid #2196F3; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
          .button { display: inline-block; padding: 10px 20px; background-color: #2196F3; color: white; text-decoration: none; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Order Update</h1>
          </div>
          <div class="content">
            <div class="status-box">
              <h3>Order #${orderId}</h3>
              <p><strong>Status:</strong> ${status}</p>
              <p>${statusMessages[status] || 'Your order status has been updated'}</p>
              ${trackingDetails ? `<p><strong>Tracking ID:</strong> ${trackingDetails.tracking_id}</p>` : ''}
            </div>
            <p style="text-align: center; margin-top: 20px;">
              <a href="${process.env.FRONTEND_URL}/orders/${orderId}" class="button">Track Your Order</a>
            </p>
          </div>
          <div class="footer">
            <p>© 2024 PET Marketplace. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: customerEmail,
      subject: `Order Update: ${statusMessages[status]} - #${orderId}`,
      html,
    });
  }

  // Vendor order assignment email
  async sendVendorOrderAssignment(vendorEmail: string, orderId: string, orderDetails: any) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #FF9800; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .order-box { background-color: white; padding: 15px; margin: 10px 0; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
          .button { display: inline-block; padding: 10px 20px; background-color: #FF9800; color: white; text-decoration: none; border-radius: 5px; margin: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>New Order Assignment</h1>
          </div>
          <div class="content">
            <p>You have been assigned a new order!</p>
            <div class="order-box">
              <h3>Order #${orderId}</h3>
              <p><strong>Total Amount:</strong> ₹${orderDetails.total}</p>
              <p><strong>Items:</strong> ${orderDetails.items.length} item(s)</p>
              <p><strong>Acceptance Deadline:</strong> ${new Date(orderDetails.acceptanceDeadline).toLocaleString()}</p>
            </div>
            <p style="text-align: center; margin-top: 20px;">
              <a href="${process.env.FRONTEND_URL}/vendor/orders/${orderId}" class="button">Accept Order</a>
              <a href="${process.env.FRONTEND_URL}/vendor/orders/${orderId}" class="button" style="background-color: #f44336;">Reject Order</a>
            </p>
          </div>
          <div class="footer">
            <p>© 2024 PET Marketplace. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: vendorEmail,
      subject: `New Order Assignment #${orderId}`,
      html,
    });
  }

  // Payment confirmation email
  async sendPaymentConfirmation(customerEmail: string, orderId: string, amount: number, paymentId: string) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .payment-box { background-color: white; padding: 15px; margin: 10px 0; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Payment Successful</h1>
          </div>
          <div class="content">
            <p>Your payment has been processed successfully!</p>
            <div class="payment-box">
              <h3>Payment Details</h3>
              <p><strong>Order ID:</strong> ${orderId}</p>
              <p><strong>Amount Paid:</strong> ₹${amount}</p>
              <p><strong>Payment ID:</strong> ${paymentId}</p>
              <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
            </div>
          </div>
          <div class="footer">
            <p>© 2024 PET Marketplace. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: customerEmail,
      subject: `Payment Confirmation - Order #${orderId}`,
      html,
    });
  }

  // Welcome email
  async sendWelcomeEmail(userEmail: string, userName: string) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #9C27B0; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
          .button { display: inline-block; padding: 10px 20px; background-color: #9C27B0; color: white; text-decoration: none; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to PET Marketplace!</h1>
          </div>
          <div class="content">
            <p>Hi ${userName},</p>
            <p>Thank you for joining PET Marketplace! We're excited to have you with us.</p>
            <p>Explore our wide range of pet products and enjoy a seamless shopping experience.</p>
            <p style="text-align: center; margin-top: 20px;">
              <a href="${process.env.FRONTEND_URL}/products" class="button">Start Shopping</a>
            </p>
          </div>
          <div class="footer">
            <p>© 2024 PET Marketplace. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: userEmail,
      subject: 'Welcome to PET Marketplace!',
      html,
    });
  }

  // Password reset email
  async sendPasswordResetEmail(userEmail: string, resetToken: string) {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #f44336; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
          .button { display: inline-block; padding: 10px 20px; background-color: #f44336; color: white; text-decoration: none; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <p>You requested to reset your password.</p>
            <p>Click the button below to reset your password. This link will expire in 1 hour.</p>
            <p style="text-align: center; margin-top: 20px;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </p>
            <p>If you didn't request this, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>© 2024 PET Marketplace. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: userEmail,
      subject: 'Password Reset Request',
      html,
    });
  }

  // Review reminder email
  async sendReviewReminder(customerEmail: string, orderId: string, products: any[]) {
    const productList = products.map(p => `<li>${p.name}</li>`).join('');
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #FFC107; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
          .button { display: inline-block; padding: 10px 20px; background-color: #FFC107; color: white; text-decoration: none; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>How was your experience?</h1>
          </div>
          <div class="content">
            <p>Thank you for your recent purchase! We'd love to hear your feedback.</p>
            <p>Please take a moment to review your order:</p>
            <ul>${productList}</ul>
            <p style="text-align: center; margin-top: 20px;">
              <a href="${process.env.FRONTEND_URL}/orders/${orderId}/review" class="button">Write a Review</a>
            </p>
          </div>
          <div class="footer">
            <p>© 2024 PET Marketplace. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: customerEmail,
      subject: 'Share Your Feedback - Order Review',
      html,
    });
  }
}

export default new EmailService();
