import { Router } from 'express';
import {
  createHelpRequest,
  listHelpRequests,
  updateHelpRequest,
} from '../controllers/helpRequests.controller';
import { authenticate } from '../middleware/auth';
import { requireRole, tenantResolver } from '../middleware/rbac';

const router = Router();

router.use(authenticate);
router.use(tenantResolver);

// List help requests (students see own; faculty sees assigned; college admin sees institutional)
router.get(
  '/',
  requireRole('student', 'faculty', 'college-admin'),
  listHelpRequests
);

// Student creates help request
router.post(
  '/',
  requireRole('student'),
  createHelpRequest
);

// Faculty or College Admin updates/resolves help request
router.patch(
  '/:id',
  requireRole('faculty', 'college-admin'),
  updateHelpRequest
);

export const helpRequestsRouter = router;

