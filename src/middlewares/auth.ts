import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { AppError } from './errorHandler';
import { userCache } from '../utils/userCache';

export interface AuthRequest extends Request {
  user?: any;
}

export const verifyToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    let token: string | undefined;

    console.log('🔐 ===== VERIFY TOKEN =====');
    console.log('Cookies:', req.cookies);
    console.log('Authorization header:', req.headers.authorization);

    // Check for token in cookies first
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
      console.log('✅ Token found in cookies');
    } 
    // Fallback to Authorization header
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
      console.log('✅ Token found in Authorization header');
    }

    if (!token) {
      console.log('❌ No token found in request');
      return next(new AppError('Not authorized, no token', 401));
    }
    
    console.log('Token (first 20 chars):', token.substring(0, 20) + '...');

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      console.log('✅ Token verified. Decoded:', { id: decoded.id, role: decoded.role });
      
      // Try to get user from cache first - HUGE performance boost!
      let user = userCache.get(decoded.id);
      
      if (!user) {
        console.log('Cache miss - fetching user from database...');
        // Cache miss - fetch from database
        user = await User.findById(decoded.id).select('-password').lean();
        
        if (!user) {
          console.log('❌ User not found in database');
          return next(new AppError('User not found', 404));
        }
        
        console.log('✅ User found:', { id: user._id, email: user.email, role: user.role });
        // Store in cache for future requests
        userCache.set(decoded.id, user);
      } else {
        console.log('✅ User found in cache:', { id: user._id, email: user.email, role: user.role });
      }

      req.user = user;
      console.log('✅ req.user set successfully');
      console.log('========================\n');
      next();
    } catch (error) {
      console.log('❌ Token verification failed:', error);
      return next(new AppError('Not authorized, token failed', 401));
    }
  } catch (error) {
    next(error);
  }
};

export const checkRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Not authorized', 401));
    }

    // Case-insensitive role comparison
    const userRole = req.user.role?.toLowerCase();
    const allowedRoles = roles.map(r => r.toLowerCase());
    
    if (!allowedRoles.includes(userRole)) {
      return next(new AppError('Access denied. Insufficient permissions', 403));
    }

    next();
  };
};

// Check for MY_SHOP vendor type
export const checkMyShopVendor = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(new AppError('Not authorized', 401));
  }

  if (req.user.role === 'admin' || (req.user.role === 'vendor' && req.user.vendorType === 'MY_SHOP')) {
    return next();
  }

  return next(new AppError('Access denied. Insufficient permissions', 403));
};

// Check for PRIME vendor type
export const checkPrimeVendor = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(new AppError('Not authorized', 401));
  }

  if (req.user.role === 'admin' || (req.user.role === 'vendor' && req.user.vendorType === 'PRIME')) {
    return next();
  }

  return next(new AppError('Access denied. Only Prime vendors can access this resource', 403));
};

// Check for WAREHOUSE_FULFILLER vendor type
export const checkWarehouseFulfiller = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(new AppError('Not authorized', 401));
  }

  if (req.user.role === 'vendor' && req.user.vendorType === 'WAREHOUSE_FULFILLER') {
    return next();
  }

  return next(new AppError('Access denied. Only Warehouse Fulfillers can access this resource', 403));
};

// Alias for verifyToken
export const authenticate = verifyToken;

// Optional authentication - doesn't fail if no token, but populates req.user if token exists
export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    let token: string | undefined;

    // Check for token in cookies first
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    } 
    // Fallback to Authorization header
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // If no token, continue without authentication
    if (!token) {
      return next();
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      
      // Try to get user from cache first
      let user = userCache.get(decoded.id);
      
      if (!user) {
        // Cache miss - fetch from database
        user = await User.findById(decoded.id).select('-password').lean();
        
        if (user) {
          // Store in cache for future requests
          userCache.set(decoded.id, user);
        }
      }

      if (user) {
        req.user = user;
      }
    } catch (error) {
      // Invalid token, but continue without authentication
      // (don't throw error, just skip authentication)
    }

    next();
  } catch (error) {
    next(error);
  }
};
export const authenticate = verifyToken;
export const protect = verifyToken; // Common alias

// Alias for checkRole
export const authorize = checkRole;

