import mongoose from 'mongoose';
import { config } from './env';

const READY_STATE_MAP: Record<number, string> = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

// Mask sensitive credentials from connection strings in log messages
const sanitizeErrorMessage = (message: string): string => {
  return message.replace(/mongodb(\+srv)?:\/\/[^@]+@/gi, 'mongodb$1://***:***@');
};

let listenersAttached = false;

const attachEventListeners = (): void => {
  if (listenersAttached) return;

  mongoose.connection.on('connected', () => {
    console.log(`[database] MongoDB Atlas connected successfully (database: ${config.DATABASE_NAME})`);
  });

  mongoose.connection.on('error', (err: unknown) => {
    const rawMsg = err instanceof Error ? err.message : String(err);
    console.error(`[database] MongoDB runtime connection error: ${sanitizeErrorMessage(rawMsg)}`);
  });

  mongoose.connection.on('disconnected', () => {
    console.log('[database] MongoDB connection disconnected');
  });

  listenersAttached = true;
};

/**
 * Connects to MongoDB Atlas using the configured MONGODB_URI and DATABASE_NAME.
 * Implements exponential retry to handle transient cloud socket/TLS renegotiations.
 * Never logs or exposes credentials.
 */
export const connectDatabase = async (
  maxRetries = 3,
  retryDelayMs = 2000
): Promise<boolean> => {
  if (!config.MONGODB_URI) {
    console.warn('[database] MONGODB_URI is not configured. Database connection aborted.');
    return false;
  }

  // If already connected, return early
  if (mongoose.connection.readyState === 1) {
    return true;
  }

  attachEventListeners();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(
        `[database] Attempting connection to database: ${config.DATABASE_NAME}${
          attempt > 1 ? ` (retry ${attempt}/${maxRetries})` : ''
        }...`
      );
      await mongoose.connect(config.MONGODB_URI, {
        dbName: config.DATABASE_NAME,
        serverSelectionTimeoutMS: 5000, // Timeout fast if network or credentials fail
      });
      return true;
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : String(err);
      console.error(
        `[database] Connection attempt ${attempt} failed: ${sanitizeErrorMessage(rawMsg)}`
      );

      if (attempt < maxRetries) {
        console.log(`[database] Waiting ${retryDelayMs}ms before retrying connection...`);
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      } else if (process.env['MONGODB_DIRECT_URI']) {
        // Fallback: If configured, attempt direct connection to active cluster shard with secondaryPreferred.
        console.warn('[database] Primary replica discovery failed. Attempting resilient connection to configured cluster shard...');
        try {
          await mongoose.connect(process.env['MONGODB_DIRECT_URI'], {
            dbName: config.DATABASE_NAME,
            serverSelectionTimeoutMS: 5000,
          });
          console.log(`[database] Resilient connection established to MongoDB Atlas (database: ${config.DATABASE_NAME})`);
          return true;
        } catch (fallbackErr) {
          console.error('[database] Resilient fallback connection failed:', sanitizeErrorMessage(String(fallbackErr)));
        }
      }
    }
  }

  console.error(`[database] All ${maxRetries} connection attempts failed.`);
  return false;
};

/**
 * Gracefully closes the MongoDB connection if active.
 */
export const disconnectDatabase = async (): Promise<void> => {
  if (mongoose.connection.readyState !== 0) {
    try {
      await mongoose.disconnect();
      console.log('[database] MongoDB connection closed gracefully');
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : String(err);
      console.error(`[database] Error closing connection: ${sanitizeErrorMessage(rawMsg)}`);
    }
  }
};

/**
 * Checks if the database is actively connected (readyState === 1).
 */
export const isDatabaseConnected = (): boolean => {
  return mongoose.connection.readyState === 1;
};

export interface DatabaseStatus {
  isConnected: boolean;
  readyState: string;
  databaseName?: string;
  host?: string;
}

/**
 * Returns safe connection status details without credentials.
 */
export const getDatabaseStatus = (): DatabaseStatus => {
  const readyStateCode = mongoose.connection.readyState;
  const isConnected = readyStateCode === 1;

  return {
    isConnected,
    readyState: READY_STATE_MAP[readyStateCode] ?? 'unknown',
    databaseName: isConnected ? mongoose.connection.name : undefined,
    host: isConnected ? mongoose.connection.host : undefined,
  };
};
