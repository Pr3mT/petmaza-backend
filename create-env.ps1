# Create .env file for PET Marketplace Backend

$envContent = @"
PORT=6969
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/pet-marketplace
JWT_SECRET=pet-marketplace-super-secret-jwt-key-2024-change-in-production
JWT_EXPIRE=7d
RAZORPAY_KEY_ID=your-razorpay-key-id
RAZORPAY_KEY_SECRET=your-razorpay-key-secret
CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret
FRONTEND_URL=http://localhost:3000
SKIP_PAYMENT=false
ENABLE_SETTLEMENT_SCHEDULER=true
"@

$envPath = Join-Path $PSScriptRoot ".env"
Set-Content -Path $envPath -Value $envContent -Encoding UTF8

Write-Host "✓ .env file created successfully at: $envPath" -ForegroundColor Green
Write-Host ""
Write-Host "IMPORTANT: Update MONGODB_URI if you're using MongoDB Atlas or a different connection string" -ForegroundColor Yellow
Write-Host "Current MongoDB URI: mongodb://localhost:27017/pet-marketplace" -ForegroundColor Cyan


