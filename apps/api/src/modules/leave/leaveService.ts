import { LeaveRequest, LeaveType } from '@uapms/shared-types';
import { v4 as uuidv4 } from 'uuid';
import { execute, query, queryOne } from '../../core/database/db.js';
import { AppError } from '../../middleware/errorHandler.js';
import { auditService } from '../audit/auditService.js';

const mapLeaveType = (row: any): LeaveType => ({
  ...row,
  is_paid: Boolean(row.is_paid),
  requires_approval: Boolean(row.requires_approval),
  is_active: Boolean(row.is_active),
});

const mapLeaveRequest = (row: any): LeaveRequest => ({ ...row });

function assertDateRange(startDate: string, endDate: string) {
  if (startDate > endDate) throw new AppError('Start date cannot be after end date', 400, 'INVALID_DATE_RANGE');
}

export const leaveService = {
  listTypes(organizationId: string): LeaveType[] {
    return query<any>('SELECT * FROM leave_types WHERE organization_id = ? AND is_active = 1 ORDER BY name ASC', [organizationId]).map(mapLeaveType);
  },

  createType(params: {
    organization_id: string;
    name: string;
    code: string;
    is_paid: boolean;
    days_allowed_per_year: number;
    requires_approval: boolean;
    actor_id: string;
  }): LeaveType {
    if (queryOne('SELECT id FROM leave_types WHERE organization_id = ? AND code = ?', [params.organization_id, params.code])) {
      throw new AppError(`Leave type code "${params.code}" already exists in this organization`, 409, 'LEAVE_TYPE_CODE_EXISTS');
    }
    const id = uuidv4();
    execute(
      `INSERT INTO leave_types (id, organization_id, name, code, is_paid, days_allowed_per_year, requires_approval)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, params.organization_id, params.name, params.code, params.is_paid ? 1 : 0, params.days_allowed_per_year, params.requires_approval ? 1 : 0]
    );
    auditService.log({ organization_id: params.organization_id, actor_id: params.actor_id, action: 'LEAVE_TYPE_CREATED', entity_type: 'LEAVE_TYPE', entity_id: id });
    return mapLeaveType(queryOne<any>('SELECT * FROM leave_types WHERE id = ?', [id]));
  },

  listRequests(organizationId: string, status?: string): LeaveRequest[] {
    let sql = 'SELECT * FROM leave_requests WHERE organization_id = ?';
    const params: any[] = [organizationId];
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    sql += ' ORDER BY start_date DESC, created_at DESC';
    return query<any>(sql, params).map(mapLeaveRequest);
  },

  createRequest(params: {
    organization_id: string;
    person_id: string;
    leave_type_id: string;
    start_date: string;
    end_date: string;
    reason: string;
    actor_id: string;
  }): LeaveRequest {
    assertDateRange(params.start_date, params.end_date);
    if (!queryOne('SELECT id FROM persons WHERE id = ? AND organization_id = ?', [params.person_id, params.organization_id])) {
      throw new AppError('Person not found', 404, 'PERSON_NOT_FOUND');
    }
    const leaveType = queryOne<any>('SELECT * FROM leave_types WHERE id = ? AND organization_id = ? AND is_active = 1', [params.leave_type_id, params.organization_id]);
    if (!leaveType) throw new AppError('Leave type not found', 404, 'LEAVE_TYPE_NOT_FOUND');

    const id = uuidv4();
    const now = new Date().toISOString();
    const status = leaveType.requires_approval ? 'PENDING' : 'APPROVED';
    execute(
      `INSERT INTO leave_requests (id, organization_id, person_id, leave_type_id, start_date, end_date, reason, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, params.organization_id, params.person_id, params.leave_type_id, params.start_date, params.end_date, params.reason, status, now, now]
    );
    auditService.log({ organization_id: params.organization_id, actor_id: params.actor_id, action: 'LEAVE_REQUEST_CREATED', entity_type: 'LEAVE_REQUEST', entity_id: id, new_state: { status } });
    return mapLeaveRequest(queryOne<any>('SELECT * FROM leave_requests WHERE id = ?', [id]));
  },

  reviewRequest(organizationId: string, requestId: string, status: 'APPROVED' | 'REJECTED', comments: string | undefined, reviewerId: string): LeaveRequest {
    const current = queryOne<any>('SELECT * FROM leave_requests WHERE id = ? AND organization_id = ?', [requestId, organizationId]);
    if (!current) throw new AppError('Leave request not found', 404, 'LEAVE_REQUEST_NOT_FOUND');
    if (current.status !== 'PENDING') throw new AppError('Only pending leave requests can be reviewed', 409, 'LEAVE_REQUEST_ALREADY_REVIEWED');
    const now = new Date().toISOString();
    execute('UPDATE leave_requests SET status = ?, reviewer_id = ?, reviewed_at = ?, reviewer_comments = ?, updated_at = ? WHERE id = ? AND organization_id = ?', [status, reviewerId, now, comments || null, now, requestId, organizationId]);
    auditService.log({ organization_id: organizationId, actor_id: reviewerId, action: status === 'APPROVED' ? 'LEAVE_REQUEST_APPROVED' : 'LEAVE_REQUEST_REJECTED', entity_type: 'LEAVE_REQUEST', entity_id: requestId, previous_state: { status: current.status }, new_state: { status, comments } });
    return mapLeaveRequest(queryOne<any>('SELECT * FROM leave_requests WHERE id = ?', [requestId]));
  },
};