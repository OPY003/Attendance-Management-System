import { Request, Response, NextFunction } from 'express';
import { groupService } from './groupService.js';

export const groupController = {
  listDepartments(req: Request, res: Response, next: NextFunction) {
    try {
      const depts = groupService.listDepartments(req.tenantId!);
      res.status(200).json({ success: true, data: depts });
    } catch (err) {
      next(err);
    }
  },

  createDepartment(req: Request, res: Response, next: NextFunction) {
    try {
      const dept = groupService.createDepartment({
        ...req.body,
        organization_id: req.tenantId!,
        actor_id: req.user!.id,
      });
      res.status(201).json({ success: true, data: dept });
    } catch (err) {
      next(err);
    }
  },

  listGroups(req: Request, res: Response, next: NextFunction) {
    try {
      const departmentId = req.query.department_id as string | undefined;
      const groups = groupService.listGroups(req.tenantId!, departmentId);
      res.status(200).json({ success: true, data: groups });
    } catch (err) {
      next(err);
    }
  },

  createGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const group = groupService.createGroup({
        ...req.body,
        organization_id: req.tenantId!,
        actor_id: req.user!.id,
      });
      res.status(201).json({ success: true, data: group });
    } catch (err) {
      next(err);
    }
  },

  enrollMembers(req: Request, res: Response, next: NextFunction) {
    try {
      const result = groupService.enrollMembers({
        ...req.body,
        group_id: req.params.groupId,
        organization_id: req.tenantId!,
        actor_id: req.user!.id,
      });
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  listMembers(req: Request, res: Response, next: NextFunction) {
    try {
      const members = groupService.listGroupMembers(req.tenantId!, req.params.groupId);
      res.status(200).json({ success: true, data: members });
    } catch (err) {
      next(err);
    }
  },
};
