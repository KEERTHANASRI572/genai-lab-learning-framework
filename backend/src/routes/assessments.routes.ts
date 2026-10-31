import { Router } from 'express';
import {
  createAssessment,
  getAssessmentForExperiment,
  submitAssessmentAttempt,
  getAssessmentAttemptById,
  getAssessmentById,
  addQuestionToAssessment,
  updateQuestionInAssessment,
  deleteQuestionFromAssessment,
  updateAssessment,
  deleteAssessment,
  deleteAssessmentPermanently,
  generateAssessmentQuestions,
  updateQuestionStatus,
  approveAllDraftQuestions,
} from '../controllers/assessments.controller';
import { authenticate } from '../middleware/auth';
import { requireRole, tenantResolver } from '../middleware/rbac';

const router = Router();

router.use(authenticate);
router.use(tenantResolver);

// Student & Faculty access: fetch assessment for an experiment
router.get(
  '/experiment/:experimentId',
  requireRole('student', 'faculty', 'college-admin', 'platform-admin'),
  getAssessmentForExperiment
);

// Student submit attempt (both /:assessmentId/submit and /attempts supported)
router.post(
  '/:assessmentId/submit',
  requireRole('student', 'faculty', 'college-admin'),
  submitAssessmentAttempt
);

router.post(
  '/attempts',
  requireRole('student', 'faculty', 'college-admin'),
  submitAssessmentAttempt
);

// Retrieve attempt by attemptId
router.get(
  '/attempts/:attemptId',
  requireRole('student', 'faculty', 'college-admin', 'platform-admin'),
  getAssessmentAttemptById
);

// Faculty / College Admin: author assessment
router.post(
  '/',
  requireRole('faculty', 'college-admin', 'platform-admin'),
  createAssessment
);

// Faculty / College Admin: generate assessment questions from approved indexed learning resource (RAG)
router.post(
  '/generate-from-resource',
  requireRole('faculty', 'college-admin', 'platform-admin'),
  generateAssessmentQuestions
);

// Faculty / College Admin: get single assessment by ID
router.get(
  '/:id',
  requireRole('faculty', 'college-admin', 'platform-admin'),
  getAssessmentById
);

// Faculty / College Admin: approve all draft questions in bulk
router.post(
  '/:id/questions/approve-all',
  requireRole('faculty', 'college-admin', 'platform-admin'),
  approveAllDraftQuestions
);

// Faculty / College Admin: add question to assessment
router.post(
  '/:id/questions',
  requireRole('faculty', 'college-admin', 'platform-admin'),
  addQuestionToAssessment
);

// Faculty / College Admin: update question review status (draft, approved, rejected)
router.patch(
  '/:id/questions/:questionId/status',
  requireRole('faculty', 'college-admin', 'platform-admin'),
  updateQuestionStatus
);

// Faculty / College Admin: update question in assessment
router.put(
  '/:id/questions/:questionId',
  requireRole('faculty', 'college-admin', 'platform-admin'),
  updateQuestionInAssessment
);

// Faculty / College Admin: delete question from assessment
router.delete(
  '/:id/questions/:questionId',
  requireRole('faculty', 'college-admin', 'platform-admin'),
  deleteQuestionFromAssessment
);

// Faculty / College Admin: update assessment
router.patch(
  '/:id',
  requireRole('faculty', 'college-admin', 'platform-admin'),
  updateAssessment
);

// Faculty / College Admin: permanent delete assessment
router.delete(
  '/:id/permanent',
  requireRole('faculty', 'college-admin', 'platform-admin'),
  deleteAssessmentPermanently
);

// Faculty / College Admin: archive assessment
router.delete(
  '/:id',
  requireRole('faculty', 'college-admin', 'platform-admin'),
  deleteAssessment
);

export const assessmentsRouter = router;
