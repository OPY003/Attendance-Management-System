import { Request, Response, NextFunction } from 'express';
import { query, queryOne } from '../core/database/db.js';
import { AppError } from './errorHandler.js';

/**
 * Enforces strict multi-tenancy isolation.
 * Resolves tenant ID from x-organization-id header, query parameter, or route parameter.
 * Validates that authenticated user is a verified active member of that organization.
 */
export function requireTenant(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    return next(new AppError('Authentication required before tenant resolution', 401, 'UNAUTHORIZED'));
  }

  // Resolve tenant ID from header or params
  const tenantId = (req.headers['x-organization-id'] as string) || req.params.orgId || req.params.organization_id;

  if (!tenantId) {
    return next(new AppError('Missing required organization identifier (x-organization-id header or route parameter)', 400, 'MISSING_TENANT_HEADER'));
  }

  // Check if organization exists and is active
  const org = queryOne<any>('SELECT id, slug, name, status FROM organizations WHERE id = ? OR slug = ?', [tenantId, tenantId]);
  if (!org) {
    return next(new AppError('Organization not found', 404, 'ORGANIZATION_NOT_FOUND'));
  }

  if (org.status === 'SUSPENDED' || org.status === 'CANCELLED') {
    return next(new AppError(`Organization is ${org.status.toLowerCase()}`, 403, 'TENANT_SUSPENDED'));
  }

  // Allow platform super admin global bypass with tenant context
  if (req.user.is_super_admin) {
    req.tenantId = org.id;
    req.userRole = 'PLATFORM_SUPER_ADMIN';
    req.userPermissions = ['*']; // Full platform access
    return next();
  }

  // Verify user's membership in this organization
  const membership = queryOne<any>(
    `SELECT om.id, om.role_id, om.status, r.code as role_code, r.name as role_name 
     FROM organization_memberships om
     JOIN roles r ON r.id = om.role_id
     WHERE om.organization_id = ? AND om.user_id = ?`,
    [org.id, req.user.id]
  );

  if (!membership || membership.status !== 'ACTIVE') {
    return next(new AppError('Cross-tenant access denied: You do not have access to this organization', 403, 'CROSS_TENANT_ACCESS_DENIED'));
  }

  // Load granular permissions for this role in this organization
  const permissions = query<{ code: string }>(
    `SELECT p.code FROM permissions p
     JOIN role_permissions rp ON rp.permission_id = p.id
     WHERE rp.role_id = ?`,
    [membership.role_id]
  ).map((p) => p.code);

  req.tenantId = org.id;
  req.userRole = membership.role_code;
  req.userPermissions = permissions;

  next();
}
