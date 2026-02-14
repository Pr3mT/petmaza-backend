# 🚀 PetMaza Backend - Current Status

## ✅ Server Status
- **Status**: ✅ RUNNING
- **Port**: 6969
- **Host**: 0.0.0.0 (all interfaces)
- **Environment**: Development
- **Database**: MongoDB Atlas (Connected)

## 📊 Recent Changes (Simplified Architecture)

### Vendor Types Simplified
- **Before**: 4 vendor types (PRIME, NORMAL, MY_SHOP, WAREHOUSE)
- **Now**: 2 vendor types only
  - `PRIME`: Brand manufacturers with first-come-first-serve order acceptance
  - `MY_SHOP`: Shop managers who can create products, manage inventory, track both website and store sales

### Database Fresh Start
✅ Complete database reset completed with fresh seed data

## 👥 Test User Accounts

All users have the password: `Password123!`

| Role | Email | Description |
|------|-------|-------------|
| **Admin** | admin@petmaza.com | Full system access |
| **Customer** | customer@petmaza.com | Can browse and order products |
| **MY_SHOP Vendor** | myshop@petmaza.com | Can create products, auto-receives normal orders |
| **PRIME Vendor** | prime@petmaza.com | Brand "Pedigree", sees pending Prime orders |

## 📦 Seeded Data

- **Categories**: 7 (Dog Food, Cat Food, Pet Toys, etc.)
- **Brands**: 6 (Pedigree, Whiskas, Royal Canin, etc.)
- **Products**: 12 total
  - 8 Normal products (auto-assigned to MY_SHOP vendor)
  - 4 Prime products (assigned to Pedigree/PRIME vendor)
- **VendorProductPricing**: 12 entries (one per product)

## 🔄 Order Flow (Simplified)

### For Normal Products:
1. Customer places order
2. Order automatically assigned to MY_SHOP vendor with `ACCEPTED` status
3. MY_SHOP vendor packs and ships
4. No pending order workflow needed

### For Prime Products:
1. Customer places order
2. Order created with `PENDING` status
3. Broadcast to all PRIME vendors via WebSocket
4. First PRIME vendor to accept gets the order
5. Order status changes to `ACCEPTED`
6. Vendor packs and ships

## 🛠️ Recent Fixes

1. ✅ Fixed duplicate variable declaration in `OrderAcceptanceService.ts`
2. ✅ Fixed PORT type error in `server.ts` (converted to Number)
3. ✅ Simplified order routing logic
4. ✅ Enabled MY_SHOP vendors to create products
5. ✅ Updated all model enums to new vendor types

## ⚠️ Known Issues

### Minor Warnings (Non-Critical):
- Duplicate schema index warnings on:
  - `vendor_id`
  - `order_id`
  - `invoiceNumber`
  
These are Mongoose warnings about index definitions and don't affect functionality. Can be cleaned up later.

## 🧪 Testing Checklist

### To Test:
- [ ] Customer login and browse products
- [ ] Add products to cart
- [ ] Place order with normal products (should auto-assign to MY_SHOP)
- [ ] Place order with Prime products (should go to PENDING)
- [ ] MY_SHOP vendor login
- [ ] MY_SHOP create new product
- [ ] MY_SHOP view auto-assigned orders
- [ ] PRIME vendor login
- [ ] PRIME vendor see pending orders
- [ ] PRIME vendor accept/reject orders

## 📝 API Endpoints

### Authentication
- POST `/api/auth/register` - Register new user
- POST `/api/auth/login` - Login
- POST `/api/auth/logout` - Logout
- GET `/api/auth/check` - Check authentication status

### Products
- GET `/api/products` - List all products
- GET `/api/products/:id` - Get product details
- POST `/api/products` - Create product (Admin or MY_SHOP vendor)
- PUT `/api/products/:id` - Update product
- DELETE `/api/products/:id` - Delete product

### Orders
- POST `/api/orders` - Create order (Customer)
- GET `/api/orders/my` - Get my orders
- GET `/api/orders/pending` - Get pending orders (PRIME vendors only)
- POST `/api/orders/:id/accept` - Accept order (PRIME vendor)
- POST `/api/orders/:id/reject` - Reject order (PRIME vendor)
- PUT `/api/orders/:id/status` - Update order status

### Admin
- GET `/api/admin/vendors` - List all vendors
- GET `/api/admin/orders` - List all orders
- GET `/api/admin/analytics` - Get analytics data

## 🔧 Environment Variables

Located in `.env` file:

```env
PORT=6969
NODE_ENV=development
MONGODB_URI=mongodb+srv://...
JWT_SECRET=pet-marketplace-super-secret-jwt-key-2024-change-in-production
JWT_EXPIRE=7d
RAZORPAY_KEY_ID=rzp_test_...
CLOUDINARY_CLOUD_NAME=dknzmdxjy
FRONTEND_URL=https://petmaza.com
SKIP_PAYMENT=false
ENABLE_SETTLEMENT_SCHEDULER=true
```

## 🚀 Quick Start Commands

```bash
# Start server (development mode with auto-reload)
npm run dev

# Start server (production mode)
npm start

# Fresh database reset
npm run fresh-start

# Seed users only
npm run seed:users

# Seed products only
npm run seed:products

# View logs
Get-Content logs\combined.log -Tail 50
Get-Content logs\error.log -Tail 20
```

## 📁 Key Files Modified

1. `src/models/User.ts` - Updated vendor types enum
2. `src/models/VendorDetails.ts` - Updated vendor types enum
3. `src/types/index.ts` - Updated interfaces
4. `src/controllers/authController.ts` - Updated registration validation
5. `src/controllers/productController.ts` - Enabled MY_SHOP product creation
6. `src/services/OrderRoutingService.ts` - Simplified routing logic
7. `src/services/OrderAcceptanceService.ts` - Only handles Prime orders
8. `src/scripts/freshStart.ts` - NEW: Complete database reset script
9. `src/server.ts` - Fixed PORT type issue

## 🔗 Frontend Connection

Update frontend to point to:
```
http://localhost:6969
```

Or production:
```
https://petmaza.com (already configured in CORS)
```

---

**Last Updated**: February 14, 2026, 23:46 IST
**Server Status**: ✅ RUNNING
**Database**: ✅ SEEDED
**Architecture**: ✅ SIMPLIFIED
