import { Router } from 'express';
import {
  uploadLearningResource,
  listLearningResources,
  downloadLearningResource,
  deleteLearningResource,
  reindexLearningResource,
} from '../controllers/learningResources.controller';
import { authenticate } from '../middleware/auth';
import { tenantResolver, requireRole } from '../middleware/rbac';
import { multerMemory } from '../middleware/fileValidator';

export const learningResourcesRouter = Router();

learningResourcesRouter.use(authenticate, tenantResolver);

// List resources (accessible to college-admin, faculty, student, platform-admin)
learningResourcesRouter.get(
  '/',
  requireRole('college-admin', 'faculty', 'student', 'platform-admin'),
  listLearningResources
);

// Upload resource (college-admin, faculty)
learningResourcesRouter.post(
  '/',
  requireRole('college-admin', 'faculty'),
  multerMemory.single('file'),
  uploadLearningResource
);

// Download resource file
learningResourcesRouter.get(
  '/:resourceId/download',
  requireRole('college-admin', 'faculty', 'student', 'platform-admin'),
  downloadLearningResource
);

// Reindex resource (college-admin, faculty)
learningResourcesRouter.post(
  '/:resourceId/reindex',
  requireRole('college-admin', 'faculty'),
  reindexLearningResource
);

// Delete resource (college-admin, faculty)
learningResourcesRouter.delete(
  '/:resourceId',
  requireRole('college-admin', 'faculty'),
  deleteLearningResource
);

