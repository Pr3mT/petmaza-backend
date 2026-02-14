# PETMAZA - SIMPLIFIED ARCHITECTURE

**Date:** February 14, 2026  
**Version:** 2.0 (Simplified)

---

## 🎯 OVERVIEW

This document describes the **FINAL SIMPLIFIED ARCHITECTURE** for the Petmaza e-commerce platform.

### Key Changes from Previous Version:
- ❌ Removed NORMAL vendor type
- ❌ Removed WAREHOUSE as separate type  
- ❌ Removed complex order routing and vendor matching
- ❌ Removed order acceptance flow for normal products
- ✅ Only 2 vendor types: **MY_SHOP** and **PRIME**
- ✅ MY_SHOP manages ALL normal products
- ✅ Simplified order fulfillment flow

---

## 👥 USER ROLES

### 1. 🛍️ CUSTOMER (role='customer')

**Capabilities:**
- Browse products by category
- Add **NORMAL products** to cart (multiple items)
- **PRIME products**: Buy Now only (no cart allowed)
- Create orders
- Make payment via Razorpay
- View orders in "My Orders" section
- Track order status

**Order Flow:**
```
Browse Products → Add to Cart/Buy Now → Place Order → Payment → Order Confirmation
```

**API Endpoints:**
- `GET /api/products` - Browse all products
- `GET /api/products?category_id=xxx` - Browse by category
- `POST /api/orders` - Create order
- `GET /api/orders/my` - View my orders
- `PUT /api/orders/:id` - Update payment status
- `GET /api/orders/:id` - View order details

---

### 2. 🏪 MY_SHOP VENDOR (role='vendor', vendorType='MY_SHOP')

**Purpose:** Your shop manager who manages ALL normal (non-Prime) products.

**Capabilities:**

#### Product Management
- ✅ **CREATE products** with:
  - Purchase Rate (your cost price)
  - Maximum Retail Price (MRP)
  - Discount Rate
  - Available Stock Quantity
- ✅ Update product details
- ✅ Mark products inactive (quantity preserved)
- ✅ Cannot delete products (only admin can)

#### Inventory Management
- Track quantities:
  - **Available Stock** - Current inventory
  - **Total Sold on Website** - Orders from online
  - **Total Sold in Store** - Offline sales
- Mark offline sales (sold in store)
- Update stock quantities

#### Order Management
- **ALL normal product orders are automatically assigned to MY_SHOP**
- No acceptance/rejection flow
- Orders start with status: `ACCEPTED`
- Update order status: `PACKED` → `PICKED_UP` → `IN_TRANSIT` → `DELIVERED`

**Customer View:**
- MRP
- Discount percentage
- **Selling Price** (calculated: MRP - Discount)

**Backend Tracking:**
- Purchase Price (your cost)
- Quantities (available, sold website, sold store)
- Profit margins

**API Endpoints:**
- `POST /api/products` - Create product
- `PUT /api/products/:id` - Update product
- `GET /api/vendor/products/my` - View all products
- `PUT /api/vendor/products/my/:id/stock` - Update stock
- `PUT /api/vendor/products/my/:id/status` - Mark active/inactive
- `GET /api/orders/vendor/my` - View assigned orders
- `PUT /api/orders/vendor/:id/status` - Update order status

**Product Creation Fields:**
```json
{
  "name": "Dog Food 5kg",
  "category_id": "xxx",
  "brand_id": "xxx",
  "mrp": 1000,
  "sellingPercentage": 80,  // 80% of MRP = ₹800 selling price
  "purchasePercentage": 60,  // 60% of MRP = ₹600 your cost
  "availableStock": 50,
  "images": ["url1", "url2"],
  "description": "High quality dog food",
  "isPrime": false  // ALWAYS false for MY_SHOP products
}
```

---

### 3. 🏭 PRIME VENDOR (role='vendor', vendorType='PRIME')

**Purpose:** Brand manufacturers with their own product line.

**Characteristics:**
- Has ONE specific brand assigned by admin
- Only sees products from their brand
- Customers buy Prime products directly (Buy Now only)
- Cannot add Prime products to cart

**Capabilities:**

#### Product Assignment
- Admin assigns specific brand to Prime vendor
- Admin creates Prime products and links to Prime vendor
- Prime vendor **cannot create products** (only admin can)

#### Inventory Management  
- View assigned products
- Update stock for product variants
- Set product availability (active/inactive)

