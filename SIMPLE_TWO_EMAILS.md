# 📧 SIMPLE EMAIL SETUP - TWO EMAILS

## ✅ **What I Did**

Updated your `.env` file so emails will be sent to **TWO email addresses**:

```env
ADMIN_EMAILS=samrudhiamrutkar15@gmail.com,YOUR_SECOND_EMAIL@gmail.com
```

---

## 🔧 **What You Need to Do**

### **Step 1: Add Your Second Email**

Open `.env` file and replace `YOUR_SECOND_EMAIL@gmail.com` with your actual email:

**Example:**
```env
ADMIN_EMAILS=samrudhiamrutkar15@gmail.com,youremail@gmail.com
```

or

```env
ADMIN_EMAILS=samrudhiamrutkar15@gmail.com,petmaza.admin@gmail.com
```

### **Step 2: Restart Backend**
```bash
npm start
```

### **Step 3: Test**
Place an order and BOTH emails will receive admin notifications!

---

## 📧 **How It Works**

### **Customer Emails:**
- Order confirmation → Customer's email
- Payment success → Customer's email

### **Admin/Vendor Emails:**
- New order notifications → **BOTH emails** (samrudhiamrutkar15@gmail.com AND your second email)
- Order assignments → Vendor's registered email

---

## 🎯 **Email Distribution**

| Event | Who Gets Email | Addresses |
|-------|---------------|-----------|
| **Order Placed** | Customer | Customer's email |
| **Order Placed** | Admin | samrudhiamrutkar15@gmail.com<br>YOUR_SECOND_EMAIL@gmail.com |
| **Payment Success** | Customer | Customer's email |
| **Order Assigned** | Vendor | Vendor's registered email |
| **Order Accepted** | Customer | Customer's email |

---

## ✅ **That's It!**

No aliases, no complex setup. Just:
1. Update `YOUR_SECOND_EMAIL@gmail.com` in `.env`
2. Restart backend
3. Both emails receive notifications

Simple! 🎉
