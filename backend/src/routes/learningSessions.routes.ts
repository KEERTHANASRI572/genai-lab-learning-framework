import { Router } from 'express';
import {
  getOrCreateSession,
  updateSessionStep,
  queryLabTutor,
  getStudentProgress,
} from '../controllers/learningSessions.controller';
import { authenticate } from '../middleware/auth';
import { requireRole, tenantResolver } from '../middleware/rbac';

const router = Router();

router.use(authenticate);
router.use(tenantResolver);

// Student learning progress: self or faculty review
router.get(
  '/progress/:studentId?',
  requireRole('student', 'faculty', 'college-admin', 'platform-admin'),
  getStudentProgress
);

// Get or initialize active session for experiment (both GET and POST supported)
router.get(
  '/experiment/:experimentId',
  requireRole('student', 'faculty', 'college-admin'),
  getOrCreateSession
);
router.post(
  '/experiment/:experimentId',
  requireRole('student', 'faculty', 'college-admin'),
  getOrCreateSession
);

// Update step progress and recorded observations (both PATCH and POST supported)
router.patch(
  '/:sessionId/step',
  requireRole('student', 'faculty'),
  updateSessionStep
);
router.post(
  '/:sessionId/step',
  requireRole('student', 'faculty'),
  updateSessionStep
);

// Query lab tutor (RAG-grounded with verified institution resources, supports /tutor and /query-tutor)
router.post(
  '/:sessionId/tutor',
  requireRole('student', 'faculty'),
  queryLabTutor
);
router.post(
  '/:sessionId/query-tutor',
  requireRole('student', 'faculty'),
  queryLabTutor
);

export const learningSessionsRouter = router;

