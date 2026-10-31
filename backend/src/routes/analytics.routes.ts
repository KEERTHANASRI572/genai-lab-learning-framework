import { Router } from 'express';
import {
  getCollegeAnalytics,
  getCollegeOverview,
  getStudentInterventions,
  getFacultyOversight,
  getFacultyDashboard,
  getFacultyAnalytics,
  getFacultyLearningGaps,
} from '../controllers/analytics.controller';
import { authenticate } from '../middleware/auth';
import { tenantResolver, requireRole } from '../middleware/rbac';

export const analyticsRouter = Router();

analyticsRouter.use(authenticate, tenantResolver);

// College Admin Analytics (accessible to college-admin, platform-admin)
analyticsRouter.get(
  '/college/analytics',
  requireRole('college-admin', 'platform-admin'),
  getCollegeAnalytics
);

// College Admin Overview
analyticsRouter.get(
  '/college/overview',
  requireRole('college-admin', 'platform-admin'),
  getCollegeOverview
);

// Student early-warning interventions
analyticsRouter.get(
  '/college/interventions',
  requireRole('college-admin', 'faculty', 'platform-admin'),
  getStudentInterventions
);

// Faculty oversight & participation metrics
analyticsRouter.get(
  '/college/faculty-oversight',
  requireRole('college-admin', 'platform-admin'),
  getFacultyOversight
);

// Faculty Dashboard (Assignment-based metrics & real experiment roster)
analyticsRouter.get(
  '/faculty/dashboard',
  requireRole('faculty', 'college-admin', 'platform-admin'),
  getFacultyDashboard
);

// Faculty Analytics (Performance data calculated from real student attempts)
analyticsRouter.get(
  '/faculty/analytics',
  requireRole('faculty', 'college-admin', 'platform-admin'),
  getFacultyAnalytics
);

// Faculty Learning Gaps (Real conceptual gaps aggregated from student diagnostics)
analyticsRouter.get(
  '/faculty/learning-gaps',
  requireRole('faculty', 'college-admin', 'platform-admin'),
  getFacultyLearningGaps
);

