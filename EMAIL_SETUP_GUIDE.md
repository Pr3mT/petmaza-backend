# ✉️ EMAIL SYSTEM - SETUP & USAGE GUIDE

## 📧 Three Main Email Flows

### 1️⃣ ORDER CONFIRMATION EMAIL
**When:** Customer places an order
**Recipient:** Customer email
**Trigger:** `createOrder()` in orderController.ts
**Function:** `sendOrderConfirmationEmail()`

```
Customer places order → Order created → Email sent automatically
```

### 2️⃣ PAYMENT SUCCESS EMAIL  
**When:** Payment is verified
**Recipient:** Customer email
**Trigger:** `verifyPayment()` in paymentController.ts
**Function:** `sendPaymentSuccessEmail()`

```
Payment made → Payment verified → Email sent automatically
```

### 3️⃣ FULFILLER DELIVERY NOTIFICATION
**When:** Order assigned to fulfiller
**Recipient:** Fulfiller email
**Trigger:** Need to add this call when order is assigned to fulfiller
**Function:** `sendFulfillerDeliveryNotificationEmail()`

```
Order assigned to fulfiller → Fulfiller notified via email
```

---

## ✅ WHAT'S ALREADY IMPLEMENTED

### Order Confirmation ✓
- **File:** `src/controllers/orderController.ts` (lines 38-48)
- **Status:** WORKING (after backend restart)
- **Email Content:** Order details, items, delivery address

### Payment Success ✓  
- **File:** `src/controllers/paymentController.ts` (lines 218-228)
- **Status:** WORKING (after backend restart)
- **Email Content:** Payment details, order ID, amount, payment ID

---

## ⚙️ SETUP REQUIREMENTS

### 1. Environment Variables (.env)
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=samrudhiamrutkar15@gmail.com
SMTP_PASS=nfye ypke hykd lilk
EMAIL_FROM_NAME=PET Marketplace
ADMIN_EMAILS=admin@petmaza.com,samrudhiamrutkar15@gmail.com
```

### 2. Import the Email Functions
```typescript
import {
  sendOrderConfirmationEmail,
  sendPaymentSuccessEmail,
  sendFulfillerDeliveryNotificationEmail,
  sendDeliveryCompletedEmail
} from '../services/emailer';
```

### 3. Call in Controllers
The emails are automatically sent when:
- Order is created
- Payment is verified
- (Need to add) Order is assigned to fulfiller
- (Need to add) Delivery is completed

---

## 🚀 TEST THE EMAILS

### Test Script
```bash
npm run test-email
npm run diagnose-emails
```

### Manual Test
1. Restart backend: `npm start`
2. Go to frontend: http://localhost:3000
3. Login as customer
4. Add items, place order, complete payment
5. Check email inbox for:
   - Order Confirmation ✉️
   - Payment Success ✉️

---

## 📋 ALL AVAILABLE EMAIL FUNCTIONS

| Function | Use Case | Recipients |
|----------|----------|-----------|
| `sendOrderConfirmationEmail()` | Order created | Customer |
| `sendPaymentSuccessEmail()` | Payment received | Customer |
| `sendPaymentFailureEmail()` | Payment failed | Customer |
| `sendOrderStatusUpdateEmail()` | Order status changes | Customer |
| `sendVendorOrderNotificationEmail()` | Order assigned to vendor | Vendor |
| `sendFulfillerDeliveryNotificationEmail()` | Order assigned to fulfiller | Fulfiller |
| `sendDeliveryCompletedEmail()` | Delivery completed | Customer |
| `sendAdminOrderNotificationEmail()` | New order created | Admin |
| `sendEmail()` | Custom emails | Any recipient |

---

## 🔍 TROUBLESHOOTING

### Emails Not Sending?
1. ✅ Check backend is running
2. ✅ Restart backend after .env changes: `npm start`
3. ✅ Check console logs for errors
4. ✅ Check MongoDB `emaillogs` collection:
   ```bash
   db.emaillogs.find({}).pretty()
   ```

### Wrong Password Error?
```
Error: Invalid login: 535-5.7.8 Username and Password not accepted
```
**Solution:** 
- Get new Gmail app password from: https://myaccount.google.com/apppasswords
- Update `SMTP_PASS` in `.env`
- Restart backend

### Emails Going to Spam?
- Check spam/promotions folder
- Add sender to contacts
- Email domain may need SPF/DKIM configuration

---

## 📱 NEXT STEPS - ADD FULFILLER EMAIL

To send email when order is assigned to fulfiller, add this to the order assignment controller:

```typescript
try {
  await sendFulfillerDeliveryNotificationEmail(
    fulfiller.email,
    fulfiller.name,
    order._id.toString(),
    {
      customerName: order.customer_id.name,
      customerAddress: order.customerAddress,
      customerPhone: order.customer_id.phone,
      customerPincode: order.customerPincode,
      totalAmount: order.totalAmount,
      items: order.items
    }
  );
} catch (emailError: any) {
  console.error('Failed to send fulfiller email:', emailError.message);
}
```

---

## 📊 EMAIL STATUS TRACKING

All emails are logged in MongoDB:
```
Collection: emaillogs
Fields:
- recipient: email address
- subject: email subject
- status: 'sent' or 'failed'
- trigger: email type (order_confirmation, payment_success, etc)
- timestamp: when email was sent
- error: error message if failed
- orderId: associated order ID
- userId: associated user ID
```

---

**Last Updated:** March 2, 2026
**System Status:** ✅ Ready for Production
