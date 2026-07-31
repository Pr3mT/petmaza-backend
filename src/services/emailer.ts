import { SendMailClient } from 'zeptomail';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import EmailLog from '../models/EmailLog';
import logger from '../config/logger';
import { generatePaymentReceiptPDF } from './pdfGenerator';

// Load environment variables
dotenv.config();

// ZeptoMail client - uses HTTPS API (not SMTP, works on all hosting providers)
const zeptoHost = (process.env.ZEPTOMAIL_HOST || 'api.zeptomail.com').replace(/https?:\/\//, '').replace(/\/$/, '') + '/';
const zeptoToken = process.env.ZEPTOMAIL_TOKEN || '';
const zeptoClient = new SendMailClient({
  url: zeptoHost,
  token: zeptoToken,
});

// Determine email sending method
const useZeptoMail = !!zeptoToken;

// SMTP (nodemailer) transporter — used when ZeptoMail token is not configured
const smtpTransporter = !useZeptoMail && process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  : null;

if (useZeptoMail) {
  logger.info(`[Emailer] Using ZeptoMail (host=${zeptoHost}, token=****)`);
} else if (smtpTransporter) {
  logger.info(`[Emailer] ZeptoMail token missing — using SMTP fallback (host=${process.env.SMTP_HOST}, user=${process.env.SMTP_USER})`);
} else {
  logger.warn('[Emailer] ⚠️  No email provider configured! Set ZEPTOMAIL_TOKEN or SMTP_HOST in .env');
}

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

    let messageId = '';

    if (useZeptoMail) {
      // Send via ZeptoMail HTTPS API
      const resp = await zeptoClient.sendMail({
        from: {
          address: process.env.ZEPTOMAIL_FROM_ADDRESS || 'noreply@petmaza.com',
          name: process.env.ZEPTOMAIL_FROM_NAME || 'PETMAZA',
        },
        to: [{ email_address: { address: to, name: to } }],
        ...(cc?.length ? { cc: cc.map(addr => ({ email_address: { address: addr, name: addr } })) } : {}),
        ...(bcc?.length ? { bcc: bcc.map(addr => ({ email_address: { address: addr, name: addr } })) } : {}),
        subject,
        htmlbody: html,
        ...(attachments?.length ? {
          attachments: attachments.map(a => ({
            content: a.content.toString('base64'),
            mime_type: a.contentType,
            name: a.filename,
          })),
        } : {}),
      } as any);
      messageId = (resp as any)?.request_id || '';
    } else if (smtpTransporter) {
      // Fallback: Send via SMTP (nodemailer)
      const fromAddress = `"${process.env.EMAIL_FROM_NAME || 'PETMAZA'}" <${process.env.SMTP_USER}>`;
      const info = await smtpTransporter.sendMail({
        from: fromAddress,
        to,
        ...(cc?.length ? { cc: cc.join(',') } : {}),
        ...(bcc?.length ? { bcc: bcc.join(',') } : {}),
        subject,
        html,
        ...(attachments?.length ? {
          attachments: attachments.map(a => ({
            filename: a.filename,
            content: a.content,
            contentType: a.contentType,
          })),
        } : {}),
      });
      messageId = info.messageId || '';
    } else {
      throw new Error('No email provider configured. Set ZEPTOMAIL_TOKEN or SMTP_HOST in .env');
    }
    logger.info(`Email sent successfully: ${subject} to ${to}`);

    // Log successful email (non-blocking, don't fail email if logging fails)
    EmailLog.create({
      recipient: to,
      subject,
      body: html,
      status: 'sent',
      trigger,
      timestamp: new Date(),
      messageId,
      orderId,
      userId,
    }).catch((logError) => {
      logger.error(`Failed to log sent email: ${logError.message}`);
    });

    return { success: true, messageId };
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

// ─────────────────────────────────────────────────────────────────────────────
// Shared email design system
//
// A small set of reusable building blocks so every customer-facing email shares
// one consistent, modern look (header, hero banner, cards, detail rows, button,
// footer). Change these in one place to restyle the whole email system.
// ─────────────────────────────────────────────────────────────────────────────

const EMAIL_SUPPORT = 'support@petmaza.com';

/** Colour palette used across all emails. */
const EMAIL_THEME = {
  brand: '#FFD400',
  ink: '#1f2937',
  muted: '#6b7280',
  faint: '#9ca3af',
  line: '#eceef1',
  cardBg: '#f9fafb',
  // semantic accents: [text, background]
  success: ['#15803d', '#dcfce7'],
  info: ['#1e40af', '#dbeafe'],
  warn: ['#b45309', '#fef3c7'],
  danger: ['#b91c1c', '#fee2e2'],
} as const;

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

/** Wraps inner content in the standard Petmaza email shell (header + footer). */
function emailShell(content: string, preheader = ''): string {
  return `
  <div style="margin:0; padding:24px 12px; background-color:#eef0f3;">
    ${preheader ? `<div style="display:none; max-height:0; overflow:hidden; opacity:0; color:#eef0f3; font-size:1px; line-height:1px;">${preheader}</div>` : ''}
    <div style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; max-width:600px; margin:0 auto; background-color:#ffffff; border-radius:14px; overflow:hidden; box-shadow:0 1px 4px rgba(0,0,0,0.06);">
      <div style="background-color:${EMAIL_THEME.brand}; padding:22px 24px; text-align:center;">
        <span style="font-size:22px; font-weight:800; letter-spacing:1px; color:${EMAIL_THEME.ink};">🐾 PETMAZA</span>
      </div>
      <div style="padding:28px 28px 14px 28px; color:${EMAIL_THEME.ink}; font-size:15px; line-height:1.6;">
        ${content}
      </div>
      <div style="padding:22px 24px; text-align:center; background-color:#fafbfc; border-top:1px solid ${EMAIL_THEME.line};">
        <p style="margin:0 0 6px 0; color:${EMAIL_THEME.muted}; font-size:13px;">Need help? <a href="mailto:${EMAIL_SUPPORT}" style="color:#2563eb; text-decoration:none;">${EMAIL_SUPPORT}</a></p>
        <p style="margin:0; color:${EMAIL_THEME.faint}; font-size:12px;">© ${new Date().getFullYear()} Petmaza. All rights reserved.</p>
      </div>
    </div>
  </div>`;
}

/** Coloured hero banner with a big icon, title and optional subtitle. */
function emailHero(
  icon: string,
  title: string,
  subtitle = '',
  accent: readonly [string, string] = EMAIL_THEME.info
): string {
  const [fg, bg] = accent;
  return `
    <div style="background-color:${bg}; border-radius:12px; padding:26px 20px; text-align:center; margin:0 0 22px 0;">
      <div style="font-size:40px; line-height:1;">${icon}</div>
      <div style="margin:12px 0 0 0; color:${fg}; font-size:21px; font-weight:700;">${title}</div>
      ${subtitle ? `<div style="margin:6px 0 0 0; color:${fg}; font-size:14px; opacity:0.9;">${subtitle}</div>` : ''}
    </div>`;
}

/** A light rounded card, optionally with a coloured left accent bar. */
function emailCard(inner: string, accentColor?: string): string {
  return `<div style="background-color:${EMAIL_THEME.cardBg}; border:1px solid ${EMAIL_THEME.line}; border-radius:10px; padding:18px 20px; margin:18px 0;${accentColor ? ` border-left:4px solid ${accentColor};` : ''}">${inner}</div>`;
}

/** Key/value rows for order details. Values may contain inline HTML. */
function detailRows(rows: Array<[string, string]>): string {
  return `
    <table style="width:100%; border-collapse:collapse;">
      ${rows
        .map(
          ([k, v]) => `
      <tr>
        <td style="padding:7px 0; color:${EMAIL_THEME.muted}; font-size:14px; vertical-align:top; width:42%;">${k}</td>
        <td style="padding:7px 0; color:${EMAIL_THEME.ink}; font-size:14px; font-weight:600; text-align:right; vertical-align:top;">${v}</td>
      </tr>`
        )
        .join('')}
    </table>`;
}

/** A pill-shaped status badge. */
function statusPill(label: string, accent: readonly [string, string] = EMAIL_THEME.info): string {
  const [fg, bg] = accent;
  return `<span style="display:inline-block; background-color:${bg}; color:${fg}; padding:3px 12px; border-radius:999px; font-size:12px; font-weight:700; letter-spacing:0.3px;">${label}</span>`;
}

/** A centred call-to-action button. */
function emailButton(label: string, href: string, color = '#2563eb'): string {
  return `
    <div style="text-align:center; margin:26px 0 10px 0;">
      <a href="${href}" style="display:inline-block; background-color:${color}; color:#ffffff; text-decoration:none; padding:13px 30px; border-radius:9px; font-weight:700; font-size:15px;">${label}</a>
    </div>`;
}

/** A bulleted "what's next" style list inside a soft card. */
function emailChecklist(title: string, items: string[], accent: readonly [string, string] = EMAIL_THEME.info): string {
  const [fg, bg] = accent;
  return `
    <div style="background-color:${bg}; border-radius:10px; padding:18px 20px; margin:18px 0;">
      <div style="margin:0 0 10px 0; color:${fg}; font-size:15px; font-weight:700;">${title}</div>
      ${items.map((i) => `<div style="margin:6px 0; color:${EMAIL_THEME.ink}; font-size:14px;">✓ ${i}</div>`).join('')}
    </div>`;
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
  // Debug logging
  logger.info('DEBUG - sendOrderConfirmationEmail - orderData:', {
    orderId,
    discountAmount: orderData.discountAmount,
    couponCode: orderData.couponCode,
    totalAmount: orderData.totalAmount,
    subtotalBeforeCharges: orderData.subtotalBeforeCharges,
  });
  
  // Check if this is a split shipment
  const isSplit = orderData.isSplitShipment || false;
  const splitCount = orderData.splitOrderCount || 1;
  const splitIds = orderData.splitOrderIds || [orderId];

  const itemsList = orderData.items
    .map(
      (item: any) => `
      <tr>
        <td style="padding:8px 0; border-bottom:1px solid ${EMAIL_THEME.line}; font-size:14px; color:${EMAIL_THEME.ink};">${item.product_id?.name || 'Product'} <span style="color:${EMAIL_THEME.muted};">× ${item.quantity}</span></td>
        <td style="padding:8px 0; border-bottom:1px solid ${EMAIL_THEME.line}; font-size:14px; color:${EMAIL_THEME.ink}; font-weight:600; text-align:right;">₹${(item.subtotal || item.price * item.quantity).toFixed(2)}</td>
      </tr>`
    )
    .join('');

  const summaryRows: Array<[string, string]> = [
    ['Subtotal', `₹${(orderData.subtotalBeforeCharges || orderData.subtotal || 0).toFixed(2)}`],
  ];
  if (orderData.discountAmount > 0) {
    summaryRows.push([
      `Discount${orderData.couponCode ? ` (${orderData.couponCode})` : ''}`,
      `<span style="color:#15803d;">-₹${(orderData.discountAmount || 0).toFixed(2)}</span>`,
    ]);
  }
  summaryRows.push(['Shipping Charges', `₹${(orderData.shippingCharges || 0).toFixed(2)}`]);
  summaryRows.push(['Platform Fee', `₹${(orderData.platformFee || 0).toFixed(2)}`]);

  const html = emailShell(
    `
      ${emailHero('🐾', 'Order Confirmed', 'Thank you for shopping with us!', EMAIL_THEME.success)}

      <p style="margin:0 0 12px 0;">Hi ${customerName},</p>
      <p style="margin:0 0 4px 0;">Thank you for your order! We're excited to help you find the perfect pet products.</p>

      ${
        isSplit
          ? emailCard(
              `<div style="color:${EMAIL_THEME.warn[0]}; font-weight:700; margin-bottom:6px;">📦 Split Shipment</div>
        <div style="font-size:14px;">Your order will arrive in <strong>${splitCount} separate shipments</strong> for faster delivery.</div>
        <div style="font-size:13px; color:${EMAIL_THEME.muted}; margin-top:8px;"><strong>Order IDs:</strong> ${splitIds.join(', ')}</div>`,
              '#ffc107'
            )
          : ''
      }

      ${emailCard(
        detailRows([
          ['Order ID', `#${orderId}`],
          ['Order Date', new Date().toLocaleDateString('en-IN')],
          ['Status', statusPill('PENDING', EMAIL_THEME.warn)],
        ])
      )}

      <div style="margin:18px 0 6px 0; font-weight:700; font-size:15px;">Items Ordered (${orderData.items.length})</div>
      ${emailCard(
        `<table style="width:100%; border-collapse:collapse;">
          ${itemsList}
          ${detailRows(summaryRows)}
          <table style="width:100%; border-collapse:collapse; margin-top:6px; border-top:2px solid ${EMAIL_THEME.line};">
            <tr>
              <td style="padding:12px 0 0 0; font-size:15px; font-weight:800; color:${EMAIL_THEME.ink};">Total Amount</td>
              <td style="padding:12px 0 0 0; font-size:16px; font-weight:800; color:#15803d; text-align:right;">₹${(orderData.totalAmount || 0).toFixed(2)}</td>
            </tr>
          </table>
        </table>`
      )}

      ${emailCard(
        `<div style="font-weight:700; margin-bottom:6px;">Delivery Address</div>
        <div style="font-size:14px; color:${EMAIL_THEME.muted}; line-height:1.6;">
          ${orderData.customerAddress?.street || 'N/A'}<br>
          ${orderData.customerAddress?.city || 'N/A'}, ${orderData.customerAddress?.state || 'N/A'}<br>
          Pincode: ${orderData.customerAddress?.pincode || 'N/A'}
        </div>`
      )}

      ${emailChecklist('What’s next?', [
        'Payment will be verified',
        isSplit ? 'Each item is processed by its assigned warehouse' : 'Order will be assigned to the nearest vendor',
        "You'll receive email updates for each shipment",
        ...(isSplit ? ['Track each shipment separately in your order history'] : []),
        'Estimated Delivery: 7-10 days',
      ])}
    `,
    `Order confirmed — #${orderId}`
  );

  return sendEmail({
    to: customerEmail,
    subject: `Order Confirmation - ${orderId}${isSplit ? ` (${splitCount} shipments)` : ''}`,
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
  vendorName?: string,
  tracking?: { company?: string; trackingId?: string; trackingLink?: string }
) {
  const statusMessages: Record<string, { title: string; icon: string; description: string }> = {
    confirmed: {
      title: 'Order Confirmed',
      icon: '✓',
      description: 'Your order has been confirmed.',
    },
    accepted: {
      title: 'Order Accepted',
      icon: '✓',
      description: 'Great news! Your order has been accepted and is being prepared for delivery.',
    },
    packed: {
      title: 'Order Packed',
      icon: '📦',
      description: 'Your order has been packed and is ready for pickup.',
    },
    picked_up: {
      title: 'Order Picked Up',
      icon: '🚚',
      description: 'Your order has been picked up by delivery partner.',
    },
    in_transit: {
      title: 'In Transit',
      icon: '🚚',
      description: 'Your order is on its way!',
    },
    shipped: {
      title: 'Order Shipped',
      icon: '🚚',
      description: 'Great news! Your order has been shipped and is on its way to you. Expected delivery within 2-5 business days.',
    },
    delivered: {
      title: 'Order Delivered',
      icon: '🎉',
      description: 'Your order has been successfully delivered. Thank you for shopping with Petmaza!',
    },
    cancelled: {
      title: 'Order Cancelled',
      icon: '❌',
      description: 'Your order has been cancelled. A refund will be processed shortly.',
    },
    rejected: {
      title: 'Order Update',
      icon: '⚠️',
      description: 'There was an issue with your order. Please check your order status.',
    },
  };

  const statusInfo = statusMessages[status.toLowerCase()] || statusMessages.confirmed;

  // Positive states get a green banner, problem states red, everything else blue.
  const s = status.toLowerCase();
  const accent =
    ['delivered', 'accepted', 'confirmed'].includes(s)
      ? EMAIL_THEME.success
      : ['cancelled', 'rejected'].includes(s)
      ? EMAIL_THEME.danger
      : EMAIL_THEME.info;

  const trackingHtml =
    tracking && (tracking.trackingId || tracking.trackingLink)
      ? emailCard(
          `
        <div style="margin:0 0 12px 0; color:${EMAIL_THEME.ink}; font-size:15px; font-weight:700;">📦 Tracking Details</div>
        ${detailRows([
          ...(tracking.company ? [['Courier', tracking.company] as [string, string]] : []),
          ...(tracking.trackingId
            ? [['Tracking ID', `<span style="font-family:monospace;">${tracking.trackingId}</span>`] as [string, string]]
            : []),
        ])}
        ${
          tracking.trackingLink
            ? `${emailButton('🔍 Track Your Order', tracking.trackingLink, '#2563eb')}
        <p style="margin:8px 0 0 0; font-size:12px; color:${EMAIL_THEME.muted}; word-break:break-all; text-align:center;">
          Or copy this link: <a href="${tracking.trackingLink}" target="_blank" style="color:#2563eb;">${tracking.trackingLink}</a>
        </p>`
            : ''
        }`,
          '#ffc107'
        )
      : '';

  const html = emailShell(
    `
      ${emailHero(statusInfo.icon, statusInfo.title, '', accent)}

      <p style="margin:0 0 12px 0;">Hi ${customerName},</p>
      <p style="margin:0 0 4px 0;">${statusInfo.description}</p>

      ${emailCard(
        detailRows([
          ['Order ID', `#${orderId}`],
          ['Status', statusPill(status.toUpperCase(), accent)],
          ['Last Updated', new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })],
        ])
      )}
      ${trackingHtml}
    `,
    `${statusInfo.title} — order #${orderId}`
  );

  return sendEmail({
    to: customerEmail,
    subject: `Order ${statusInfo.title} - #${orderId}`,
    html,
    trigger: 'order_status_update',
    orderId,
  });
}

