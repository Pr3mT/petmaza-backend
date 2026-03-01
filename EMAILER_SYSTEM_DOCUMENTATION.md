# Emailer System Documentation

## Overview

The Petmaza backend now includes a comprehensive email notification system that automatically sends emails to customers, vendors, and admins at critical points in the order and payment lifecycle. The system uses **Nodemailer** for SMTP communications and **MongoDB** for audit logging.

## System Architecture

### Core Components

1. **Emailer Service** (`src/services/emailer.ts`)
   - Central email dispatch service using Nodemailer
   - 7 distinct email functions for different scenarios
   - Built-in error handling and email logging
   - HTML email templates with Petmaza branding
   - Status mapping for customer-friendly messages

2. **Email Log Model** (`src/models/EmailLog.ts`)
   - Mongoose schema for auditing all email communications
   - Indexed fields for efficient querying: recipient, status, trigger, timestamp, orderId, userId
   - Tracks both sent and failed emails with error reasons

3. **Controller Integration**
   - `orderController.ts`: Order creation and status update emails
   - `paymentController.ts`: Payment success and failure emails
   - `authController.ts`: Welcome email on registration

## Email Triggers

### 1. Order Confirmation (Customer)
- **Trigger:** When customer creates a new order
- **Recipient:** Customer email address
- **Function:** `sendOrderConfirmationEmail()`
- **Controller:** `orderController.ts` → `createOrder()`
- **Content:**
  - Order ID and creation date
  - List of items with quantities and prices
  - Subtotal, taxes, delivery charges
  - Delivery address
  - Next steps and tracking information

**Example:**
```typescript
await sendOrderConfirmationEmail(
  req.user.email,
  req.user.name,
  order._id.toString(),
  { totalAmount: order.totalAmount, items: populatedOrder.items, customerAddress: order.customerAddress }
);
```

### 2. Order Status Update (Customer)
- **Trigger:** When vendor updates order status
- **Recipient:** Customer email address
- **Function:** `sendOrderStatusUpdateEmail()`
- **Controller:** `orderController.ts` → `updateOrderStatus()`
- **Content:**
  - Order ID
  - Current status (processing/shipped/delivered)
  - Vendor name and contact
  - Delivery timeline estimate
  - Action link to track order

**Status Mapping (Internal → Customer-Friendly):**
- `PACKED` → "processing" (✓ Order is being prepared)
- `PICKED_UP` → "shipped" (🚚 Order has been picked up)
- `IN_TRANSIT` → "shipped" (🚚 Order is in transit)
- `DELIVERED` → "delivered" (📦 Order has been delivered)

**Example:**
```typescript
await sendOrderStatusUpdateEmail(
  customerEmail,
  customerName,
  order._id.toString(),
  staus,  // NEW status (PACKED, PICKED_UP, IN_TRANSIT, DELIVERED)
  vendorInfo.name
);
```

### 3. Payment Success (Customer)
- **Trigger:** After successful payment verification
- **Recipient:** Customer email address
- **Function:** `sendPaymentSuccessEmail()`
- **Controller:** `paymentController.ts` → `completePayment()`
- **Content:**
  - Payment confirmation details
  - Amount paid and payment method
  - Transaction/Payment ID
  - Invoice reference
  - Order details and delivery timeline

**Example:**
```typescript
await sendPaymentSuccessEmail(
  customerEmail,
  customerName,
  order._id.toString(),
  order.totalAmount
);
```

### 4. Payment Failure (Customer)
- **Trigger:** When payment is declined or fails
- **Recipient:** Customer email address
- **Function:** `sendPaymentFailureEmail()`
- **Controller:** `paymentController.ts` → `handlePaymentFailure()` (new endpoint)
- **Content:**
  - Payment failure reason
  - Troubleshooting steps
  - Common solutions (check card details, available funds, contact bank)
  - Retry link to frontend checkout page
  - Order details and amount

**Available Failure Reasons:**
- "Payment was declined by your bank"
- "Insufficient funds in your account"
- "Card has expired"
- "Incorrect card details"
- "Daily limit exceeded"
- "Your bank blocked this transaction for security"

**Example:**
```typescript
await sendPaymentFailureEmail(
  customerEmail,
  customerName,
  order_id,
  order.totalAmount,
  'Payment was declined by your bank'
);
```

### 5. Vendor Order Notification
- **Trigger:** When order is assigned to vendor
- **Recipient:** Vendor email address
- **Function:** `sendVendorOrderNotificationEmail()`
- **Trigger Point:** Order assignment (to be integrated)
- **Content:**
  - New order alert
  - Order ID and items
  - Customer name and delivery address
  - Order value
  - Link to vendor dashboard
  - Action items (update status, confirm pickup)

