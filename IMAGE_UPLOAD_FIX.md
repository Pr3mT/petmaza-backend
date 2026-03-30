# Image Upload Fix Guide

## Issue: Product images not uploading when creating products through admin

### Current Status: ✅ Backend Configuration is CORRECT

The image upload system is already properly configured:

1. **Upload Endpoint**: `/api/upload/image` ✅
2. **Multer Middleware**: Configured in `src/config/cloudinary.ts` ✅
3. **Upload Controller**: `src/controllers/uploadController.ts` ✅
4. **Route Protection**: Requires authentication + admin/vendor role ✅

### How It Works:

1. **Frontend**: `ImageUpload.js` component uploads images to `/api/upload/image`
2. **Backend**: Processes file and uploads to Cloudinary
3. **Response**: Returns cloudinary URL
4. **Product Creation**: URLs stored in product.images array

### Troubleshooting Steps:

## Step 1: Check Backend Server Status

```bash
# In petmaza-backend folder
npm start
```

**Expected**: Server running on http://localhost:6969

## Step 2: Verify Cloudinary Credentials

Check `.env` file in petmaza-backend:

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

**If missing**: Add these credentials from your Cloudinary dashboard (https://cloudinary.com/console)

## Step 3: Test Image Upload

1. Open browser console (F12)
2. Go to Admin → Products → Add Product
3. Click "Choose Files" and select an image
4. Watch console for errors

### Common Errors & Solutions:

#### Error: "Network Error" or "Failed to fetch"
**Cause**: Backend server not running
**Fix**: Start backend server with `npm start`

#### Error: "invalid_api_key" or Cloudinary error
**Cause**: Wrong Cloudinary credentials
**Fix**: Update .env file with correct credentials

#### Error: "Please login first to upload images"
**Cause**: No authentication token
**Fix**: Logout and login again

#### Error: "Only Admin and vendors can create products"
**Cause**: User doesn't have proper role
**Fix**: Ensure logged in as admin or approved vendor

## Step 4: Check Frontend API URL

In `petmaza-frontend/.env`:

```env
REACT_APP_API_URL=http://localhost:6969/api
```

## Step 5: Test Full Flow

1. Login as Admin
2. Go to Products → Add Product
3. Fill product details
4. Upload 1-5 images (watch console)
5. Submit form

### Expected Console Logs:

```
Files selected: 1
Valid files: 1
Starting upload...
Uploading image: product.jpg
Upload URL: http://localhost:6969/api/upload/image
Upload response: { success: true, data: { url: "https://..." } }
Image uploaded successfully: https://res.cloudinary.com/...
```

## If Images Still Not Uploading:

### Check Browser Network Tab:

1. Open DevTools → Network tab
2. Upload an image
3. Look for `/upload/image` request
4. Check:
   - **Status**: Should be `200 OK`
   - **Request Headers**: Has `Authorization: Bearer ...`
   - **Request Payload**: Has image file
   - **Response**: Has `success: true` and `url`

### Backend Logs:

Check terminal running `npm start` for errors like:
- Cloudinary connection errors
- Multer errors  
- Authentication errors

---

## Mobile Menu Issue: Vendors Not Showing

The mobile admin menu already includes Vendors. The menu structure is correct in `Header.js`:

```javascript
{ divider: true, label: '👥 Users' },
{ icon: 'ri-user-line', label: 'Customers', link: '/admin/users' },
{ icon: 'ri-store-2-line', label: 'Vendors', link: '/admin/vendors' },
```

If Vendors menu is not visible:
1. Clear browser cache
2. Hard refresh (Ctrl+Shift+R)
3. Check if logged in as Admin (not Vendor or Customer)

The menu filters by role - only Admins see the full menu with Vendors option.
