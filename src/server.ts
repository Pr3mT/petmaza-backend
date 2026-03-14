import express, { Express, Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import { createServer } from 'http';
import https from 'https';
import http from 'http';
import { Server } from 'socket.io';
import logger from './config/logger';
import { errorHandler } from './middlewares/errorHandler';
import { notFound } from './middlewares/notFound';
import { initializeWebSocket } from './websocket/server';
import { requestTimeout } from './middlewares/timeout';
import { performanceMonitor } from './middlewares/performance';

// Load environment variables
dotenv.config();

const app: Express = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      'http://localhost:3000',
      'https://petmaza.com',
      'http://petmaza.com',
    ],
    credentials: true,
    methods: ['GET', 'POST'],
  },
});

const PORT = Number(process.env.PORT) || 6969;

// Increase max listeners to prevent memory leak warnings
require('events').EventEmitter.defaultMaxListeners = 20;

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3001',
      'https://petmaza.com',
      'http://petmaza.com',
      'https://www.petmaza.com',
      'http://www.petmaza.com',
    ];
    
    // In production, allow any HTTPS origin or configured origins
    if (allowedOrigins.indexOf(origin) !== -1 || 
        process.env.NODE_ENV === 'development' ||
        origin.startsWith('https://')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Authorization'],
};

app.use(cors(corsOptions));

// Add request timeout middleware (30 seconds)
app.use(requestTimeout(30000));

// Add performance monitoring middleware
app.use(performanceMonitor);

// Add compression middleware (should be early in middleware chain)
app.use(compression());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Disable unnecessary middleware for better performance
app.disable('x-powered-by');
app.set('trust proxy', 1);

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public'), {
  maxAge: '1d', // Cache static files for 1 day
  etag: true,
}));

// Initialize WebSocket
initializeWebSocket(io);

