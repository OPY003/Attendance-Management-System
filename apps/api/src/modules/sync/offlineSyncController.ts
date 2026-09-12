import { Request, Response, NextFunction } from 'express';
import { offlineSyncService } from './offlineSyncService.js';

export const offlineSyncController = {
  syncBatch(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.params.organizationId || (req.tenantId as string);
      const actorId = req.user?.id || req.device?.id || 'system';
      const deviceId = req.body.device_id || req.device?.id;

      const result = offlineSyncService.processSyncBatch({
        organization_id: orgId,
        device_id: deviceId,
        events: req.body.events,
        actor_id: actorId,
      });

      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  },
};
