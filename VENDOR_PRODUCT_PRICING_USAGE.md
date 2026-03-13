# VendorProductPricing Collection - Usage Documentation

## 📋 Overview

The **VendorProductPricing** collection is a critical junction table that manages the relationship between vendors and products, including inventory management, pricing, and sales tracking.

## 🎯 Purpose

This collection serves as the **inventory management system** for your multi-vendor marketplace, tracking:
- Which products each vendor can sell
- Vendor-specific purchase pricing (wholesale cost)
- Available stock per vendor
- Sales statistics (website & store)
- Product availability status per vendor
- Variant-level stock tracking

## 📊 Schema Structure

```typescript
{
  vendor_id: ObjectId,              // Reference to User (vendor)
  product_id: ObjectId,             // Reference to Product
  purchasePercentage: Number,       // Vendor's cost as % of MRP (0-100)
  purchasePrice: Number,            // Calculated purchase cost
  availableStock: Number,           // Current inventory count
  totalSoldWebsite: Number,         // Total sales from website
  totalSoldStore: Number,           // Total sales from physical store
  isActive: Boolean,                // Product availability for this vendor
  variantStock: [{                  // Variant-level inventory
    weight: Number,
    unit: String,
    displayWeight: String,
    availableStock: Number,
    totalSoldWebsite: Number,
    totalSoldStore: Number,
    isActive: Boolean
  }]
}
```

**Total Records:** 429 vendor-product combinations

---

## 🔧 WHERE IT'S USED

### 1. **Core Model & Services**

#### Model Definition
- **File:** [src/models/VendorProductPricing.ts](c:\Users\PREM\Desktop\saas\petmaza-backend\src\models\VendorProductPricing.ts)
- **Features:**
  - Auto-calculates purchase price before saving
  - Unique compound index on (vendor_id, product_id)
  - Auto-populates vendor and product references

#### Service Layer
- **File:** [src/services/VendorProductPricingService.ts](c:\Users\PREM\Desktop\saas\petmaza-backend\src\services\VendorProductPricingService.ts)
- **Methods:**
  ```typescript
  - assignProductToVendor()        // Assign single product to vendor
  - assignProductsToVendor()       // Bulk assign products
  - assignBrandsToVendor()         // Assign all products of brands
  - getVendorProducts()            // Get vendor's inventory
  - getProductVendors()            // Find vendors selling a product
  - updateVendorProductPricing()   // Update pricing/stock
  - removeProductFromVendor()      // Deactivate product for vendor
  - getVendorAssignments()         // Get vendor's brand/product assignments
  ```

---

### 2. **API Routes**

#### Dedicated Routes
- **File:** [src/routes/vendorProductPricing.ts](c:\Users\PREM\Desktop\saas\petmaza-backend\src\routes\vendorProductPricing.ts)
- **Endpoints:**
  ```
  GET    /api/vendor-product-pricing/product/:product_id/vendors    // Public: Find vendors for product
  POST   /api/vendor-product-pricing/assign                         // Admin: Assign product
  PUT    /api/vendor-product-pricing/:vendor_id/:product_id         // Admin: Update pricing
  DELETE /api/vendor-product-pricing/:vendor_id/:product_id         // Admin: Remove assignment
  GET    /api/vendor-product-pricing/vendor/:vendor_id              // Vendor: View inventory
  ```

#### Admin Routes
- **File:** [src/routes/admin.ts](c:\Users\PREM\Desktop\saas\petmaza-backend\src\routes\admin.ts)
- **Endpoints:**
  ```
  POST   /api/admin/vendors/:id/assign-brands       // Assign brands to vendor
  POST   /api/admin/vendors/:id/assign-products     // Assign products to vendor
  GET    /api/admin/vendors/:id/assignments         // View vendor assignments
  PUT    /api/admin/vendors/:id/products/:productId/pricing  // Update pricing
  DELETE /api/admin/vendors/:id/products/:productId  // Remove assignment
  ```

#### Vendor Routes
- **File:** [src/routes/vendor.ts](c:\Users\PREM\Desktop\saas\petmaza-backend\src\routes\vendor.ts)
- **Endpoints:**
  ```
  GET    /api/vendor/products/my                    // Get vendor's products
  PUT    /api/vendor/products/my/:id/stock          // Update stock
  PUT    /api/vendor/products/my/:id/status         // Mark available/unavailable
  ```

---

### 3. **Controllers**

#### Vendor Controller
- **File:** [src/controllers/vendorController.ts](c:\Users\PREM\Desktop\saas\petmaza-backend\src\controllers\vendorController.ts)
- **Functions:**
  - `getVendorProducts()` - Fetch vendor's product catalog with pricing
  - `updateVendorProductStock()` - Update inventory levels
  - `updateVendorProductStatus()` - Toggle product availability
  - `getVendorStats()` - Get sales statistics

#### Admin Controller
- **File:** [src/controllers/adminController.ts](c:\Users\PREM\Desktop\saas\petmaza-backend\src\controllers\adminController.ts)
- **Functions:**
  - `assignBrandsToVendor()` - Bulk brand assignment
  - `assignProductsToVendor()` - Bulk product assignment
  - `getVendorAssignments()` - View all assignments
  - `updateVendorProductPricing()` - Update pricing/stock
  - `removeVendorProductAssignment()` - Remove product

