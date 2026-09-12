import { NextFunction, Request, Response } from 'express';
import { leaveService } from './leaveService.js';

export const leaveController = {
  listTypes(req: Request, res: Response, next: NextFunction) {
    try { res.status(200).json({ success: true, data: leaveService.listTypes(req.tenantId!) }); } catch (err) { next(err); }
  },
  createType(req: Request, res: Response, next: NextFunction) {
    try { res.status(201).json({ success: true, data: leaveService.createType({ ...req.body, organization_id: req.tenantId!, actor_id: req.user!.id }) }); } catch (err) { next(err); }
  },
  listRequests(req: Request, res: Response, next: NextFunction) {
    try { res.status(200).json({ success: true, data: leaveService.listRequests(req.tenantId!, req.query.status as string | undefined) }); } catch (err) { next(err); }
  },
  createRequest(req: Request, res: Response, next: NextFunction) {
    try { res.status(201).json({ success: true, data: leaveService.createRequest({ ...req.body, organization_id: req.tenantId!, actor_id: req.user!.id }) }); } catch (err) { next(err); }
  },
  reviewRequest(req: Request, res: Response, next: NextFunction) {
    try { res.status(200).json({ success: true, data: leaveService.reviewRequest(req.tenantId!, req.params.requestId, req.body.status, req.body.comments, req.user!.id) }); } catch (err) { next(err); }
  },
};