// Root route
app.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Petmaza Backend API is working',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      api: '/api/*'
    },
    timestamp: new Date().toISOString()
  });
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'OK', message: 'PET Marketplace API is running' });
});

// Routes
import authRoutes from './routes/auth';
import productRoutes from './routes/products';
import orderRoutes from './routes/orders';
import paymentRoutes from './routes/payments';
import vendorRoutes from './routes/vendor';
import adminRoutes from './routes/admin';
import serviceRoutes from './routes/services';
import courierRoutes from './routes/courier';
import categoryRoutes from './routes/categories';
import brandRoutes from './routes/brands';
import heroBannerRoutes from './routes/heroBanners';
import adsRoutes from './routes/ads';
import vendorProductPricingRoutes from './routes/vendorProductPricing';
import walletRoutes from './routes/wallet';
import billingRoutes from './routes/billing';
import complaintRoutes from './routes/complaints';
import warehouseRoutes from './routes/warehouse';
import warehouseFulfillerRoutes from './routes/warehouseFulfiller';
import myShopVendorRoutes from './routes/myShopVendor';
import primeVendorRoutes from './routes/primeVendor';
import primeProductRoutes from './routes/primeProducts';
import uploadRoutes from './routes/upload';
import reviewRoutes from './routes/reviews';
import questionRoutes from './routes/questions';
import invoiceRoutes from './routes/invoices';
import recommendationRoutes from './routes/recommendations';
import searchRoutes from './routes/search';
import debugRoutes from './routes/debug';
import shippingRoutes from './routes/shipping';

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/vendor', vendorRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/courier', courierRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/brands', brandRoutes);
app.use('/api/hero-banners', heroBannerRoutes);
app.use('/api/ads', adsRoutes);
app.use('/api/vendor-product-pricing', vendorProductPricingRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/warehouse', warehouseRoutes);
app.use('/api/warehouse-fulfiller', warehouseFulfillerRoutes);
app.use('/api/my-shop-vendor', myShopVendorRoutes);
app.use('/api/prime-vendor', primeVendorRoutes);
app.use('/api/prime-products', primeProductRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/debug', debugRoutes);
app.use('/api/shipping', shippingRoutes);

// Error handling
app.use(notFound);
app.use(errorHandler);

// MongoDB connection with optimization
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;
    if (!mongoURI) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }
    
    // MongoDB connection options for optimal performance
    await mongoose.connect(mongoURI, {
      maxPoolSize: 50, // Maximum connection pool size
      minPoolSize: 10, // Minimum connection pool size
      serverSelectionTimeoutMS: 5000, // Timeout after 5s if no server found
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
      family: 4, // Use IPv4, skip trying IPv6
    });
    
    // Enable query logging in development only
    if (process.env.NODE_ENV === 'development') {
      mongoose.set('debug', false); // Set to true only when debugging
    }
    
    logger.info('MongoDB connected successfully with connection pooling');
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Start server
const startServer = async () => {
  try {
    await connectDB();
    const HOST = '0.0.0.0'; // Bind to all network interfaces for cloud deployment
    
    // Configure HTTP server for better performance
    httpServer.keepAliveTimeout = 65000; // Slightly higher than typical load balancer timeout
    httpServer.headersTimeout = 66000; // Should be higher than keepAliveTimeout
    httpServer.maxHeadersCount = 100;
    httpServer.timeout = 30000; // 30 second timeout for requests
    
    httpServer.listen(PORT, HOST, () => {
      logger.info(`Server running on ${HOST}:${PORT} in ${process.env.NODE_ENV} mode`);
      logger.info('Performance optimizations enabled:');
      logger.info('- Connection pooling: 50 connections');
      logger.info('- User authentication caching: 5 minutes');
      logger.info('- Response compression: enabled');
      logger.info('- Request timeout: 30 seconds');
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// ─── Keep-Alive Cron for Render Free Instance ────────────────────────────────
// Render free tier spins down after 15 min of inactivity.
// Each ping is scheduled at a random interval between 10–14 minutes
// to avoid predictable patterns while staying under the 15-min threshold.
const startKeepAliveCron = () => {
  const RENDER_URL = "https://petmaza-backend.onrender.com"; // Replace with your actual Render URL

  if (!RENDER_URL) {
    logger.warn('Keep-alive cron: RENDER_EXTERNAL_URL not set, skipping self-ping.');
    return;
  }

  // Returns a random integer between min and max (inclusive), in milliseconds
  const randomIntervalMs = (minMinutes: number, maxMinutes: number): number => {
    const minMs = minMinutes * 60 * 1000;
    const maxMs = maxMinutes * 60 * 1000;
    return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  };

  const pingServer = () => {
    const url = `${RENDER_URL}/health`;
    const client = url.startsWith('https') ? https : http;

    const req = client.get(url, (res) => {
      const nextMs = randomIntervalMs(10, 14);
      logger.info(`Keep-alive ping → ${url} | Status: ${res.statusCode} | Next ping in ${Math.round(nextMs / 60000)} min`);
      res.resume(); // Consume response data to free up memory
      setTimeout(pingServer, nextMs); // Schedule next ping at a new random interval
    });

    req.on('error', (err) => {
      logger.error(`Keep-alive ping failed: ${err.message}`);
      // Retry after a random interval even on failure
      setTimeout(pingServer, randomIntervalMs(10, 14));
    });

    req.setTimeout(10000, () => {
      req.destroy();
      logger.warn('Keep-alive ping timed out after 10s');
    });
  };

  // Delay the first ping by 30s to ensure the server is fully up
  const initialDelay = 30000;
  setTimeout(() => {
    const firstInterval = randomIntervalMs(10, 14);
    logger.info(`Keep-alive cron started — first ping in ${Math.round(firstInterval / 60000)} min (random 10–14 min intervals)`);
    setTimeout(pingServer, firstInterval);
  }, initialDelay);
};
// ─────────────────────────────────────────────────────────────────────────────

startServer();
startKeepAliveCron();

export { io };