#### Warehouse Controller
- **File:** [src/controllers/warehouseController.ts](c:\Users\PREM\Desktop\saas\petmaza-backend\src\controllers\warehouseController.ts)
- **Functions:**
  - `getWarehouseInventory()` - View warehouse stock levels
  - Calculates total inventory value
  - Identifies low stock items

#### Product Controller
- **File:** [src/controllers/productController.ts](c:\Users\PREM\Desktop\saas\petmaza-backend\src\controllers/productController.ts)
- **Functions:**
  - `updateProduct()` - Updates VendorProductPricing when MY_SHOP vendor updates product
  - Syncs stock/pricing changes

---

### 4. **Order Processing & Fulfillment**

Used to:
- ✅ Determine which vendors can fulfill an order based on pincode
- ✅ Check product availability and stock levels
- ✅ Calculate vendor's purchase cost for profit margins
- ✅ Track sales when orders are completed
- ✅ Update stock levels when orders are fulfilled

**Typical Flow:**
```
Order Placed → Find Vendors by Pincode → Check VendorProductPricing.availableStock 
→ Assign to Vendor → Deduct Stock → Increment totalSoldWebsite
```

---

### 5. **Vendor Type Specific Usage**

#### MY_SHOP Vendors
- Can create their own products
- VendorProductPricing tracks their inventory
- Manage stock and pricing through vendor dashboard

#### PRIME Vendors
- Admin assigns specific brand products
- VendorProductPricing tracks their branded inventory
- Can only manage stock, not pricing

#### WAREHOUSE_FULFILLER
- Assigned products from multiple brands
- VendorProductPricing tracks warehouse inventory
- Fulfills orders for all vendors

---

### 6. **Frontend Integration**

#### Vendor Dashboard
- **File:** [petmaza-frontend/src/pages/Vendor/Products/MyListings.js](c:\Users\PREM\Desktop\saas\petmaza-frontend\src\pages\Vendor\Products\MyListings.js)
- Displays vendor's products with stock status
- Filters by active/inactive products
- Updates stock quantities

---

### 7. **Data Integrity**

#### Unique Constraints
```javascript
// Each vendor can only have ONE pricing entry per product
vendorProductPricingSchema.index({ vendor_id: 1, product_id: 1 }, { unique: true });
```

#### Auto-Calculations
```javascript
// Purchase price automatically calculated from MRP
purchasePrice = product.mrp * (purchasePercentage / 100)
```

---

## 🔄 Sales Flow Example

```
Customer Orders Product (Weight: 1kg)
↓
System finds vendors serving customer's pincode
↓
Checks VendorProductPricing for:
  ✓ availableStock > 0
  ✓ isActive = true
  ✓ variant.availableStock > 0 (for 1kg variant)
↓
Assigns order to best vendor
↓
On order completion:
  • Deduct from availableStock
  • Increment totalSoldWebsite
  • Update variant stock if applicable
```

---

## 📈 Why We Reset Stock Counters for Production?

During cleanup, we reset:
- `totalSoldWebsite: 0`
- `totalSoldStore: 0`

**Reason:** These are cumulative sales counters from testing. For production launch, you want to start fresh with accurate sales tracking.

**What's Preserved:**
- ✅ Vendor-product relationships
- ✅ Purchase percentages
- ✅ Current stock levels (availableStock)
- ✅ Active/inactive status

---

## 🛠️ Common Operations

### View All Vendor Assignments
```javascript
const assignments = await VendorProductPricing.find({ vendor_id })
  .populate('product_id')
  .populate('vendor_id');
```

### Update Stock
```javascript
await VendorProductPricing.findOneAndUpdate(
  { vendor_id, product_id },
  { $inc: { availableStock: quantity } }
);
```

### Track Sale
```javascript
await VendorProductPricing.findOneAndUpdate(
  { vendor_id, product_id },
  { 
    $inc: { 
      availableStock: -quantity,
      totalSoldWebsite: quantity 
    }
  }
);
```

---

## ⚠️ Important Notes

1. **This is NOT deleted in production cleanup** - It's essential for operations
2. **Contains real inventory data** - Review stock levels before launch
3. **Sales counters reset** - Historical sales data cleared for fresh start
4. **429 active relationships** - Between vendors and products

---

## 🎯 Production Checklist

Before deploying to production:

- [ ] Verify all vendors have correct product assignments
- [ ] Check stock levels are accurate in `availableStock`
- [ ] Confirm purchase percentages are realistic
- [ ] Test vendor can only see their assigned products
- [ ] Test stock deduction on order placement
- [ ] Verify sales tracking increments correctly
- [ ] Check variant stock tracking works for weighted products

---

## 📞 Related Collections

- **Users** - vendor_id references
- **Products** - product_id references  
- **VendorDetails** - Vendor metadata (pincodes, brands)
- **Orders** - Uses this to determine fulfillment
- **Brands** - Used in brand-level assignment

---

**Summary:** This collection is the **heart of your inventory management system**. Don't delete it - it handles everything from stock tracking to vendor assignments to order fulfillment! 🚀
