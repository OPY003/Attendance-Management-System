import { Request, Response, NextFunction } from 'express';
import { locationService } from './locationService.js';
import { AppError } from '../../middleware/errorHandler.js';

export const locationController = {
  list(req: Request, res: Response, next: NextFunction) {
    try {
      const parentId = req.query.parent_id as string | undefined;
      const locations = locationService.listLocations(req.tenantId!, parentId);
      res.status(200).json({ success: true, data: locations });
    } catch (err) {
      next(err);
    }
  },

  getById(req: Request, res: Response, next: NextFunction) {
    try {
      const loc = locationService.getLocationById(req.tenantId!, req.params.locationId);
      if (!loc) throw new AppError('Location not found', 404, 'LOCATION_NOT_FOUND');
      res.status(200).json({ success: true, data: loc });
    } catch (err) {
      next(err);
    }
  },

  create(req: Request, res: Response, next: NextFunction) {
    try {
      const loc = locationService.createLocation({
        ...req.body,
        organization_id: req.tenantId!,
        actor_id: req.user!.id,
      });
      res.status(201).json({ success: true, data: loc });
    } catch (err) {
      next(err);
    }
  },

  update(req: Request, res: Response, next: NextFunction) {
    try {
      const loc = locationService.updateLocation(req.tenantId!, req.params.locationId, req.body, req.user!.id);
      res.status(200).json({ success: true, data: loc });
    } catch (err) {
      next(err);
    }
  },
};
