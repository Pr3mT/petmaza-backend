# Petmaza Emailer System - Quick Reference Guide

## ✅ System Status: COMPLETE & INTEGRATED

All email functionality has been implemented, integrated, and is ready for SMTP configuration and testing.

---

## 📧 Email Triggers Overview

| # | Trigger | Recipient | Function | Status |
|---|---------|-----------|----------|--------|
| 1 | Order Created | Customer | `sendOrderConfirmationEmail()` | ✅ Integrated |
| 2 | Order Status Updated | Customer | `sendOrderStatusUpdateEmail()` | ✅ Integrated |
| 3 | Payment Successful | Customer | `sendPaymentSuccessEmail()` | ✅ Integrated |
| 4 | Payment Failed | Customer | `sendPaymentFailureEmail()` | ✅ Integrated |
| 5 | Order Assigned | Vendor | `sendVendorOrderNotificationEmail()` | ⚠️ Ready (needs integration) |
| 6 | New Order Created | Admin | `sendAdminOrderNotificationEmail()` | ✅ Integrated |
| 7 | User Registration | User | `sendEmail()` (generic) | ✅ Integrated |

---

## 📁 Files Created/Modified

### New Files (3)
```
✨ src/services/emailer.ts (500+ lines)
   └─ 7 email functions, Nodemailer setup, HTML templates
   
✨ src/models/EmailLog.ts (25 lines)
   └─ Mongoose schema for email audit trail
   
✨ EMAILER_SYSTEM_DOCUMENTATION.md (this file)
   └─ Comprehensive documentation
```

### Modified Files (4)
```
📝 src/controllers/orderController.ts
   ├─ Added: sendOrderConfirmationEmail (on create)
   ├─ Added: sendOrderStatusUpdateEmail (on status update)
   └─ Added: sendAdminOrderNotificationEmail (on create)
   
📝 src/controllers/paymentController.ts
   ├─ Added: sendPaymentSuccessEmail (on complete)
   ├─ Added: sendPaymentFailureEmail (on failure)
   └─ NEW: handlePaymentFailure() function
   
📝 src/routes/payments.ts
   └─ Added: POST /api/payments/failure endpoint
   
📝 src/controllers/authController.ts
   └─ Already has: sendEmail (on registration)
```

---

## 🚀 Integration Points

### 1. Order Creation → 2 Emails
**File:** `src/controllers/orderController.ts` → `createOrder()`
```typescript
// After order is saved:
await sendOrderConfirmationEmail(customerEmail, customerName, orderId, orderDetails);
await sendAdminOrderNotificationEmail(adminEmail, orderId, orderDetails);
```

### 2. Order Status Update → 1 Email
**File:** `src/controllers/orderController.ts` → `updateOrderStatus()`
```typescript
// When vendor updates status (PACKED, PICKED_UP, IN_TRANSIT, DELIVERED):
await sendOrderStatusUpdateEmail(customerEmail, customerName, orderId, newStatus, vendorName);
// Status is mapped: PACKED→'processing', DELIVERED→'delivered', etc.
```

### 3. Payment Success → 1 Email
**File:** `src/controllers/paymentController.ts` → `completePayment()`
```typescript
// After payment verification:
await sendPaymentSuccessEmail(customerEmail, customerName, orderId, amount);
```

### 4. Payment Failure → 1 Email
**File:** `src/controllers/paymentController.ts` → `handlePaymentFailure()`
```typescript
// New endpoint POST /api/payments/failure:
// Takes: { order_id, reason }
// Sends: sendPaymentFailureEmail(customerEmail, customerName, orderId, amount, reason);
```

### 5. Vendor Order Assignment → Needs Integration
**File:** To be determined (likely OrderRoutingService or similar)
```typescript
// When order is assigned to vendor:
await sendVendorOrderNotificationEmail(vendorEmail, vendorName, orderId, amount, orderDetails);
```

---

## ⚙️ Configuration Required

### Step 1: Add Environment Variables
Create/update `.env` file with:
```env
# SMTP Configuration (Gmail example)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@petmaza.com
SMTP_SECURE=false

# Admin Configuration
ADMIN_EMAILS=admin1@petmaza.com,admin2@petmaza.com

# Frontend URL (for email action links)
FRONTEND_URL=http://localhost:3000

# Optional
SKIP_EMAIL=false
```

### Step 2: Setup SMTP Provider

**Gmail (Easiest for Testing):**
1. Enable 2FA on Google Account
2. Generate App Password: https://myaccount.google.com/apppasswords
3. Copy the 16-character password
4. Paste in SMTP_PASS (remove spaces)

**Other Providers:**
- SendGrid, AWS SES, MailGun - See documentation for SMTP details

### Step 3: Restart Backend Server
```bash
npm run dev
# or
npm start
```

---

## 🧪 Testing Checklist

- [ ] Configure SMTP credentials in `.env`
- [ ] Restart backend server
- [ ] Create a test order (POST /api/orders)
- [ ] Verify emails in EmailLog MongoDB table
- [ ] Check recipient email inbox for confirmation
- [ ] Make a payment and verify payment success email
- [ ] Test payment failure endpoint (POST /api/payments/failure)
- [ ] Query EmailLog for failed emails and error messages

### Quick Test Command
```bash
# Check MongoDB EmailLog
mongosh
use petmaza_db
db.emaillogs.find().sort({ timestamp: -1 }).limit(10).pretty()
```

---

## 📊 Email Templates Reference

