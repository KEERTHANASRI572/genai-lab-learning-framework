import { Router } from 'express';
import {
  createDepartment,
  listDepartments,
  getDepartmentById,
  updateDepartment,
  deleteDepartment,
  deleteDepartmentPermanently,
} from '../controllers/departments.controller';
import { authenticate } from '../middleware/auth';
import { requireRole, tenantResolver } from '../middleware/rbac';

const router = Router();

router.use(authenticate);
router.use(tenantResolver);

// List and view (College Admin, Faculty, Student, Platform Admin)
router.get('/', requireRole('college-admin', 'faculty', 'student', 'platform-admin'), listDepartments);
router.get('/:id', requireRole('college-admin', 'faculty', 'student', 'platform-admin'), getDepartmentById);

// Create, Update, Delete (College Admin, Platform Admin)
router.post('/', requireRole('college-admin', 'platform-admin'), createDepartment);
router.patch('/:id', requireRole('college-admin', 'platform-admin'), updateDepartment);
router.delete('/:id/permanent', requireRole('college-admin', 'platform-admin'), deleteDepartmentPermanently);
router.delete('/:id', requireRole('college-admin', 'platform-admin'), deleteDepartment);

export const departmentsRouter = router;
