import { Request, Response, NextFunction } from 'express';
import { Device } from '@uapms/shared-types';
import { deviceService } from '../modules/devices/deviceService.js';
import { authenticate } from './auth.js';
import { AppError } from './errorHandler.js';

declare global {
  namespace Express {
    interface Request {
      device?: Device;
    }
  }
}

export function authenticateDevice(req: Request, _res: Response, next: NextFunction): void {
  const deviceId = (req.headers['x-device-id'] || req.body?.device_id) as string;
  const apiKey = (req.headers['x-device-key'] || req.headers['x-api-key']) as string;
  const apiSecret = req.headers['x-device-secret'] as string | undefined;
  const orgId = (req.tenantId || req.params.orgId || req.params.organizationId || req.headers['x-organization-id']) as string;

  if (!deviceId || !apiKey) {
    return next(
      new AppError(
        'Missing device authentication credentials (x-device-id and x-device-key)',
        401,
        'DEVICE_UNAUTHORIZED'
      )
    );
  }

  try {
    const device = deviceService.verifyDeviceCredentials({
      organization_id: orgId,
      device_id: deviceId,
      api_key: apiKey,
      api_secret: apiSecret,
    });
    req.device = device;
    next();
  } catch (err) {
    next(err);
  }
}

export function authenticateDeviceOrUser(req: Request, res: Response, next: NextFunction): void {
  if (req.user) {
    return next();
  }

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    return authenticate(req, res, next);
  }

  const deviceId = (req.headers['x-device-id'] || req.body?.device_id) as string;
  const apiKey = (req.headers['x-device-key'] || req.headers['x-api-key']) as string;
  if (deviceId && apiKey) {
    return authenticateDevice(req, res, next);
  }

  return next(new AppError('Authentication required (Bearer token or device credentials)', 401, 'UNAUTHORIZED'));
}
