import { Router } from 'express';
import { locationController } from './locationController.js';
import { authenticate } from '../../middleware/auth.js';
import { requireTenant } from '../../middleware/tenant.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validateBody } from '../../middleware/validator.js';
import { CreateLocationSchema } from '@uapms/validation';

export const locationRouter = Router();

locationRouter.get('/:orgId/locations', authenticate, requireTenant, requirePermission('locations:read'), locationController.list);
locationRouter.post('/:orgId/locations', authenticate, requireTenant, requirePermission('locations:write'), validateBody(CreateLocationSchema), locationController.create);
locationRouter.get('/:orgId/locations/:locationId', authenticate, requireTenant, requirePermission('locations:read'), locationController.getById);
locationRouter.put('/:orgId/locations/:locationId', authenticate, requireTenant, requirePermission('locations:write'), locationController.update);
