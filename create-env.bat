@echo off
echo Creating .env file...

(
echo PORT=6969
echo NODE_ENV=development
echo MONGODB_URI=mongodb://localhost:27017/pet-marketplace
echo JWT_SECRET=pet-marketplace-super-secret-jwt-key-2024-change-in-production
echo JWT_EXPIRE=7d
echo RAZORPAY_KEY_ID=your-razorpay-key-id
echo RAZORPAY_KEY_SECRET=your-razorpay-key-secret
echo CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
echo CLOUDINARY_API_KEY=your-cloudinary-api-key
echo CLOUDINARY_API_SECRET=your-cloudinary-api-secret
echo FRONTEND_URL=http://localhost:3000
echo SKIP_PAYMENT=false
echo ENABLE_SETTLEMENT_SCHEDULER=true
) > .env

echo.
echo .env file created successfully!
echo.
echo IMPORTANT: Update MONGODB_URI if you're using MongoDB Atlas or a different connection string
echo Current MongoDB URI: mongodb://localhost:27017/pet-marketplace
echo.
pause


