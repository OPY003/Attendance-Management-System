import { AssignRoleSchema, BulkCreatePersonsSchema, CreatePersonSchema, SetCustomFieldValueSchema } from '@uapms/validation';
import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { requireTenant } from '../../middleware/tenant.js';
import { validateBody } from '../../middleware/validator.js';
import { personController } from './personController.js';

export const personRouter = Router();

personRouter.get('/:orgId/persons', authenticate, requireTenant, requirePermission('persons:read'), personController.list);
personRouter.post('/:orgId/persons', authenticate, requireTenant, requirePermission('persons:write'), validateBody(CreatePersonSchema), personController.create);
personRouter.post('/:orgId/persons/import', authenticate, requireTenant, requirePermission('persons:write'), validateBody(BulkCreatePersonsSchema), personController.bulkCreate);
personRouter.get('/:orgId/persons/:personId', authenticate, requireTenant, requirePermission('persons:read'), personController.getById);
personRouter.put('/:orgId/persons/:personId', authenticate, requireTenant, requirePermission('persons:write'), personController.update);
personRouter.post('/:orgId/persons/assign-role', authenticate, requireTenant, requirePermission('persons:assign_role'), validateBody(AssignRoleSchema), personController.assignRole);
personRouter.post('/:orgId/persons/:personId/custom-field', authenticate, requireTenant, requirePermission('persons:write'), validateBody(SetCustomFieldValueSchema.omit({ entity_id: true, entity_type: true })), personController.setCustomField);
