import { Router } from 'express';
import { personController } from './personController.js';
import { authenticate } from '../../middleware/auth.js';
import { requireTenant } from '../../middleware/tenant.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validateBody } from '../../middleware/validator.js';
import { CreatePersonSchema, AssignRoleSchema, SetCustomFieldValueSchema } from '@uapms/validation';

export const personRouter = Router();

personRouter.get('/:orgId/persons', authenticate, requireTenant, requirePermission('persons:read'), personController.list);
personRouter.post('/:orgId/persons', authenticate, requireTenant, requirePermission('persons:write'), validateBody(CreatePersonSchema), personController.create);
personRouter.get('/:orgId/persons/:personId', authenticate, requireTenant, requirePermission('persons:read'), personController.getById);
personRouter.put('/:orgId/persons/:personId', authenticate, requireTenant, requirePermission('persons:write'), personController.update);
personRouter.post('/:orgId/persons/assign-role', authenticate, requireTenant, requirePermission('persons:assign_role'), validateBody(AssignRoleSchema), personController.assignRole);
personRouter.post('/:orgId/persons/:personId/custom-field', authenticate, requireTenant, requirePermission('persons:write'), validateBody(SetCustomFieldValueSchema.omit({ entity_id: true, entity_type: true })), personController.setCustomField);
