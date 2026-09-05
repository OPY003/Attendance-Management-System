import { AttendanceStatus, DetectionMethodType } from '@uapms/shared-types';
import { v4 as uuidv4 } from 'uuid';
import { execute, query, queryOne, transaction } from '../../core/database/db.js';
import { attendanceEngine } from '../../engines/attendanceEngine.js';
import { AppError } from '../../middleware/errorHandler.js';
import { auditService } from '../audit/auditService.js';

export interface SubmitDetectionParams {
  organization_id: string;
  session_id?: string;
  person_id: string;
  detection_method: DetectionMethodType;
  event_type: 'CHECK_IN' | 'CHECK_OUT';
  timestamp: string;
  location_id?: string;
  latitude?: number;
  longitude?: number;
  device_id?: string;
  qr_token?: string;
  confidence_score?: number;
  raw_payload?: Record<string, any>;
  actor_id: string;
}

export const attendanceService = {
  /**
   * Submits a normalized detection event and upserts the attendance record.
   * This is the core ingestion path: every check-in / check-out from any
   * adapter flows through here.
   */
  submitDetection(params: SubmitDetectionParams) {
    return transaction((_db) => {
      // 1. Persist the raw normalized detection event
      const eventId = uuidv4();
      const now = new Date().toISOString();

      execute(
        `INSERT INTO detection_events (
          id, organization_id, session_id, person_id, detection_method, event_type,
          timestamp, location_id, latitude, longitude, device_id, qr_token,
          confidence_score, raw_payload, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          eventId,
          params.organization_id,
          params.session_id || null,
          params.person_id,
          params.detection_method,
          params.event_type,
          params.timestamp,
          params.location_id || null,
          params.latitude ?? null,
          params.longitude ?? null,
          params.device_id || null,
          params.qr_token || null,
          params.confidence_score ?? 1.0,
          params.raw_payload ? JSON.stringify(params.raw_payload) : null,
          now,
        ]
      );

      // 2. Upsert attendance_record for this person + date
      const eventDate = params.timestamp.split('T')[0]; // YYYY-MM-DD

      let record = queryOne<any>(
        `SELECT * FROM attendance_records
         WHERE organization_id = ? AND person_id = ? AND date = ?`,
        [params.organization_id, params.person_id, eventDate]
      );

      if (!record) {
        // Create a new attendance record
        const recordId = uuidv4();
        execute(
          `INSERT INTO attendance_records (
            id, organization_id, person_id, session_id, date, status,
            check_in_time, check_in_method, check_in_event_id,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, 'PRESENT', ?, ?, ?, ?, ?)`,
          [
            recordId,
            params.organization_id,
            params.person_id,
            params.session_id || null,
            eventDate,
            params.event_type === 'CHECK_IN' ? params.timestamp : null,
            params.event_type === 'CHECK_IN' ? params.detection_method : null,
            params.event_type === 'CHECK_IN' ? eventId : null,
            now,
            now,
          ]
        );
        record = queryOne<any>('SELECT * FROM attendance_records WHERE id = ?', [recordId]);
      } else {
        // Update existing record with CHECK_IN or CHECK_OUT
        if (params.event_type === 'CHECK_IN' && !record.check_in_time) {
          execute(
            `UPDATE attendance_records SET
              check_in_time = ?, check_in_method = ?, check_in_event_id = ?, updated_at = ?
             WHERE id = ?`,
            [params.timestamp, params.detection_method, eventId, now, record.id]
          );
        } else if (params.event_type === 'CHECK_OUT') {
          execute(
            `UPDATE attendance_records SET
              check_out_time = ?, check_out_method = ?, check_out_event_id = ?, updated_at = ?
             WHERE id = ?`,
            [params.timestamp, params.detection_method, eventId, now, record.id]
          );
        }
        record = queryOne<any>('SELECT * FROM attendance_records WHERE id = ?', [record.id]);
      }

      // 3. If we have both check-in and check-out, run the attendance engine
      if (record.check_in_time && record.check_out_time) {
        // Fetch shift if session is linked
        let shift: any = undefined;
        if (record.session_id) {
          const session = queryOne<any>('SELECT shift_id FROM attendance_sessions WHERE id = ?', [record.session_id]);
          if (session?.shift_id) {
            shift = queryOne<any>('SELECT * FROM shifts WHERE id = ?', [session.shift_id]);
          }
        }

        let sessionStart: string | undefined;
        let sessionEnd: string | undefined;
        if (record.session_id) {
          const session = queryOne<any>(
            'SELECT start_time, end_time FROM attendance_sessions WHERE id = ?',
            [record.session_id]
          );
          sessionStart = session?.start_time;
          sessionEnd = session?.end_time;
        }

        const calc = attendanceEngine.evaluateAttendance({
          check_in_time: record.check_in_time,
          check_out_time: record.check_out_time,
          date: eventDate,
          shift: shift
            ? {
                ...shift,
                crosses_midnight: Boolean(shift.crosses_midnight),
                is_active: Boolean(shift.is_active),
              }
            : undefined,
          session_start_time: sessionStart,
          session_end_time: sessionEnd,
        });

        execute(
          `UPDATE attendance_records SET
            status = ?, late_minutes = ?, early_leave_minutes = ?,
            working_minutes = ?, overtime_minutes = ?,
            status_explanation = ?, updated_at = ?
           WHERE id = ?`,
          [
            calc.status,
            calc.late_minutes,
            calc.early_leave_minutes,
            calc.working_minutes,
            calc.overtime_minutes,
            calc.explanation,
            now,
            record.id,
          ]
        );

        record = queryOne<any>('SELECT * FROM attendance_records WHERE id = ?', [record.id]);
      }

      auditService.log({
        organization_id: params.organization_id,
        actor_id: params.actor_id,
        action: params.event_type === 'CHECK_IN' ? 'DETECTION_CHECK_IN' : 'DETECTION_CHECK_OUT',
        entity_type: 'ATTENDANCE_RECORD',
        entity_id: record.id,
        new_state: { detection_event_id: eventId, method: params.detection_method },
      });

      return {
        detection_event_id: eventId,
        attendance_record: record,
      };
    });
  },

  /**
   * Retrieves attendance records with filtering
   */
  listRecords(params: {
    organization_id: string;
    person_id?: string;
    session_id?: string;
    date_from?: string;
    date_to?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const offset = (page - 1) * limit;

    let sql = `SELECT ar.*, p.first_name, p.last_name, p.person_code
               FROM attendance_records ar
               JOIN persons p ON p.id = ar.person_id
               WHERE ar.organization_id = ?`;
    const queryParams: any[] = [params.organization_id];

    if (params.person_id) {
      sql += ' AND ar.person_id = ?';
      queryParams.push(params.person_id);
    }
    if (params.session_id) {
      sql += ' AND ar.session_id = ?';
      queryParams.push(params.session_id);
    }
    if (params.date_from) {
      sql += ' AND ar.date >= ?';
      queryParams.push(params.date_from);
    }
    if (params.date_to) {
      sql += ' AND ar.date <= ?';
      queryParams.push(params.date_to);
    }
    if (params.status) {
      sql += ' AND ar.status = ?';
      queryParams.push(params.status);
    }

    const countSql = `SELECT COUNT(*) as total FROM (${sql})`;
    const countRes = queryOne<{ total: number }>(countSql, queryParams);
    const total = countRes ? countRes.total : 0;

    sql += ' ORDER BY ar.date DESC, ar.check_in_time DESC LIMIT ? OFFSET ?';
    queryParams.push(limit, offset);

    const rows = query<any>(sql, queryParams);

    return {
      items: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  /**
   * Admin correction: overrides attendance status with audit trail
   */
  correctRecord(params: {
    organization_id: string;
    record_id: string;
    corrected_status: AttendanceStatus;
    reason: string;
    actor_id: string;
  }) {
    const record = queryOne<any>(
      'SELECT * FROM attendance_records WHERE id = ? AND organization_id = ?',
      [params.record_id, params.organization_id]
    );
    if (!record) throw new AppError('Attendance record not found', 404, 'RECORD_NOT_FOUND');

    const now = new Date().toISOString();

    // Store correction as an audit-tracked override
    execute(
      `UPDATE attendance_records SET
        status = ?, is_corrected = 1, corrected_by = ?, correction_reason = ?, updated_at = ?
       WHERE id = ?`,
      [params.corrected_status, params.actor_id, params.reason, now, params.record_id]
    );

    auditService.log({
      organization_id: params.organization_id,
      actor_id: params.actor_id,
      action: 'ATTENDANCE_CORRECTED',
      entity_type: 'ATTENDANCE_RECORD',
      entity_id: params.record_id,
      previous_state: { status: record.status },
      new_state: { status: params.corrected_status, reason: params.reason },
    });

    return queryOne<any>('SELECT * FROM attendance_records WHERE id = ?', [params.record_id]);
  },
};
