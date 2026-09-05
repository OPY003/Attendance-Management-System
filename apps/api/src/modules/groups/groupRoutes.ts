import { Router } from 'express';
import { groupController } from './groupController.js';
import { authenticate } from '../../middleware/auth.js';
import { requireTenant } from '../../middleware/tenant.js';
import { requirePermission } from '../../middleware/rbac.js';

export const groupRouter = Router();

// Departments
groupRouter.get('/:orgId/departments', authenticate, requireTenant, requirePermission('departments:manage'), groupController.listDepartments);
groupRouter.post('/:orgId/departments', authenticate, requireTenant, requirePermission('departments:manage'), groupController.createDepartment);

// Groups / Classes / Teams
groupRouter.get('/:orgId/groups', authenticate, requireTenant, requirePermission('groups:manage'), groupController.listGroups);
groupRouter.post('/:orgId/groups', authenticate, requireTenant, requirePermission('groups:manage'), groupController.createGroup);
groupRouter.get('/:orgId/groups/:groupId/members', authenticate, requireTenant, requirePermission('groups:manage'), groupController.listMembers);
groupRouter.post('/:orgId/groups/:groupId/members', authenticate, requireTenant, requirePermission('groups:manage'), groupController.enrollMembers);