#### Order Management
- See **pending Prime orders** (first-come-first-serve)
- **Accept** or **Reject** orders
- Update order status: `ACCEPTED` → `PACKED` → `PICKED_UP` → `IN_TRANSIT` → `DELIVERED`
- Track commission/earnings

**API Endpoints:**
- `GET /api/vendor/products/my` - View assigned products
- `PUT /api/vendor/products/my/:id/stock` - Update stock
- `PUT /api/vendor/products/my/:id/status` - Update availability
- `GET /api/orders/vendor/pending` - View pending Prime orders
- `POST /api/orders/vendor/:id/accept` - Accept order
- `POST /api/orders/vendor/:id/reject` - Reject order
- `GET /api/orders/vendor/my` - View accepted orders
- `PUT /api/orders/vendor/:id/status` - Update order status

**Order Flow:**
```
Customer places Prime order → Order status PENDING → Broadcast to Prime vendors
→ First Prime vendor accepts → Order status ACCEPTED → Fulfillment
```

---

### 4. 👨‍💼 ADMIN (role='admin')

**Capabilities:**

#### User Management
- View all users
- Approve/Reject vendor registrations
- Manage vendor accounts

#### Product Management - PRIME Products
- Create Prime products
- Assign Prime products to Prime vendors
- Update/Delete any product
- Manage categories
- Manage brands

#### Vendor Assignment
- Assign brands to Prime vendors
- Assign products to Prime vendors
- Update vendor pricing configurations

#### Order Management
- View all orders
- Update order status manually
- Assign orders to vendors (if needed)

#### Analytics
- Dashboard statistics
- Revenue tracking (Normal vs Prime)
- Profit calculations
- Order reports
- Sales analytics

**API Endpoints:**
- `GET /api/admin/users` - View all users
- `GET /api/admin/vendors` - View vendors
- `PUT /api/admin/users/:id/approve` - Approve vendor
- `POST /api/products` - Create Prime products
- `PUT /api/products/:id` - Update products
- `DELETE /api/products/:id` - Delete products
- `POST /api/admin/vendors/:id/assign-brands` - Assign brands to Prime vendor
- `GET /api/admin/stats` - Dashboard statistics
- `GET /api/admin/orders` - View all orders
- `GET /api/admin/analytics` - Analytics data

---

## 📦 ORDER FLOW

### Normal Products (MY_SHOP)

```
Customer adds to cart → Places order → Makes payment
↓
Order created with status: ACCEPTED
↓
Automatically assigned to MY_SHOP vendor
assignedVendorId: <MY_SHOP_vendor_id>
↓
MY_SHOP vendor fulfills order
↓
Updates status: PACKED → PICKED_UP → IN_TRANSIT → DELIVERED
```

**Key Points:**
- ✅ No acceptance/rejection needed
- ✅ Direct assignment to MY_SHOP
- ✅ Order status starts as `ACCEPTED`
- ✅ Admin/MY_SHOP handles fulfillment manually
- ✅ No automatic shipping integration

### Prime Products (PRIME Vendors)

```
Customer clicks Buy Now → Places order → Makes payment
↓
Order created with status: PENDING
↓
Broadcast to ALL Prime vendors (with matching brand)
↓
First Prime vendor to accept gets the order
↓
Order status: ACCEPTED
assignedVendorId: <prime_vendor_id>
↓
Prime vendor fulfills order
↓
Updates status: PACKED → PICKED_UP → IN_TRANSIT → DELIVERED
```

**Key Points:**
- ✅ First-come-first-serve model
- ✅ Only vendors with matching brand see the order
- ✅ Must be accepted by Prime vendor
- ✅ Order status starts as `PENDING`

---

## 🔄 ORDER STATUSES

| Status | Description | Who Can Set |
|--------|-------------|-------------|
| `PENDING` | Order created, awaiting vendor acceptance (Prime only) | System |
| `ACCEPTED` | Order accepted by vendor / Auto-assigned to MY_SHOP | Vendor / System |
| `REJECTED` | Prime vendor rejected order | Prime Vendor |
| `PACKED` | Vendor packed the order | Vendor |
| `PICKED_UP` | Courier picked up the order | Vendor |
| `IN_TRANSIT` | Order in transit | Vendor |
| `DELIVERED` | Order delivered to customer | Vendor |
| `CANCELLED` | Order cancelled | Admin |

---

## 🛠️ KEY SERVICES

### OrderRoutingService
**Simplified Logic:**
- Prime products → Route to Prime vendors (PENDING status)
- Normal products → Route directly to MY_SHOP (ACCEPTED status)
- No warehouse priority
- No split shipments
- No complex vendor matching

