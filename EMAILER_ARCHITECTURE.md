# Emailer System Architecture

## System Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        PETMAZA EMAILER SYSTEM                           │
└─────────────────────────────────────────────────────────────────────────┘

                           TRIGGER SOURCES
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
              ┌─────▼────┐  ┌────▼────┐  ┌───▼────┐
              │  ORDERS  │  │ PAYMENTS │  │ AUTH   │
              └─────┬────┘  └────┬────┘  └───┬────┘
                    │            │            │
                    │ Create     │ Success    │ Registration
                    │ or Update  │ or Fail   │
                    └────────────┼────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │  EMAILER SERVICE       │
                    │  (src/services/        │
                    │   emailer.ts)          │
                    │                        │
                    │ Functions:             │
                    │ • sendOrderConfirm()   │
                    │ • sendOrderStatus()    │
                    │ • sendPaymentSuccess() │
                    │ • sendPaymentFailure() │
                    │ • sendVendorNotif()    │
                    │ • sendAdminNotif()     │
                    │ • sendEmail()          │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │  NODEMAILER SMTP       │
                    │  (SMTP_HOST, PORT,     │
                    │   USER, PASS)          │
                    │                        │
                    │ Transporter setup      │
                    │ with TLS/SSL           │
                    └────────────┬────────────┘
                                 │
                ┌────────────────┼────────────────┐
                │                │                │
         ┌──────▼──────┐  ┌──────▼──────┐  ┌────▼─────┐
         │    SUCCESS  │  │    FAILED   │  │  LOGGING │
         │             │  │             │  │          │
         │ Email sent  │  │ Email failed│  │ Save to  │
         │ return msgId│  │ return error│  │ EmailLog │
         │ to DB       │  │ to ErrorLog │  │ MongoDB  │
         └─────────────┘  └─────────────┘  └──────────┘
                │                │                │
                └────────────────┼────────────────┘
                                 │
                         ┌────────▼─────────┐
                         │  EMAIL DELIVERED │
                         │  TO RECIPIENTS   │
                         │                  │
                         │ • Customer inbox │
                         │ • Vendor inbox   │
                         │ • Admin inbox    │
                         └──────────────────┘

                              AUDIT TRAIL
                                  │
                    ┌─────────────▼──────────────┐
                    │   EMAIL LOG (MongoDB)      │
                    │                            │
                    │ Fields:                    │
                    │ • recipient                │
                    │ • subject                  │
                    │ • body (HTML)              │
                    │ • status (sent/failed)     │
                    │ • trigger (type)           │
                    │ • timestamp                │
                    │ • messageId                │
                    │ • error (if failed)        │
                    │ • orderId                  │
                    │ • userId                   │
                    │                            │
                    │ Indexes:                   │
                    │ • recipient                │
                    │ • status                   │
                    │ • trigger                  │
                    │ • timestamp                │
                    │ • orderId                  │
                    └────────────────────────────┘
```

---

## Request-Response Flow

### 1. ORDER CREATION EMAIL FLOW

```
┌─────────────────┐
│ Customer POST   │
│ /api/orders     │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ orderController.createOrder()            │
│                                         │
│ 1. Validate order data                 │
│ 2. Create Order in DB                  │
│ 3. Save to database                    │
└────────┬────────────────────────────────┘
         │
         ├─► TRY BLOCK:
         │   ├─ Populate order details
         │   ├─ Call sendOrderConfirmationEmail()
         │   │  └─ Creates email object
         │   │     └─ Sends via Nodemailer
         │   │        └─ Logs success/failure to EmailLog
         │   │
         │   └─ Call sendAdminOrderNotificationEmail()
         │      └─ Creates admin alert
         │         └─ Sends to all ADMIN_EMAILS
         │            └─ Logs to EmailLog
         │
         └─► CATCH BLOCK: Log error, don't block response
                  
         ▼
