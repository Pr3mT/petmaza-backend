# 🎯 Order Routing System - Complete Reference

## ✅ Current Configuration (VERIFIED)

### Warehouse Fulfillers:

1. **RameshShirke** (rameshshirke@gmail.com)
   - Handles 18 subcategories:
     * Dog Accessories, Dog Medicine, Dog Toys
     * Cat Accessories, Cat Medicine, Cat Toys
     * Fish Food, Fish Accessories, Fish Medicine, Fish Tank Supplies
     * Bird Food, Bird Accessories, Bird Medicine, Bird Toys
     * Small Animal Food, Small Animal Accessories, Small Animal Medicine, Small Animal Toys

2. **DiveshDoke** (diveshdoke@gmail.com)
   - Handles 2 subcategories:
     * Dog Food
     * Cat Food

3. **My Shop Manager** (myshop@petmaza.com)
   - Fallback for all rejected orders or unassigned subcategories

---

## 🔄 How Order Routing Works

### Scenario 1: Dog Food Order
```
Customer orders Dog Food
    ↓
System checks: Which fulfiller handles "Dog Food"?
    ↓
Found: DiveshDoke has "Dog Food" in assigned subcategories
    ↓
Order assigned to DiveshDoke (Status: PENDING)
    ↓
DiveshDoke logs in → Sees order → Can Accept/Reject
    ↓
If ACCEPT: Order proceeds with fulfillment
If REJECT: Order reassigned to My Shop Manager (Status: PENDING)
```

### Scenario 2: Fish Food Order
```
Customer orders Fish Food
    ↓
System checks: Which fulfiller handles "Fish Food"?
    ↓
Found: RameshShirke has "Fish Food" in assigned subcategories
    ↓
Order assigned to RameshShirke (Status: PENDING)
    ↓
RameshShirke logs in → Sees order → Can Accept/Reject
```

### Scenario 3: Mixed Order (Dog Food + Fish Food)
```
Customer orders Dog Food + Fish Food
    ↓
System checks: Who handles BOTH subcategories?
    ↓
DiveshDoke: Handles 1/2 (Dog Food only)
RameshShirke: Handles 1/2 (Fish Food only)
    ↓
Result: Assigned to FIRST MATCH (whoever is found first in database)
```

### Scenario 4: No Fulfiller Matches
```
Customer orders product with unassigned subcategory
    ↓
System checks: No fulfiller has this subcategory
    ↓
Order goes DIRECTLY to My Shop Manager (Status: ACCEPTED)
    ↓
My Shop Manager sees order immediately (auto-accepted)
```

---

## 🧪 Testing Steps

### Test 1: Dog Food → Should Go to DiveshDoke

1. **Place Order** (as customer):
   - Go to website
   - Add ANY Dog Food product to cart
   - Complete checkout

2. **Check Backend Logs**:
   ```
   [routeNormalOrderToMyShop] Order contains subcategories: ['Dog Food']
   [routeNormalOrderToMyShop] Fulfiller DiveshDoke can handle 1/1 subcategories
   [routeNormalOrderToMyShop] Fulfiller RameshShirke can handle 0/1 subcategories
   [routeNormalOrderToMyShop] ✅ Assigning order to DiveshDoke
   ```

3. **Login as DiveshDoke**:
   - Email: `diveshdoke@gmail.com`
   - Password: (whatever you set when creating)
   - Navigate to **Orders** page
   - **SHOULD SEE**: Dog Food order with Status = PENDING

4. **Login as RameshShirke**:
   - Email: `rameshshirke@gmail.com`
   - **SHOULD NOT SEE**: The Dog Food order

### Test 2: Fish Food → Should Go to RameshShirke

1. **Place Order**: Add Fish Food product
2. **Check Logs**: Should show assignment to RameshShirke
3. **Login as RameshShirke**: Should see the order
4. **Login as DiveshDoke**: Should NOT see the order

### Test 3: Rejection Flow

1. **Login as DiveshDoke**
2. **View Dog Food order** (Status: PENDING)
3. **Click Reject Button** and provide reason
4. **Expected**: Order disappears from DiveshDoke's dashboard
5. **Login as My Shop Manager** (myshop@petmaza.com)
6. **Expected**: Should now see the rejected order (Status: PENDING)

---

## ⚠️ Troubleshooting

### Problem: "Order not showing anywhere after placing it"

**Possible Causes:**

1. **Product has no subcategory**
   - Check: Open product in database and verify `subCategory` field exists
   - Fix: Update product with correct subcategory

2. **Backend server not running**
   - Check: Is `npm start` running in backend folder?
   - Fix: Restart backend server

3. **Order went to wrong account**
   - Check backend logs for assignment reasoning
   - Look for lines starting with `[routeNormalOrderToMyShop]`

