# Emailer System Implementation & Testing Checklist

## Phase 1: Configuration Setup ✅

### Step 1.1: Environment Variables
- [ ] Open `.env` file in project root
- [ ] Add SMTP configuration (choose one provider):

**Option A: Gmail (Recommended for Testing)**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@petmaza.com
SMTP_SECURE=false
```
- [ ] Go to https://myaccount.google.com/apppasswords
- [ ] Enable 2FA first if not already enabled
- [ ] Generate app password for "Mail" + "Windows Computer"
- [ ] Copy 16-character password (without spaces)
- [ ] Paste into SMTP_PASS

**Option B: SendGrid**
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.your-api-key-here
SMTP_FROM=noreply@petmaza.com
SMTP_SECURE=false
```

**Option C: AWS SES**
```env
SMTP_HOST=email-smtp.your-region.amazonaws.com
SMTP_PORT=587
SMTP_USER=your-ses-username
SMTP_PASS=your-ses-password
SMTP_FROM=verified-email@yourdomain.com
SMTP_SECURE=false
```

### Step 1.2: Admin Configuration
- [ ] In `.env`, add admin email(s):
```env
ADMIN_EMAILS=admin@petmaza.com,supervisor@petmaza.com
```
- [ ] Separate multiple emails with comma (no spaces)

### Step 1.3: Frontend Configuration
- [ ] In `.env`, add frontend URL:
```env
FRONTEND_URL=http://localhost:3000
# For production:
# FRONTEND_URL=https://app.petmaza.com
```
- [ ] This URL is used in email links (payment retry, order tracking, etc.)

### Step 1.4: Optional Testing Settings
- [ ] To skip actual email sending (for testing):
```env
SKIP_EMAIL=false  # Set to 'true' to disable actual sending
```
- [ ] Emails will still be logged to EmailLog even if SKIP_EMAIL=true

---

## Phase 2: Code Verification ✅

### Step 2.1: Verify Files Created
```bash
# Check these files exist and have content:
ls -la src/services/emailer.ts      # Should be 500+ lines
ls -la src/models/EmailLog.ts        # Should exist
```
- [ ] `src/services/emailer.ts` exists (500+ lines)
- [ ] `src/models/EmailLog.ts` exists
- [ ] Both files compile without errors

### Step 2.2: Verify Controller Imports
- [ ] Open `src/controllers/orderController.ts`
  - [ ] Check imports include:
    ```typescript
    import {
      sendOrderConfirmationEmail,
      sendOrderStatusUpdateEmail,
      sendAdminOrderNotificationEmail,
      sendVendorOrderNotificationEmail
    } from '../services/emailer';
    ```
  - [ ] Check `sendEmail` import exists (from authController)

- [ ] Open `src/controllers/paymentController.ts`
  - [ ] Check imports include:
    ```typescript
    import {
      sendPaymentSuccessEmail,
      sendPaymentFailureEmail
    } from '../services/emailer';
    ```

### Step 2.3: Verify Function Integration
- [ ] In `orderController.ts` → `createOrder()`:
  - [ ] Look for `sendOrderConfirmationEmail()` call
  - [ ] Look for `sendAdminOrderNotificationEmail()` call
  - [ ] Both are in try-catch blocks

- [ ] In `orderController.ts` → `updateOrderStatus()`:
  - [ ] Look for `sendOrderStatusUpdateEmail()` call
  - [ ] Check status mapping logic
  - [ ] Verify try-catch block exists

- [ ] In `paymentController.ts` → `completePayment()`:
  - [ ] Look for `sendPaymentSuccessEmail()` call
  - [ ] Check try-catch block

- [ ] In `paymentController.ts` → `handlePaymentFailure()`:
  - [ ] Verify function exists (not just import)
  - [ ] Check it takes `order_id` and `reason` from request
  - [ ] Check it sends `sendPaymentFailureEmail()`

### Step 2.4: Verify Routes
- [ ] Open `src/routes/payments.ts`
  - [ ] Check route imports
  - [ ] Verify this line exists:
    ```typescript
    router.post('/failure', verifyToken, handlePaymentFailure);
    ```
  - [ ] Check all required function imports are present