┌─────────────────────────────────────────┐
│ Response: 200 OK                        │
│ {                                       │
│   success: true,                        │
│   message: "Order created successfully",│
│   data: { orderId, ... }                │
│ }                                       │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ MEANWHILE:                              │
│                                         │
│ EmailLog entries created:               │
│ 1. { recipient: "customer@...",         │
│      trigger: "order_confirmation",     │
│      status: "sent", ... }              │
│                                         │
│ 2. { recipient: "admin@...",            │
│      trigger: "admin_order_notif",      │
│      status: "sent", ... }              │
└─────────────────────────────────────────┘
```

### 2. ORDER STATUS UPDATE EMAIL FLOW

```
┌──────────────────────┐
│ Vendor PATCH         │
│ /api/orders/id       │
│ { status: "PACKED" } │
└──────────┬───────────┘
           │
           ▼
┌────────────────────────────────────────┐
│ orderController.updateOrderStatus()     │
│                                        │
│ 1. Validate user (vendor access check)│
│ 2. Get current order from DB          │
│ 3. Update status field                │
│ 4. Save to database                   │
└────────┬───────────────────────────────┘
         │
         ├─► SEND EMAIL TO CUSTOMER:
         │   (in try-catch block)
         │   
         │   Input: status = "PACKED"
         │   ↓ MAP STATUS ↓
         │   friendlyStatus = "processing" ✓
         │   
         │   Call: sendOrderStatusUpdateEmail(
         │     email,
         │     name,
         │     orderId,
         │     "PACKED",      // internal
         │     vendorName
         │   )
         │   
         │   Email body includes:
         │   "Your order is being prepared" ✓
         │   + vendor name
         │   + estimated delivery
         │   
         │   ↓ LOG TO EMAILLOG ↓
         │   { trigger: "order_status_update",
         │     status: "sent", ... }
         │
         └─► END TRY-CATCH
         
         ▼
┌────────────────────────────────────────┐
│ Response: 200 OK                       │
│ {                                      │
│   success: true,                       │
│   message: "Status updated",           │
│   data: { orderId, status: "PACKED" }  │
│ }                                      │
└────────────────────────────────────────┘

STATUS MAPPING REFERENCE:
┌──────────────┬──────────────────┬──────────────────┐
│ Internal     │ Customer-Friendly│ Email Icon       │
├──────────────┼──────────────────┼──────────────────┤
│ PACKED       │ processing       │ ✓ Order prepared │
│ PICKED_UP    │ shipped          │ 🚚 Picked up    │
│ IN_TRANSIT   │ shipped          │ 🚚 In transit    │
│ DELIVERED    │ delivered        │ 📦 Delivered     │
└──────────────┴──────────────────┴──────────────────┘
```

### 3. PAYMENT SUCCESS EMAIL FLOW

```
┌──────────────────────────┐
│ Client POST              │
│ /api/payments/complete   │
│ { ... payment details }  │
└──────────┬───────────────┘
           │
           ▼
┌────────────────────────────────────────┐
│ paymentController.completePayment()     │
│                                        │
│ 1. Verify payment signature             │
│ 2. Find order in DB                    │
│ 3. Update payment_status to "Paid"     │
│ 4. Save order                          │
└────────┬───────────────────────────────┘
         │
         ├─► TRY BLOCK:
         │   └─ Populate customer details
         │   └─ Call sendPaymentSuccessEmail(
         │        email,
         │        name,
         │        orderId,
         │        amount
         │      )
         │      └─ Creates HTML email
         │      └─ Sends via Nodemailer
         │      └─ Logs to EmailLog
         │
         └─► CATCH BLOCK: Log error, don't fail payment
         
         ▼
