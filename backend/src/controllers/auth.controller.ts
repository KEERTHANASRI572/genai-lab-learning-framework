import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';
import { verifyPassword, hashPassword, validatePasswordStrength } from '../utils/password';
import {
  generateAuthTokens,
  verifyRefreshToken,
  hashToken,
} from '../utils/token';
import { isDatabaseConnected } from '../config/database';
import { sendPasswordResetEmail } from '../utils/email';

/**
 * Login Handler: POST /api/v1/auth/login
 * Validates credentials, manages lockout protection, and issues JWT access/refresh tokens.
 * Fails closed if the database is disconnected.
 */
export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;

    // 1. Input Validation
    if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Both email and password are required strings.',
          requestId: req.headers['x-request-id'] || undefined,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 2. Fail closed if database is unavailable
    if (!isDatabaseConnected()) {
      res.status(503).json({
        success: false,
        error: {
          code: 'DATABASE_UNAVAILABLE',
          message: 'Authentication service is temporarily unavailable. Database connection is not established.',
          requestId: req.headers['x-request-id'] || undefined,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // 3. User lookup (explicitly selecting protected fields)
    const user = await User.findOne({ email: normalizedEmail }).select(
      '+passwordHash +security.failedLoginAttempts +security.lockoutUntil +security.activeRefreshTokenHash'
    );

    // Constant-time mitigation: generic error for non-existent user or wrong password
    const genericAuthError = () => {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password.',
          requestId: req.headers['x-request-id'] || undefined,
          timestamp: new Date().toISOString(),
        },
      });
    };

    if (!user) {
      // Run dummy verify to avoid timing attack discrepancy
      await verifyPassword(password, '$2b$10$abcdefghijklmnopqrstuvwxyz123456789012345678');
      genericAuthError();
      return;
    }

    // 4. Lockout Check
    const now = new Date();
    if (user.security?.lockoutUntil && user.security.lockoutUntil > now) {
      const waitMinutes = Math.ceil((user.security.lockoutUntil.getTime() - now.getTime()) / 60000);
      res.status(401).json({
        success: false,
        error: {
          code: 'ACCOUNT_LOCKED',
          message: `Account is temporarily locked due to multiple failed login attempts. Please try again in ${waitMinutes} minute(s).`,
          requestId: req.headers['x-request-id'] || undefined,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // 5. Password Verification
    const isPasswordValid = await verifyPassword(password, user.passwordHash);

    if (!isPasswordValid) {
      // Increment failed attempts and apply progressive lockout
      const currentAttempts = (user.security?.failedLoginAttempts || 0) + 1;
      user.security.failedLoginAttempts = currentAttempts;

      if (currentAttempts >= 5) {
        user.security.lockoutUntil = new Date(now.getTime() + 15 * 60 * 1000); // 15-minute lockout
      }

      try {
        await user.save();
      } catch (err) {
        console.warn('[auth] Could not persist failed login counter to replica:', (err as Error).message);
      }
      genericAuthError();
      return;
    }

    // 6. Account Status Check
    if (user.status !== 'active') {
      res.status(403).json({
        success: false,
        error: {
          code: 'ACCOUNT_INACTIVE',
          message: `Account status is '${user.status}'. Access is denied. Please contact your institution administrator.`,
          requestId: req.headers['x-request-id'] || undefined,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // 7. Success: Reset failure counters and issue tokens
    user.security.failedLoginAttempts = 0;
    user.security.lockoutUntil = undefined;
    user.lastLoginAt = now;

    const { tokens } = generateAuthTokens(user);

    // Save refresh token hash for rotation & revocation tracking (resilient against secondary replicas)
    user.security.activeRefreshTokenHash = hashToken(tokens.refreshToken);
    try {
      try {
        await user.save();
      } catch (err) {
        console.warn('[auth] Could not persist failed login counter to replica:', (err as Error).message);
      }
    } catch (saveErr) {
      console.warn('[auth] Could not persist login security record to replica:', (saveErr as Error).message);
    }

    // Set secure HttpOnly cookies for browser authentication
    const isProduction = process.env['NODE_ENV'] === 'production';
    res.cookie('access_token', tokens.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 15 * 60 * 1000,
      path: '/',
    });
    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    res.status(200).json({
      success: true,
      data: {
        tokens,
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          institutionId: user.institutionId ? user.institutionId.toString() : null,
          departmentId: user.departmentId ? user.departmentId.toString() : null,
          status: user.status,
        },
      },
      meta: {
        requestId: req.headers['x-request-id'] || undefined,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Refresh Token Handler: POST /api/v1/auth/refresh
 * Validates cryptographic refresh token and single-use hash match, then issues fresh tokens.
 */
export const refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const incomingToken = req.cookies?.['refresh_token'] || req.body?.refreshToken;

    if (!incomingToken || typeof incomingToken !== 'string') {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Refresh token is required in cookies or request body.',
          requestId: req.headers['x-request-id'] || undefined,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // 1. Verify token signature and claims
    let payload;
    try {
      payload = verifyRefreshToken(incomingToken);
    } catch {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Refresh token is invalid or expired.',
          requestId: req.headers['x-request-id'] || undefined,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // 2. Fail closed if database is unavailable
    if (!isDatabaseConnected()) {
      res.status(503).json({
        success: false,
        error: {
          code: 'DATABASE_UNAVAILABLE',
          message: 'Database connection is not established.',
          requestId: req.headers['x-request-id'] || undefined,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // 3. User lookup and active refresh token hash match
    const user = await User.findById(payload.sub).select('+security.activeRefreshTokenHash');

    if (!user || user.status !== 'active') {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'User account not found or is no longer active.',
          requestId: req.headers['x-request-id'] || undefined,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    const incomingHash = hashToken(incomingToken);
    if (user.security?.activeRefreshTokenHash !== incomingHash) {
      // Token reuse / revocation detected! Invalidate immediately
      user.security.activeRefreshTokenHash = undefined;
      try {
        await user.save();
      } catch (err) {
        console.warn('[auth] Could not persist failed login counter to replica:', (err as Error).message);
      }

      res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_REVOKED',
          message: 'Refresh token has been revoked or already consumed.',
          requestId: req.headers['x-request-id'] || undefined,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // 4. Issue rotated tokens
    const { tokens } = generateAuthTokens(user);
    user.security.activeRefreshTokenHash = hashToken(tokens.refreshToken);
    await user.save();

    const isProduction = process.env['NODE_ENV'] === 'production';
    res.cookie('access_token', tokens.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 15 * 60 * 1000,
      path: '/',
    });
    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    res.status(200).json({
      success: true,
      data: {
        tokens,
      },
      meta: {
        requestId: req.headers['x-request-id'] || undefined,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get Current User Profile: GET /api/v1/auth/me
 * Returns authenticated user details and tenant affiliation.
 */
export const getCurrentUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'User is not authenticated.',
          requestId: req.headers['x-request-id'] || undefined,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // If database is available, fetch fresh profile from DB
    if (isDatabaseConnected()) {
      const user = await User.findById(req.user.id).populate('institutionId', 'name code domain');
      if (user) {
        res.status(200).json({
          success: true,
          data: {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            role: user.role,
            institutionId: user.institutionId ? (user.institutionId as any)._id?.toString() || user.institutionId.toString() : null,
            institution: user.institutionId && typeof user.institutionId === 'object' ? user.institutionId : null,
            departmentId: user.departmentId ? user.departmentId.toString() : null,
            status: user.status,
            lastLoginAt: user.lastLoginAt,
            profile: user.profile,
          },
          meta: {
            requestId: req.headers['x-request-id'] || undefined,
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }
    }

    // If database is disconnected or user lookup fails, return verified JWT context
    res.status(200).json({
      success: true,
      data: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role,
        institutionId: req.user.institutionId || null,
      },
      meta: {
        requestId: req.headers['x-request-id'] || undefined,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Logout Handler: POST /api/v1/auth/logout
 * Revokes the active refresh token in the user security record.
 */
export const logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.user && isDatabaseConnected()) {
      await User.findByIdAndUpdate(req.user.id, {
        $unset: { 'security.activeRefreshTokenHash': 1 },
      });
    }

    const isProduction = process.env['NODE_ENV'] === 'production';
    res.clearCookie('access_token', {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      path: '/',
    });
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      path: '/',
    });

    res.status(200).json({
      success: true,
      data: {
        message: 'Successfully logged out. Active session refresh token revoked.',
      },
      meta: {
        requestId: req.headers['x-request-id'] || undefined,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Activate Account Handler: POST /api/v1/auth/activate
 * Sets initial password for invited faculty/student and activates account.
 */
export const activateAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { token, password } = req.body;

    if (!token || typeof token !== 'string' || !password || typeof password !== 'string') {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Both invitation token and password are required.',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Validate password complexity before database operations
    const passCheck = validatePasswordStrength(password);
    if (!passCheck.valid) {
      res.status(400).json({
        success: false,
        error: {
          code: 'WEAK_PASSWORD',
          message: passCheck.message || 'Password does not meet complexity requirements.',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    if (!isDatabaseConnected()) {
      res.status(503).json({
        success: false,
        error: {
          code: 'DATABASE_UNAVAILABLE',
          message: 'Database connection is not established.',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    const tokenHash = hashToken(token.trim());
    const user = await User.findOne({
      'security.invitationTokenHash': tokenHash,
      'security.invitationExpiresAt': { $gt: new Date() },
      status: 'pending_activation',
    }).select('+security.invitationTokenHash +security.invitationExpiresAt');

    if (!user) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_OR_EXPIRED_INVITATION',
          message: 'The invitation token is invalid, expired, or has already been used.',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Hash new password and activate
    const passwordHash = await hashPassword(password);
    user.passwordHash = passwordHash;
    user.status = 'active';
    user.security.invitationTokenHash = undefined;
    user.security.invitationExpiresAt = undefined;
    user.lastLoginAt = new Date();

    const { tokens } = generateAuthTokens(user);
    user.security.activeRefreshTokenHash = hashToken(tokens.refreshToken);
    await user.save();

    // Set HttpOnly cookies
    const isProduction = process.env['NODE_ENV'] === 'production';
    res.cookie('access_token', tokens.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 15 * 60 * 1000,
      path: '/',
    });
    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    res.status(200).json({
      success: true,
      data: {
        message: 'Account activated successfully. Session established.',
        tokens,
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          institutionId: user.institutionId ? user.institutionId.toString() : null,
          status: user.status,
        },
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Forgot Password Handler: POST /api/v1/auth/forgot-password
 * Initiates secure single-use password reset flow.
 */
export const forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Email address is required.',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    if (!isDatabaseConnected()) {
      res.status(503).json({
        success: false,
        error: {
          code: 'DATABASE_UNAVAILABLE',
          message: 'Database connection is not established.',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    const user = await User.findOne({ email: email.trim().toLowerCase(), status: 'active' });
    if (user) {
      // Rate limiting: 60-second cooldown between password reset requests
      if (user.security?.lastPasswordResetRequestedAt) {
        const timeSinceLast = Date.now() - new Date(user.security.lastPasswordResetRequestedAt).getTime();
        if (timeSinceLast < 60 * 1000) {
          res.status(429).json({
            success: false,
            error: {
              code: 'RATE_LIMITED',
              message: 'A password reset request was recently sent. Please wait 60 seconds before requesting another.',
              timestamp: new Date().toISOString(),
            },
          });
          return;
        }
      }

      const resetToken = crypto.randomBytes(32).toString('hex');
      user.security.passwordResetTokenHash = hashToken(resetToken);
      user.security.passwordResetExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      user.security.lastPasswordResetRequestedAt = new Date();
      try {
        await user.save();
      } catch (err) {
        console.warn('[auth] Could not persist failed login counter to replica:', (err as Error).message);
      }

      const appBaseUrl = process.env['APP_URL'] || 'http://localhost:5173';
      const resetUrl = `${appBaseUrl}/reset-password?token=${resetToken}`;
      await sendPasswordResetEmail(user.email, resetUrl);
    }

    res.status(200).json({
      success: true,
      data: {
        message: 'If an active account exists with this email, password reset instructions have been dispatched.',
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Reset Password Handler: POST /api/v1/auth/reset-password
 * Completes single-use password reset.
 */
export const resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { token, newPassword } = req.body;
    if (!token || typeof token !== 'string' || !newPassword || typeof newPassword !== 'string') {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Both reset token and new password are required.',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    const passCheck = validatePasswordStrength(newPassword);
    if (!passCheck.valid) {
      res.status(400).json({
        success: false,
        error: {
          code: 'WEAK_PASSWORD',
          message: passCheck.message || 'Password does not meet complexity requirements.',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    if (!isDatabaseConnected()) {
      res.status(503).json({
        success: false,
        error: {
          code: 'DATABASE_UNAVAILABLE',
          message: 'Database connection is not established.',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    const tokenHash = hashToken(token.trim());
    const user = await User.findOne({
      'security.passwordResetTokenHash': tokenHash,
      'security.passwordResetExpiresAt': { $gt: new Date() },
      status: 'active',
    }).select('+security.passwordResetTokenHash +security.passwordResetExpiresAt');

    if (!user) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_OR_EXPIRED_RESET_TOKEN',
          message: 'The password reset token is invalid, expired, or has already been used.',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    user.passwordHash = await hashPassword(newPassword);
    user.security.passwordResetTokenHash = undefined;
    user.security.passwordResetExpiresAt = undefined;
    user.security.activeRefreshTokenHash = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      data: {
        message: 'Password reset successfully. You may now log in with your new credentials.',
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
};
