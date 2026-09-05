import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler.js';

/**
 * Checks if the user has the specified permission in the current tenant context.
 */
export function requirePermission(permission: string | string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Unauthorized', 401, 'UNAUTHORIZED'));
    }

    if (req.user.is_super_admin) {
      return next(); // Platform super admin has all permissions
    }

    const required = Array.isArray(permission) ? permission : [permission];
    const userPermissions = req.userPermissions || [];

    const hasPermission = required.some((perm) => userPermissions.includes(perm) || userPermissions.includes('*'));

    if (!hasPermission) {
      return next(
        new AppError(
          `Forbidden: Missing required permission [${required.join(', ')}]`,
          403,
          'PERMISSION_DENIED',
          { required_permissions: required }
        )
      );
    }

    next();
  };
}

/**
 * Checks if the user has one of the specified roles in the current tenant context.
 */
export function requireRole(roles: string | string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Unauthorized', 401, 'UNAUTHORIZED'));
    }

    if (req.user.is_super_admin) {
      return next();
    }

    const required = Array.isArray(roles) ? roles : [roles];
    const userRole = req.userRole;

    if (!userRole || !required.includes(userRole)) {
      return next(
        new AppError(
          `Forbidden: User role [${userRole || 'NONE'}] is not authorized for this operation. Required: [${required.join(', ')}]`,
          403,
          'ROLE_FORBIDDEN',
          { required_roles: required, current_role: userRole }
        )
      );
    }

    next();
  };
}

/**
 * Specifically requires Platform Super Admin
 */
export function requireSuperAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user || !req.user.is_super_admin) {
    return next(new AppError('Forbidden: Requires Platform Super Admin privileges', 403, 'SUPER_ADMIN_REQUIRED'));
  }
  next();
}
