import { CreateLeaveRequestSchema, CreateLeaveTypeSchema, ReviewLeaveRequestSchema } from '@uapms/validation';
import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { requireTenant } from '../../middleware/tenant.js';
import { validateBody } from '../../middleware/validator.js';
import { leaveController } from './leaveController.js';

export const leaveRouter = Router();

leaveRouter.get('/:orgId/leave/types', authenticate, requireTenant, requirePermission(['leave:request', 'leave:review']), leaveController.listTypes);
leaveRouter.post('/:orgId/leave/types', authenticate, requireTenant, requirePermission('leave:review'), validateBody(CreateLeaveTypeSchema), leaveController.createType);
leaveRouter.get('/:orgId/leave/requests', authenticate, requireTenant, requirePermission(['leave:request', 'leave:review']), leaveController.listRequests);
leaveRouter.post('/:orgId/leave/requests', authenticate, requireTenant, requirePermission('leave:request'), validateBody(CreateLeaveRequestSchema), leaveController.createRequest);
leaveRouter.put('/:orgId/leave/requests/:requestId/review', authenticate, requireTenant, requirePermission('leave:review'), validateBody(ReviewLeaveRequestSchema), leaveController.reviewRequest);