# Backend Environment Setup

## Create .env File

Create a file named `.env` in the `backend/` directory with the following content:

```env
PORT=6969
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/pet-marketplace
JWT_SECRET=your-super-secret-jwt-key-change-in-production-min-32-chars
JWT_EXPIRE=7d
RAZORPAY_KEY_ID=your-razorpay-key-id
RAZORPAY_KEY_SECRET=your-razorpay-key-secret
CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret
FRONTEND_URL=http://localhost:3000
SKIP_PAYMENT=false
ENABLE_SETTLEMENT_SCHEDULER=true
```

## Required Configuration

### MongoDB URI
- **Local MongoDB**: `mongodb://localhost:27017/pet-marketplace`
- **MongoDB Atlas**: `mongodb+srv://username:password@cluster.mongodb.net/pet-marketplace`
- **Custom**: Your MongoDB connection string

### JWT Secret
- Must be at least 32 characters long
- Use a strong random string for production
- Example: Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### Razorpay (Optional for testing)
- Get keys from: https://razorpay.com/
- Or set `SKIP_PAYMENT=true` to use test mode

### Cloudinary (Optional)
- Get credentials from: https://cloudinary.com/
- Only needed if you want image uploads

## Quick Setup

1. Copy the content above
2. Create `backend/.env` file
3. Update `MONGODB_URI` with your MongoDB connection string
4. Update `JWT_SECRET` with a secure random string
5. Save the file
6. Restart the backend server

## Test Mode

For development without payment gateway:
```env
SKIP_PAYMENT=true
```

This will skip Razorpay integration and allow testing without real payment credentials.


