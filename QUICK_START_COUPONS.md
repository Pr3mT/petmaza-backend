# 🚀 Quick Start - Coupon System Access Guide

## ⚡ How to Access the Coupon Features

### 1️⃣ **Start Backend Server**
```bash
cd C:\Users\SAMRUDDHI\Documents\GitHub\petmaza-backend
npm start
```
✅ Backend should run on: `http://localhost:5000`

---

### 2️⃣ **Start Frontend**
```bash
cd C:\Users\SAMRUDDHI\Documents\GitHub\petmaza-frontend
npm start
```
✅ Frontend should open: `http://localhost:3000`

---

## 🔑 **ADMIN: Create & Manage Coupons**

### Access Admin Coupon Page:
1. **Login as Admin** at `http://localhost:3000/login`
2. Look for **"Coupons"** in left sidebar menu (💰 icon)
3. Click it → Opens: `http://localhost:3000/admin/coupons`

### What You'll See:
- ✅ Table showing all coupons (code, type, discount, status)
- ✅ **"Create New Coupon"** button (top right)
- ✅ Toggle switches to activate/deactivate
- ✅ Edit (✏️) and Delete (🗑️) buttons

### Create Your First Coupon:
1. Click **"Create New Coupon"** button
2. Fill in form:
   - **Code**: `WELCOME10` (will auto-uppercase)
   - **Description**: "10% off for first-time customers"
   - **Discount Type**: Select "Percentage"
   - **Discount Value**: `10`
   - **Max Discount**: `200`
   - **Min Order Value**: `500`
   - **First-Time Only**: ✅ Check this box
   - **Applicable For**: "All Products"
3. Click **"Create Coupon"**
4. ✅ Coupon appears in table with GREEN "Active" badge

---

## 🛒 **CUSTOMER: Apply Coupons at Checkout**

### Test Coupon Application:

#### **On Cart Page** (`http://localhost:3000/cart`):
1. Add products to cart (make sure total > ₹500 if using WELCOME10)
2. Scroll to **Order Summary** section (right side on desktop, bottom on mobile)
3. See input field: **"Enter coupon code"**
4. Type: `WELCOME10`
5. Click **"Apply"** button
6. ✅ See green success message: "Coupon applied! You saved ₹XX"
7. ✅ See discount line: `-₹50` (if cart was ₹500)
8. ✅ Updated total shown

#### **On Checkout Page** (`http://localhost:3000/checkout`):
1. Proceed to checkout
2. See applied coupon in green badge:
   ```
   🎟️ WELCOME10
   Discount: ₹50
   [X] (remove button)
   ```
3. Final total includes discount
4. Complete order → Coupon usage recorded!

---

## 📱 Where to See Changes on Mobile

### **Mobile Cart View:**
- Coupon input appears **below subtotal**
- Full-width button for "Apply"
- Green success badge shows discount
- Responsive design adapts to screen size

### **Mobile Checkout View:**
- Applied coupon shown as compact badge
- Easy "X" button to remove
- Discount clearly visible in price breakdown

---

## 🧪 Quick Test Scenarios

### Test 1: First-Time Customer Coupon
```
✅ Create account → Add ₹500+ products → Apply WELCOME10 → Should work
❌ Complete order → Try WELCOME10 again → Should fail (not first-time anymore)
```

### Test 2: Minimum Order Value
```
✅ Cart total ₹600 → Apply WELCOME10 → Works (₹60 discount)
❌ Cart total ₹400 → Apply WELCOME10 → Fails ("Minimum order value ₹500 required")
```

### Test 3: Brand-Specific Coupon
```
1. Create coupon: Code ROYAL15, 15% off, Brands: Royal Canin
2. Add Pedigree product → Apply ROYAL15 → ❌ Fails
3. Add Royal Canin product → Apply ROYAL15 → ✅ Works!
```

---

## 🎯 Where to See Each Feature

| Feature | Location | URL |
|---------|----------|-----|
| **Admin: Create Coupon** | Admin Panel → Sidebar → Coupons | `/admin/coupons` |
| **Admin: Edit Coupon** | Coupon List → Edit Icon (✏️) | `/admin/coupons` |
| **Admin: Toggle Active** | Coupon List → Switch Toggle | `/admin/coupons` |
| **Customer: Apply Coupon** | Cart Page → Order Summary | `/cart` |
| **Customer: View Discount** | Cart & Checkout → Price Breakdown | `/cart`, `/checkout` |
| **Customer: Remove Coupon** | Checkout → Coupon Badge → X button | `/checkout` |

---

## 🚨 Troubleshooting

### "Coupons menu not showing in sidebar"
- ✅ Check you're logged in as **admin** (not customer/vendor)
- ✅ Clear browser cache (Ctrl + Shift + Delete)
- ✅ Refresh page

### "Invalid coupon code" error
- ✅ Check coupon is **Active** (green toggle in admin)
- ✅ Verify code is typed correctly (case-insensitive)
- ✅ Check coupon didn't expire (Valid To date)

### Backend errors
- ✅ Check backend terminal for errors
- ✅ Ensure MongoDB is running
- ✅ Restart backend: `npm start`

---

## 📸 Visual Guide

### **Admin Panel:**
```
┌─────────────────────────────────────────┐
│  Petmaza Admin                          │
├─────────────────────────────────────────┤
│  📊 Dashboard                           │
│  📦 Orders                              │
│  👥 Users                               │
│  🛍️  Products                           │
│  💰 Coupons  ← Click Here!             │
│  ⭐ Reviews                             │
└─────────────────────────────────────────┘
```

### **Cart Page - Order Summary:**
```
┌───────────────────────────────┐
│  Order Summary                │
├───────────────────────────────┤
│  Subtotal: ₹599.00            │
│                               │
│  ┌────────────┬──────┐        │
│  │ WELCOME10  │ Apply│ ← Here!│
│  └────────────┴──────┘        │
│                               │
│  🎟️ WELCOME10 Applied         │
│  You saved ₹59.90!            │
│                               │
│  Discount: -₹59.90            │
│  Shipping: ₹50.00             │
│  Total: ₹589.10               │
└───────────────────────────────┘
```

---

## ✅ Checklist Before Testing

- [ ] Backend server running (port 5000)
- [ ] Frontend server running (port 3000)
- [ ] Logged in as admin
- [ ] Created at least one coupon
- [ ] Coupon is **Active** (green toggle)
- [ ] Test account has products in cart

---

**🎉 You're all set! Start creating coupons and boost your sales!**
