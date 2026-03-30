# Petmaza Coupon System - Complete Guide

## 📋 Table of Contents
1. [System Overview](#system-overview)
2. [How It Works](#how-it-works)
3. [Creating Coupons (Admin)](#creating-coupons-admin)
4. [Coupon Types & Examples](#coupon-types--examples)
5. [Customer Usage](#customer-usage)
6. [Testing Guide](#testing-guide)
7. [Technical Architecture](#technical-architecture)
8. [Troubleshooting](#troubleshooting)

---

## 🎯 System Overview

The Petmaza coupon system allows:
- **Admins** to create, edit, activate/deactivate, and delete discount coupons
- **Customers** to apply coupon codes at checkout for discounts
- **Automatic validation** of coupon eligibility (dates, usage limits, customer eligibility, product applicability)
- **Usage tracking** to prevent coupon abuse

### Key Features
✅ **Percentage & Flat Discounts**: Support both discount types  
✅ **Brand-Specific Coupons**: Apply discounts only to specific brands (e.g., Royal Canin, Pedigree)  
✅ **Category-Specific Coupons**: Apply discounts only to specific categories (e.g., Dog Food, Cat Toys)  
✅ **First-Time Customer Offers**: Exclusive coupons for first-time buyers  
✅ **Usage Limits**: Global usage limits and per-user limits  
✅ **Min Order Value**: Require minimum cart value for coupon eligibility  
✅ **Max Discount Cap**: Limit maximum discount amount for percentage coupons  
✅ **Date Range**: Set valid from/to dates for seasonal promotions  

---

## 🔧 How It Works

### Backend Flow
1. **Customer applies coupon** in Cart/Checkout page
2. **Frontend validates** coupon via `/api/coupons/validate` endpoint
3. **Backend checks**:
   - Is coupon active?
   - Is it within valid date range?
   - Is min order value met?
   - Is this customer eligible (first-time check)?
   - Has global usage limit been reached?
   - Has per-user usage limit been reached?
   - Are cart products applicable (brand/category check)?
4. **Discount calculated** based on discount type (percentage or flat)
5. **Order created** with coupon code and discount amount stored
6. **Coupon usage recorded** - increments usage count and tracks user usage

### Database Structure
- **Coupon Collection**: Stores coupon definitions (code, discount, rules)
- **Order Collection**: Stores applied coupon code and discount amount per order
- **Usage Tracking**: Embedded `usedBy` array in Coupon tracks per-user usage

---

## 🔨 Creating Coupons (Admin)

### Step-by-Step: Create a Coupon

1. **Login as Admin**
   - Navigate to admin portal
   - Credentials: Use your admin account

2. **Go to Coupons Page**
   - In the sidebar menu, click **"Coupons"** (💰 icon)
   - URL: `http://your-domain/admin/coupons`

3. **Click "Create New Coupon"**
   - Opens modal form

4. **Fill in Coupon Details**

   **Basic Info:**
   - **Coupon Code**: Unique code (e.g., `WELCOME10`, `ROYAL100`)
     - Auto-converts to uppercase
     - Must be unique across all coupons
   - **Description**: Internal note about coupon purpose

   **Discount Settings:**
   - **Discount Type**: Choose `Percentage` or `Flat Amount`
   - **Discount Value**: 
     - For Percentage: Enter 5-100 (e.g., 10 = 10% off)
     - For Flat: Enter rupee amount (e.g., 100 = ₹100 off)
   - **Max Discount** (Percentage only): Cap maximum discount amount (e.g., ₹500)

   **Conditions:**
   - **Min Order Value**: Minimum cart value required (e.g., ₹2000)
   - **Valid From**: Start date (optional)
   - **Valid To**: End date (optional)
   - **First-Time Only**: Check if only for first-time customers

   **Usage Limits:**
   - **Total Usage Limit**: Maximum total uses (e.g., 100)
   - **Usage Per User**: Max uses per customer (e.g., 1)

   **Applicability:**
   - **Applicable For**: Choose:
     - `All Products` - Works on entire catalog
     - `Specific Brands` - Select brands from dropdown
     - `Specific Categories` - Select subcategories from dropdown

5. **Save Coupon**
   - Click **"Create Coupon"**
   - Coupon is created and automatically **Active**

### Editing Coupons
- Click **Edit** icon (✏️) next to any coupon
- Modify any field except the coupon code
- Click **"Update Coupon"** to save

### Activating/Deactivating Coupons
- Use the **toggle switch** in the Active column
- Deactivated coupons cannot be used by customers
- Useful for pausing promotions without deleting

### Deleting Coupons
- Click **Delete** icon (🗑️) next to any coupon
- **Warning**: This permanently deletes the coupon and all usage history

---

## 🎁 Coupon Types & Examples

### 1️⃣ First-Time Customer Welcome Offer
**Scenario**: Give 10% discount to new customers on orders above ₹500

```
Code: WELCOME10
Type: Percentage
Value: 10
Min Order: 500
Max Discount: 200
First-Time Only: ✅ YES
Applicable For: All Products
Usage Per User: 1
Total Usage: 1000
```

**How it works:** Customer must have **zero previous orders**.

---

### 2️⃣ Flat Discount on Minimum Purchase
**Scenario**: Get ₹100 off on orders above ₹2000

```
Code: SAVE100
Type: Flat Amount
Value: 100
Min Order: 2000
First-Time Only: ❌ NO
Applicable For: All Products
Usage Per User: 3
Total Usage: 500
```

**How it works:** Any customer, repeat purchases allowed (up to 3 times per user).

---

### 3️⃣ Brand-Specific Discount
**Scenario**: 15% off on Royal Canin products only, max ₹500 discount

```
Code: ROYAL15
Type: Percentage
Value: 15
Max Discount: 500
Min Order: 1000
Applicable For: Specific Brands
Selected Brands: Royal Canin
Usage Per User: 1
Total Usage: 200
```

**How it works:** Only applies if cart contains **at least one Royal Canin product**.

---

### 4️⃣ Category-Specific Discount
**Scenario**: ₹50 off on Dog Food category only

```
Code: DOGFOOD50
Type: Flat Amount
Value: 50
Min Order: 300
Applicable For: Specific Categories
Selected Categories: Dog Food
Usage Per User: 2
Total Usage: 1000
```

**How it works:** Only applies if cart contains **at least one Dog Food product**.

---

### 5️⃣ Limited-Time Sale
**Scenario**: 20% off storewide during Diwali week, max ₹1000 discount

```
Code: DIWALI20
Type: Percentage
Value: 20
Max Discount: 1000
Valid From: 2024-11-01
Valid To: 2024-11-07
First-Time Only: ❌ NO
Applicable For: All Products
Usage Per User: 1
Total Usage: 5000
```

**How it works:** Only valid between Nov 1-7, 2024. Expires automatically after Nov 7.

---

## 🛒 Customer Usage

### How Customers Apply Coupons

#### On Cart Page:
1. Add products to cart
2. Scroll to **Order Summary** section (right side)
3. See **"Enter coupon code"** input field
4. Type coupon code (e.g., `WELCOME10`)
5. Click **"Apply"** button
6. See discount applied in green success message
7. Proceed to checkout (discount persists)

#### On Checkout Page:
- If coupon was applied in cart, it shows in Order Summary
- Green badge displays: **Coupon Code** and **Discount Amount**
- Click **X** button to remove coupon
- Final total reflects discount

#### Error Messages Customers May See:
- ❌ "Invalid or inactive coupon code" - Code doesn't exist or is deactivated
- ❌ "Coupon has expired" - Past valid date range
- ❌ "Minimum order value of ₹2000 required" - Cart total too low
- ❌ "This coupon is only valid for first-time customers" - User has previous orders
- ❌ "You have reached the usage limit for this coupon" - User exceeded per-user limit
- ❌ "Coupon usage limit has been reached" - Global usage limit hit
- ❌ "Coupon not applicable to products in cart" - No matching brand/category products

---

## 🧪 Testing Guide

### Test Case 1: First-Time Customer Coupon
1. Create coupon: `Code: TEST10, Type: Percentage, Value: 10, First-Time Only: YES`
2. **Login as NEW customer** (account with 0 orders)
3. Add ₹500 worth of products to cart
4. Apply `TEST10` → ✅ Should work, get ₹50 discount
5. **Complete order**
6. Try applying `TEST10` again → ❌ Should fail with "only valid for first-time customers"

### Test Case 2: Min Order Value Check
1. Create coupon: `Code: MIN2000, Type: Flat, Value: 100, Min Order: 2000`
2. Add ₹1500 worth of products to cart
3. Apply `MIN2000` → ❌ Should fail with "Minimum order value of ₹2000 required"
4. Add more products to reach ₹2000+
5. Apply `MIN2000` → ✅ Should work, get ₹100 discount

### Test Case 3: Brand-Specific Coupon
1. Create coupon: `Code: ROYAL15, Type: Percentage, Value: 15, Brands: Royal Canin`
2. Add **non-Royal Canin** products to cart (e.g., Pedigree)
3. Apply `ROYAL15` → ❌ Should fail with "not applicable to products in cart"
4. Add **Royal Canin** product to cart
5. Apply `ROYAL15` → ✅ Should work, get 15% discount

### Test Case 4: Usage Limit (Per User)
1. Create coupon: `Code: LIMIT1, Type: Flat, Value: 50, Usage Per User: 1`
2. Apply and complete 1 order with `LIMIT1`
3. Try applying `LIMIT1` on next order → ❌ Should fail with "reached usage limit"

### Test Case 5: Max Discount Cap
1. Create coupon: `Code: CAP500, Type: Percentage, Value: 20, Max Discount: 500`
2. Add ₹5000 worth of products (20% = ₹1000 discount)
3. Apply `CAP500` → ✅ Discount should be capped at ₹500 (not ₹1000)

### Test Case 6: Date Range Validation
1. Create coupon: `Code: FUTURE, Valid From: Tomorrow's date`
2. Try applying `FUTURE` today → ❌ Should fail with "not yet valid"
3. Wait until tomorrow
4. Apply `FUTURE` → ✅ Should work

---

## 🏗️ Technical Architecture

### Backend Components

#### 1. **Coupon Model** (`src/models/Coupon.ts`)
```typescript
- code: string (unique, indexed)
- discountType: 'PERCENTAGE' | 'FLAT'
- discountValue: number
- minOrderValue: number
- maxDiscount: number
- validFrom: Date
- validTo: Date
- usageLimit: number
- usagePerUser: number
- usedCount: number
- isActive: boolean
- isFirstTimeOnly: boolean
- applicableFor: 'ALL' | 'SPECIFIC_BRANDS' | 'SPECIFIC_CATEGORIES'
- brands: ObjectId[]
- categories: string[]
- usedBy: [{user_id, usageCount, lastUsedAt}]
```

#### 2. **Coupon Controller** (`src/controllers/couponController.ts`)
**Endpoints:**
- `GET /api/coupons` - Admin: Get all coupons
- `POST /api/coupons` - Admin: Create coupon
- `PUT /api/coupons/:id` - Admin: Update coupon
- `DELETE /api/coupons/:id` - Admin: Delete coupon
- `PATCH /api/coupons/:id/toggle-status` - Admin: Activate/deactivate
- `GET /api/coupons/active` - Public: List active coupons
- `POST /api/coupons/validate` - Customer: Validate coupon

**Key Functions:**
- `validateCoupon()` - Comprehensive 10-step validation logic
- `recordCouponUsage()` - Tracks usage after order completion

#### 3. **Order Integration** (`src/controllers/orderController.ts`)
**Changes:**
- Added `couponCode?: string` to request body
- Added validation logic before order creation
- Subtract discount from subtotal before calculating total
- Store `couponCode` and `discountAmount` in each order
- Record coupon usage after successful order creation

#### 4. **Order Model** (`src/models/Order.ts`)
**New Fields:**
```typescript
couponCode?: string
discountAmount?: number (default: 0)
```

### Frontend Components

#### 1. **Admin Coupon Manager** (`src/pages/Admin/CouponManager.js`)
- Full CRUD interface
- React Select for multi-select brands/categories
- Form validation
- Live discount preview
- Toggle active status
- Delete with confirmation

#### 2. **Cart Page** (`src/pages/Cart.js`)
**New Features:**
- Coupon input field in Order Summary
- "Apply" button with loading state
- Error display for invalid coupons
- Green success badge when applied
- Discount line item in summary
- Updated total calculation

#### 3. **Checkout Page** (`src/pages/Checkout.js`)
**New Features:**
- Load applied coupon from localStorage
- Display coupon badge in Order Summary
- Remove coupon button
- Include coupon in order creation API call
- Updated total calculation with discount

---

## 🐛 Troubleshooting

### Issue: Coupon not appearing in admin menu
**Solution:** 
1. Check if route is registered in `allRoutes.js`
2. Check if "admin-coupons" is in allowed menu IDs in `LayoutMenuData.js`
3. Clear browser cache and refresh

### Issue: "Invalid or inactive coupon code" error
**Possible Causes:**
- Coupon is deactivated (check Active toggle)
- Coupon code has typo
- Coupon was deleted
- Database connection issue

**Solution:** Verify in admin panel that coupon exists and is active.

### Issue: Coupon validates in cart but fails at checkout
**Possible Causes:**
- Cart items changed between cart and checkout
- Coupon expired between cart and checkout
- Usage limit reached by other customers

**Solution:** Re-validate coupon at checkout, show updated error message.

### Issue: Discount not applied to order total
**Possible Causes:**
- Frontend not sending `couponCode` in order creation request
- Backend validation failing silently
- Discount calculation logic error

**Solution:** 
1. Check browser console for errors
2. Check backend logs for validation errors
3. Verify `discountAmount` field in created order document

### Issue: Coupon usage not incrementing
**Possible Causes:**
- `recordCouponUsage()` not called after order creation
- Try-catch block suppressing errors
- Database write failure

**Solution:** Check backend logs for coupon usage recording errors.

---

## 📊 Best Practices

### For Admins:
✅ **Set realistic usage limits** to prevent coupon abuse
✅ **Use max discount caps** for percentage coupons to control costs
✅ **Test coupons** before announcing to customers
✅ **Set end dates** for promotional campaigns
✅ **Monitor usage** regularly via admin dashboard
✅ **Deactivate expired coupons** instead of deleting (preserves history)

### For Developers:
✅ **Always validate on backend** - Never trust frontend validation alone
✅ **Log all coupon operations** for debugging and auditing
✅ **Handle edge cases** (e.g., split orders, product removal)
✅ **Use transactions** for coupon usage recording (future enhancement)
✅ **Index coupon code** for fast lookups
✅ **Cache active coupons** for performance (future enhancement)

---

## 🚀 Future Enhancements (Optional)

- **Coupon analytics dashboard**: Track usage, revenue impact, popular coupons
- **Auto-apply coupons**: Automatically apply best available coupon
- **Stackable coupons**: Allow multiple coupons per order
- **Referral coupons**: Generate unique codes for customer referrals
- **Coupon redemption emails**: Send targeted coupon codes via email
- **Dynamic coupon generation**: Create personalized codes on-the-fly
- **Cart abandonment coupons**: Email coupon if user leaves cart

---

## 📝 Summary

You now have a **complete, production-ready coupon system** with:
- ✅ **Admin interface** for creating and managing coupons
- ✅ **Customer interface** for applying coupons at checkout
- ✅ **Comprehensive validation** covering 10+ eligibility checks
- ✅ **Usage tracking** to prevent abuse
- ✅ **Brand and category-specific** coupon support
- ✅ **First-time customer** exclusive offers
- ✅ **Date-based** promotional campaigns
- ✅ **Flexible discount types** (percentage & flat)

### Quick Start Checklist:
1. ✅ Backend models and controllers created
2. ✅ API routes registered
3. ✅ Frontend admin page created
4. ✅ Cart and checkout updated
5. ✅ Order integration complete
6. ✅ Restart backend server
7. ✅ Clear frontend cache
8. ✅ Login as admin
9. ✅ Navigate to `/admin/coupons`
10. ✅ Create your first coupon!

**Need Help?** Check the Troubleshooting section or review backend logs for detailed error messages.

---

**🎉 Congratulations! Your coupon system is now live and ready to boost sales!**
