import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { isDatabaseConnected } from '../config/database';
import { AuditLog, AuditTargetDomain } from '../models/AuditLog';

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginationResult {
  page: number;
  limit: number;
  totalRecords: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/**
 * Standardized success response sender for a single entity or action result.
 */
export const sendSuccess = <T>(
  res: Response,
  data: T,
  meta?: Record<string, unknown>,
  statusCode = 200
): void => {
  res.status(statusCode).json({
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  });
};

/**
 * Standardized success response sender for paginated collections.
 */
export const sendPaginated = <T>(
  res: Response,
  data: T[],
  pagination: PaginationResult,
  meta?: Record<string, unknown>,
  statusCode = 200
): void => {
  res.status(statusCode).json({
    success: true,
    data,
    pagination,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  });
};

/**
 * Standardized error response sender following the API contract RFC-7807 inspired envelope.
 */
export const sendError = (
  res: Response,
  code: string,
  message: string,
  statusCode = 400,
  details?: unknown,
  req?: Request
): void => {
  const requestId = (req?.headers['x-request-id'] as string) || undefined;
  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      details,
      requestId,
      timestamp: new Date().toISOString(),
    },
  });
};

/**
 * Checks if MongoDB is connected. If not, sends a standardized 503 error and returns false.
 */
export const ensureDatabaseReady = (req: Request, res: Response): boolean => {
  if (!isDatabaseConnected()) {
    sendError(
      res,
      'DATABASE_UNAVAILABLE',
      'The database service is currently unavailable. Protected persistent operations cannot be completed.',
      503,
      undefined,
      req
    );
    return false;
  }
  return true;
};

/**
 * Parses and bounds page and limit query parameters.
 */
export const parsePagination = (
  query: Record<string, unknown>,
  defaultLimit = 20,
  maxLimit = 100
): PaginationParams => {
  const pageRaw = parseInt(String(query['page'] || '1'), 10);
  const limitRaw = parseInt(String(query['limit'] || String(defaultLimit)), 10);

  const page = isNaN(pageRaw) || pageRaw < 1 ? 1 : pageRaw;
  let limit = isNaN(limitRaw) || limitRaw < 1 ? defaultLimit : limitRaw;
  if (limit > maxLimit) limit = maxLimit;

  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

/**
 * Validates whether a given string is a valid MongoDB ObjectId.
 */
export const isValidObjectId = (id: unknown): id is string => {
  if (typeof id !== 'string') return false;
  return mongoose.Types.ObjectId.isValid(id);
};

/**
 * Safe asynchronous audit logging helper. Logs administrative operations without failing the request.
 */
export const recordAuditLog = async (params: {
  req: Request;
  action: string;
  targetDomain: AuditTargetDomain;
  targetResourceId?: string;
  status: 'success' | 'failure' | 'flagged';
  details?: Record<string, unknown>;
  institutionId?: string | mongoose.Types.ObjectId;
}): Promise<void> => {
  try {
    if (!isDatabaseConnected()) return; // Don't crash if DB is down during audit

    const ipAddress =
      (params.req.headers['x-forwarded-for'] as string) ||
      params.req.socket.remoteAddress ||
      '127.0.0.1';

    await AuditLog.create({
      institutionId: params.institutionId || params.req.tenantId || params.req.user?.institutionId,
      actorUserId: params.req.user?.id,
      actorEmail: params.req.user?.email || 'unauthenticated@system',
      actorRole: params.req.user?.role || 'system',
      action: params.action,
      targetDomain: params.targetDomain,
      targetResourceId: params.targetResourceId,
      ipAddress,
      userAgent: params.req.headers['user-agent'] || 'unknown',
      status: params.status,
      details: params.details,
      metadata: {
        requestId: (params.req.headers['x-request-id'] as string) || undefined,
      },
    });
  } catch (err: unknown) {
    console.error('[audit] Failed to write audit log entry:', err);
  }
};
