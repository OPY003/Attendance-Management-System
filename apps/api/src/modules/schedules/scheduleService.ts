import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, execute, transaction } from '../../core/database/db.js';
import { AppError } from '../../middleware/errorHandler.js';
import { auditService } from '../audit/auditService.js';
import { Shift, Schedule, AttendanceSession, ScheduleType } from '@uapms/shared-types';

export const scheduleService = {
  // ==========================================
  // SHIFTS
  // ==========================================

  listShifts(organizationId: string): Shift[] {
    const rows = query<any>('SELECT * FROM shifts WHERE organization_id = ? ORDER BY name ASC', [organizationId]);
    return rows.map((r) => ({
      id: r.id,
      organization_id: r.organization_id,
      name: r.name,
      code: r.code,
      start_time: r.start_time,
      end_time: r.end_time,
      crosses_midnight: Boolean(r.crosses_midnight),
      grace_period_minutes: r.grace_period_minutes,
      late_threshold_minutes: r.late_threshold_minutes,
      early_leave_threshold_minutes: r.early_leave_threshold_minutes,
      min_working_minutes: r.min_working_minutes,
      break_duration_minutes: r.break_duration_minutes,
      is_active: Boolean(r.is_active),
      created_at: r.created_at,
    }));
  },

  createShift(params: {
    organization_id: string;
    name: string;
    code: string;
    start_time: string;
    end_time: string;
    crosses_midnight?: boolean;
    grace_period_minutes?: number;
    late_threshold_minutes?: number;
    early_leave_threshold_minutes?: number;
    min_working_minutes?: number;
    break_duration_minutes?: number;
    actor_id: string;
  }): Shift {
    const existing = queryOne('SELECT id FROM shifts WHERE organization_id = ? AND code = ?', [
      params.organization_id,
      params.code,
    ]);
    if (existing) {
      throw new AppError(`Shift code "${params.code}" already exists in this organization`, 409, 'SHIFT_CODE_EXISTS');
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    // Auto-detect midnight crossover if start_time > end_time
    let crossesMidnight = params.crosses_midnight;
    if (crossesMidnight === undefined || crossesMidnight === false) {
      if (params.start_time > params.end_time) {
        crossesMidnight = true;
      }
    }

    execute(
      `INSERT INTO shifts (
        id, organization_id, name, code, start_time, end_time, crosses_midnight,
        grace_period_minutes, late_threshold_minutes, early_leave_threshold_minutes,
        min_working_minutes, break_duration_minutes, is_active, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [
        id,
        params.organization_id,
        params.name,
        params.code,
        params.start_time,
        params.end_time,
        crossesMidnight ? 1 : 0,
        params.grace_period_minutes ?? 10,
        params.late_threshold_minutes ?? 30,
        params.early_leave_threshold_minutes ?? 15,
        params.min_working_minutes ?? 480,
        params.break_duration_minutes ?? 60,
        now,
      ]
    );

    auditService.log({
      organization_id: params.organization_id,
      actor_id: params.actor_id,
      action: 'SHIFT_CREATED',
      entity_type: 'SHIFT',
      entity_id: id,
      new_state: { name: params.name, code: params.code, start_time: params.start_time, end_time: params.end_time },
    });

    const created = queryOne<any>('SELECT * FROM shifts WHERE id = ?', [id])!;
    return {
      ...created,
      crosses_midnight: Boolean(created.crosses_midnight),
      is_active: Boolean(created.is_active),
    };
  },

  // ==========================================
  // SCHEDULES
  // ==========================================

  listSchedules(organizationId: string): Schedule[] {
    const rows = query<any>('SELECT * FROM schedules WHERE organization_id = ? ORDER BY name ASC', [organizationId]);
    return rows.map((r) => ({
      id: r.id,
      organization_id: r.organization_id,
      name: r.name,
      schedule_type: r.schedule_type as ScheduleType,
      timezone: r.timezone,
      valid_from: r.valid_from,
      valid_until: r.valid_until,
      days_of_week: JSON.parse(r.days_of_week || '[]'),
      default_shift_id: r.default_shift_id,
      is_active: Boolean(r.is_active),
      created_at: r.created_at,
    }));
  },

  createSchedule(params: {
    organization_id: string;
    name: string;
    schedule_type: string;
    timezone?: string;
    valid_from: string;
    valid_until?: string;
    days_of_week?: number[];
    default_shift_id?: string;
    actor_id: string;
  }): Schedule {
    const id = uuidv4();
    const now = new Date().toISOString();

    execute(
      `INSERT INTO schedules (
        id, organization_id, name, schedule_type, timezone, valid_from, valid_until,
        days_of_week, default_shift_id, is_active, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [
        id,
        params.organization_id,
        params.name,
        params.schedule_type,
        params.timezone || 'UTC',
        params.valid_from,
        params.valid_until || null,
        JSON.stringify(params.days_of_week || [1, 2, 3, 4, 5]),
        params.default_shift_id || null,
        now,
      ]
    );

    auditService.log({
      organization_id: params.organization_id,
      actor_id: params.actor_id,
      action: 'SCHEDULE_CREATED',
      entity_type: 'SCHEDULE',
      entity_id: id,
      new_state: { name: params.name, type: params.schedule_type },
    });

    return queryOne<any>('SELECT * FROM schedules WHERE id = ?', [id])!;
  },

  // ==========================================
  // SESSIONS
  // ==========================================

  listSessions(organizationId: string, status?: string): AttendanceSession[] {
    let sql = 'SELECT * FROM attendance_sessions WHERE organization_id = ?';
    const params: any[] = [organizationId];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    sql += ' ORDER BY start_time DESC';

    const rows = query<any>(sql, params);
    return rows.map((r) => ({
      id: r.id,
      organization_id: r.organization_id,
      location_id: r.location_id,
      group_id: r.group_id,
      schedule_id: r.schedule_id,
      shift_id: r.shift_id,
      host_person_id: r.host_person_id,
      name: r.name,
      session_type: r.session_type,
      start_time: r.start_time,
      end_time: r.end_time,
      status: r.status,
      policy_id: r.policy_id,
      current_dynamic_qr: r.current_dynamic_qr,
      qr_expires_at: r.qr_expires_at,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));
  },

  createSession(params: {
    organization_id: string;
    location_id?: string;
    group_id?: string;
    schedule_id?: string;
    shift_id?: string;
    host_person_id?: string;
    name: string;
    session_type: string;
    start_time: string;
    end_time: string;
    policy_id?: string;
    actor_id: string;
  }): AttendanceSession {
    const id = uuidv4();
    const now = new Date().toISOString();

    execute(
      `INSERT INTO attendance_sessions (
        id, organization_id, location_id, group_id, schedule_id, shift_id, host_person_id,
        name, session_type, start_time, end_time, status, policy_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SCHEDULED', ?, ?, ?)`,
      [
        id,
        params.organization_id,
        params.location_id || null,
        params.group_id || null,
        params.schedule_id || null,
        params.shift_id || null,
        params.host_person_id || null,
        params.name,
        params.session_type,
        params.start_time,
        params.end_time,
        params.policy_id || null,
        now,
        now,
      ]
    );

    auditService.log({
      organization_id: params.organization_id,
      actor_id: params.actor_id,
      action: 'SESSION_CREATED',
      entity_type: 'SESSION',
      entity_id: id,
      new_state: { name: params.name, session_type: params.session_type, start_time: params.start_time },
    });

    return queryOne<any>('SELECT * FROM attendance_sessions WHERE id = ?', [id])!;
  },

  /**
   * Activates / Starts an attendance session
   */
  startSession(organization_id: string, sessionId: string, actorId: string) {
    const session = queryOne<any>(
      'SELECT * FROM attendance_sessions WHERE id = ? AND organization_id = ?',
      [sessionId, organization_id]
    );
    if (!session) throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');

    const now = new Date().toISOString();
    execute(
      `UPDATE attendance_sessions SET status = 'ACTIVE', updated_at = ? WHERE id = ?`,
      [now, sessionId]
    );

    auditService.log({
      organization_id,
      actor_id: actorId,
      action: 'SESSION_STARTED',
      entity_type: 'SESSION',
      entity_id: sessionId,
    });

    return queryOne<any>('SELECT * FROM attendance_sessions WHERE id = ?', [sessionId])!;
  },

  /**
   * Completes / Ends an attendance session
   */
  endSession(organization_id: string, sessionId: string, actorId: string) {
    const session = queryOne<any>(
      'SELECT * FROM attendance_sessions WHERE id = ? AND organization_id = ?',
      [sessionId, organization_id]
    );
    if (!session) throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');

    const now = new Date().toISOString();
    execute(
      `UPDATE attendance_sessions SET status = 'COMPLETED', updated_at = ? WHERE id = ?`,
      [now, sessionId]
    );

    auditService.log({
      organization_id,
      actor_id: actorId,
      action: 'SESSION_COMPLETED',
      entity_type: 'SESSION',
      entity_id: sessionId,
    });

    return queryOne<any>('SELECT * FROM attendance_sessions WHERE id = ?', [sessionId])!;
  },
};