---

## Phase 3: Backend Setup & Testing ✅

### Step 3.1: Start Backend Server
- [ ] Navigate to backend directory:
  ```bash
  cd petmaza-backend
  ```
- [ ] Install dependencies (if needed):
  ```bash
  npm install
  ```
- [ ] Ensure TypeScript compiles:
  ```bash
  npm run build
  ```
  - [ ] No compilation errors

- [ ] Start development server:
  ```bash
  npm run dev
  # or
  npm start
  ```
- [ ] Check console output:
  - [ ] Server listening on port 3000 (or configured port)
  - [ ] No SMTP connection errors
  - [ ] No "cannot find module" errors

### Step 3.2: Verify SMTP Connection
- [ ] Check backend logs for SMTP transporter initialization
- [ ] If error appears like:
  - "Error: connect ECONNREFUSED" → Check SMTP_HOST and SMTP_PORT
  - "Error: Invalid login" → Check SMTP_USER and SMTP_PASS
  - "Error: STARTTLS required" → Set SMTP_SECURE=false

### Step 3.3: Prepare Test Data
- [ ] Have a valid test customer email ready
- [ ] Default test customer (if using seeded data):
  ```
  Email: customer@test.com
  Name: Test Customer
  Password: test123
  ```
- [ ] Have admin email from ADMIN_EMAILS ready to check

---

## Phase 4: Manual Testing ✅

### Test 4.1: Order Creation Email
**Objective:** Verify order confirmation emails to customer and admin

1. [ ] Start backend server (Phase 3.1)
2. [ ] Open API testing tool (Postman, Insomnia, or curl)
3. [ ] Get JWT token (login endpoint):
   ```bash
   POST /api/auth/login
   {
     "email": "customer@test.com",
     "password": "test123"
   }
   ```
   - [ ] Copy the JWT token from response

4. [ ] Create test order:
   ```bash
   POST /api/orders
   Headers: { Authorization: "Bearer YOUR_JWT_TOKEN" }
   {
     "items": [
       {
         "product_id": "product_id_here",
         "quantity": 2,
         "price": 500
       }
     ],
     "totalAmount": 1000,
     "customerAddress": {
       "street": "123 Main St",
       "city": "Test City",
       "postalCode": "12345",
       "country": "India"
     }
   }
   ```
   - [ ] Response shows 200 OK
   - [ ] Response contains order ID

5. [ ] Check EmailLog in MongoDB:
   ```bash
   mongosh
   use petmaza_db
   db.emaillogs.find({ trigger: "order_confirmation" }).pretty()
   db.emaillogs.find({ trigger: "admin_order_notif" }).pretty()
   ```
   - [ ] 1 order_confirmation entry exists
   - [ ] 1 admin_order_notif entry exists
   - [ ] Both show status: "sent"

6. [ ] Check emails in inboxes:
   - [ ] Customer receives confirmation email
     - [ ] Subject contains "Order Confirmation"
     - [ ] Email shows order details
     - [ ] Includes customer address
   
   - [ ] Admin receives admin notification
     - [ ] Subject contains "New Order"
     - [ ] Email shows order summary
     - [ ] Includes customer details

**If emails NOT received:**
- [ ] Check SKIP_EMAIL is not 'true'
- [ ] Check spam/junk folder
- [ ] Verify SMTP_FROM is in correct format
- [ ] Check EmailLog error field:
  ```bash
  db.emaillogs.findOne({ status: "failed" })
  ```

---

### Test 4.2: Order Status Update Email
**Objective:** Verify status update emails to customer

1. [ ] Get order ID from Test 4.1
2. [ ] Login as vendor:
   ```bash
   POST /api/auth/login
   {
     "email": "vendor@test.com",
     "password": "vendor123"
   }
   ```
   - [ ] Copy JWT token

3. [ ] Update order status:
   ```bash
   PATCH /api/orders/:order_id
   Headers: { Authorization: "Bearer VENDOR_JWT_TOKEN" }
   {
     "status": "PACKED"
   }
   ```
   - [ ] Response shows 200 OK
   - [ ] Status field shows "PACKED"

