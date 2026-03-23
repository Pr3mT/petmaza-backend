import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

// Global cache map for sharing across middleware instances
const globalCache = new Map<string, { data: any; timestamp: number }>();

// Clean expired cache entries every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of globalCache.entries()) {
    // Remove entries older than 10 minutes regardless of duration
    if (now - value.timestamp > 600000) {
      globalCache.delete(key);
    }
  }
}, 60000);

/**
 * Clear cache for a specific URL pattern
 */
export const clearCache = (pattern?: string) => {
  if (!pattern) {
    globalCache.clear();
    return;
  }
  
  for (const key of globalCache.keys()) {
    if (key.includes(pattern)) {
      globalCache.delete(key);
    }
  }
};

/**
 * Response caching middleware for frequently accessed endpoints
 * Caches GET requests for a specified duration
 */
export const cacheResponse = (durationMs: number = 60000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const key = `${req.originalUrl || req.url}`;
    const cached = globalCache.get(key);

    if (cached && Date.now() - cached.timestamp < durationMs) {
      // Return cached response
      return res.json(cached.data);
    }

    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json method to cache response
    res.json = function (data: any) {
      globalCache.set(key, { data, timestamp: Date.now() });
      return originalJson(data);
    };

    next();
  };
};

/**
 * Conditional caching middleware - caches for customers/public, but NOT for admins
 * This ensures admins always get real-time data while customers benefit from caching
 * Cache keys include user authentication state to prevent serving wrong data after login
 */
export const cacheForCustomersOnly = (durationMs: number = 60000) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Check if user is admin - if yes, skip caching entirely
    const isAdmin = req.user && req.user.role === 'admin';
    if (isAdmin) {
      // Admin users always get fresh data - don't cache and don't return cached data
      return next();
    }

    // Include user auth state in cache key to prevent serving cached data from different auth state
    // This ensures logged-in users don't get cached data from when they weren't logged in
    const authState = req.user ? `auth:${req.user.role}:${req.user._id}` : 'public';
    const key = `${authState}:${req.originalUrl || req.url}`;
    const cached = globalCache.get(key);

    if (cached && Date.now() - cached.timestamp < durationMs) {
      // Return cached response
      return res.json(cached.data);
    }

    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json method to cache response
    res.json = function (data: any) {
      globalCache.set(key, { data, timestamp: Date.now() });
      return originalJson(data);
    };

    next();
  };
};
