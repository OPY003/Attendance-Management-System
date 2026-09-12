import { Router } from 'express';
import { CreateVisitorPassSchema, VisitorCheckInSchema, VisitorCheckOutSchema } from '@uapms/validation';
import { authenticate } from '../../middleware/auth.js';
import { authenticateDeviceOrUser } from '../../middleware/deviceAuth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { requireTenant } from '../../middleware/tenant.js';
import { validateBody } from '../../middleware/validator.js';
import { visitorController } from './visitorController.js';

export const visitorRouter = Router();

visitorRouter.get(
  '/:orgId/visitors',
  authenticate,
  requireTenant,
  requirePermission(['visitors:read', 'visitors:manage']),
  visitorController.list
);

visitorRouter.get(
  '/:orgId/visitors/:id',
  authenticate,
  requireTenant,
  requirePermission(['visitors:read', 'visitors:manage']),
  visitorController.getById
);

visitorRouter.post(
  '/:orgId/visitors',
  authenticate,
  requireTenant,
  requirePermission('visitors:manage'),
  validateBody(CreateVisitorPassSchema),
  visitorController.create
);

visitorRouter.post(
  '/:orgId/visitors/:id/check-in',
  authenticateDeviceOrUser,
  requireTenant,
  validateBody(VisitorCheckInSchema),
  visitorController.checkIn
);

visitorRouter.post(
  '/:orgId/visitors/:id/check-out',
  authenticateDeviceOrUser,
  requireTenant,
  validateBody(VisitorCheckOutSchema),
  visitorController.checkOut
);

visitorRouter.post(
  '/:orgId/visitors/:id/cancel',
  authenticate,
  requireTenant,
  requirePermission('visitors:manage'),
  visitorController.cancel
);
