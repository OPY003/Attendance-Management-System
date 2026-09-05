import { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';
import { AppError } from './errorHandler.js';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, RateLimitRecord>();

export function rateLimiter(windowMs: number = config.rateLimit.windowMs, maxRequests: number = config.rateLimit.maxRequests) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (process.env.NODE_ENV === 'test') {
      return next();
    }
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${ip}:${req.baseUrl || req.path}`;
    const now = Date.now();

    let record = memoryStore.get(key);
    if (!record || now > record.resetAt) {
      record = {
        count: 1,
        resetAt: now + windowMs,
      };
      memoryStore.set(key, record);
      return next();
    }

    record.count += 1;
    if (record.count > maxRequests) {
      const retryAfterSeconds = Math.ceil((record.resetAt - now) / 1000);
      return next(
        new AppError(
          `Too many requests. Please retry in ${retryAfterSeconds} seconds.`,
          429,
          'RATE_LIMIT_EXCEEDED',
          { retry_after_seconds: retryAfterSeconds }
        )
      );
    }

    next();
  };
}