┌────────────────────────────────────────┐
│ Response: 200 OK                       │
│ { success: true,                       │
│   message: "Payment verified",         │
│   data: { orderId, status: "Paid" } }  │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ CUSTOMER RECEIVES EMAIL:               │
│                                        │
│ Subject: "Payment Received!"           │
│ Body:                                  │
│ ✓ Your payment of ₹4,999 was received │
│ Payment ID: pay_123456                 │
│ Transaction Date: 2024-01-15           │
│ Invoice: INV-12345                     │
│                                        │
│ Next: Your order will be processed     │
│ soon. Track here: [link]               │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ EmailLog Entry:                        │
│ {                                      │
│   recipient: "customer@email.com",     │
│   subject: "Payment Received!",        │
│   trigger: "payment_success",          │
│   status: "sent",                      │
│   messageId: "...",                    │
│   orderId: "_id",                      │
│   timestamp: new Date()                │
│ }                                      │
└────────────────────────────────────────┘
```

### 4. PAYMENT FAILURE EMAIL FLOW

```
┌──────────────────────────┐
│ Client POST (New!)       │
│ /api/payments/failure    │
│ {                        │
│   order_id: "...",       │
│   reason: "Insufficient" │
│ }                        │
└──────────┬───────────────┘
           │
           ▼
┌────────────────────────────────────────┐
│ paymentController.handlePaymentFailure()│ (NEW FUNCTION)
│                                        │
│ 1. Validate order exists               │
│ 2. Check user owns order               │
│ 3. Update payment_status to "Failed"   │
│ 4. Save order                          │
└────────┬───────────────────────────────┘
         │
         ├─► TRY BLOCK:
         │   └─ Populate customer details
         │   └─ Call sendPaymentFailureEmail(
         │        email,
         │        name,
         │        orderId,
         │        amount,
         │        reason
         │      )
         │      └─ Creates failure email
         │      └─ Includes retry link
         │      └─ Includes FRONTEND_URL
         │      └─ Sends via Nodemailer
         │      └─ Logs to EmailLog
         │
         └─► CATCH BLOCK: Log error, don't fail
         
         ▼
┌────────────────────────────────────────┐
│ Response: 200 OK                       │
│ {                                      │
│   success: true,                       │
│   message: "Payment failure recorded", │
│   data: { order: {...} }               │
│ }                                      │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ CUSTOMER RECEIVES EMAIL:               │
│                                        │
│ Subject: "Payment Failed"              │
│ Body:                                  │
│ ⚠️ Your payment for ₹4,999 was        │
│    declined by your bank               │
│                                        │
│ Order ID: ORDER-12345                  │
│ Amount: ₹4,999                         │
│ Reason: Insufficient funds             │
│                                        │
│ Troubleshooting:                       │
│ • Check card details                   │
│ • Ensure sufficient funds              │
│ • Try a different payment method       │
│ • Contact your bank                    │
│                                        │
│ [RETRY PAYMENT] ← Link to frontend    │
│ http://frontend:3000/checkout?        │
│ order=ORDER-12345                      │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ EmailLog Entry:                        │
│ {                                      │
│   recipient: "customer@email.com",     │
│   subject: "Payment Failed",           │
│   trigger: "payment_failure",          │
│   status: "sent",                      │
│   messageId: "...",                    │
│   orderId: "_id",                      │
│   timestamp: new Date()                │
│ }                                      │
└────────────────────────────────────────┘
```

---

## Component Architecture

```
CONTROLLERS (Request Handlers)
│
├─ orderController.ts
│  ├─ createOrder()            ──► Triggers order_confirmation + admin_order_notif
│  └─ updateOrderStatus()      ──► Triggers order_status_update
│
├─ paymentController.ts
│  ├─ completePayment()        ──► Triggers payment_success
│  └─ handlePaymentFailure()   ──► Triggers payment_failure
│
└─ authController.ts
   └─ register()               ──► Triggers welcome email
                                   (via sendEmail)

         │
         ▼

SERVICES (Business Logic)
│
└─ emailer.ts
   │
   ├─ sendEmail()                        (Core function)
   ├─ sendOrderConfirmationEmail()       (Template 1)
   ├─ sendOrderStatusUpdateEmail()       (Template 2)
   ├─ sendPaymentSuccessEmail()          (Template 3)
   ├─ sendPaymentFailureEmail()          (Template 4)
   ├─ sendVendorOrderNotificationEmail() (Template 5)
   └─ sendAdminOrderNotificationEmail()  (Template 6)

         │
         ▼

