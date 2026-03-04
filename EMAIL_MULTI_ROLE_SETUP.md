# 📧 **EMAIL SETUP FOR MULTIPLE ROLES**

## 🎯 **Your Requirement**

Currently: All emails go to `samrudhiamrutkar15@gmail.com`

**You Want:**
- Admin has own email
- Vendors have own emails  
- Shop Manager has own email
- Warehouse has own email
- You (customer) can test with your email

---

## ✅ **OPTION 1: Gmail Aliases (RECOMMENDED for Testing)**

### **How it Works:**
Gmail lets you add `+anything` before the `@`:
- `samrudhiamrutkar15+admin@gmail.com` ✉️ → Inbox
- `samrudhiamrutkar15+shop@gmail.com` ✉️ → Inbox
- `samrudhiamrutkar15+warehouse@gmail.com` ✉️ → Inbox

**All emails arrive in ONE inbox, but you can see who they're for!**

### **Benefits:**
✅ Easy setup - no new Gmail accounts needed  
✅ All emails in one place  
✅ Can filter by alias in Gmail  
✅ Perfect for testing and development

### **Setup Steps:**

#### **1. Run the Update Script:**
```bash
npx ts-node src/update-emails-aliases.ts
```

This updates all user emails to:
- Admin → `samrudhiamrutkar15+admin@gmail.com`
- Shop Manager → `samrudhiamrutkar15+shop@gmail.com`
- Warehouse → `samrudhiamrutkar15+warehouse@gmail.com`
- Prime Vendor → `samrudhiamrutkar15+prime@gmail.com`
- Customer → `samrudhiamrutkar15@gmail.com`

#### **2. Update .env File:**
```env
ADMIN_EMAILS=samrudhiamrutkar15+admin@gmail.com
```

#### **3. Set Up Gmail Filters (Optional):**

In Gmail:
1. Settings → Filters and Blocked Addresses
2. Create new filter:
   - **To:** `samrudhiamrutkar15+admin@gmail.com`
   - **Label:** 🏷️ Admin Emails
3. Repeat for shop, warehouse, prime

#### **4. Restart Backend:**
```bash
npm start
```

#### **5. Test:**
- Place order → Check inbox
- Accept as vendor → Check inbox
- Each email will show different "To:" address

---

## 🔐 **OPTION 2: Separate Gmail Accounts (For Production)**

### **How it Works:**
Create separate Gmail accounts:
- `petmaza.admin@gmail.com`
- `petmaza.shop@gmail.com`
- `petmaza.warehouse@gmail.com`
- `petmaza.prime@gmail.com`

### **Benefits:**
✅ Separate login for each role  
✅ Better for production  
✅ Each person manages their own inbox  
✅ More professional

### **Setup Steps:**

#### **1. Create Gmail Accounts:**

Create 4 new Gmail accounts:
1. **Admin:** `petmaza.admin@gmail.com`
2. **Shop:** `petmaza.shop@gmail.com`
3. **Warehouse:** `petmaza.warehouse@gmail.com`
4. **Prime:** `petmaza.prime@gmail.com`

#### **2. Run the Update Script:**
```bash
npx ts-node src/update-emails-separate.ts
```

Enter each email when prompted.

#### **3. ⚠️ IMPORTANT - Email Sending:**

**Problem:** Gmail SMTP can only send FROM the account you're authenticated with.

**Your .env has:**
```env
SMTP_USER=samrudhiamrutkar15@gmail.com
SMTP_PASS=your-app-password
```

This means ALL emails will appear to come from `samrudhiamrutkar15@gmail.com`, even though they're addressed TO the vendor/admin/shop emails.

**Solutions:**

##### **Solution A: Keep current setup**
- Emails are **sent from**: `samrudhiamrutkar15@gmail.com`
- Emails are **delivered to**: Different addresses (admin, shop, etc.)
- **Best for:** Development/Testing

##### **Solution B: Use Email Service (Recommended for Production)**

Use services that support multiple sender addresses:

**SendGrid** (Free tier: 100 emails/day):
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
```

**Mailgun** (Free tier: 5,000 emails/month):
```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@your-domain
SMTP_PASS=your-mailgun-password
```

##### **Solution C: Per-Role SMTP (Advanced)**

Configure different SMTP for each role - requires code changes.

---

## 📊 **Comparison**

| Feature | Option 1: Aliases | Option 2: Separate |
|---------|------------------|-------------------|
| Setup Time | ⚡ 5 minutes | 🕐 30 minutes |
| Gmail Accounts | 1 | 4+ |
| Email Management | One inbox | Separate inboxes |
| Best For | Testing/Development | Production |
| Cost | Free | Free (Gmail limits) |

---

## 🚀 **QUICK START (Recommended)**

For your current testing needs, use **Option 1**:

```bash
# 1. Update emails with aliases
npx ts-node src/update-emails-aliases.ts

# 2. Update .env
# Add this line:
ADMIN_EMAILS=samrudhiamrutkar15+admin@gmail.com

# 3. Restart backend
npm start

# 4. Test order flow
# - Place order as customer
# - Check inbox for emails addressed to different aliases
```

---

## 📧 **Email Flow After Setup**

### **Customer Places Order:**
```
✉️ To: samrudhiamrutkar15@gmail.com (customer)
Subject: Order Confirmation

✉️ To: samrudhiamrutkar15+admin@gmail.com
Subject: [ADMIN] New Order

✉️ To: samrudhiamrutkar15+shop@gmail.com (or +warehouse)
Subject: New Order Assigned
```

### **Vendor Accepts Order:**
```
✉️ To: samrudhiamrutkar15@gmail.com (customer)
Subject: Order Accepted ✓
From: Shop Manager
```

### **Payment Success:**
```
✉️ To: samrudhiamrutkar15@gmail.com (customer)
Subject: Payment Confirmed
```

**All these emails arrive in your Gmail inbox but with different "To:" addresses!**

---

## 🎭 **Testing Different Roles**

After setup, login as:

| Role | Email | Password | Purpose |
|------|-------|----------|---------|
| **Customer** | samrudhiamrutkar15@gmail.com | Password123! | Test orders |
| **Admin** | samrudhiamrutkar15+admin@gmail.com | Password123! | Admin panel |
| **Shop** | samrudhiamrutkar15+shop@gmail.com | Password123! | Vendor orders |
| **Warehouse** | samrudhiamrutkar15+warehouse@gmail.com | Password123! | Fulfillment |

You'll receive emails for the role you're acting as!

---

## ✅ **Choose Your Option**

**For Testing (Recommended):**
```bash
npx ts-node src/update-emails-aliases.ts
```

**For Production:**
```bash
npx ts-node src/update-emails-separate.ts
```

---

**Created:** March 2, 2026  
**Status:** Ready to deploy 🚀
