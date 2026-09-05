import { Request, Response, NextFunction } from 'express';
import { logger } from '../core/logger.js';

export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public details?: any;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR', details?: any) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction): void {
  const statusCode = err.statusCode || (err.status ? Number(err.status) : 500);
  const code = err.code || (statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_SERVER_ERROR');
  const message = err.message || 'An unexpected error occurred';
  const details = err.details || undefined;

  logger.error(`[${req.method}] ${req.url} - ${statusCode} ${code}: ${message}`, err, {
    ip: req.ip,
    user_id: (req as any).user?.id,
    organization_id: (req as any).tenantId,
  });

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      details,
    },
    metadata: {
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
    },
  });
}
