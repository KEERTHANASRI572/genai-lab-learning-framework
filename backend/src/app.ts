import express, { Application } from 'express';
import cors from 'cors';
import { config } from './config/env';
import { cookieParser } from './middleware/cookieParser';
import { apiRouter } from './routes';
import { notFoundHandler } from './middleware/notFoundHandler';
import { errorHandler } from './middleware/errorHandler';

const createApp = (): Application => {
  const app = express();

  // Cross-Origin Resource Sharing: parse configured origins and dynamically support local dev ports
  const allowedOrigins: (string | RegExp)[] = [];
  if (config.CORS_ORIGIN) {
    config.CORS_ORIGIN.split(',').forEach((origin) => {
      const trimmed = origin.trim();
      if (trimmed) allowedOrigins.push(trimmed);
    });
  }

  // In non-production environments, dynamically permit local development origins
  if (config.NODE_ENV !== 'production') {
    allowedOrigins.push(/^http:\/\/localhost:517\d$/);
    allowedOrigins.push(/^http:\/\/127\.0\.0\.1:517\d$/);
  }

  app.use(
    cors({
      origin: allowedOrigins.length > 0 ? allowedOrigins : ['http://localhost:5173', 'http://localhost:5174'],
      credentials: true,
    })
  );

  // Cookie parsing middleware
  app.use(cookieParser);

  // Request body parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Future middleware hooks:
  // app.use(tenantResolverMiddleware);
  // app.use(authMiddleware);

  // Mount API router under /api
  app.use('/api', apiRouter);

  // Catch-all 404 handler for unknown routes
  app.use(notFoundHandler);

  // Centralized error handling middleware
  app.use(errorHandler);

  return app;
};

export const app = createApp();