**Example:**
```typescript
await sendVendorOrderNotificationEmail(
  vendorEmail,
  vendorName,
  order._id.toString(),
  order.totalAmount,
  { items: order.items, customer: order.customer_id, address: order.customerAddress, assignedAt: new Date() }
);
```

### 6. Admin Order Notification
- **Trigger:** When new order is created
- **Recipient:** All admin emails (from `ADMIN_EMAILS` env var)
- **Function:** `sendAdminOrderNotificationEmail()`
- **Controller:** `orderController.ts` → `createOrder()`
- **Content:**
  - New order alert
  - Order ID and creation timestamp
  - Customer details
  - Order value and items summary
  - Vendor information
  - Admin action link to orders dashboard

**Example:**
```typescript
await sendAdminOrderNotificationEmail(
  admin_email,
  order._id.toString(),
  order.totalAmount,
  { items: order.items, customer: order.customer_id, address: order.customerAddress }
);
```

### 7. Welcome Email (New User)
- **Trigger:** When user registers
- **Recipient:** User email address
- **Function:** `sendEmail()` (generic function)
- **Controller:** `authController.ts` → `register()`
- **Content:**
  - Welcome message
  - Account setup guidance
  - First order discount offer
  - Link to browse products

## API Endpoints

### Process Payment Failure
**Endpoint:** `POST /api/payments/failure`

**Authentication:** Required (JWT token)

**Request Body:**
```json
{
  "order_id": "507f1f77bcf86cd799439011",
  "reason": "Payment was declined by your bank"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment failure recorded",
  "data": {
    "order": {
      "_id": "507f1f77bcf86cd799439011",
      "payment_status": "Failed",
      "status": "Pending",
      "totalAmount": 5299,
      "items": [...],
      "customerAddress": {...}
    }
  }
}
```

**Failure Reasons:** Any customer-friendly description of why payment failed

## Environment Configuration

### Required Environment Variables

```env
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@petmaza.com
SMTP_SECURE=false

# Admin Configuration
ADMIN_EMAILS=admin1@petmaza.com,admin2@petmaza.com

# Frontend Configuration (for email action links)
FRONTEND_URL=https://frontend.petmaza.com

# Optional
SKIP_EMAIL=false  # Set to true to skip actual email sending (for testing)
```

### SMTP Setup Instructions

