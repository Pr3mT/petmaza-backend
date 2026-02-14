# MIGRATION GUIDE - Simplified Architecture

**Date:** February 14, 2026  
**Migration Version:** 1.x → 2.0

---

## 🔄 CHANGES SUMMARY

### **Removed Vendor Types:**
- ❌ `NORMAL` vendor type
- ❌ `WAREHOUSE` vendor type (replaced by `MY_SHOP`)
- ❌ `retail_vendor` role (old architecture)
- ❌ `special_vendor` role (old architecture)

### **Current Vendor Types:**
- ✅ `MY_SHOP` - Your shop manager (handles ALL normal products)
- ✅ `PRIME` - Brand manufacturers (handles only their brand's Prime products)

---

## 📝 FILES MODIFIED

### 1. **Models Updated:**
- ✅ `src/models/User.ts` - Vendor types enum updated
- ✅ `src/models/VendorDetails.ts` - Vendor types enum updated
- ✅ `src/types/index.ts` - Interface types updated

### 2. **Controllers Updated:**
- ✅ `src/controllers/authController.ts` - Registration validation updated
- ✅ `src/controllers/productController.ts` - MY_SHOP can create/update products

### 3. **Services Simplified:**
- ✅ `src/services/OrderRoutingService.ts` - Removed complex routing logic
  - Normal orders → Direct to MY_SHOP (status: ACCEPTED)
  - Prime orders → Broadcast to Prime vendors (status: PENDING)
- ✅ `src/services/OrderAcceptanceService.ts` - Only handles Prime orders
  - MY_SHOP vendors don't see pending orders

### 4. **Routes Updated:**
- ✅ `src/routes/vendor.ts` - Removed old vendor role checks
- ✅ `src/routes/orders.ts` - Removed old vendor role checks
- ✅ `src/routes/products.ts` - MY_SHOP vendors can create products

### 5. **WebSocket Updated:**
- ✅ `src/websocket/server.ts` - Removed old vendor role logic

---

## 🗄️ DATABASE CHANGES REQUIRED

### **Step 1: Update Existing Vendors**

If you have existing vendors with old types, run this MongoDB update:

```javascript
// Update WAREHOUSE vendors to MY_SHOP
db.users.updateMany(
  { vendorType: 'WAREHOUSE' },
  { $set: { vendorType: 'MY_SHOP' } }
);

db.vendordetails.updateMany(
  { vendorType: 'WAREHOUSE' },
  { $set: { vendorType: 'MY_SHOP' } }
);

// Remove NORMAL vendors (or convert to MY_SHOP if needed)
// WARNING: Decide based on your business needs
// Option 1: Delete NORMAL vendors
db.users.deleteMany({ vendorType: 'NORMAL' });
db.vendordetails.deleteMany({ vendorType: 'NORMAL' });

// Option 2: Convert NORMAL to MY_SHOP (if you want to keep them)
// db.users.updateMany(
//   { vendorType: 'NORMAL' },
//   { $set: { vendorType: 'MY_SHOP' } }
// );
```

### **Step 2: Update Orders**

Convert any pending normal orders to be assigned to MY_SHOP:

```javascript
// Find your MY_SHOP vendor ID
const myShopVendor = db.users.findOne({ vendorType: 'MY_SHOP', isApproved: true });
const myShopVendorId = myShopVendor._id;

// Assign all pending normal orders to MY_SHOP
db.orders.updateMany(
  { 
    isPrime: false, 
    status: 'PENDING',
    assignedVendorId: { $exists: false }
  },
  { 
    $set: { 
      assignedVendorId: myShopVendorId,
      status: 'ACCEPTED'
    } 
  }
);
```

### **Step 3: Clean Up Old Data (Optional)**

```javascript
// Remove old order types if any
db.orders.updateMany(
  { orderType: { $exists: true } },
  { $unset: { orderType: "" } }
);
```

---

## 🎯 BEHAVIOR CHANGES

### **Order Creation - Normal Products:**

**Before:**
```
Order Created → Status: PENDING → Broadcast to Normal Vendors
→ First vendor accepts → Status: ACCEPTED
```

**After:**
```
Order Created → Status: ACCEPTED → Assigned to MY_SHOP vendor
```

### **Order Creation - Prime Products:**

**Before & After:** (No change)
```
Order Created → Status: PENDING → Broadcast to Prime Vendors
→ First vendor accepts → Status: ACCEPTED
```

### **Vendor Product Management:**

**Before:**
- Only Admin could create products
- Vendors could only update stock

**After:**
- Admin can create any products
- **MY_SHOP vendor can create normal products**
- MY_SHOP vendor can update their products
- Prime vendor can only update stock (cannot create)

---

## 🔑 KEY API CHANGES

### **Product Creation:**

Previously: `POST /api/products` (Admin only)

Now: `POST /api/products` (Admin + MY_SHOP vendors)

**MY_SHOP Request:**
```json
{
  "name": "Dog Food 5kg",
  "category_id": "xxx",
  "brand_id": "xxx",
  "mrp": 1000,
  "sellingPercentage": 80,
  "purchasePercentage": 60,
  "availableStock": 50,
  "images": ["url1", "url2"],
  "isPrime": false
}
```

**Response:** Auto-creates VendorProductPricing entry for MY_SHOP vendor.

### **Pending Orders:**

Previously: `GET /api/orders/vendor/pending` (All vendors)

Now: `GET /api/orders/vendor/pending` (Prime vendors only)

**MY_SHOP vendors:** No pending orders (all orders auto-assigned)

---

## ⚠️ BREAKING CHANGES

1. **Vendor Registration:**
   - Cannot register as `NORMAL` or `WAREHOUSE` vendor
   - Must register as `MY_SHOP` or `PRIME`

2. **Order Acceptance:**
   - Normal product orders no longer go through acceptance flow
   - MY_SHOP vendors see orders directly in "My Orders"
   - No "Pending Orders" for MY_SHOP vendors

3. **Product Creation:**
   - MY_SHOP vendors can now create products (new capability)
   - Must follow product schema validation

4. **WebSocket Events:**
   - Removed `retail_vendor` and `special_vendor` room subscriptions
   - Only `vendor` role used now

---

## ✅ TESTING CHECKLIST

### **Customer Flow:**
- [ ] Browse products by category
- [ ] Add normal products to cart
- [ ] Buy Prime products (Buy Now)
- [ ] Create order with normal products
- [ ] Create order with Prime products
- [ ] Make payment
- [ ] View orders in "My Orders"

### **MY_SHOP Vendor Flow:**
- [ ] Login as MY_SHOP vendor
- [ ] Create new product
- [ ] Update product details
- [ ] Update stock quantities
- [ ] Mark product inactive/active
- [ ] View assigned orders (auto-assigned)
- [ ] Update order status
- [ ] Track sales (website + store)

### **Prime Vendor Flow:**
- [ ] Login as Prime vendor
- [ ] View assigned products only
- [ ] Update product stock
- [ ] View pending Prime orders
- [ ] Accept Prime order
- [ ] Reject Prime order
- [ ] View accepted orders
- [ ] Update order status

### **Admin Flow:**
- [ ] Approve vendors
- [ ] Create Prime products
- [ ] Assign brands to Prime vendors
- [ ] View all orders
- [ ] Update order status manually
- [ ] View analytics/dashboard

---

## 🐛 TROUBLESHOOTING

### **Issue: Existing NORMAL vendors can't login**
**Solution:** Run database migration to convert them to MY_SHOP or remove them.

### **Issue: Orders stuck in PENDING status**
**Solution:** Run the order update script to assign them to MY_SHOP vendor.

### **Issue: MY_SHOP vendor can't create products**
**Solution:** Verify vendor is approved and has vendorType='MY_SHOP'.

### **Issue: Prime vendor sees no pending orders**
**Solution:** Check if brands are assigned to the Prime vendor by admin.

---

## 📞 SUPPORT

If you encounter issues during migration:
1. Check database migration scripts ran successfully
2. Verify vendor types are correctly set
3. Ensure MY_SHOP vendor exists and is approved
4. Review server logs for errors

---

## 📚 REFERENCES

- Full Architecture: `SIMPLIFIED_ARCHITECTURE.md`
- API Documentation: `README.md`
- Model Schemas: `src/models/`
- Service Logic: `src/services/`

---

**Migration completed successfully! 🎉**
