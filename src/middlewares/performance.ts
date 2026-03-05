import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';

/**
 * Performance monitoring middleware
 * Logs slow requests for debugging
 */
export const performanceMonitor = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  // Intercept response finish event
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    // Log slow requests (over 1 second)
    if (duration > 1000) {
      logger.warn(`SLOW REQUEST: ${req.method} ${req.originalUrl} took ${duration}ms`);
    }
    
    // Log very slow requests (over 3 seconds) as errors
    if (duration > 3000) {
      logger.error(`VERY SLOW REQUEST: ${req.method} ${req.originalUrl} took ${duration}ms`);
    }
  });
  
  next();
};