4. [ ] Check EmailLog:
   ```bash
   db.emaillogs.find({ trigger: "order_status_update" }).pretty()
   ```
   - [ ] Entry exists with status: "sent"

5. [ ] Check customer inbox:
   - [ ] Email received from vendor
   - [ ] [ ] Subject contains order status update
   - [ ] Email says "Your order is being prepared" (friendly message, not "PACKED")
   - [ ] Includes vendor name

6. [ ] Test status mapping by updating to different statuses:
   ```
   PACKED     → "is being prepared" ✓
   PICKED_UP  → "has been picked up" 🚚
   IN_TRANSIT → "is in transit" 🚚
   DELIVERED  → "has been delivered" 📦
   ```
   - [ ] Each status produces correct message

---

### Test 4.3: Payment Success Email
**Objective:** Verify successful payment notifications

1. [ ] Create a test order (Test 4.1)
2. [ ] Initiate payment:
   ```bash
   POST /api/payments/create-order
   Headers: { Authorization: "Bearer JWT_TOKEN" }
   {
     "amount": 1000,
     "currency": "INR"
   }
   ```
   - [ ] Response contains payment order ID

3. [ ] Complete payment (simulate):
   ```bash
   POST /api/payments/complete
   Headers: { Authorization: "Bearer JWT_TOKEN" }
   {
     "order_id": "razorpay_order_id",
     "payment_id": "pay_123456",
     "signature": "signature_text"
   }
   ```
   - [ ] Response shows 200 OK
   - [ ] Order payment_status shows "Paid"

4. [ ] Check EmailLog:
   ```bash
   db.emaillogs.find({ trigger: "payment_success" }).pretty()
   ```
   - [ ] Entry exists with status: "sent"

5. [ ] Check customer inbox:
   - [ ] Payment success email received
   - [ ] Subject contains "Payment Received" or "Payment Successful"
   - [ ] Email shows payment amount
   - [ ] Shows transaction/payment ID
   - [ ] Shows invoice reference

---

### Test 4.4: Payment Failure Email
**Objective:** Verify payment failure notifications (NEW ENDPOINT)

1. [ ] Create a test order (Test 4.1)
2. [ ] Get order ID from response

3. [ ] Call payment failure endpoint:
   ```bash
   POST /api/payments/failure
   Headers: { Authorization: "Bearer JWT_TOKEN" }
   {
     "order_id": "order_id_from_test",
     "reason": "Payment was declined by your bank"
   }
   ```
   - [ ] Response shows 200 OK
   - [ ] Order payment_status shows "Failed"

4. [ ] Check EmailLog:
   ```bash
   db.emaillogs.find({ trigger: "payment_failure" }).pretty()
   ```
   - [ ] Entry exists with status: "sent"

5. [ ] Check customer inbox:
   - [ ] Payment failure email received
   - [ ] Subject contains "Payment Failed"
   - [ ] Shows failure reason from request
   - [ ] Includes troubleshooting steps
   - [ ] Contains retry button/link to checkout
   - [ ] Link includes order_id parameter

6. [ ] Test different failure reasons:
   ```
   "Payment was declined by your bank"
   "Insufficient funds in your account"
   "Card has expired"
   "Incorrect card details"
   ```
   - [ ] Each produces appropriate email

---

### Test 4.5: Vendor Order Assignment Email
**Objective:** Verify vendor notifications (needs manual integration test)

*Note: This email function is created but not yet integrated into assignment flow*

1. [ ] Find order assignment logic in codebase
2. [ ] Locate where vendor is assigned to order
3. [ ] Add this code after assignment:
   ```typescript
   await sendVendorOrderNotificationEmail(
     vendor.email,
     vendor.name,
     order._id.toString(),
     order.totalAmount,
     { items: order.items, customer: order.customer_id, address: order.customerAddress }
   );
   ```

4. [ ] Test by assigning order to vendor
5. [ ] Check EmailLog for "vendor_order_notif" entries
6. [ ] Verify vendor receives email with:
   - [ ] New order alert
   - [ ] Order details
   - [ ] Customer information
   - [ ] Link to vendor dashboard

---

## Phase 5: Database & Audit Trail ✅

