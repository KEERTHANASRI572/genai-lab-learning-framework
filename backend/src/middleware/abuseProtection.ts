import { Request, Response, NextFunction } from 'express';

interface LoginAttemptRecord {
  count: number;
  resetAt: number;
}

const loginAttempts = new Map<string, LoginAttemptRecord>();

const WINDOW_MS = 60 * 1000; // 1 minute sliding window
const MAX_ATTEMPTS_PER_WINDOW = 10; // 10 attempts per minute per IP

/**
 * Cleanup expired IP records every 5 minutes to prevent memory leak
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of loginAttempts.entries()) {
    if (now > record.resetAt) {
      loginAttempts.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

/**
 * Login abuse protection middleware:
 * Tracks and limits login attempts per client IP to mitigate brute-force password guessing.
 */
export const loginRateLimiter = (req: Request, res: Response, next: NextFunction): void => {
  const clientIp =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    'unknown-ip';

  const now = Date.now();
  const record = loginAttempts.get(clientIp);

  if (!record || now > record.resetAt) {
    loginAttempts.set(clientIp, {
      count: 1,
      resetAt: now + WINDOW_MS,
    });
    next();
    return;
  }

  if (record.count >= MAX_ATTEMPTS_PER_WINDOW) {
    const retryAfterSec = Math.ceil((record.resetAt - now) / 1000);
    res.setHeader('Retry-After', retryAfterSec);
    res.status(429).json({
      success: false,
      error: {
        code: 'TOO_MANY_ATTEMPTS',
        message: `Too many login attempts. Please wait ${retryAfterSec} seconds before retrying.`,
        requestId: req.headers['x-request-id'] || undefined,
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  record.count += 1;
  next();
};
