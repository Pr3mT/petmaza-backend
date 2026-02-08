# User Credentials

This document contains login credentials for all seeded users in the Petmaza system.

## Default Password
**Password for ALL users: `Password123!`**

---

## 1. Admin User
- **Email:** `admin@petmaza.com`
- **Password:** `Password123!`
- **Role:** Admin
- **Description:** Full system access, manages products, vendors, orders

---

## 2. Customer User
- **Email:** `customer@petmaza.com`
- **Password:** `Password123!`
- **Role:** Customer
- **Description:** Can browse products, add to cart, place orders

---

## 3. My Shop Vendor
- **Email:** `myshop@petmaza.com`
- **Password:** `Password123!`
- **Role:** Vendor (MY_SHOP)
- **Vendor Type:** MY_SHOP
- **Serviceable Pincodes:** 400001, 400002, 400003, 400004, 400005
- **Description:** My Shop vendor type

---

## 4. Normal Vendor
- **Email:** `normal@petmaza.com`
- **Password:** `Password123!`
- **Role:** Vendor (NORMAL)
- **Vendor Type:** NORMAL
- **Serviceable Pincodes:** 400010, 400011, 400012, 400013, 400014
- **Description:** Normal vendor type

---

## 5. Prime Vendor
- **Email:** `prime@petmaza.com`
- **Password:** `Password123!`
- **Role:** Vendor (PRIME)
- **Vendor Type:** PRIME
- **Serviceable Pincodes:** 400020, 400021, 400022, 400023, 400024
- **Description:** Prime vendor type

---

## How to Run Seed Script

To seed the database with these users, run:

```bash
cd backend
npm run seed:users
```

Or if you want to seed both users and products:

```bash
npm run seed:all
```

---

**Note:** Make sure your `.env` file has the correct `MONGODB_URI` configured before running the seed script.

