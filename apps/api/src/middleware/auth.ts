import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { queryOne } from '../core/database/db.js';
import { AppError } from './errorHandler.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  is_email_verified: boolean;
  mfa_enabled: boolean;
  is_super_admin?: boolean;
}

export interface AuthTokenPayload {
  sub: string; // User ID
  email: string;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      tenantId?: string;
      userRole?: string;
      userPermissions?: string[];
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Missing or invalid Authorization header', 401, 'UNAUTHORIZED'));
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, config.jwt.secret) as AuthTokenPayload;
    if (payload.type !== 'access') {
      return next(new AppError('Invalid token type', 401, 'INVALID_TOKEN'));
    }

    const user = queryOne<any>(
      'SELECT id, email, first_name, last_name, is_email_verified, mfa_enabled, is_active, locked_until FROM users WHERE id = ?',
      [payload.sub]
    );

    if (!user || !user.is_active) {
      return next(new AppError('User not found or account is deactivated', 401, 'ACCOUNT_INACTIVE'));
    }

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return next(new AppError('Account is temporarily locked due to failed attempts', 403, 'ACCOUNT_LOCKED'));
    }

    // Check if platform super admin
    const superAdminRole = queryOne(
      `SELECT r.code FROM roles r 
       JOIN organization_memberships om ON om.role_id = r.id 
       WHERE om.user_id = ? AND r.code = 'PLATFORM_SUPER_ADMIN'`,
      [user.id]
    );

    req.user = {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      is_email_verified: Boolean(user.is_email_verified),
      mfa_enabled: Boolean(user.mfa_enabled),
      is_super_admin: Boolean(superAdminRole),
    };

    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Access token has expired', 401, 'TOKEN_EXPIRED'));
    }
    return next(new AppError('Invalid access token', 401, 'INVALID_TOKEN'));
  }
}

/**
 * Optional authentication: attaches req.user if token is valid, otherwise continues anonymously
 */
export function optionalAuthenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, config.jwt.secret) as AuthTokenPayload;
    if (payload.type === 'access') {
      const user = queryOne<any>(
        'SELECT id, email, first_name, last_name, is_email_verified, mfa_enabled, is_active FROM users WHERE id = ?',
        [payload.sub]
      );
      if (user && user.is_active) {
        req.user = {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          is_email_verified: Boolean(user.is_email_verified),
          mfa_enabled: Boolean(user.mfa_enabled),
        };
      }
    }
  } catch {}
  next();
}
