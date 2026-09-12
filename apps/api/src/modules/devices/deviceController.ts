import { NextFunction, Request, Response } from 'express';
import { AppError } from '../../middleware/errorHandler.js';
import { deviceService } from './deviceService.js';

export const deviceController = {
  list(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(200).json({ success: true, data: deviceService.listDevices(req.tenantId!, req.query.status as string | undefined) });
    } catch (err) {
      next(err);
    }
  },

  getById(req: Request, res: Response, next: NextFunction) {
    try {
      const device = deviceService.getDeviceById(req.tenantId!, req.params.deviceId);
      if (!device) throw new AppError('Device not found', 404, 'DEVICE_NOT_FOUND');
      res.status(200).json({ success: true, data: device });
    } catch (err) {
      next(err);
    }
  },

  register(req: Request, res: Response, next: NextFunction) {
    try {
      const result = deviceService.registerDevice({ ...req.body, organization_id: req.tenantId!, actor_id: req.user!.id });
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  update(req: Request, res: Response, next: NextFunction) {
    try {
      const device = deviceService.updateDevice(req.tenantId!, req.params.deviceId, req.body, req.user!.id);
      res.status(200).json({ success: true, data: device });
    } catch (err) {
      next(err);
    }
  },

  rotateCredentials(req: Request, res: Response, next: NextFunction) {
    try {
      const result = deviceService.rotateCredentials(req.tenantId!, req.params.deviceId, req.user!.id);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
};