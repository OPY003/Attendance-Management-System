import { Router } from 'express';
import { OfflineSyncBatchSchema } from '@uapms/validation';
import { authenticateDeviceOrUser } from '../../middleware/deviceAuth.js';
import { requireTenant } from '../../middleware/tenant.js';
import { validateBody } from '../../middleware/validator.js';
import { offlineSyncController } from './offlineSyncController.js';

export const offlineSyncRouter = Router();

offlineSyncRouter.post(
  '/:orgId/sync/offline-events',
  authenticateDeviceOrUser,
  requireTenant,
  validateBody(OfflineSyncBatchSchema),
  offlineSyncController.syncBatch
);
