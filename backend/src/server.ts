import http from 'http';
import { app } from './app';
import { config } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';

const startServer = async (): Promise<void> => {
  // 1. Complete initialization steps prior to listening
  if (config.MONGODB_URI) {
    console.log('[server] Initializing MongoDB connection...');
    const connected = await connectDatabase();
    if (connected) {
      console.log('[server] Database readiness check passed. Application is fully ready.');
    } else {
      console.warn(
        '[server] Initial MongoDB connection failed. Server will start, but readiness probe will report 503 until connection succeeds.'
      );
    }
  } else {
    console.warn(
      '[server] MONGODB_URI is not set in environment. Server starting in standalone mode; readiness probe will report 503.'
    );
  }

  // 2. Create HTTP server instance
  const server = http.createServer(app);

  // 3. Attach explicit error handler for EADDRINUSE and server faults
  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(
        `\n[server] =========================================================================\n` +
        `[server] ERROR: Port ${config.PORT} is already in use (EADDRINUSE).\n` +
        `[server] Another backend instance or process is currently listening on port ${config.PORT}.\n` +
        `[server] \n` +
        `[server] To resolve this:\n` +
        `[server]   1. Ensure no other terminal or background process is running 'npm run dev'.\n` +
        `[server]   2. Check which process is holding port ${config.PORT} using:\n` +
        `[server]      Get-NetTCPConnection -LocalPort ${config.PORT}\n` +
        `[server]   3. Stop the duplicate process and restart the backend.\n` +
        `[server] =========================================================================\n`
      );
      process.exit(1);
    } else {
      console.error('[server] Fatal server error encountered:', error);
      process.exit(1);
    }
  });

  // 4. Start listening on configured port (bind explicitly to 0.0.0.0 for containerized environments like Render)
  server.listen(config.PORT, '0.0.0.0', () => {
    console.log(`[server] Backend running in ${config.NODE_ENV} mode on port ${config.PORT}`);
    console.log(`[server] Liveness check available at: http://localhost:${config.PORT}/api/health`);
    console.log(`[server] Readiness check available at: http://localhost:${config.PORT}/api/health/ready`);
  });

  // 5. Graceful shutdown handler with immediate connection termination
  let isShuttingDown = false;
  const gracefulShutdown = async (signal: string): Promise<void> => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`\n[server] Received ${signal}. Closing HTTP server gracefully...`);

    // Terminate existing keep-alive sockets immediately so port 5000 is freed without delay
    if (typeof server.closeAllConnections === 'function') {
      server.closeAllConnections();
    } else if (typeof (server as any).closeIdleConnections === 'function') {
      (server as any).closeIdleConnections();
    }

    server.close(async (err) => {
      if (err) {
        console.error('[server] Error while closing HTTP server:', err);
      } else {
        console.log('[server] HTTP server closed. Port released.');
      }

      try {
        await disconnectDatabase();
      } catch (dbErr) {
        console.warn('[server] Error closing database connection:', dbErr);
      }

      process.exit(0);
    });

    // Force exit if cleanup takes longer than 5 seconds
    setTimeout(() => {
      console.error('[server] Graceful shutdown timed out. Forcing process termination.');
      process.exit(1);
    }, 5000).unref();
  };

  // Register shutdown hooks once to prevent stacking across reloads
  process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.once('SIGINT', () => gracefulShutdown('SIGINT'));

  process.on('unhandledRejection', (reason: unknown) => {
    console.error('[server] Unhandled Promise Rejection:', reason);
  });

  process.on('uncaughtException', (err: Error) => {
    console.error('[server] Uncaught Exception:', err);
  });
};

startServer().catch((err: unknown) => {
  console.error('[server] Fatal error during startup:', err);
  process.exit(1);
});
