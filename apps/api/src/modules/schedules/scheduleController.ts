import { Request, Response, NextFunction } from 'express';
import { scheduleService } from './scheduleService.js';
import { AppError } from '../../middleware/errorHandler.js';

export const scheduleController = {
  // --- Shifts ---
  listShifts(req: Request, res: Response, next: NextFunction) {
    try {
      const shifts = scheduleService.listShifts(req.tenantId!);
      res.status(200).json({ success: true, data: shifts });
    } catch (err) {
      next(err);
    }
  },

  createShift(req: Request, res: Response, next: NextFunction) {
    try {
      const shift = scheduleService.createShift({
        ...req.body,
        organization_id: req.tenantId!,
        actor_id: req.user!.id,
      });
      res.status(201).json({ success: true, data: shift });
    } catch (err) {
      next(err);
    }
  },

  // --- Schedules ---
  listSchedules(req: Request, res: Response, next: NextFunction) {
    try {
      const schedules = scheduleService.listSchedules(req.tenantId!);
      res.status(200).json({ success: true, data: schedules });
    } catch (err) {
      next(err);
    }
  },

  createSchedule(req: Request, res: Response, next: NextFunction) {
    try {
      const schedule = scheduleService.createSchedule({
        ...req.body,
        organization_id: req.tenantId!,
        actor_id: req.user!.id,
      });
      res.status(201).json({ success: true, data: schedule });
    } catch (err) {
      next(err);
    }
  },

  // --- Sessions ---
  listSessions(req: Request, res: Response, next: NextFunction) {
    try {
      const status = req.query.status as string | undefined;
      const sessions = scheduleService.listSessions(req.tenantId!, status);
      res.status(200).json({ success: true, data: sessions });
    } catch (err) {
      next(err);
    }
  },

  createSession(req: Request, res: Response, next: NextFunction) {
    try {
      const session = scheduleService.createSession({
        ...req.body,
        organization_id: req.tenantId!,
        actor_id: req.user!.id,
      });
      res.status(201).json({ success: true, data: session });
    } catch (err) {
      next(err);
    }
  },

  startSession(req: Request, res: Response, next: NextFunction) {
    try {
      const session = scheduleService.startSession(req.tenantId!, req.params.sessionId, req.user!.id);
      res.status(200).json({ success: true, data: session });
    } catch (err) {
      next(err);
    }
  },

  endSession(req: Request, res: Response, next: NextFunction) {
    try {
      const session = scheduleService.endSession(req.tenantId!, req.params.sessionId, req.user!.id);
      res.status(200).json({ success: true, data: session });
    } catch (err) {
      next(err);
    }
  },
};
