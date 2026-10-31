import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/token';
import { AuthenticatedUser } from '../types/express';

/**
 * Authentication Middleware:
 * Inspects incoming request headers for a valid Bearer JWT.
 * Verifies token signature, issuer, audience, and expiry with algorithm restriction (HS256).
 * Attaches user identity to `req.user`.
 * Denies access with standard 401 Unauthorized envelope if missing or invalid.
 */
export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  let token: string | undefined;

  // 1. Check HttpOnly access_token cookie first (preferred for browser sessions)
  if (req.cookies && req.cookies['access_token']) {
    token = req.cookies['access_token'];
  } else if (req.headers.authorization) {
    // 2. Fall back to Authorization: Bearer <token> header (for CLI, API clients & automated tests)
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0]?.toLowerCase() === 'bearer' && parts[1]) {
      token = parts[1];
    } else {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN_FORMAT',
          message: 'Authorization header format must be: Bearer <token>',
          requestId: req.headers['x-request-id'] || undefined,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }
  }

  if (!token) {
    res.status(401).json({
      success: false,
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authorization header with Bearer token is required.',
        requestId: req.headers['x-request-id'] || undefined,
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  try {
    const payload = verifyAccessToken(token);

    const user: AuthenticatedUser = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      institutionId: payload.institutionId,
    };

    req.user = user;
    next();
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Invalid or expired token';
    const isExpired = errorMessage.toLowerCase().includes('expired');

    res.status(401).json({
      success: false,
      error: {
        code: isExpired ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID',
        message: isExpired
          ? 'Authentication token has expired. Please refresh your session.'
          : 'Authentication token is invalid or corrupted.',
        requestId: req.headers['x-request-id'] || undefined,
        timestamp: new Date().toISOString(),
      },
    });
  }
};
