import { CreateDeviceSchema, UpdateDeviceSchema } from '@uapms/validation';
import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { requireTenant } from '../../middleware/tenant.js';
import { validateBody } from '../../middleware/validator.js';
import { deviceController } from './deviceController.js';

export const deviceRouter = Router();

deviceRouter.get('/:orgId/devices', authenticate, requireTenant, requirePermission('devices:manage'), deviceController.list);
deviceRouter.post('/:orgId/devices', authenticate, requireTenant, requirePermission('devices:manage'), validateBody(CreateDeviceSchema), deviceController.register);
deviceRouter.get('/:orgId/devices/:deviceId', authenticate, requireTenant, requirePermission('devices:manage'), deviceController.getById);
deviceRouter.put('/:orgId/devices/:deviceId', authenticate, requireTenant, requirePermission('devices:manage'), validateBody(UpdateDeviceSchema), deviceController.update);
deviceRouter.post('/:orgId/devices/:deviceId/rotate-credentials', authenticate, requireTenant, requirePermission('devices:manage'), deviceController.rotateCredentials);