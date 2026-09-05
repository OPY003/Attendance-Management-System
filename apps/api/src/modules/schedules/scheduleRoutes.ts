import { Router } from 'express';
import { scheduleController } from './scheduleController.js';
import { authenticate } from '../../middleware/auth.js';
import { requireTenant } from '../../middleware/tenant.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validateBody } from '../../middleware/validator.js';
import { CreateShiftSchema, CreateScheduleSchema, CreateSessionSchema } from '@uapms/validation';

export const scheduleRouter = Router();

// Shifts
scheduleRouter.get('/:orgId/shifts', authenticate, requireTenant, requirePermission(['shifts:read', 'shifts:manage', 'schedules:read']), scheduleController.listShifts);
scheduleRouter.post('/:orgId/shifts', authenticate, requireTenant, requirePermission(['shifts:write', 'shifts:manage', 'schedules:write']), validateBody(CreateShiftSchema), scheduleController.createShift);

// Schedules
scheduleRouter.get('/:orgId/schedules', authenticate, requireTenant, requirePermission(['schedules:read', 'schedules:write']), scheduleController.listSchedules);
scheduleRouter.post('/:orgId/schedules', authenticate, requireTenant, requirePermission(['schedules:write']), validateBody(CreateScheduleSchema), scheduleController.createSchedule);

// Sessions
scheduleRouter.get('/:orgId/sessions', authenticate, requireTenant, requirePermission(['sessions:read', 'sessions:manage', 'schedules:read']), scheduleController.listSessions);
scheduleRouter.post('/:orgId/sessions', authenticate, requireTenant, requirePermission(['sessions:write', 'sessions:manage', 'schedules:write']), validateBody(CreateSessionSchema), scheduleController.createSession);
scheduleRouter.post('/:orgId/sessions/:sessionId/start', authenticate, requireTenant, requirePermission(['sessions:write', 'sessions:manage']), scheduleController.startSession);
scheduleRouter.post('/:orgId/sessions/:sessionId/end', authenticate, requireTenant, requirePermission(['sessions:write', 'sessions:manage']), scheduleController.endSession);
