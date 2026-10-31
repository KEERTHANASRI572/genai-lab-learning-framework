import { Router } from 'express';
import {
  login,
  refreshToken,
  getCurrentUser,
  logout,
  activateAccount,
  forgotPassword,
  resetPassword,
} from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import { loginRateLimiter } from '../middleware/abuseProtection';

const router = Router();

// Public authentication & onboarding routes
router.post('/login', loginRateLimiter, login);
router.post('/refresh', refreshToken);
router.post('/activate', activateAccount);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Protected session routes
router.get('/me', authenticate, getCurrentUser);
router.post('/logout', authenticate, logout);

export const authRouter = router;
