import { Router, Request, Response } from 'express';
import { healthRouter } from './health.routes';
import { getDatabaseStatus } from '../config/database';

import { v1Router } from './v1.routes';

const apiRouter = Router();

// Health routes mounted under /api/health (Liveness: /api/health, Readiness: /api/health/ready)
apiRouter.use('/health', healthRouter);

// Direct readiness route alias at /api/ready
apiRouter.get('/ready', (_req: Request, res: Response) => {
  const dbStatus = getDatabaseStatus();

  if (dbStatus.isConnected) {
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      service: 'genai-lab-backend',
      database: {
        status: 'connected',
        readyState: dbStatus.readyState,
        databaseName: dbStatus.databaseName,
      },
    });
  } else {
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      service: 'genai-lab-backend',
      database: {
        status: 'disconnected',
        readyState: dbStatus.readyState,
        message: 'Database connection is not established. Verify MONGODB_URI configuration.',
      },
    });
  }
});

// Mount versioned API routes under /api/v1
apiRouter.use('/v1', v1Router);

export { apiRouter };