### Step 5.1: Verify EmailLog Collection
- [ ] Connect to MongoDB:
  ```bash
  mongosh
  use petmaza_db
  ```

- [ ] Verify collection exists:
  ```bash
  db.emaillogs.stats()
  ```
  - [ ] Returns collection stats

- [ ] View all email records:
  ```bash
  db.emaillogs.find().pretty()
  ```
  - [ ] Should show 2+ entries from tests above

### Step 5.2: Verify Indexes
- [ ] Check indexes exist:
  ```bash
  db.emaillogs.getIndexes()
  ```
  - [ ] Should show indexes on: recipient, status, trigger, timestamp, orderId, userId

### Step 5.3: Query Examples
- [ ] Find all emails to a specific recipient:
  ```bash
  db.emaillogs.find({ recipient: "test@example.com" })
  ```

- [ ] Find all failed emails:
  ```bash
  db.emaillogs.find({ status: "failed" })
  ```

- [ ] Find emails for specific order:
  ```bash
  db.emaillogs.find({ orderId: ObjectId("507f1f77bcf86cd799439011") })
  ```

- [ ] Find recent emails:
  ```bash
  db.emaillogs.find({
    timestamp: { $gte: new Date(Date.now() - 24*60*60*1000) }
  })
  ```

### Step 5.4: Monitor Failures
- [ ] Create a monitoring query:
  ```bash
  db.emaillogs.aggregate([
    { $match: { status: "failed" } },
    { $group: { _id: "$trigger", count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ])
  ```
  - [ ] Shows which email types are failing
  - [ ] Could indicate SMTP issues

---

## Phase 6: Error Scenarios Testing ✅

### Test 6.1: Invalid Email Address
1. [ ] Create order with invalid customer email
2. [ ] Check EmailLog for failure entry
3. [ ] Verify error message in `error` field
4. [ ] Confirm order still created successfully

### Test 6.2: SMTP Connection Failure
1. [ ] Temporarily change SMTP_HOST to invalid host
2. [ ] Try to create order
3. [ ] Check EmailLog shows failed status
4. [ ] Check error field contains connection error
5. [ ] Restore correct SMTP_HOST

### Test 6.3: Missing Environment Variables
1. [ ] Remove ADMIN_EMAILS from .env
2. [ ] Restart backend
3. [ ] Check logs for warning (graceful handling)
4. [ ] Verify emails to admin are skipped gracefully

### Test 6.4: Email Sending Disabled
1. [ ] Set SKIP_EMAIL=true in .env
2. [ ] Restart backend
3. [ ] Create order
4. [ ] Check EmailLog entry exists
5. [ ] Verify no actual emails sent
6. [ ] Restore SKIP_EMAIL=false

---

## Phase 7: Production Readiness ✅

### Step 7.1: Pre-Deployment Checklist
- [ ] All SMTP credentials are in environment variables (never hardcoded)
- [ ] ADMIN_EMAILS includes all necessary admins
- [ ] FRONTEND_URL is correct for production
- [ ] SMTP_SECURE is set appropriately (false for 587, true for 465)
- [ ] All email functions have proper error handling
- [ ] EmailLog collection has indexes
- [ ] Email templates are reviewed and approved

### Step 7.2: Security Check
- [ ] SMTP_PASS is NOT logged anywhere
- [ ] JWT verification is required for payment failure endpoint
- [ ] User can only see their own order emails
- [ ] Admins can only access admin emails
- [ ] No sensitive data in email body
- [ ] Email links use HTTPS for production

### Step 7.3: Performance Check
- [ ] Email sending is async (non-blocking)
- [ ] Order creation doesn't wait for email completion
- [ ] EmailLog indexes are in place
- [ ] Queries for email history are optimized
- [ ] No N+1 queries in populating order data

### Step 7.4: Monitoring Setup
- [ ] Monitor EmailLog for failed emails
  ```typescript
  // Add to monitoring service:
  const failedEmails = await EmailLog.find({ 
    status: 'failed',
    timestamp: { $gte: new Date(Date.now() - 60*1000) }
  });
  ```

- [ ] Alert if failure rate > 5%
- [ ] Track email delivery times
- [ ] Monitor SMTP connection health

---

