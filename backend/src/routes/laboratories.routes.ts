import { Router } from 'express';
import {
  createLaboratory,
  listLaboratories,
  getLaboratoryById,
  updateLaboratory,
  deleteLaboratory,
  deleteLaboratoryPermanently,
} from '../controllers/laboratories.controller';
import { authenticate } from '../middleware/auth';
import { requireRole, tenantResolver } from '../middleware/rbac';

const router = Router();

router.use(authenticate);
router.use(tenantResolver);

// List and view (College Admin, Faculty, Student, Platform Admin)
router.get('/', requireRole('college-admin', 'faculty', 'student', 'platform-admin'), listLaboratories);
router.get('/:id', requireRole('college-admin', 'faculty', 'student', 'platform-admin'), getLaboratoryById);

// Create, Update, Delete (College Admin, Platform Admin; Faculty can update if assigned)
router.post('/', requireRole('college-admin', 'platform-admin'), createLaboratory);
router.patch('/:id', requireRole('college-admin', 'faculty', 'platform-admin'), updateLaboratory);
router.delete('/:id/permanent', requireRole('college-admin', 'platform-admin'), deleteLaboratoryPermanently);
router.delete('/:id', requireRole('college-admin', 'platform-admin'), deleteLaboratory);

export const laboratoriesRouter = router;
