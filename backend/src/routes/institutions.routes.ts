import { Router } from 'express';
import {
  createInstitution,
  listInstitutions,
  getInstitutionById,
  updateInstitution,
  deleteInstitution,
  suspendInstitution,
  reactivateInstitution,
  deleteInstitutionPermanently,
  resendAdminInvitation,
} from '../controllers/institutions.controller';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Platform Admin can provision and list all institutions
router.post('/', requireRole('platform-admin'), createInstitution);
router.get('/', requireRole('platform-admin'), listInstitutions);

// Lifecycle actions (Platform Admin only)
router.post('/:id/suspend', requireRole('platform-admin'), suspendInstitution);
router.post('/:id/reactivate', requireRole('platform-admin'), reactivateInstitution);
router.post('/:id/resend-admin-invitation', requireRole('platform-admin'), resendAdminInvitation);
router.delete('/:id/permanent', requireRole('platform-admin'), deleteInstitutionPermanently);

// Institution details & updates (Platform Admin or matching College Admin)
router.get('/:id', getInstitutionById);
router.patch('/:id', updateInstitution);
router.delete('/:id', requireRole('platform-admin'), deleteInstitution);

export const institutionsRouter = router;