/**
 * Send order rejection with refund notification email
 */
export async function sendOrderRejectionEmail(
  customerEmail: string,
  customerName: string,
  orderId: string,
  reason: string,
  amount: number
) {
  logger.info(`[sendOrderRejectionEmail] Starting to send rejection email to ${customerEmail} for order ${orderId}`);
  
  const html = emailShell(
    `
      ${emailHero('⚠️', 'Order Rejected', 'A refund has been initiated', EMAIL_THEME.warn)}

      <p style="margin:0 0 12px 0;">Hi ${customerName},</p>
      <p style="margin:0 0 4px 0;">We regret to inform you that your order has been rejected by the vendor for the reason below.</p>

      ${emailCard(`<div style="color:${EMAIL_THEME.danger[0]};"><strong>Reason:</strong> ${reason}</div>`, '#dc2626')}

      ${emailCard(
        detailRows([
          ['Order ID', `#${orderId}`],
          ['Order Amount', `₹${amount.toFixed(2)}`],
          ['Refund Status', statusPill('INITIATED', EMAIL_THEME.success)],
        ])
      )}

      ${emailCard(
        `<div style="color:${EMAIL_THEME.success[0]}; font-weight:700; margin-bottom:6px;">💰 Refund Information</div>
        <div style="font-size:14px;">Your payment of <strong>₹${amount.toFixed(2)}</strong> will be refunded to your original payment method within <strong>3-4 business days</strong>.</div>
        <div style="font-size:12px; color:${EMAIL_THEME.muted}; margin-top:6px;">Exact time may vary depending on your bank or payment provider.</div>`,
        '#16a34a'
      )}

      ${emailButton('Browse Products', `${FRONTEND_URL}/products`, '#2563eb')}
    `,
    `Order #${orderId} rejected — refund initiated`
  );

  try {
    const result = await sendEmail({
      to: customerEmail,
      subject: `Order Rejected - Refund Initiated - #${orderId}`,
      html,
      trigger: 'order_rejection_refund',
      orderId,
    });
    logger.info(`[sendOrderRejectionEmail] Email sent successfully to ${customerEmail} for order ${orderId}, MessageId: ${result.messageId}`);
    return result;
  } catch (error: any) {
    logger.error(`[sendOrderRejectionEmail] Failed to send email to ${customerEmail} for order ${orderId}: ${error.message}`);
    throw error;
  }
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

  const html = emailShell(
    `
      ${emailHero('✓', 'Payment Successful', 'Your order has been confirmed', EMAIL_THEME.success)}

      <p style="margin:0 0 12px 0;">Hi <strong>${customerName}</strong>,</p>
      <p style="margin:0 0 4px 0;">Thank you for your payment! Your transaction has been completed successfully and your order is now confirmed. We'll keep you updated via email.</p>

      ${emailCard(
        `<div style="margin:0 0 12px 0; font-weight:700; font-size:15px;">Payment Receipt</div>
        ${detailRows([
          ['Order ID', `#${orderId}`],
          ['Transaction ID', `<span style="font-family:monospace; font-size:12px;">${paymentId}</span>`],
          [
            'Payment Gateway',
            `${orderData?.paymentGateway || 'Razorpay'}${orderData?.paymentMethod ? ` - ${orderData.paymentMethod}` : ''}`,
          ],
          ['Transaction Date', new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })],
          ['Payment Status', statusPill('PAID', EMAIL_THEME.success)],
        ])}
        <table style="width:100%; border-collapse:collapse; margin-top:6px; border-top:2px solid ${EMAIL_THEME.line};">
          <tr>
            <td style="padding:12px 0 0 0; font-size:15px; font-weight:800; color:${EMAIL_THEME.ink};">Amount Paid</td>
            <td style="padding:12px 0 0 0; font-size:16px; font-weight:800; color:#15803d; text-align:right;">₹${amount.toFixed(2)}</td>
          </tr>
        </table>`
      )}

      ${itemsHtml}
      ${addressHtml}

      ${emailChecklist('📦 What’s next?', [
        'Your order will be assigned to the nearest vendor',
        'Vendor will confirm product availability',
        "You'll receive shipping updates via email",
        'Estimated Delivery: 7-10 days',
      ])}

      ${emailButton('Track Your Order', `${FRONTEND_URL}/orders`, '#2563eb')}

      ${emailCard(
        `<div style="font-size:14px; color:${EMAIL_THEME.muted};"><strong style="color:${EMAIL_THEME.ink};">📄 Note:</strong> Please save this receipt. You can also download your invoice from your account dashboard.</div>`,
        '#ffc107'
      )}
    `,
    `Payment received for order #${orderId}`
  );

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
    logger.info('Payment receipt PDF generated successfully');
  } catch (pdfError) {
    logger.error('Failed to generate payment receipt PDF:', pdfError);
    // Continue without PDF if generation fails
  }

  return sendEmail({
    to: customerEmail,
    subject: `Payment Receipt - Order #${orderId}`,
    html,
    trigger: 'payment_success',
    orderId,
    attachments: pdfBuffer
      ? [
          {
            filename: `Payment_Receipt_${orderId}.pdf`,
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
  const html = emailShell(
    `
      ${emailHero('⚠️', 'Payment Failed', 'Your payment could not be processed', EMAIL_THEME.danger)}

      <p style="margin:0 0 12px 0;">Hi ${customerName},</p>
      <p style="margin:0 0 4px 0;">Unfortunately, your payment could not be processed. Please review the details below and try again.</p>

      ${emailCard(
        detailRows([
          ['Order ID', `#${orderId}`],
          ['Amount', `₹${amount.toFixed(2)}`],
          ['Reason', `<span style="color:${EMAIL_THEME.danger[0]};">${reason}</span>`],
          ['Date & Time', new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })],
        ]),
        '#dc2626'
      )}

      ${emailChecklist(
        'What should you do?',
        [
          'Check your payment details',
          'Ensure you have sufficient funds',
          'Try a different payment method',
          'Contact your bank if the issue persists',
        ],
        EMAIL_THEME.warn
      )}

      ${emailButton('Retry Payment', `${FRONTEND_URL}/checkout`, '#2563eb')}
    `,
    `Payment failed for order #${orderId}`
  );

  return sendEmail({
    to: customerEmail,
    subject: `Payment Failed - Order #${orderId}`,
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
          <p><strong>Delivery Address:</strong><br>
          ${orderData.customerAddress?.street || 'N/A'}<br>
          ${orderData.customerAddress?.city || 'N/A'}, ${orderData.customerAddress?.state || 'N/A'}<br>
          Pincode: ${orderData.customerAddress?.pincode || 'N/A'}</p>
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
  const html = emailShell(
    `
      ${emailHero('🎉', 'Delivered!', 'Your order has arrived', EMAIL_THEME.success)}

      <p style="margin:0 0 12px 0;">Hi ${customerName},</p>
      <p style="margin:0 0 4px 0;">Your order has been successfully delivered. Thank you for shopping with Petmaza!</p>

      ${emailCard(
        detailRows([
          ['Order ID', `#${orderId}`],
          ['Delivered On', deliveryDate],
          ['Status', statusPill('DELIVERED', EMAIL_THEME.success)],
        ])
      )}

      ${emailChecklist('What’s next?', [
        'Review the products in your account',
        'Submit ratings and feedback',
        'Continue shopping for more pet products',
      ])}

      ${emailButton('View Order Details', `${FRONTEND_URL}/orders/${orderId}`, '#16a34a')}
    `,
    `Your order #${orderId} has been delivered`
  );

  return sendEmail({
    to: customerEmail,
    subject: `Order Delivered - #${orderId} 🎉`,
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
  const html = emailShell(
    `
      ${emailHero('✓', 'Order Accepted', 'All products are available', EMAIL_THEME.success)}

      <p style="margin:0 0 12px 0;">Hi ${customerName},</p>
      <p style="margin:0 0 4px 0;">Great news! Your order has been accepted and is now being prepared for delivery. We'll email you the tracking details as soon as it ships.</p>

      ${emailCard(
        detailRows([
          ['Order ID', `#${orderId}`],
          ['Status', statusPill('ACCEPTED', EMAIL_THEME.success)],
          ...(estimatedDelivery ? [['Estimated Delivery', estimatedDelivery] as [string, string]] : []),
        ])
      )}

      ${emailChecklist('What happens next?', [
        'Your order is being prepared',
        'Products will be packed carefully',
        "You'll receive tracking details by email once shipped",
        'Expected delivery within 2-5 business days',
      ])}
    `,
    `Your order #${orderId} has been accepted`
  );

  return sendEmail({
    to: customerEmail,
    subject: `Order Accepted - #${orderId} ✓`,
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
  const html = emailShell(
    `
      ${emailHero('⚠️', 'Products Not Available', 'Your order could not be fulfilled', EMAIL_THEME.danger)}

      <p style="margin:0 0 12px 0;">Hi ${customerName},</p>
      <p style="margin:0 0 4px 0;">We're sorry to inform you that your order could not be processed at this time.</p>

      ${emailCard(
        detailRows([
          ['Order ID', `#${orderId}`],
          ['Status', statusPill('UNABLE TO FULFILL', EMAIL_THEME.danger)],
          ['Reason', reason],
        ]),
        '#dc2626'
      )}

      ${emailChecklist(
        'What should you do?',
        [
          'No payment has been charged',
          'Try placing a new order with alternative products',
          'Check product availability on our website',
          'Contact us for product recommendations',
        ],
        EMAIL_THEME.warn
      )}

      ${emailButton('Browse Products', `${FRONTEND_URL}/products`, '#2563eb')}
    `,
    `Update on your order #${orderId}`
  );

  return sendEmail({
    to: customerEmail,
    subject: `Order Update - #${orderId}`,
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
  estimatedDelivery?: string,
  trackingLink?: string
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
          ${trackingLink ? `
          <div style="text-align: center; margin-top: 12px;">
            <a href="${trackingLink}" target="_blank"
               style="display: inline-block; background-color: #1976d2; color: #ffffff; text-decoration: none; padding: 10px 24px; border-radius: 5px; font-weight: bold;">
              🔍 Track Your Package
            </a>
          </div>
          <p style="margin: 10px 0 0 0; font-size: 12px; color: #666; word-break: break-all;">
            Or copy this link: <a href="${trackingLink}" target="_blank">${trackingLink}</a>
          </p>` : ''}
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
 * Send shipping tracking details to customer.
 *
 * Sent when a vendor submits shipping details for an order. Shows the courier
 * company, tracking ID, tracking link, delivery type and package weight so the
 * customer can follow their shipment.
 *
 * IMPORTANT: the shipping cost the vendor pays is intentionally NOT included —
 * it must never be exposed to the customer.
 */
export async function sendShippingTrackingEmail(
  customerEmail: string,
  customerName: string,
  orderId: string,
  details: {
    company?: string;
    trackingId?: string;
    trackingLink?: string;
    deliveryType?: 'inter_state' | 'out_of_state';
    totalWeight?: number;
    weightUnit?: 'kg' | 'g';
    estimatedDelivery?: string;
  }
) {
  const deliveryTypeLabel =
    details.deliveryType === 'inter_state'
      ? 'Inter-State'
      : details.deliveryType === 'out_of_state'
      ? 'Out of State'
      : '';

  const weightLabel =
    details.totalWeight !== undefined && details.totalWeight !== null
      ? `${details.totalWeight} ${details.weightUnit || ''}`.trim()
      : '';

  const trackingInner = `
      <div style="margin:0 0 12px 0; color:${EMAIL_THEME.ink}; font-size:15px; font-weight:700;">📦 Tracking Details</div>
      ${detailRows([
        ...(details.company ? [['Courier / Company', details.company] as [string, string]] : []),
        ...(details.trackingId
          ? [['Tracking ID', `<span style="font-family:monospace;">${details.trackingId}</span>`] as [string, string]]
          : []),
        ...(deliveryTypeLabel ? [['Delivery Type', deliveryTypeLabel] as [string, string]] : []),
        ...(weightLabel ? [['Package Weight', weightLabel] as [string, string]] : []),
      ])}
      ${
        details.trackingLink
          ? `${emailButton('🔍 Track Your Order', details.trackingLink, '#2563eb')}
      <p style="margin:8px 0 0 0; font-size:12px; color:${EMAIL_THEME.muted}; word-break:break-all; text-align:center;">
        Or copy this link: <a href="${details.trackingLink}" target="_blank" style="color:#2563eb;">${details.trackingLink}</a>
      </p>`
          : ''
      }`;

  const html = emailShell(
    `
      ${emailHero('🚚', 'Order Shipped', 'Your order is on its way — track it below', EMAIL_THEME.info)}

      <p style="margin:0 0 12px 0;">Hi ${customerName},</p>
      <p style="margin:0 0 4px 0;">Good news! Your order has been shipped. Use the tracking details below to follow your shipment.</p>

      ${emailCard(
        detailRows([
          ['Order ID', `#${orderId}`],
          ['Status', statusPill('SHIPPED', EMAIL_THEME.info)],
          ...(details.estimatedDelivery ? [['Estimated Delivery', details.estimatedDelivery] as [string, string]] : []),
        ])
      )}

      ${emailCard(trackingInner, '#ffc107')}
    `,
    `Your order #${orderId} has shipped — tracking inside`
  );

  return sendEmail({
    to: customerEmail,
    subject: `Order Shipped & Tracking - #${orderId} 🚚`,
    html,
    trigger: 'shipping_tracking',
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
  const html = emailShell(
    `
      ${emailHero('💰', 'Refund Initiated', 'Your refund is being processed', EMAIL_THEME.warn)}

      <p style="margin:0 0 12px 0;">Hi ${customerName},</p>
      <p style="margin:0 0 4px 0;">We're sorry that your order couldn't be fulfilled. We've initiated a refund for your order.</p>

      ${emailCard(
        detailRows([
          ['Order ID', `#${orderId}`],
          ['Refund Amount', `<span style="color:#15803d; font-size:16px; font-weight:700;">₹${refundAmount.toFixed(2)}</span>`],
          ['Reason', reason],
          ['Status', statusPill('REFUND INITIATED', EMAIL_THEME.warn)],
        ])
      )}

      ${emailChecklist(
        '⏱️ Refund Timeline',
        [
          'Credited to your account within 4-5 working days',
          'Refunded to your original payment method',
          "You'll get a confirmation once it's credited",
        ],
        EMAIL_THEME.info
      )}

      ${emailButton('View Orders', `${FRONTEND_URL}/orders`, '#2563eb')}
    `,
    `Refund initiated for order #${orderId}`
  );

  return sendEmail({
    to: customerEmail,
    subject: `Refund Initiated - Order #${orderId}`,
    html,
    trigger: 'refund_initiated',
    orderId,
  });
}

