import { Router, Request, Response } from 'express';
import { config } from '../config/env';
import { getDatabaseStatus } from '../config/database';

const router = Router();

/**
 * Liveness Check: GET /api/health (or GET /api/health/live)
 * Verifies that the Express server process is running and responsive.
 */
router.get('/', (_req: Request, res: Response) => {
  const memory = process.memoryUsage();

  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: config.NODE_ENV,
    service: 'genai-lab-backend',
    version: '0.1.0',
    diagnostics: {
      nodeVersion: process.version,
      memoryUsageRssMb: Math.round((memory.rss / (1024 * 1024)) * 100) / 100,
      memoryUsageHeapUsedMb: Math.round((memory.heapUsed / (1024 * 1024)) * 100) / 100,
    },
  });
});

/**
 * Readiness Check: GET /api/health/ready
 * Verifies that the server and backing dependencies (MongoDB Atlas) are connected.
 * Returns 200 OK when connected, 503 Service Unavailable when disconnected.
 */
router.get('/ready', (_req: Request, res: Response) => {
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

export const healthRouter = router;
