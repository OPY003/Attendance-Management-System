import { Request, Response, NextFunction } from 'express';
import { roleService } from './roleService.js';

export const roleController = {
  listPermissions(_req: Request, res: Response, next: NextFunction) {
    try {
      const perms = roleService.listPermissions();
      res.status(200).json({ success: true, data: perms });
    } catch (err) {
      next(err);
    }
  },

  listRoles(req: Request, res: Response, next: NextFunction) {
    try {
      const roles = roleService.listRoles(req.tenantId);
      res.status(200).json({ success: true, data: roles });
    } catch (err) {
      next(err);
    }
  },

  createRole(req: Request, res: Response, next: NextFunction) {
    try {
      const role = roleService.createRole({
        ...req.body,
        organization_id: req.tenantId!,
        actor_id: req.user!.id,
      });
      res.status(201).json({ success: true, data: role });
    } catch (err) {
      next(err);
    }
  },
};
