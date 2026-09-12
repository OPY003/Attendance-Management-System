import { Request, Response, NextFunction } from 'express';
import { visitorService } from './visitorService.js';
import { AppError } from '../../middleware/errorHandler.js';

export const visitorController = {
  list(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.params.organizationId || (req.tenantId as string);
      const status = req.query.status as any;
      const hostPersonId = req.query.host_person_id as string | undefined;

      const visitors = visitorService.listVisitors(orgId, {
        status,
        host_person_id: hostPersonId,
      });

      res.status(200).json({ data: visitors });
    } catch (err) {
      next(err);
    }
  },

  getById(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.params.organizationId || (req.tenantId as string);
      const visitor = visitorService.getVisitorById(orgId, req.params.id);
      if (!visitor) {
        throw new AppError('Visitor pass not found', 404, 'VISITOR_NOT_FOUND');
      }

      res.status(200).json({ data: visitor });
    } catch (err) {
      next(err);
    }
  },

  create(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.params.organizationId || (req.tenantId as string);
      const actorId = req.user?.id || 'system';

      const pass = visitorService.createVisitorPass({
        organization_id: orgId,
        ...req.body,
        actor_id: actorId,
      });

      res.status(201).json({ data: pass });
    } catch (err) {
      next(err);
    }
  },

  checkIn(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.params.organizationId || (req.tenantId as string);
      const actorId = req.user?.id || req.device?.id || 'system';

      const pass = visitorService.checkInVisitor({
        organization_id: orgId,
        visitor_id: req.params.id,
        location_id: req.body.location_id,
        pass_code: req.body.pass_code,
        timestamp: req.body.timestamp,
        actor_id: actorId,
      });

      res.status(200).json({ data: pass });
    } catch (err) {
      next(err);
    }
  },

  checkOut(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.params.organizationId || (req.tenantId as string);
      const actorId = req.user?.id || req.device?.id || 'system';

      const pass = visitorService.checkOutVisitor({
        organization_id: orgId,
        visitor_id: req.params.id,
        timestamp: req.body.timestamp,
        actor_id: actorId,
      });

      res.status(200).json({ data: pass });
    } catch (err) {
      next(err);
    }
  },

  cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.params.organizationId || (req.tenantId as string);
      const actorId = req.user?.id || 'system';

      const pass = visitorService.cancelVisitorPass(orgId, req.params.id, actorId);
      res.status(200).json({ data: pass });
    } catch (err) {
      next(err);
    }
  },
};
