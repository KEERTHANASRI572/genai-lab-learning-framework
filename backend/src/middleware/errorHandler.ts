import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env';

export interface AppError extends Error {
  statusCode?: number;
  status?: number;
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';

  const errorResponse: {
    status: 'error';
    statusCode: number;
    message: string;
    path: string;
    timestamp: string;
    stack?: string;
  } = {
    status: 'error',
    statusCode,
    message,
    path: req.originalUrl,
    timestamp: new Date().toISOString(),
  };

  // Only expose error stack traces in development mode
  if (config.NODE_ENV === 'development' && err.stack) {
    errorResponse.stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
};
