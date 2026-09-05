import { Request, Response, NextFunction } from 'express';
import { organizationService } from './organizationService.js';
import { AppError } from '../../middleware/errorHandler.js';

export const organizationController = {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const org = organizationService.createOrganization({
        ...req.body,
        userId: req.user!.id,
        actor_role: req.userRole,
        ip_address: req.ip,
      });
      res.status(201).json({ success: true, data: org });
    } catch (err) {
      next(err);
    }
  },

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const orgs = organizationService.listOrganizations(req.user!.id, req.user?.is_super_admin);
      res.status(200).json({ success: true, data: orgs });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.params.orgId || req.tenantId!;
      const org = organizationService.getOrganizationById(orgId);
      if (!org) {
        throw new AppError('Organization not found', 404, 'ORGANIZATION_NOT_FOUND');
      }
      res.status(200).json({ success: true, data: org });
    } catch (err) {
      next(err);
    }
  },

  async updateSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const org = organizationService.updateSettings(req.tenantId!, req.body, req.user!.id);
      res.status(200).json({ success: true, data: org });
    } catch (err) {
      next(err);
    }
  },

  async createCustomField(req: Request, res: Response, next: NextFunction) {
    try {
      const field = organizationService.createCustomFieldDefinition({
        ...req.body,
        organization_id: req.tenantId!,
        actor_id: req.user!.id,
      });
      res.status(201).json({ success: true, data: field });
    } catch (err) {
      next(err);
    }
  },

  async listCustomFields(req: Request, res: Response, next: NextFunction) {
    try {
      const entityType = req.query.entity_type as string | undefined;
      const fields = organizationService.listCustomFieldDefinitions(req.tenantId!, entityType);
      res.status(200).json({ success: true, data: fields });
    } catch (err) {
      next(err);
    }
  },
};
