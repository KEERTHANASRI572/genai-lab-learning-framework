import { Router } from 'express';
import {
  createCourse,
  listCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
  deleteCoursePermanently,
} from '../controllers/courses.controller';
import { authenticate } from '../middleware/auth';
import { requireRole, tenantResolver } from '../middleware/rbac';

const router = Router();

router.use(authenticate);
router.use(tenantResolver);

// List and view (College Admin, Faculty, Student, Platform Admin)
router.get('/', requireRole('college-admin', 'faculty', 'student', 'platform-admin'), listCourses);
router.get('/:id', requireRole('college-admin', 'faculty', 'student', 'platform-admin'), getCourseById);

// Create, Update, Delete (College Admin, Platform Admin)
router.post('/', requireRole('college-admin', 'platform-admin'), createCourse);
router.patch('/:id', requireRole('college-admin', 'platform-admin'), updateCourse);
router.delete('/:id/permanent', requireRole('college-admin', 'platform-admin'), deleteCoursePermanently);
router.delete('/:id', requireRole('college-admin', 'platform-admin'), deleteCourse);

export const coursesRouter = router;
