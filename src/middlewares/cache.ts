import { Request, Response, NextFunction } from 'express';

/**
 * Response caching middleware for frequently accessed endpoints
 * Caches GET requests for a specified duration
 */
export const cacheResponse = (durationMs: number = 60000) => {
  const cache = new Map<string, { data: any; timestamp: number }>();
  
  // Clean expired cache entries every minute
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of cache.entries()) {
      if (now - value.timestamp > durationMs) {
        cache.delete(key);
      }
    }
  }, 60000);

  return (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const key = `${req.originalUrl || req.url}`;
    const cached = cache.get(key);

    if (cached && Date.now() - cached.timestamp < durationMs) {
      // Return cached response
      return res.json(cached.data);
    }

    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json method to cache response
    res.json = function (data: any) {
      cache.set(key, { data, timestamp: Date.now() });
      return originalJson(data);
    };

    next();
  };
};
