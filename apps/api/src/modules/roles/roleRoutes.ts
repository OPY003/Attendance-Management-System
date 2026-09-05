import { Router } from 'express';
import { roleController } from './roleController.js';
import { authenticate } from '../../middleware/auth.js';
import { requireTenant } from '../../middleware/tenant.js';
import { requirePermission } from '../../middleware/rbac.js';

export const roleRouter = Router();

roleRouter.get('/permissions', authenticate, roleController.listPermissions);
roleRouter.get('/:orgId/roles', authenticate, requireTenant, roleController.listRoles);
roleRouter.post('/:orgId/roles', authenticate, requireTenant, requirePermission('roles:manage'), roleController.createRole);
