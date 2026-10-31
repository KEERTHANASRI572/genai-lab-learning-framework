import { Router, Request, Response } from 'express';
import { authRouter } from './auth.routes';
import { institutionsRouter } from './institutions.routes';
import { departmentsRouter } from './departments.routes';
import { coursesRouter } from './courses.routes';
import { subjectsRouter } from './subjects.routes';
import { laboratoriesRouter } from './laboratories.routes';
import { experimentsRouter } from './experiments.routes';
import { usersRouter } from './users.routes';
import { assessmentsRouter } from './assessments.routes';
import { learningSessionsRouter } from './learningSessions.routes';
import { helpRequestsRouter } from './helpRequests.routes';
import { supportTicketsRouter } from './supportTickets.routes';
import { learningResourcesRouter } from './learningResources.routes';
import { analyticsRouter } from './analytics.routes';
import { authenticate } from '../middleware/auth';
import { requireRole, tenantResolver, requireTenantScope } from '../middleware/rbac';

const router = Router();

// 1. Mount Authentication Domain
router.use('/auth', authRouter);

// 2. Mount Core Domain CRUD Routers (Phase 3C)
router.use('/institutions', institutionsRouter);
router.use('/departments', departmentsRouter);
router.use('/courses', coursesRouter);
router.use('/subjects', subjectsRouter);
router.use('/laboratories', laboratoriesRouter);
router.use('/experiments', experimentsRouter);
router.use('/users', usersRouter);
router.use('/assessments', assessmentsRouter);
router.use('/sessions', learningSessionsRouter);
router.use('/help-requests', helpRequestsRouter);
router.use('/support-tickets', supportTicketsRouter);
router.use('/learning-resources', learningResourcesRouter);
router.use('/analytics', analyticsRouter);

// 2. Secured RBAC & Tenant Verification Endpoints (used for role & tenant boundary audits)
router.get(
  '/platform/test-guard',
  authenticate,
  requireRole('platform-admin'),
  (req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: 'Platform admin access granted.',
      actor: req.user,
    });
  }
);

router.get(
  '/college/test-guard',
  authenticate,
  requireRole('college-admin'),
  tenantResolver,
  (req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: 'College admin tenant access granted.',
      tenantId: req.tenantId,
      actor: req.user,
    });
  }
);

router.get(
  '/faculty/test-guard',
  authenticate,
  requireRole('faculty', 'college-admin'),
  tenantResolver,
  (req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: 'Faculty access granted.',
      tenantId: req.tenantId,
      actor: req.user,
    });
  }
);

router.get(
  '/student/test-guard',
  authenticate,
  requireRole('student'),
  tenantResolver,
  (req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: 'Student access granted.',
      tenantId: req.tenantId,
      actor: req.user,
    });
  }
);

// Cross-tenant verification route checking explicit tenant parameter matching
router.get(
  '/tenants/:institutionId/resource',
  authenticate,
  tenantResolver,
  requireTenantScope('params', 'institutionId'),
  (req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: 'Authorized tenant access verified.',
      tenantId: req.params['institutionId'],
      actor: req.user,
    });
  }
);

export const v1Router = router;