### OrderAcceptanceService  
**Simplified Logic:**
- Only handles **PRIME vendor orders**
- MY_SHOP vendors don't see "pending orders"
- Filters orders by Prime vendor's assigned brands
- First-come-first-serve acceptance

### ProductService
- Handles product creation for admin and MY_SHOP vendors
- Validates categories and brands
- Auto-creates VendorProductPricing for MY_SHOP products

---

## 🗃️ KEY MODELS

### User Model
```typescript
{
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'vendor' | 'customer';
  vendorType: 'PRIME' | 'MY_SHOP';  // Only 2 types
  phone: string;
  address: {...};
  isApproved: boolean;
}
```

### Product Model
```typescript
{
  name: string;
  category_id: ObjectId;
  brand_id: ObjectId;
  mrp: number;
  sellingPercentage: number;
  sellingPrice: number;  // Auto-calculated
  purchasePercentage: number;
  purchasePrice: number;  // Auto-calculated
  isPrime: boolean;
  primeVendor_id: ObjectId;  // For Prime products only
  images: string[];
  isActive: boolean;
}
```

### Order Model
```typescript
{
  customer_id: ObjectId;
  items: [...];
  total: number;
  totalPurchasePrice: number;
  totalProfit: number;
  status: OrderStatus;
  isPrime: boolean;
  assignedVendorId: ObjectId;  // Assigned vendor
  payment_status: 'Pending' | 'Paid' | 'Failed';
  payment_id: string;
  customerAddress: {...};
}
```

### VendorProductPricing Model
```typescript
{
  vendor_id: ObjectId;
  product_id: ObjectId;
  purchasePrice: number;  // Vendor's cost
  availableStock: number;
  totalSoldWebsite: number;  // Sales from website orders
  totalSoldStore: number;  // Sales from physical store
  isActive: boolean;
}
```

---

## 📊 PRICING FLOW

### For Customers:
```
Product MRP: ₹1000
Selling Percentage: 80%
→ Selling Price: ₹800 (shown to customer)
→ Discount: 20% off (shown to customer)
```

### For MY_SHOP Vendor:
```
Product MRP: ₹1000
Purchase Percentage: 60%
→ Purchase Price: ₹600 (your cost)
Selling Price: ₹800
→ Your Profit: ₹200 per unit
```

### For Prime Vendor:
```
Product MRP: ₹1000
Purchase Percentage: 65%
→ Purchase Price: ₹650 (vendor commission)
Selling Price: ₹850
→ Vendor Earning: ₹650 per unit
→ Platform Profit: ₹200 per unit
```

---

## 🚀 VENDOR REGISTRATION FLOW

### MY_SHOP Vendor
```
Register → Provide shop details → Admin approval
→ Start adding products → Manage inventory
```

**Auto-approved:** No (requires admin approval)

### Prime Vendor
```
Register → Provide brand details → Admin approval
→ Admin assigns brand → Admin creates products
→ Vendor manages stock → Accept orders
```

**Auto-approved:** No (requires admin approval)

---

## ❌ REMOVED FEATURES

1. **NORMAL Vendor Type** - Consolidated into MY_SHOP
2. **WAREHOUSE Vendor Type** - Now called MY_SHOP
3. **Complex Order Routing** - Simplified to direct assignment
4. **Split Shipments** - Removed
5. **Vendor Competition for Normal Orders** - MY_SHOP handles all
6. **Order Acceptance for Normal Products** - Auto-accepted
7. **Pincode-based Vendor Matching** - Removed

---

## ✅ BENEFITS OF SIMPLIFIED ARCHITECTURE

1. **Reduced Complexity** - Only 2 vendor types instead of 4
2. **Faster Order Processing** - Normal orders directly assigned
3. **Easier Inventory Management** - Single source (MY_SHOP)
4. **Simpler Vendor Onboarding** - Clear responsibilities
5. **Better Control** - MY_SHOP handles all normal fulfillment
6. **Cleaner Codebase** - Removed unused logic

---

## 📝 NOTES

- **No Shipping Integration:** Orders managed manually by admin/MY_SHOP
- **Payment Gateway:** Razorpay (test mode supported)
- **WebSocket:** Real-time order notifications to vendors
- **Authentication:** JWT-based with cookie support
- **Database:** MongoDB with Mongoose

---

**For Technical Implementation Details, see:**
- Models: `src/models/`
- Services: `src/services/OrderRoutingService.ts`, `src/services/OrderAcceptanceService.ts`
- Controllers: `src/controllers/`
- Routes: `src/routes/`