4. **Pending status confusion**
   - Remember: PENDING means awaiting acceptance
   - Fulfiller must manually accept to proceed
   - Check fulfiller's dashboard, not customer's

### Problem: "Order showing in wrong fulfiller's account"

**Diagnosis Steps:**

1. Check backend logs:
   ```powershell
   cd C:\Users\SAMRUDDHI\Documents\GitHub\petmaza-backend
   cat logs/combined.log | findstr "routeNormalOrderToMyShop"
   ```

2. Verify product subcategory:
   - Open MongoDB and check product's `subCategory` field
   - Ensure it matches one of the fulfiller's assigned subcategories

3. Check fulfiller assignments:
   ```powershell
   npx ts-node verify-fulfillers-detailed.ts
   ```

### Problem: "Order stuck in PENDING"

**Cause**: Fulfiller hasn't accepted yet

**Solution**: 
- Fulfiller must login and click **Accept Order**
- Or click **Reject Order** to send to My Shop Manager

---

## 📊 Technical Details

### Order Assignment Logic (OrderRoutingService.ts)

```typescript
// 1. Get product subcategories from order
const orderSubcategories = ['Dog Food'];

// 2. Find all warehouse fulfillers
const fulfillers = [DiveshDoke, RameshShirke];

// 3. Calculate match score for each
- DiveshDoke has ['Dog Food', 'Cat Food']
  → matchCount = 1 (handles Dog Food) ✅
  
- RameshShirke has [18 others, NOT Dog Food]
  → matchCount = 0 (doesn't handle Dog Food) ❌

// 4. Assign to best match (highest matchCount)
assignedVendorId = DiveshDoke._id
status = 'PENDING'

// 5. Send email notification to DiveshDoke
```

### Fulfiller Dashboard Query (warehouseFulfillerController.ts)

```typescript
// Get orders assigned to logged-in fulfiller
const orders = await Order.find({
  assignedVendorId: fulfiller._id,  // Only MY orders
  status: { $in: ['PENDING', 'ACCEPTED', ...] }
});
```

### Rejection Flow (warehouseFulfillerController.ts)

```typescript
// When fulfiller rejects order
order.assignedVendorId = myShopVendor._id;  // Reassign to MY_SHOP
order.status = 'PENDING';  // Awaiting MY_SHOP acceptance
order.rejectionReason = "Not available";
await order.save();
```

---

## 🎓 Key Concepts

1. **PENDING Status**
   - Means: Awaiting fulfiller acceptance
   - Who sees it: Assigned fulfiller only
   - Actions: Fulfiller can Accept or Reject

2. **ACCEPTED Status**
   - Means: Fulfiller confirmed they will fulfill
   - Next step: Fulfiller marks as PICKED_FROM_VENDOR → PACKED → etc.

3. **Automatic Assignment**
   - Happens during order creation
   - Based on product subcategories
   - Uses "best match" algorithm (highest match count wins)

4. **Fallback Protection**
   - If no fulfiller matches: Goes to MY_SHOP (auto-accepted)
   - If fulfiller rejects: Goes to MY_SHOP (pending acceptance)

---

## 🔍 Verification Commands

### Check Current Configuration
```powershell
cd C:\Users\SAMRUDDHI\Documents\GitHub\petmaza-backend
npx ts-node verify-fulfillers-detailed.ts
```

### View Backend Logs
```powershell
# Real-time logs
cd C:\Users\SAMRUDDHI\Documents\GitHub\petmaza-backend
tail -f logs/combined.log

# Or in PowerShell
Get-Content logs/combined.log -Wait
```

### Search Logs for Order Assignment
```powershell
cat logs/combined.log | findstr "routeNormalOrderToMyShop"
```

---

## 📞 Quick Reference

| Account | Email | Handles |
|---------|-------|---------|
| **DiveshDoke** | diveshdoke@gmail.com | Dog Food, Cat Food |
| **RameshShirke** | rameshshirke@gmail.com | 18 other subcategories |
| **My Shop Manager** | myshop@petmaza.com | Fallback / Rejected orders |

| Order Type | Goes To |
|------------|---------|
| Dog Food | DiveshDoke |
| Cat Food | DiveshDoke |
| Fish Food | RameshShirke |
| Dog Accessories | RameshShirke |
| Dog Medicine | RameshShirke |
| Unassigned subcategory | My Shop Manager (auto-accepted) |

---

## ✅ System Status

**Configuration**: ✅ Correct  
**Routing Logic**: ✅ Implemented  
**Rejection Flow**: ✅ Working  
**Fallback**: ✅ Active

**Ready for Production** 🚀

---

**Last Verified**: March 9, 2026  
**Total Fulfillers**: 2 (DiveshDoke, RameshShirke)  
**Fallback Vendor**: My Shop Manager (Active)
