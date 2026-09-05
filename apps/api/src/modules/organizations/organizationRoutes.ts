import { Router } from 'express';
import { organizationController } from './organizationController.js';
import { authenticate } from '../../middleware/auth.js';
import { requireTenant } from '../../middleware/tenant.js';
import { requirePermission, requireRole } from '../../middleware/rbac.js';
import { validateBody } from '../../middleware/validator.js';
import { CreateOrganizationSchema, UpdateOrganizationSettingsSchema, CreateCustomFieldDefinitionSchema } from '@uapms/validation';

export const organizationRouter = Router();

// General organization endpoints
organizationRouter.post('/', authenticate, validateBody(CreateOrganizationSchema), organizationController.create);
organizationRouter.get('/', authenticate, organizationController.list);

// Tenant-scoped endpoints
organizationRouter.get('/:orgId', authenticate, requireTenant, organizationController.getById);
organizationRouter.put('/:orgId/settings', authenticate, requireTenant, requirePermission('org:settings:write'), validateBody(UpdateOrganizationSettingsSchema), organizationController.updateSettings);

// Custom fields
organizationRouter.post('/:orgId/custom-fields', authenticate, requireTenant, requirePermission('org:custom_fields:manage'), validateBody(CreateCustomFieldDefinitionSchema), organizationController.createCustomField);
organizationRouter.get('/:orgId/custom-fields', authenticate, requireTenant, organizationController.listCustomFields);
