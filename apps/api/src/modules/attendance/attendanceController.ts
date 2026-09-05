import { Request, Response, NextFunction } from 'express';
import { attendanceService } from './attendanceService.js';

export const attendanceController = {
  submitDetection(req: Request, res: Response, next: NextFunction) {
    try {
      const result = attendanceService.submitDetection({
        ...req.body,
        organization_id: req.tenantId!,
        actor_id: req.user!.id,
      });
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  listRecords(req: Request, res: Response, next: NextFunction) {
    try {
      const result = attendanceService.listRecords({
        organization_id: req.tenantId!,
        person_id: req.query.person_id as string,
        session_id: req.query.session_id as string,
        date_from: req.query.date_from as string,
        date_to: req.query.date_to as string,
        status: req.query.status as string,
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
      });
      res.status(200).json({ success: true, data: result.items, metadata: result.pagination });
    } catch (err) {
      next(err);
    }
  },

  correctRecord(req: Request, res: Response, next: NextFunction) {
    try {
      const record = attendanceService.correctRecord({
        organization_id: req.tenantId!,
        record_id: req.params.recordId,
        corrected_status: req.body.corrected_status,
        reason: req.body.reason,
        actor_id: req.user!.id,
      });
      res.status(200).json({ success: true, data: record });
    } catch (err) {
      next(err);
    }
  },
};
