# Render Deployment Guide

## MongoDB Atlas IP Whitelist Configuration

To allow Render to connect to your MongoDB Atlas cluster, you need to whitelist Render's IP addresses:

### Option 1: Allow Access from Anywhere (Easiest for Development)
1. Go to your MongoDB Atlas Dashboard: https://cloud.mongodb.com/
2. Select your cluster
3. Click on "Network Access" in the left sidebar
4. Click "Add IP Address"
5. Click "Allow Access from Anywhere"
6. Enter `0.0.0.0/0` (this allows all IPs)
7. Click "Confirm"

⚠️ **Security Note**: For production, use Option 2 below for better security.

### Option 2: Whitelist Render's IP Addresses (Recommended for Production)
1. Go to your Render Dashboard
2. Find your deployed service
3. Copy the outbound IP addresses shown in the service details
4. Go to MongoDB Atlas → Network Access
5. Click "Add IP Address"
6. Add each Render IP address
7. Click "Confirm"

### Option 3: Use MongoDB Atlas on Render (Alternative)
Consider deploying MongoDB on the same platform or using MongoDB Atlas's private endpoint feature.

## Environment Variables on Render

Make sure these environment variables are set in your Render dashboard:

```
MONGODB_URI=your_mongodb_connection_string
PORT=(automatically set by Render)
NODE_ENV=production
FRONTEND_URL=your_frontend_url
JWT_SECRET=your_jwt_secret
CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_key
CLOUDINARY_API_SECRET=your_cloudinary_secret
RAZORPAY_KEY_ID=your_razorpay_key
RAZORPAY_KEY_SECRET=your_razorpay_secret
```

## Deployment Checklist

- [ ] MongoDB Atlas IP whitelist configured
- [ ] All environment variables set on Render
- [ ] GitHub repository connected to Render
- [ ] Build command: `npm i`
- [ ] Start command: `npm start`
- [ ] Health check path: `/health`

## Troubleshooting

### Server not starting
- Check logs for MongoDB connection errors
- Verify MONGODB_URI is correct
- Confirm IP whitelist is configured

### Port issues
- Server automatically binds to `0.0.0.0` and uses `PORT` env var
- Render provides the PORT automatically

### Build failures
- Check that all dependencies are in `dependencies`, not `devDependencies`
- Verify package.json scripts are correct