#### Gmail (Recommended for Testing)
1. Enable 2-Factor Authentication on your Google Account
2. Go to [Google App Passwords](https://myaccount.google.com/apppasswords)
3. Select "Mail" and "Windows Computer" (or your device)
4. Copy the generated 16-character password
5. Use in `SMTP_PASS` (without spaces)

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx  # Remove spaces
SMTP_SECURE=false
```

#### SendGrid
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.your-api-key
SMTP_SECURE=false
```

#### Other Providers
```env
# AWS SES
SMTP_HOST=email-smtp.region.amazonaws.com
SMTP_PORT=587
SMTP_USER=your-aws-user
SMTP_PASS=your-aws-password
SMTP_SECURE=false

# MailGun
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@your-domain.mailgun.org
SMTP_PASS=your-password
SMTP_SECURE=false
```

## Email Log Database

### EmailLog Model Schema

```typescript
interface EmailLog {
  recipient: string;           // Email recipient address
  subject: string;             // Email subject
  body: string;                // HTML email body
  status: 'sent' | 'failed';   // Delivery status
  trigger: string;             // Trigger type (order_confirmation, payment_success, etc.)
  timestamp: Date;             // When email was sent/attempted
  messageId?: string;          // Nodemailer message ID
  error?: string;              // Error message if failed
  orderId?: ObjectId;          // Related order ID
  userId?: ObjectId;           // Related user ID
}
```

### Querying Email Logs

```typescript
// Find all emails sent to a customer
const emails = await EmailLog.find({ recipient: 'customer@email.com' });

// Find all failed emails by trigger type
const failedPayments = await EmailLog.find({ trigger: 'payment_success', status: 'failed' });

// Find all emails for an order
const orderEmails = await EmailLog.find({ orderId: order_id });

// Find recent emails (last 24 hours)
const recentEmails = await EmailLog.find({
  timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
});
```

## Error Handling

### Email Failures Don't Cascade

All email sending is wrapped in try-catch blocks to ensure:
- Order creation proceeds even if email fails
- Payment processing proceeds even if email fails
- Email errors are logged but don't block critical operations
- Users receive appropriate notifications about order/payment status regardless of email delivery

### Example Error Handling Pattern

```typescript
try {
  await sendOrderConfirmationEmail(customerEmail, customerName, orderId, details);
} catch (emailError: any) {
  console.error('Failed to send order confirmation email:', emailError.message);
  // Order creation continues - email failure doesn't block the process
  // Error is logged to EmailLog table
}
```

## Testing

### Manual Testing Workflow

1. **Setup:** Configure SMTP credentials in `.env` file
2. **Start Backend:** Run the backend server
3. **Create Test Order:**
   - Call `POST /api/orders` with test customer data
   - Should trigger: Order confirmation email + Admin notification email
4. **Check EmailLog:** Query MongoDB to verify email records
5. **Verify Emails:** Check recipient email inbox for actual emails

### Test Commands

```bash
# Check SMTP connection
curl -X POST http://localhost:3000/api/debug/test-email \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Query email logs
curl http://localhost:3000/api/debug/email-logs
```

### Common Issues

| Issue | Solution |
|-------|----------|
| "Error: connect ECONNREFUSED" | SMTP_HOST or SMTP_PORT incorrect |
| "Error: Invalid login" | SMTP_USER or SMTP_PASS incorrect |
| "Error: STARTTLS required" | Set SMTP_SECURE=false for port 587 |
| "Email not received" | Check spam folder, verify SMTP_FROM is correct |
| "Email logs empty" | Check if SKIP_EMAIL=true in .env |

## Monitoring & Troubleshooting

### View Email Logs in MongoDB

```typescript
// MongoDB Shell
use petmaza_db
db.emaillogs.find({ status: 'failed' }).pretty()

// Aggregate failed emails by trigger
db.emaillogs.aggregate([
  { $match: { status: 'failed' } },
  { $group: { _id: '$trigger', count: { $sum: 1 } } }
])
```

### Common Debugging Steps

1. **Check .env Configuration:**
   ```bash
   echo $SMTP_HOST
   echo $SMTP_PORT
   echo $SMTP_USER
   ```

2. **Verify Transporter:**
   ```typescript
   const transporter = createTransport({...});
   await transporter.verify(); // Should return true
   ```

3. **Check Email Logs:**
   ```typescript
   const logs = await EmailLog.find({ recipient: 'test@email.com' }).sort({ timestamp: -1 });
   ```

4. **Enable SMTP Debugging:**
   ```typescript
   const transporter = createTransport({
     logger: true,
     debug: true // Shows SMTP conversation
   });
   ```

## Future Enhancements

### Planned Features
- [ ] Email template customization in admin panel
- [ ] User email preferences (opt-in/out)
- [ ] Complaint and refund notification emails
- [ ] Scheduled admin reports via email
- [ ] SMS notifications for critical events
- [ ] Email delivery retry mechanism with exponential backoff
- [ ] Bulk email sending for announcements
- [ ] Email preview/testing tool in admin panel

### Suggested Integrations
- Complaint creation notification to admin
- Refund approval notification to customer
- Vendor rejection notification to customer/admin
- Low inventory alerts to vendors
- Revenue reports to admins
- Delivery confirmation emails
- Special promotion emails to customers

## Files Modified/Created

### New Files
- `src/services/emailer.ts` (500+ lines) - Main emailer service
- `src/models/EmailLog.ts` (25 lines) - Email audit log schema
- `EMAILER_SYSTEM_DOCUMENTATION.md` (this file)

### Modified Files
- `src/controllers/orderController.ts` - Added order email triggers
- `src/controllers/paymentController.ts` - Added payment email triggers + failure handler
- `src/routes/payments.ts` - Added /failure endpoint route

### Configuration
- `.env` - Add SMTP_* and ADMIN_EMAILS variables

## Code References

### Import Emailer Functions
```typescript
import {
  sendOrderConfirmationEmail,
  sendOrderStatusUpdateEmail,
  sendPaymentSuccessEmail,
  sendPaymentFailureEmail,
  sendVendorOrderNotificationEmail,
  sendAdminOrderNotificationEmail,
  sendEmail
} from '../services/emailer';
```

### Example: Send Order Confirmation
```typescript
const populatedOrder = await order.populate('items.product_id');
await sendOrderConfirmationEmail(
  req.user.email,
  req.user.name,
  order._id.toString(),
  {
    totalAmount: order.totalAmount,
    items: populatedOrder.items,
    customerAddress: order.customerAddress
  }
);
```

## Support & Troubleshooting

For issues:
1. Check `.env` SMTP configuration
2. Review error message in console logs
3. Query `EmailLog` collection for failure details
4. Verify SMTP credentials with provider
5. Test SMTP connection using `telnet` or online tools

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024 | Initial emailer system implementation |

---

**System Status:** ✅ Fully Implemented and Integrated
