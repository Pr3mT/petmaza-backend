import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';

// Disable rate limiting outside production. Local dev hot-reloads + HMR
// fetches blow through real limits and make debugging painful. Toggle off
// in non-prod, OR by setting DISABLE_RATE_LIMIT=true in the env.
const RATE_LIMIT_DISABLED =
  process.env.NODE_ENV !== 'production' ||
  process.env.DISABLE_RATE_LIMIT === 'true';

const passthrough = (_req: Request, _res: Response, next: NextFunction) => next();

// Allow trusted load-test traffic to bypass the limiters WITHOUT disabling
// protection for everyone else. Set LOADTEST_BYPASS_TOKEN in the environment
// and send the header `X-Loadtest-Bypass: <token>` on test requests. When the
// env var is unset (the default), this never triggers and limits stay enforced.
const bypassToken = process.env.LOADTEST_BYPASS_TOKEN;
const skipForLoadTest = (req: Request): boolean =>
  !!bypassToken && req.get('X-Loadtest-Bypass') === bypassToken;

if (RATE_LIMIT_DISABLED) {
  // eslint-disable-next-line no-console
  console.log('[rateLimiter] disabled (NODE_ENV=' + (process.env.NODE_ENV || 'undefined') + ')');
}

/**
 * General API rate limiter
 * 500 requests per 15 minutes per IP (prod only)
 */
export const generalLimiter = RATE_LIMIT_DISABLED
  ? passthrough
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 500,
      standardHeaders: true,
      legacyHeaders: false,
      skip: skipForLoadTest,
      message: {
        success: false,
        message: 'Too many requests, please try again after 15 minutes.',
      },
    });

/**
 * Auth rate limiter (login, register)
 * 10 attempts per 15 minutes per IP — prevents brute-force (prod only)
 */
export const authLimiter = RATE_LIMIT_DISABLED
  ? passthrough
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 10,
      standardHeaders: true,
      legacyHeaders: false,
      skip: skipForLoadTest,
      message: {
        success: false,
        message: 'Too many login attempts, please try again after 15 minutes.',
      },
    });

/**
 * Search / product listing limiter
 * 500 requests per 15 minutes per IP — public browsing is heavier (prod only)
 */
export const searchLimiter = RATE_LIMIT_DISABLED
  ? passthrough
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 500,
      standardHeaders: true,
      legacyHeaders: false,
      skip: skipForLoadTest,
      message: {
        success: false,
        message: 'Too many search requests, please slow down.',
      },
    });
