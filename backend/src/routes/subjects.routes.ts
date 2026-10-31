import { Router } from 'express';
import {
  createSubject,
  listSubjects,
  getSubjectById,
  updateSubject,
  deleteSubject,
  deleteSubjectPermanently,
} from '../controllers/subjects.controller';
import { authenticate } from '../middleware/auth';
import { requireRole, tenantResolver } from '../middleware/rbac';

const router = Router();

router.use(authenticate);
router.use(tenantResolver);

// List and view (College Admin, Faculty, Student, Platform Admin)
router.get('/', requireRole('college-admin', 'faculty', 'student', 'platform-admin'), listSubjects);
router.get('/:id', requireRole('college-admin', 'faculty', 'student', 'platform-admin'), getSubjectById);

// Create, Update, Delete (College Admin, Platform Admin)
router.post('/', requireRole('college-admin', 'platform-admin'), createSubject);
router.patch('/:id', requireRole('college-admin', 'platform-admin'), updateSubject);
router.delete('/:id/permanent', requireRole('college-admin', 'platform-admin'), deleteSubjectPermanently);
router.delete('/:id', requireRole('college-admin', 'platform-admin'), deleteSubject);

export const subjectsRouter = router;
