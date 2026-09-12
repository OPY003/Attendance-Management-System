import { VisitorPass, VisitorPassStatus } from '@uapms/shared-types';
import { randomBytes, createHmac } from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import { execute, query, queryOne } from '../../core/database/db.js';
import { AppError } from '../../middleware/errorHandler.js';
import { auditService } from '../audit/auditService.js';
import { config } from '../../config/index.js';

function mapVisitorPass(row: any): VisitorPass {
  return {
    ...row,
    allowed_location_ids: row.allowed_location_ids ? JSON.parse(row.allowed_location_ids) : [],
  };
}

function generateDynamicQrToken(passId: string, passCode: string, validUntil: string): string {
  const payload = `${passId}:${passCode}:${validUntil}`;
  const hmac = createHmac('sha256', config.jwt.secret).update(payload).digest('hex');
  return `vqr_${Buffer.from(`${payload}:${hmac.slice(0, 16)}`).toString('base64url')}`;
}

export const visitorService = {
  listVisitors(organizationId: string, filters?: { status?: VisitorPassStatus; host_person_id?: string }): VisitorPass[] {
    let sql = 'SELECT * FROM visitors WHERE organization_id = ?';
    const params: any[] = [organizationId];

    if (filters?.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters?.host_person_id) {
      sql += ' AND host_person_id = ?';
      params.push(filters.host_person_id);
    }

    sql += ' ORDER BY created_at DESC';
    return query<any>(sql, params).map(mapVisitorPass);
  },

  getVisitorById(organizationId: string, visitorId: string): VisitorPass | undefined {
    const row = queryOne<any>('SELECT * FROM visitors WHERE id = ? AND organization_id = ?', [visitorId, organizationId]);
    return row ? mapVisitorPass(row) : undefined;
  },

  createVisitorPass(params: {
    organization_id: string;
    visitor_name: string;
    visitor_email?: string;
    visitor_phone?: string;
    host_person_id: string;
    purpose: string;
    allowed_location_ids: string[];
    valid_from: string;
    valid_until: string;
    actor_id: string;
  }): VisitorPass {
    const host = queryOne('SELECT id FROM persons WHERE id = ? AND organization_id = ?', [
      params.host_person_id,
      params.organization_id,
    ]);
    if (!host) {
      throw new AppError('Host person not found in this organization', 404, 'HOST_NOT_FOUND');
    }

    const fromDate = new Date(params.valid_from);
    const untilDate = new Date(params.valid_until);
    if (isNaN(fromDate.getTime()) || isNaN(untilDate.getTime()) || untilDate <= fromDate) {
      throw new AppError('Invalid time window: valid_until must be strictly after valid_from', 400, 'INVALID_TIME_RANGE');
    }

    // Validate allowed location IDs if specified
    if (params.allowed_location_ids && params.allowed_location_ids.length > 0) {
      for (const locId of params.allowed_location_ids) {
        const loc = queryOne('SELECT id FROM locations WHERE id = ? AND organization_id = ?', [locId, params.organization_id]);
        if (!loc) {
          throw new AppError(`Location ${locId} not found in this organization`, 404, 'LOCATION_NOT_FOUND');
        }
      }
    }

    const id = uuidv4();
    const passCode = `VP-${randomBytes(4).toString('hex').toUpperCase()}`;
    const dynamicQr = generateDynamicQrToken(id, passCode, params.valid_until);
    const now = new Date().toISOString();

    execute(
      `INSERT INTO visitors (
        id, organization_id, visitor_name, visitor_email, visitor_phone,
        host_person_id, purpose, allowed_location_ids, valid_from, valid_until,
        pass_code, dynamic_qr_token, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PRE_REGISTERED', ?)`,
      [
        id,
        params.organization_id,
        params.visitor_name,
        params.visitor_email || null,
        params.visitor_phone || null,
        params.host_person_id,
        params.purpose,
        JSON.stringify(params.allowed_location_ids || []),
        params.valid_from,
        params.valid_until,
        passCode,
        dynamicQr,
        now,
      ]
    );

    auditService.log({
      organization_id: params.organization_id,
      actor_id: params.actor_id,
      action: 'VISITOR_PASS_CREATED',
      entity_type: 'VISITOR',
      entity_id: id,
      new_state: { visitor_name: params.visitor_name, host_person_id: params.host_person_id, pass_code: passCode },
    });

    return this.getVisitorById(params.organization_id, id)!;
  },

  checkInVisitor(params: {
    organization_id: string;
    visitor_id: string;
    location_id?: string;
    pass_code?: string;
    timestamp?: string;
    actor_id: string;
  }): VisitorPass {
    const visitor = this.getVisitorById(params.organization_id, params.visitor_id);
    if (!visitor) {
      throw new AppError('Visitor pass not found', 404, 'VISITOR_NOT_FOUND');
    }

    if (visitor.status === 'CHECKED_IN') {
      throw new AppError('Visitor is already checked in', 400, 'VISITOR_ALREADY_CHECKED_IN');
    }
    if (visitor.status === 'CHECKED_OUT') {
      throw new AppError('Visitor has already completed their visit', 400, 'VISITOR_ALREADY_CHECKED_OUT');
    }
    if (visitor.status === 'CANCELLED') {
      throw new AppError('Visitor pass has been cancelled', 400, 'VISITOR_PASS_CANCELLED');
    }

    const checkInTime = params.timestamp ? new Date(params.timestamp) : new Date();
    const validFrom = new Date(visitor.valid_from);
    const validUntil = new Date(visitor.valid_until);

    if (checkInTime < validFrom) {
      throw new AppError('Visitor pass is not active yet', 400, 'PASS_NOT_ACTIVE_YET');
    }
    if (checkInTime > validUntil) {
      execute('UPDATE visitors SET status = ? WHERE id = ?', ['EXPIRED', visitor.id]);
      throw new AppError('Visitor pass has expired', 400, 'PASS_EXPIRED');
    }

    if (params.pass_code && params.pass_code !== visitor.pass_code) {
      throw new AppError('Invalid visitor pass code', 400, 'INVALID_PASS_CODE');
    }

    if (params.location_id && visitor.allowed_location_ids.length > 0) {
      if (!visitor.allowed_location_ids.includes(params.location_id)) {
        throw new AppError('Visitor is not authorized for this location', 403, 'LOCATION_NOT_ALLOWED');
      }
    }

    const checkInIso = checkInTime.toISOString();
    execute('UPDATE visitors SET status = ?, check_in_time = ? WHERE id = ? AND organization_id = ?', [
      'CHECKED_IN',
      checkInIso,
      visitor.id,
      params.organization_id,
    ]);

    auditService.log({
      organization_id: params.organization_id,
      actor_id: params.actor_id,
      action: 'VISITOR_CHECKED_IN',
      entity_type: 'VISITOR',
      entity_id: visitor.id,
      new_state: { status: 'CHECKED_IN', check_in_time: checkInIso, location_id: params.location_id },
    });

    return this.getVisitorById(params.organization_id, visitor.id)!;
  },

  checkOutVisitor(params: {
    organization_id: string;
    visitor_id: string;
    timestamp?: string;
    actor_id: string;
  }): VisitorPass {
    const visitor = this.getVisitorById(params.organization_id, params.visitor_id);
    if (!visitor) {
      throw new AppError('Visitor pass not found', 404, 'VISITOR_NOT_FOUND');
    }

    if (visitor.status !== 'CHECKED_IN') {
      throw new AppError('Visitor is not currently checked in', 400, 'VISITOR_NOT_CHECKED_IN');
    }

    const checkOutIso = (params.timestamp ? new Date(params.timestamp) : new Date()).toISOString();
    execute('UPDATE visitors SET status = ?, check_out_time = ? WHERE id = ? AND organization_id = ?', [
      'CHECKED_OUT',
      checkOutIso,
      visitor.id,
      params.organization_id,
    ]);

    auditService.log({
      organization_id: params.organization_id,
      actor_id: params.actor_id,
      action: 'VISITOR_CHECKED_OUT',
      entity_type: 'VISITOR',
      entity_id: visitor.id,
      new_state: { status: 'CHECKED_OUT', check_out_time: checkOutIso },
    });

    return this.getVisitorById(params.organization_id, visitor.id)!;
  },

  cancelVisitorPass(organizationId: string, visitorId: string, actorId: string): VisitorPass {
    const visitor = this.getVisitorById(organizationId, visitorId);
    if (!visitor) {
      throw new AppError('Visitor pass not found', 404, 'VISITOR_NOT_FOUND');
    }

    if (visitor.status !== 'PRE_REGISTERED') {
      throw new AppError(`Cannot cancel visitor pass in status "${visitor.status}"`, 400, 'CANNOT_CANCEL_PASS');
    }

    execute('UPDATE visitors SET status = ? WHERE id = ? AND organization_id = ?', ['CANCELLED', visitor.id, organizationId]);

    auditService.log({
      organization_id: organizationId,
      actor_id: actorId,
      action: 'VISITOR_PASS_CANCELLED',
      entity_type: 'VISITOR',
      entity_id: visitor.id,
    });

    return this.getVisitorById(organizationId, visitor.id)!;
  },
};
