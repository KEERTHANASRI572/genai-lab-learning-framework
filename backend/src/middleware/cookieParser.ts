import { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      cookies?: Record<string, string>;
    }
  }
}

/**
 * Lightweight, zero-dependency cookie parsing middleware.
 * Parses standard RFC 6265 Cookie request header into req.cookies dictionary.
 */
export const cookieParser = (req: Request, _res: Response, next: NextFunction): void => {
  const cookieHeader = req.headers.cookie;
  const cookies: Record<string, string> = {};

  if (cookieHeader && typeof cookieHeader === 'string') {
    const pairs = cookieHeader.split(';');
    for (const pair of pairs) {
      const idx = pair.indexOf('=');
      if (idx !== -1) {
        const key = pair.slice(0, idx).trim();
        const rawVal = pair.slice(idx + 1).trim();
        if (key) {
          try {
            cookies[key] = decodeURIComponent(rawVal);
          } catch {
            cookies[key] = rawVal;
          }
        }
      }
    }
  }

  req.cookies = cookies;
  next();
};