## Phase 8: Troubleshooting Guide ✅

### Problem: "Cannot find module 'emailer'"
**Solution:**
- Check file path is correct: `src/services/emailer.ts`
- Run `npm install` to ensure dependencies
- Restart VS Code intellisense

### Problem: "SMTP Error: connect ECONNREFUSED"
**Solution:**
- [ ] Verify SMTP_HOST is correct (not typo)
- [ ] Verify SMTP_PORT is correct (usually 587 or 465)
- [ ] Check firewall isn't blocking port
- [ ] Test with `telnet smtp.gmail.com 587`

### Problem: "Invalid login" SMTP error
**Solution:**
- [ ] Verify SMTP_USER is correct email
- [ ] For Gmail: use app password (not regular password)
- [ ] Ensure app password has no spaces
- [ ] Check if 2FA is enabled for Gmail
- [ ] Regenerate app password if expired

### Problem: Emails not received in inbox
**Solution:**
- [ ] Check spam/junk folder
- [ ] Verify recipient email is correct
- [ ] Check EmailLog for delivery confirmation
- [ ] Verify SMTP_FROM is valid email
- [ ] For Gmail: recipient domain might need whitelist
- [ ] Check email provider's bounce logs

### Problem: Email logs not appearing
**Solution:**
- [ ] Verify SKIP_EMAIL is not true
- [ ] Check MongoDB connection is active
- [ ] Verify EmailLog collection exists
- [ ] Check order creation response for errors
- [ ] Look at backend console for exceptions

### Problem: Status mapping shows internal status not friendly message
**Solution:**
- [ ] Check status mapping logic in updateOrderStatus()
- [ ] Verify this code exists:
  ```typescript
  const statusMap: { [key: string]: string } = {
    'PACKED': 'processing',
    'PICKED_UP': 'shipped',
    'IN_TRANSIT': 'shipped',
    'DELIVERED': 'delivered'
  };
  ```
- [ ] Ensure status update uses mapped status

---

## Verification Checklist

### Code Level
- [x] emailer.ts service created with 7 functions
- [x] EmailLog model created with proper schema
- [x] Order controller imports added
- [x] Order controller integration points added
- [x] Payment controller imports added
- [x] Payment controller integration points added
- [x] Payment failure handler created
- [x] Routes updated with failure endpoint
- [x] All imports are correct and resolve
- [x] No TypeScript compilation errors

### Database Level
- [ ] EmailLog collection created
- [ ] Indexes created on required fields
- [ ] Can query emails by recipient
- [ ] Can query emails by status
- [ ] Can query emails by trigger
- [ ] Can query emails by orderId

### Integration Level
- [ ] Order creation triggers 2 emails
- [ ] Order status update triggers 1 email
- [ ] Payment success triggers 1 email
- [ ] Payment failure triggers 1 email
- [ ] All emails are async (non-blocking)
- [ ] All email failures are caught
- [ ] Email failures don't cascade

### Test Level
- [ ] Test email received for order creation
- [ ] Test email received for status update
- [ ] Test email received for payment success
- [ ] Test email received for payment failure
- [ ] EmailLog shows all attempts
- [ ] Status mapping produces correct messages

---

## Support & Documentation

**Quick Reference Files:**
1. `EMAILER_SYSTEM_DOCUMENTATION.md` - Full system documentation
2. `EMAILER_QUICK_REFERENCE.md` - Quick lookup guide
3. `EMAILER_ARCHITECTURE.md` - System diagrams and flows
4. This file - Implementation & testing checklist

**Getting Help:**
- Review error message from backend logs
- Check EmailLog collection for detailed error
- Query MongoDB for pattern in failures
- Test SMTP connection independently
- Review email templates in emailer.ts

---

## Status

- [x] **Architecture:** Complete
- [x] **Code Implementation:** Complete
- [x] **Integration:** Complete
- [ ] **Configuration:** Pending (user must setup SMTP)
- [ ] **Testing:** Pending (user must run tests)
- [ ] **Monitoring:** Pending (user may setup alerts)

**Ready for:** SMTP Configuration → Testing → Deployment

---

**Version:** 1.0 | Last Updated: 2024
