# PETMAZA - USER CREDENTIALS

**Date:** February 14, 2026  
**Status:** Fresh Database Seeded ✅

---

## 🔑 DEFAULT PASSWORD FOR ALL USERS

```
Password123!
```

---

## 👨‍💼 ADMIN

- **Email:** `admin@petmaza.com`
- **Password:** `Password123!`
- **Role:** Admin
- **Capabilities:**
  - Approve vendors
  - Create/Edit/Delete products
  - View all orders
  - Manage brands & categories
  - View analytics

---

## 🛍️ CUSTOMER

- **Email:** `customer@petmaza.com`
- **Password:** `Password123!`
- **Role:** Customer
- **Capabilities:**
  - Browse & search products
  - Add normal products to cart
  - Buy Prime products (Buy Now)
  - Place orders & make payments
  - View order history

---

## 🏪 MY_SHOP VENDOR (Your Shop Manager)

- **Email:** `myshop@petmaza.com`
- **Password:** `Password123!`
- **Role:** Vendor (MY_SHOP)
- **Shop Name:** Petmaza Main Shop
- **Products:** 8 Normal Products

**Capabilities:**
- ✅ Create new products
- ✅ Update product details (MRP, discount, stock)
- ✅ Mark products inactive/active
- ✅ View all orders (auto-assigned)
- ✅ Update order status
- ✅ Track website sales & store sales

**Product Examples:**
- Royal Canin Medium Adult Dog Food 10kg - ₹4,510
- Drools Chicken & Egg Adult Dog Food 3kg - ₹1,020
- Whiskas Ocean Fish Cat Food 1.2kg - ₹396
- PetSafe Retractable Dog Leash 5m - ₹960
- And 4 more...

---

## ⭐ PRIME VENDOR (Pedigree India)

- **Email:** `prime@petmaza.com`
- **Password:** `Password123!`
- **Role:** Vendor (PRIME)
- **Brand:** Pedigree
- **Products:** 4 Prime Products

**Capabilities:**
- ✅ View pending Prime orders
- ✅ Accept/Reject Prime orders (first-come-first-serve)
- ✅ Update product stock
- ✅ View accepted orders
- ✅ Update order status

**Product Examples:**
- Pedigree Adult Dry Dog Food 10kg - ₹2,975
- Pedigree Puppy Dry Dog Food 3kg - ₹1,056
- Pedigree Dentastix 28 Sticks - ₹765
- Pedigree Gravy Adult Dog Food Pack - ₹690

---

## 📊 DATABASE SUMMARY

| Item | Count |
|------|-------|
| Users | 4 |
| Vendors | 2 (MY_SHOP + PRIME) |
| Categories | 7 |
| Brands | 6 |
| Total Products | 12 |
| Normal Products | 8 |
| Prime Products | 4 |

---

## 📁 CATEGORIES

1. Dog Food
2. Cat Food
3. Bird Food
4. Dog Accessories
5. Cat Accessories
6. Bird Accessories
7. Pet Healthcare

---

## 🏷️ BRANDS

1. **Pedigree** (Prime - Linked to Prime Vendor)
2. Royal Canin
3. Whiskas
4. Drools
5. PetSafe
6. Trixie

---

## 🚀 HOW TO USE

### For Customer:
1. Login at http://localhost:3000
2. Browse products by category
3. Add normal products to cart
4. Buy Prime products directly (Buy Now)
5. Place order & make payment

### For MY_SHOP Vendor:
1. Login at http://localhost:3000
2. Go to Vendor Dashboard
3. Create new products (Add Product button)
4. View assigned orders (auto-assigned)
5. Update order status as you fulfill them

### For PRIME Vendor:
1. Login at http://localhost:3000
2. Go to Vendor Dashboard
3. View pending Prime orders
4. Accept orders (first-come-first-serve)
5. Update order status

### For Admin:
1. Login at http://localhost:3000
2. Go to Admin Dashboard
3. Approve vendors
4. Create Prime products
5. Manage system

---

## 🔄 RESET DATABASE AGAIN

If you need to reset and reseed the database again, run:

```bash
cd petmaza-backend
npm run fresh-start
```

---

## 📞 SUPPORT

- Backend URL: http://localhost:6969
- Frontend URL: http://localhost:3000
- API Docs: http://localhost:6969/api

---

**Happy Testing! 🎉**

