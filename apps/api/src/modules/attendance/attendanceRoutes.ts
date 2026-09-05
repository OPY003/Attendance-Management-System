import { Router } from 'express';
import { attendanceController } from './attendanceController.js';
import { authenticate } from '../../middleware/auth.js';
import { requireTenant } from '../../middleware/tenant.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validateBody } from '../../middleware/validator.js';
import { SubmitDetectionSchema } from '@uapms/validation';

export const attendanceRouter = Router();

// Detection event submission (check-in / check-out from any adapter)
attendanceRouter.post(
  '/:orgId/attendance/detect',
  authenticate,
  requireTenant,
  requirePermission(['attendance:submit', 'attendance:write']),
  validateBody(SubmitDetectionSchema),
  attendanceController.submitDetection
);

// Attendance records listing with filters
attendanceRouter.get(
  '/:orgId/attendance/records',
  authenticate,
  requireTenant,
  requirePermission('attendance:read'),
  attendanceController.listRecords
);

// Admin correction of attendance record
attendanceRouter.put(
  '/:orgId/attendance/records/:recordId/correct',
  authenticate,
  requireTenant,
  requirePermission('attendance:correct'),
  attendanceController.correctRecord
);