### Order Confirmation Email
- **To:** Customer
- **Trigger:** New order created
- **Contents:** Order details, items list, delivery address, tracking info
- **Branded:** Yes (Petmaza logo, colors)

### Order Status Update Email
- **To:** Customer
- **Trigger:** Order status changes
- **Contents:** Status message, vendor name, delivery timeline
- **Statuses:**
  - PACKED → "Order is being prepared" ✓
  - PICKED_UP → "Order has been picked up" 🚚
  - IN_TRANSIT → "Order is in transit" 🚚
  - DELIVERED → "Order has been delivered" 📦

### Payment Success Email
- **To:** Customer
- **Trigger:** Payment successfully verified
- **Contents:** Payment details, transaction ID, invoice reference
- **Branded:** Yes

### Payment Failure Email
- **To:** Customer
- **Trigger:** Payment declined/failed
- **Contents:** Failure reason, troubleshooting steps, retry link
- **Branded:** Yes

### Vendor Order Notification
- **To:** Vendor
- **Trigger:** Order assigned to vendor
- **Contents:** Order details, customer info, action items
- **Status:** Ready to integrate

### Admin Order Notification
- **To:** All ADMIN_EMAILS
- **Trigger:** New order created
- **Contents:** Order summary, customer info, vendor assignment
- **Status:** Integrated

---

## 🔧 Key Features

### Error Handling
✅ All email failures wrapped in try-catch
✅ Email failures don't block orders/payments
✅ Errors logged to EmailLog collection
✅ Console errors for debugging

### Audit Trail
✅ All emails logged to MongoDB
✅ Tracks: recipient, subject, status, timestamp, error, orderId, userId
✅ Indexed for efficient querying
✅ Can filter by recipient, status, trigger, orderId

### Smart Features
✅ Status mapping (internal → customer-friendly)
✅ HTML email templates with Petmaza branding
✅ Responsive emails for mobile/desktop
✅ Action links to checkout, order tracking, etc.
✅ SMTP transporter verification before sending
✅ Graceful degradation if SKIP_EMAIL=true

---

## 🚨 Troubleshooting

### Emails Not Sending

1. **Check .env configuration:**
   - Verify SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
   - Test with simpler password (no special chars)

2. **Check EmailLog for errors:**
   ```typescript
   db.emaillogs.findOne({ status: 'failed' })
   // Check 'error' field for SMTP error details
   ```

3. **Verify SMTP credentials:**
   - Gmail: Check if app password generated correctly
   - Others: Contact your SMTP provider for correct settings

4. **Check firewall/network:**
   - Ensure SMTP_PORT (usually 587 or 465) isn't blocked
   - Test connectivity: `telnet smtp.gmail.com 587`

### Emails Sent But Not Received

1. Check spam/junk folder
2. Verify SMTP_FROM is correct (must be verified sender)
3. Check EmailLog messageId field (Nodemailer transaction ID)
4. Contact SMTP provider to check bounce logs

---

## 📱 API Endpoints

### Create Order (Existing)
```
POST /api/orders
Body: { ... order details ... }
Triggers: 2 emails (customer confirmation + admin notification)
```

### Update Order Status (Existing)
```
POST /api/orders/:id/status
Body: { status: "PACKED|PICKED_UP|IN_TRANSIT|DELIVERED" }
Triggers: 1 email (customer status update)
```

### Complete Payment (Existing)
```
POST /api/payments/complete
Body: { ... payment verification details ... }
Triggers: 1 email (payment success)
```

### Handle Payment Failure (New)
```
POST /api/payments/failure
Auth: Required (JWT)
Body: {
  order_id: "507f1f77bcf86cd799439011",
  reason: "Payment was declined by your bank"
}
Response: { success: true, message: "Payment failure recorded", data: { order } }
Triggers: 1 email (payment failure with retry link)
```

---

## 📚 Related Documentation

- **Main Guide:** See `EMAILER_SYSTEM_DOCUMENTATION.md` for comprehensive details
- **Controller Flow:** Check `src/controllers/orderController.ts` and `paymentController.ts`
- **Service Code:** Review `src/services/emailer.ts` for email function implementation
- **Database:** Query `EmailLog` collection in MongoDB for email history

---

## ✨ Next Steps

### Immediate (Required)
1. [ ] Configure SMTP credentials in `.env`
2. [ ] Restart backend server
3. [ ] Test with sample order creation
4. [ ] Verify emails in inbox and EmailLog

### Short-term (Recommended)
1. [ ] Test payment failure endpoint
2. [ ] Integrate vendor order assignment emails
3. [ ] Create admin dashboard to view email logs
4. [ ] Setup email preference settings for users

### Long-term (Optional)
1. [ ] Email template customization in admin panel
2. [ ] SMS notifications for critical events
3. [ ] Scheduled email reports
4. [ ] Advanced retry logic for failed emails
5. [ ] Email delivery analytics/dashboard

---

## 📞 Support

**For Configuration Issues:**
- Check SMTP provider documentation
- Review transporter.verify() output
- Query EmailLog for error details
- Check console logs for SMTP errors

**For Integration Issues:**
- Review integration points above
- Check that all imports are present
- Verify function argument formats
- Run backend in debug mode

**For Testing Issues:**
- Use test email/order data
- Check spam folder
- Verify SKIP_EMAIL isn't true
- Inspect EmailLog timeout field

---

## Version: 1.0 | Status: ✅ Complete & Ready to Test