CONFIGURATION (Credentials)
│
└─ Environment Variables
   ├─ SMTP_HOST
   ├─ SMTP_PORT
   ├─ SMTP_USER
   ├─ SMTP_PASS
   ├─ SMTP_FROM
   ├─ SMTP_SECURE
   ├─ ADMIN_EMAILS
   └─ FRONTEND_URL

         │
         ▼

EXTERNAL SERVICE (Email Provider)
│
└─ Nodemailer + SMTP
   ├─ SMTP Provider (Gmail, SendGrid, etc)
   └─ Email Transporter

         │
         ▼

DATABASE (Audit Trail)
│
└─ EmailLog (MongoDB)
   ├─ Logs all sent emails
   ├─ Logs all failed emails
   └─ Indexes for querying
```

---

## Data Flow: Order to Email

```
CREATE ORDER REQUEST
      │
      ▼
┌──────────────────────┐
│ Validate Input       │
│ Check Auth           │
│ Calculate Total      │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Assign to Vendor     │
│ Set Status           │
│ Generate Tracking    │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Save to Database     │
│ Get Order ID         │
│ Populate Relations   │
└──────────┬───────────┘
           │
        ┌──┴──┐
        │     │
        ▼     ▼
     EMAIL 1 EMAIL 2
    (CUSTOMER) (ADMIN)
        │     │
        ├─────┘
        │
        ▼
┌──────────────────────┐
│ Call emailer service │
│ Create email objects │
│ Setup SMTP           │
└──────────┬───────────┘
           │
        ┌──┴──────────────┐
        │                 │
        ▼                 ▼
    SEND EMAIL        LOG RESULT
    via Nodemailer     to MongoDB
        │                 │
        │                 │
    DELIVER TO        RECORD
    CUSTOMER/ADMIN    SUCCESS/FAILURE
        │                 │
        └─────────────────┘
              │
              ▼
        RESPONSE: 200 OK
        (Order created)
```

---

## Error Handling Flow

```
TRY TO SEND EMAIL
      │
      ▼
┌──────────────────────────┐
│ Verify SMTP Transporter  │
│ (check connection)       │
└──────────┬───────────────┘
           │
      ┌────┴────┐
      │         │
   SUCCESS    FAILURE
      │         │
      ▼         ▼
   SEND      GET ERROR
   EMAIL     MESSAGE
      │         │
      ├─────────┤
      │
      ▼
┌──────────────────────────┐
│ Create EmailLog Entry    │
│ status: "sent" or        │
│ status: "failed" + error │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ Save to MongoDB          │
│ EmailLog Collection      │
└──────────┬───────────────┘
           │
      ┌────┴────┐
      │         │
   EMAIL    ORDER/PAYMENT
   LOGGED   NOT AFFECTED
      │         │
      └─────────┘
          │
          ▼
    NO CASCADE FAILURE
    Order still created
    Payment still processed
    User sees success message
```

---

## Status Mapping Logic

```
Vendor Updates Order Status (PACKED)
                │
                ▼
┌─────────────────────────────────┐
│ Check Status Value              │
└─────────────────────────────────┘
                │
        ┌───────┼───────┬─────────┐
        │       │       │         │
      PACKED  PICKED  IN_TRANSIT DELIVERED
        │     UP        │         │
        │       │       │         │
        ▼       ▼       ▼         ▼
    "proc"  "ship"  "ship"    "deliv"
        │       │       │         │
        └───────┴───────┴───────  ┙
                │
                ▼
        Use friendly status
        in customer email
                │
                ▼
    "Your order is being
     prepared for shipment" ✓
                │
                ▼
        Send email with
        friendly message
```

---

## Version: 1.0 | Complete Architecture Documentation
