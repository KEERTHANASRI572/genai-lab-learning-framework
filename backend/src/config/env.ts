import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file if present
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
if (!process.env['MONGODB_URI']) {
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });
}

export interface AppConfig {
  // Server & basic app config
  PORT?: number;
  NODE_ENV?: string;
  CORS_ORIGIN?: string;
  MONGODB_URI?: string;
  DATABASE_NAME?: string;

  // JWT config
  JWT_SECRET?: string;
  JWT_REFRESH_SECRET?: string;
  JWT_ACCESS_EXPIRY?: string;
  JWT_REFRESH_EXPIRY?: string;
  JWT_ISSUER?: string;
  JWT_AUDIENCE?: string;

  // Storage configuration (required for resource upload)
  STORAGE_PROVIDER?: string;
  STORAGE_BUCKET?: string;
  STORAGE_REGION?: string;
  STORAGE_ACCESS_KEY_ID?: string;
  STORAGE_SECRET_ACCESS_KEY?: string;
  STORAGE_ENDPOINT_URL?: string;
  STORAGE_MAX_FILE_SIZE_MB?: string;

  // Embedding provider configuration
  EMBEDDING_PROVIDER?: string;
  EMBEDDING_ENDPOINT?: string;
  EMBEDDING_API_KEY?: string;
  EMBEDDING_MODEL?: string;
  EMBEDDING_TIMEOUT_MS?: string;
  EMBEDDING_BATCH_SIZE?: string;
}

const parsePort = (val: string | undefined, defaultPort: number): number => {
  if (!val) return defaultPort;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) || parsed <= 0 ? defaultPort : parsed;
};

const getJwtSecret = (
  envVar: string | undefined,
  fallbackDevSecret: string,
  secretName: string
): string => {
  const val = envVar?.trim();
  if (val) {
    if (val.length < 32 && process.env['NODE_ENV'] === 'production') {
      throw new Error(`[SECURITY ERROR] ${secretName} must be at least 32 characters in production environments.`);
    }
    return val;
  }
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error(`[SECURITY ERROR] ${secretName} must be configured in production environments.`);
  }
  // Safe development fallback
  return fallbackDevSecret;
};

export const config: AppConfig = {
  PORT: parsePort(process.env['PORT'], 5000),
  NODE_ENV: (process.env['NODE_ENV'] as string) || 'development',
  CORS_ORIGIN: process.env['CORS_ORIGIN'] || 'http://localhost:5173,http://localhost:5174',
  MONGODB_URI: process.env['MONGODB_URI']?.trim() || undefined,
  DATABASE_NAME: process.env['DATABASE_NAME']?.trim() || 'genai_lab_learning_db',
  JWT_SECRET: getJwtSecret(
    process.env['JWT_SECRET'],
    'dev_jwt_secret_genai_lab_learning_framework_2026_super_secure',
    'JWT_SECRET'
  ),
  JWT_REFRESH_SECRET: getJwtSecret(
    process.env['JWT_REFRESH_SECRET'],
    'dev_jwt_refresh_secret_genai_lab_framework_2026_super_secure',
    'JWT_REFRESH_SECRET'
  ),
  JWT_ACCESS_EXPIRY: process.env['JWT_ACCESS_EXPIRY']?.trim() || '15m',
  JWT_REFRESH_EXPIRY: process.env['JWT_REFRESH_EXPIRY']?.trim() || '7d',
  JWT_ISSUER: process.env['JWT_ISSUER']?.trim() || 'genai-lab-learning-framework',
  JWT_AUDIENCE: process.env['JWT_AUDIENCE']?.trim() || 'genai-lab-client',
  STORAGE_PROVIDER: process.env['STORAGE_PROVIDER'],
  STORAGE_BUCKET: process.env['STORAGE_BUCKET'],
  STORAGE_REGION: process.env['STORAGE_REGION'],
  STORAGE_ACCESS_KEY_ID: process.env['STORAGE_ACCESS_KEY_ID'],
  STORAGE_SECRET_ACCESS_KEY: process.env['STORAGE_SECRET_ACCESS_KEY'],
  STORAGE_ENDPOINT_URL: process.env['STORAGE_ENDPOINT_URL'],
  STORAGE_MAX_FILE_SIZE_MB: process.env['STORAGE_MAX_FILE_SIZE_MB'],
  EMBEDDING_PROVIDER: process.env['EMBEDDING_PROVIDER'],
  EMBEDDING_ENDPOINT: process.env['EMBEDDING_ENDPOINT'],
  EMBEDDING_API_KEY: process.env['EMBEDDING_API_KEY'],
  EMBEDDING_MODEL: process.env['EMBEDDING_MODEL'],
  EMBEDDING_TIMEOUT_MS: process.env['EMBEDDING_TIMEOUT_MS'],
  EMBEDDING_BATCH_SIZE: process.env['EMBEDDING_BATCH_SIZE'],
};
