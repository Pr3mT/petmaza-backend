# Discount/Coupon Debugging Test Guide

## Issue
Discount not showing in order details page and order confirmation email despite being applied at checkout.

## Debug Logging Added

### Backend Files Modified:
1. **src/controllers/orderController.ts**
   - Line ~196: Logs discount fields when saving order
   - Line ~437: Logs discount fields when retrieving order by ID

2. **src/services/emailer.ts**
   - Line ~105: Logs discount fields when sending order confirmation email

### Frontend Files Modified:
1. **src/pages/Orders/OrderDetail.js**
   - Line ~54: Logs order data received from API including discount fields

## Test Steps

### 1. Start Backend Server
```bash
cd c:\Users\SAMRUDDHI\Documents\GitHub\petmaza-backend
npm run dev
```

### 2. Start Frontend Server (in new terminal)
```bash
cd c:\Users\SAMRUDDHI\Documents\GitHub\petmaza-frontend
npm start
```

### 3. Place a Test Order with Coupon

1. **Login as customer** on the frontend
2. **Add products to cart** (e.g., 1 item worth ₹2,700)
3. **Go to cart** and apply a coupon code (e.g., SAVE7AB3CD or any active coupon)
4. **Verify discount shows in cart**:
   - Should show: "Coupon Applied: SAVE7AB3CD"
   - Should show discount amount in green
5. **Proceed to checkout**
6. **Verify discount shows in checkout**:
   - Order summary should show discount line
   - Total should reflect discount
7. **Complete the order**

### 4. Check Backend Console Logs

Look for these debug logs in the **backend terminal**:

```
DEBUG - createOrder - Saved order with discount: {
  orderId: '...',
  discountAmount: 270,
  couponCode: 'SAVE7AB3CD',
  subtotalBeforeCharges: 2700,
  total: 2710
}
```

```
DEBUG - sendOrderConfirmationEmail - orderData: {
  orderId: '#abc12345',
  discountAmount: 270,
  couponCode: 'SAVE7AB3CD',
  totalAmount: 2710,
  subtotalBeforeCharges: 2700
}
```

### 5. View Order Details

1. **Go to "My Orders"** after placing the order
2. **Click on the order** to view details
3. **Open browser console** (F12)

Look for this debug log in the **browser console**:

```
DEBUG - Order data received: {
  orderId: '...',
  total: 2710,
  discountAmount: 270,
  couponCode: 'SAVE7AB3CD',
  subtotalBeforeCharges: 2700,
  shippingCharges: 0,
  platformFee: 10
}
```

### 6. Check Backend Console for GET Request

When you view the order details, look for this in **backend terminal**:

```
DEBUG - getOrderById - Discount fields: {
  orderId: '...',
  discountAmount: 270,
  couponCode: 'SAVE7AB3CD',
  subtotalBeforeCharges: 2700,
  total: 2710
}
```

### 7. Check Email

1. **Check the order confirmation email** in your inbox
2. **Look for discount line** in the order summary table:
   ```
   Discount (SAVE7AB3CD): -₹270
   ```

## Expected Results

### ✅ Success Indicators:
1. Backend logs show `discountAmount` and `couponCode` are **being saved** during order creation
2. Backend logs show `discountAmount` and `couponCode` are **being retrieved** when fetching order
3. Frontend console shows `discountAmount` and `couponCode` are **being received** in the API response
4. Email logs show `discountAmount` and `couponCode` are **being passed** to the email template
5. **Order details page displays** the discount in green
6. **Email displays** the discount in green

### ❌ Failure Indicators:
1. If backend shows `discountAmount: 0` or `couponCode: undefined` when saving:
   - Issue is in order creation logic
2. If backend shows `discountAmount: 0` when retrieving but was saved correctly:
   - Issue is in database or model
3. If frontend receives `discountAmount: 0` or `undefined`:
   - Issue is in API response
4. If email shows `discountAmount: 0`:
   - Issue is in data being passed to email queue

## What to Share

After testing, please share:
1. **All DEBUG logs** from backend terminal (copy the relevant lines)
2. **DEBUG log** from browser console
3. **Screenshot** of order details page showing if discount appears or not
4. **Screenshot** of email showing if discount appears or not

## Additional Check (If Discount Still Not Showing)

If the logs show discount is being saved and retrieved correctly, but still not showing in UI, check the **browser console for any errors** when the OrderDetail page loads.

Also verify in the browser console:
```javascript
// In the OrderDetail.js component
console.log('order.discountAmount > 0:', order.discountAmount > 0);
console.log('order.discountAmount:', order.discountAmount);
console.log('typeof order.discountAmount:', typeof order.discountAmount);
```

This will help us identify if it's a data type issue (string vs number) or rendering condition issue.
