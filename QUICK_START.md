# Quick Start Guide

## Backend Setup

### 1. Environment Variables
The `.env` file has been created in the `backend/` directory. 

**Important:** Update the MongoDB URI if you're using:
- MongoDB Atlas (cloud): Replace with your Atlas connection string
- Different local MongoDB: Update the connection string
- Default: `mongodb://localhost:27017/pet-marketplace` (works if MongoDB is running locally)

### 2. Install Dependencies
```bash
cd backend
npm install
```

### 3. Start MongoDB (if using local)
Make sure MongoDB is running on your system:
- Windows: Check if MongoDB service is running
- Or start with: `mongod` (if installed locally)

### 4. Start Backend Server
```bash
npm run dev
```

The server will start on `http://localhost:6969`

## Frontend Setup

### 1. Install Dependencies
```bash
# From project root
npm install
```

### 2. Start Frontend
```bash
npm start
```

The frontend will start on `http://localhost:3000`

## Troubleshooting

### MongoDB Connection Error
If you see "MONGODB_URI is not defined":
1. Check that `.env` file exists in `backend/` directory
2. Verify `MONGODB_URI` is set in the file
3. Restart the backend server

### MongoDB Not Running
If MongoDB connection fails:
- **Local MongoDB**: Start MongoDB service
- **MongoDB Atlas**: Verify connection string is correct
- **Test connection**: Try connecting with MongoDB Compass or CLI

### Port Already in Use
If port 6969 is busy:
- Change `PORT` in `backend/.env`
- Or stop the process using port 6969

## Default Configuration

The `.env` file includes:
- Port: 6969
- MongoDB: Local MongoDB (update if needed)
- JWT Secret: Default secret (change for production)
- Payment: Test mode enabled (`SKIP_PAYMENT=false`)

For production, update all secrets and keys!


