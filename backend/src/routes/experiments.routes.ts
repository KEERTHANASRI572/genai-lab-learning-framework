import { Router } from 'express';
import {
  createExperiment,
  listExperiments,
  getExperimentById,
  updateExperiment,
  publishExperiment,
  deleteExperiment,
  deleteExperimentPermanently,
} from '../controllers/experiments.controller';
import { authenticate } from '../middleware/auth';
import { requireRole, tenantResolver } from '../middleware/rbac';

const router = Router();

router.use(authenticate);
router.use(tenantResolver);

// List and view (College Admin, Faculty, Student, Platform Admin)
router.get('/', requireRole('college-admin', 'faculty', 'student', 'platform-admin'), listExperiments);
router.get('/:id', requireRole('college-admin', 'faculty', 'student', 'platform-admin'), getExperimentById);

// Create, Update, Publish, Delete (Faculty, College Admin, Platform Admin)
router.post('/', requireRole('faculty', 'college-admin', 'platform-admin'), createExperiment);
router.patch('/:id', requireRole('faculty', 'college-admin', 'platform-admin'), updateExperiment);
router.post('/:id/publish', requireRole('faculty', 'college-admin', 'platform-admin'), publishExperiment);
router.delete('/:id/permanent', requireRole('faculty', 'college-admin', 'platform-admin'), deleteExperimentPermanently);
router.delete('/:id', requireRole('faculty', 'college-admin', 'platform-admin'), deleteExperiment);

export const experimentsRouter = router;
