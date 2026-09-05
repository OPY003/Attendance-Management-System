import { Request, Response, NextFunction } from 'express';
import { personService } from './personService.js';
import { AppError } from '../../middleware/errorHandler.js';

export const personController = {
  list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = personService.listPersons({
        organization_id: req.tenantId!,
        search: req.query.search as string,
        department_id: req.query.department_id as string,
        location_id: req.query.location_id as string,
        status: req.query.status as string,
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
      });
      res.status(200).json({ success: true, data: result.items, metadata: result.pagination });
    } catch (err) {
      next(err);
    }
  },

  getById(req: Request, res: Response, next: NextFunction) {
    try {
      const person = personService.getPersonById(req.tenantId!, req.params.personId);
      if (!person) {
        throw new AppError('Person not found', 404, 'PERSON_NOT_FOUND');
      }
      res.status(200).json({ success: true, data: person });
    } catch (err) {
      next(err);
    }
  },

  create(req: Request, res: Response, next: NextFunction) {
    try {
      const person = personService.createPerson({
        ...req.body,
        organization_id: req.tenantId!,
        actor_id: req.user!.id,
      });
      res.status(201).json({ success: true, data: person });
    } catch (err) {
      next(err);
    }
  },

  update(req: Request, res: Response, next: NextFunction) {
    try {
      const person = personService.updatePerson(req.tenantId!, req.params.personId, req.body, req.user!.id);
      res.status(200).json({ success: true, data: person });
    } catch (err) {
      next(err);
    }
  },

  assignRole(req: Request, res: Response, next: NextFunction) {
    try {
      const person = personService.assignRole(req.tenantId!, req.body.person_id, req.body.role_id, req.user!.id);
      res.status(200).json({ success: true, data: person });
    } catch (err) {
      next(err);
    }
  },

  setCustomField(req: Request, res: Response, next: NextFunction) {
    try {
      const result = personService.setCustomFieldValue(
        req.tenantId!,
        req.params.personId,
        req.body.field_key,
        req.body.value,
        req.user!.id
      );
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
};