/**
 * Send refund completed (processed by admin) notification to customer
 */
export async function sendRefundCompletedEmail(
  customerEmail: string,
  customerName: string,
  orderId: string,
  refundAmount: number
) {
  const html = emailShell(
    `
      ${emailHero('✅', 'Refund Processed', 'Your refund has been approved', EMAIL_THEME.success)}

      <p style="margin:0 0 12px 0;">Hi ${customerName},</p>
      <p style="margin:0 0 4px 0;">Great news! Your refund has been successfully processed and will be credited to your original payment method shortly.</p>

      ${emailCard(
        detailRows([
          ['Order ID', `#${orderId}`],
          ['Refund Amount', `<span style="color:#15803d; font-size:16px; font-weight:700;">₹${refundAmount.toFixed(2)}</span>`],
          ['Status', statusPill('✓ REFUNDED', EMAIL_THEME.success)],
        ])
      )}

      ${emailChecklist(
        '⏱️ When will I receive the money?',
        [
          'Appears in your account within 3-5 working days',
          'Refunded to your original payment method',
        ],
        EMAIL_THEME.info
      )}
    `,
    `Refund processed for order #${orderId}`
  );

  return sendEmail({
    to: customerEmail,
    subject: `Refund Processed - Order #${orderId}`,
    html,
    trigger: 'refund_completed',
    orderId,
  });
}

