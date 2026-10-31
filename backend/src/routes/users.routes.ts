import { Router } from 'express';
import {
  createUser,
  inviteUser,
  resendInvitation,
  listUsers,
  getUserById,
  updateUser,
  deleteUser,
  reactivateUser,
  deleteUserPermanently,
} from '../controllers/users.controller';
import { authenticate } from '../middleware/auth';
import { requireRole, tenantResolver } from '../middleware/rbac';

const router = Router();

router.use(authenticate);
router.use(tenantResolver);

// List institutional users (College Admin, Platform Admin, Faculty)
router.get('/', requireRole('college-admin', 'platform-admin', 'faculty'), listUsers);

// Get user profile (Self, College Admin, Platform Admin, Faculty)
router.get('/:id', requireRole('college-admin', 'platform-admin', 'faculty', 'student'), getUserById);

// Create user (College Admin, Platform Admin)
router.post('/', requireRole('college-admin', 'platform-admin'), createUser);
router.post('/invite', requireRole('college-admin', 'platform-admin'), inviteUser);
router.post('/:id/resend-invite', requireRole('college-admin', 'platform-admin'), resendInvitation);
router.post('/:id/reactivate', requireRole('college-admin', 'platform-admin'), reactivateUser);

// Update user (Self, College Admin, Platform Admin)
router.patch('/:id', requireRole('college-admin', 'platform-admin', 'faculty', 'student'), updateUser);

// Permanent delete user (College Admin, Platform Admin)
router.delete('/:id/permanent', requireRole('college-admin', 'platform-admin'), deleteUserPermanently);

// Suspend/deactivate user (College Admin, Platform Admin)
router.delete('/:id', requireRole('college-admin', 'platform-admin'), deleteUser);

export const usersRouter = router;
