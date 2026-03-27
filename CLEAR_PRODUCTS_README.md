# Clear All Products Script

## ⚠️ WARNING
This script will **DELETE ALL PRODUCTS** from your database.

## ✅ What Will Be Deleted:
- All products from the Product collection

## ✅ What Will NOT Be Affected:
- Categories
- Subcategories  
- Brands
- Users (customers, vendors, admins)
- Orders
- Vendor details
- Any other collections

---

## 🚀 How to Run:

### Step 1: Preview Products (Optional)
See how many products will be deleted:
```bash
cd petmaza-backend
npx ts-node preview-products.ts
```

### Step 2: Delete All Products
```bash
cd petmaza-backend
npx ts-node clear-all-products.ts
```

---

## 📝 After Clearing Products:

You can manually add products through:
1. Admin dashboard
2. Vendor dashboard  
3. Import via CSV/Excel
4. API endpoints

---

## 🔄 Undo (Restore from Backup)

If you have a MongoDB backup, restore with:
```bash
mongorestore --uri="your-mongodb-uri" --drop
```

**Tip:** Take a backup BEFORE running the clear script!