/**
 * Send email verification code
 */
export async function sendVerificationEmail(email: string, verificationCode: string) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd;">
      <!-- Header -->
      <div style="background-color: #ffd700; padding: 25px; text-align: center;">
        <h1 style="margin: 0; color: #0051a5; font-size: 36px; font-weight: bold;">PETMAZA</h1>
        <p style="margin: 5px 0 0 0; color: #555; font-size: 14px;">Email Verification</p>
      </div>
      
      <div style="padding: 30px;">
        <h2 style="color: #333; margin-bottom: 20px;">Verify Your Email Address</h2>
        
        <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
          Thank you for registering with Petmaza! To complete your registration, please use the verification code below:
        </p>
        
        <!-- Verification Code Box -->
        <div style="background-color: #f8f9fa; border: 2px dashed #0051a5; border-radius: 8px; padding: 30px; text-align: center; margin: 30px 0;">
          <p style="color: #666; margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Your Verification Code</p>
          <div style="font-size: 36px; font-weight: bold; color: #0051a5; letter-spacing: 8px; font-family: 'Courier New', monospace;">
            ${verificationCode}
          </div>
        </div>
        
        <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
          Enter this code on the registration page to verify your email address and complete your account setup.
        </p>
        
        <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0; color: #856404; font-size: 14px;">
            <strong>Important:</strong> This verification code is valid for 10 minutes only. If you didn't request this code, please ignore this email.
          </p>
        </div>
        
        <p style="color: #555; line-height: 1.6;">
          If you have any questions, please contact our support team at <a href="mailto:support@petmaza.com" style="color: #0051a5;">support@petmaza.com</a>
        </p>
      </div>
      
      <!-- Footer -->
      <div style="background-color: #f5f5f5; padding: 20px; text-align: center; border-top: 1px solid #ddd;">
        <p style="color: #999; font-size: 12px; margin: 0;">
          This is an automated email. Please do not reply to this message.
        </p>
        <p style="color: #999; font-size: 12px; margin: 5px 0 0 0;">
          &#169; ${new Date().getFullYear()} Petmaza. All rights reserved.
        </p>
      </div>
    </div>
  `;

  return sendEmail({
    to: email,
    subject: 'Verify Your Email - Petmaza',
    html,
    trigger: 'email_verification',
  });
}

/**
 * Send thank you email after successful verification
 */
export async function sendVerificationSuccessEmail(email: string, name: string) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd;">
      <!-- Header -->
      <div style="background-color: #ffd700; padding: 25px; text-align: center;">
        <h1 style="margin: 0; color: #0051a5; font-size: 36px; font-weight: bold;">PETMAZA</h1>
        <p style="margin: 5px 0 0 0; color: #555; font-size: 14px;">Welcome to Petmaza!</p>
      </div>
      
      <!-- Success Banner -->
      <div style="background-color: #d4edda; padding: 30px; text-align: center;">
        <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
          <tr>
            <td align="center">
              <div style="background-color: #28a745; color: white; width: 70px; height: 70px; border-radius: 50%; line-height: 70px; font-size: 45px; margin: 0 auto 15px;">&#10003;</div>
            </td>
          </tr>
        </table>
        <h2 style="margin: 10px 0 5px 0; color: #28a745; font-size: 28px;">Email Verified Successfully!</h2>
        <p style="margin: 0; color: #555;">Thank you for verifying your email address</p>
      </div>
      
      <div style="padding: 30px;">
        <p style="font-size: 16px; margin-bottom: 20px;">Hi <strong>${name}</strong>,</p>
        
        <p style="color: #555; line-height: 1.6; margin-bottom: 15px;">
          <strong>Congratulations!</strong> Your email has been verified successfully. Thank you for registering with Petmaza!
        </p>
        
        <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
          You can now complete your registration and start exploring our amazing pet products marketplace.
        </p>
        
        <!-- What's Next Box -->
        <div style="background-color: #e3f2fd; border-left: 4px solid #2196f3; padding: 20px; margin: 25px 0; border-radius: 4px;">
          <h3 style="margin-top: 0; color: #1976d2; font-size: 18px;">🎉 What's Next?</h3>
          <ul style="margin: 10px 0; padding-left: 20px; color: #555; line-height: 1.8;">
            <li>Complete your registration by filling in the remaining details</li>
            <li>Browse thousands of quality pet products</li>
            <li>Add items to your cart and place orders</li>
            <li>Track your orders in real-time</li>
            <li>Get exclusive deals and offers</li>
          </ul>
        </div>
        
        <!-- Features Section -->
        <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin: 25px 0; border-radius: 4px;">
          <h3 style="margin-top: 0; color: #856404; font-size: 18px;">🐾 Why Choose Petmaza?</h3>
          <ul style="margin: 10px 0; padding-left: 20px; color: #555; line-height: 1.8;">
            <li><strong>Wide Selection:</strong> Thousands of pet products for all pet types</li>
            <li><strong>Quality Assured:</strong> Verified vendors and authentic products</li>
            <li><strong>Fast Delivery:</strong> Quick shipping to your doorstep</li>
            <li><strong>Secure Payments:</strong> Safe and encrypted transactions</li>
            <li><strong>24/7 Support:</strong> We're here to help anytime</li>
          </ul>
        </div>
        
        <p style="color: #555; line-height: 1.6; margin-top: 25px;">
          If you have any questions or need assistance, feel free to contact us at 
          <a href="mailto:support@petmaza.com" style="color: #0051a5; text-decoration: none;">support@petmaza.com</a>
        </p>
        
        <p style="color: #555; line-height: 1.6; margin-top: 20px;">
          Happy shopping!<br>
          <strong>The Petmaza Team</strong>
        </p>
      </div>
      
      <!-- Footer -->
      <div style="background-color: #f5f5f5; padding: 20px; text-align: center; border-top: 1px solid #ddd;">
        <p style="color: #999; font-size: 12px; margin: 0;">
          This is an automated email. Please do not reply to this message.
        </p>
        <p style="color: #999; font-size: 12px; margin: 5px 0 0 0;">
          &#169; ${new Date().getFullYear()} Petmaza. All rights reserved.
        </p>
      </div>
    </div>
  `;

  return sendEmail({
    to: email,
    subject: 'Welcome to Petmaza - Email Verified Successfully!',
    html,
    trigger: 'email_verified',
  });
}



/**
 * Send order taken notification to competing vendors (when another vendor accepts first)
 */
export async function sendOrderTakenNotificationEmail(
  vendorEmail: string,
  vendorName: string,
  orderId: string,
  winnerName: string
) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #ffd700; padding: 20px; text-align: center;">
        <h1 style="margin: 0; color: #333;">🐾 PETMAZA Vendor Portal</h1>
      </div>
      
      <div style="padding: 20px;">
        <div style="background-color: #fff3cd; padding: 20px; border-radius: 5px; text-align: center; margin: 20px 0; border-left: 4px solid #ff9800;">
          <h2 style="margin: 0; font-size: 28px;">⚡</h2>
          <h2 style="margin: 10px 0 0 0; color: #e65100;">Order Already Taken</h2>
        </div>
        
        <p>Hi ${vendorName},</p>
        <p>The order <strong>${orderId}</strong> has been accepted by <strong>${winnerName}</strong>.</p>
        <p>This order is no longer available for acceptance. Better luck next time!</p>
        
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>💡 Tip:</strong> Accept orders faster to increase your fulfillment rate!</p>
          <p style="margin: 5px 0;">Check your pending orders regularly to stay ahead of the competition.</p>
        </div>
        
        <p>
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/vendor/orders" style="display: inline-block; background-color: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Pending Orders</a>
        </p>
      </div>
      
      <div style="background-color: #f5f5f5; padding: 20px; text-align: center; border-top: 1px solid #ddd;">
        <p style="color: #999; font-size: 12px;">© 2026 Petmaza. All rights reserved.</p>
      </div>
    </div>
  `;

  return sendEmail({
    to: vendorEmail,
    subject: `Order ${orderId} was accepted by another vendor`,
    html,
    trigger: 'order_taken_notification',
    orderId,
  });
}



/**
 * Send product available notification email
 */
export async function sendProductAvailableEmail(data: {
  email: string;
  name: string;
  productName: string;
  productId: string;
  productImage?: string;
}) {
  const { email, name, productName, productId, productImage } = data;
  
  const productUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/products/${productId}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #ffd700; padding: 20px; text-align: center;">
        <h1 style="margin: 0; color: #333;">🐾 PETMAZA</h1>
      </div>
      
      <div style="padding: 20px;">
        <h2 style="color: #28a745;">🎉 Great News!</h2>
        <p>Hi ${name},</p>
        
        <p>The product you were waiting for is now back in stock!</p>
        
        ${productImage ? `
        <div style="text-align: center; margin: 20px 0;">
          <img src="${productImage}" alt="${productName}" style="max-width: 200px; height: auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        </div>
        ` : ''}
        
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #333;">${productName}</h3>
          <p style="color: #28a745; font-weight: bold; font-size: 18px; margin: 10px 0;">✅ Now Available</p>
        </div>
        
        <p>Hurry up and grab it before it's gone again!</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${productUrl}" style="display: inline-block; background-color: #ffd700; color: #333; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
            🛒 Shop Now
          </a>
        </div>
        
        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          This is a one-time notification. If you didn't register for this notification, you can safely ignore this email.
        </p>
        
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
    to: email,
    subject: `🎉 ${productName} is Back in Stock!`,
    html,
    trigger: 'product_available',
  });
}

/**
 * Queue product available notification email (non-blocking)
 */

