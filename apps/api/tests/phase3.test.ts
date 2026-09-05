import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { attendanceEngine } from '../src/engines/attendanceEngine.js';

const app = createApp();

describe('Phase 3 Test Suite: Schedules, Shifts, Sessions & Attendance Engine', () => {
  let adminToken: string;
  let orgId: string;
  let personId: string;
  let shiftId: string;
  let scheduleId: string;
  let sessionId: string;
  let recordId: string;

  beforeAll(async () => {
    // Create dedicated org + admin for Phase 3 tests
    const regRes = await request(app).post('/api/v1/auth/register').send({
      email: `phase3_admin_${Date.now()}@example.com`,
      password: 'Password123!',
      first_name: 'Phase3',
      last_name: 'Admin',
      organization_name: 'Apex Manufacturing Test',
      organization_category: 'FACTORY',
    });

    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: regRes.body.data.email,
      password: 'Password123!',
    });

    adminToken = loginRes.body.data.tokens.access_token;
    orgId = regRes.body.data.organization_id;

    // Create a person in this org for detection events
    const personRes = await request(app)
      .post(`/api/v1/${orgId}/persons`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-organization-id', orgId)
      .send({
        person_code: 'WORKER-201',
        first_name: 'Ada',
        last_name: 'Lovelace',
        email: 'ada.lovelace@apex.test',
        status: 'ACTIVE',
      });

    personId = personRes.body.data.id;
  });

  // -------------------------------------------------------
  // 1. SHIFTS (including midnight-crossing factory shift)
  // -------------------------------------------------------
  it('1. Should create a regular Day Shift (08:00 – 17:00)', async () => {
    const res = await request(app)
      .post(`/api/v1/${orgId}/shifts`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-organization-id', orgId)
      .send({
        name: 'Day Shift',
        code: 'DAY',
        start_time: '08:00:00',
        end_time: '17:00:00',
        grace_period_minutes: 10,
        late_threshold_minutes: 30,
        early_leave_threshold_minutes: 15,
        min_working_minutes: 480,
        break_duration_minutes: 60,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.code).toBe('DAY');
    expect(res.body.data.crosses_midnight).toBeFalsy();
    shiftId = res.body.data.id;
  });

  it('2. Should create a Night Shift crossing midnight (22:00 – 06:00)', async () => {
    const res = await request(app)
      .post(`/api/v1/${orgId}/shifts`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-organization-id', orgId)
      .send({
        name: 'Night Shift',
        code: 'NIGHT',
        start_time: '22:00:00',
        end_time: '06:00:00',
        grace_period_minutes: 15,
        late_threshold_minutes: 30,
      });

    expect(res.status).toBe(201);
    // Auto-detect midnight crossing
    expect(res.body.data.crosses_midnight).toBeTruthy();
  });

  it('3. Should list all shifts', async () => {
    const res = await request(app)
      .get(`/api/v1/${orgId}/shifts`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-organization-id', orgId);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
  });

  // -------------------------------------------------------
  // 2. SCHEDULES
  // -------------------------------------------------------
  it('4. Should create a Shift Schedule for factory workers', async () => {
    const res = await request(app)
      .post(`/api/v1/${orgId}/schedules`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-organization-id', orgId)
      .send({
        name: 'Factory Day Schedule Q3',
        schedule_type: 'SHIFT',
        timezone: 'America/Chicago',
        valid_from: '2026-07-01',
        valid_until: '2026-09-30',
        days_of_week: [1, 2, 3, 4, 5],
        default_shift_id: shiftId,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.schedule_type).toBe('SHIFT');
    scheduleId = res.body.data.id;
  });

  // -------------------------------------------------------
  // 3. SESSIONS (lifecycle: create → start → end)
  // -------------------------------------------------------
  it('5. Should create an Attendance Session', async () => {
    const res = await request(app)
      .post(`/api/v1/${orgId}/sessions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-organization-id', orgId)
      .send({
        name: 'Day Shift – 2026-08-30',
        session_type: 'SHIFT',
        shift_id: shiftId,
        start_time: '2026-08-30T08:00:00Z',
        end_time: '2026-08-30T17:00:00Z',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('SCHEDULED');
    sessionId = res.body.data.id;
  });

  it('6. Should activate / start the session', async () => {
    const res = await request(app)
      .post(`/api/v1/${orgId}/sessions/${sessionId}/start`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-organization-id', orgId);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ACTIVE');
  });

  // -------------------------------------------------------
  // 4. DETECTION EVENTS & ATTENDANCE RECORDS
  // -------------------------------------------------------
  it('7. Should submit CHECK_IN detection and create attendance record', async () => {
    const res = await request(app)
      .post(`/api/v1/${orgId}/attendance/detect`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-organization-id', orgId)
      .send({
        person_id: personId,
        session_id: sessionId,
        detection_method: 'RFID',
        event_type: 'CHECK_IN',
        timestamp: '2026-08-30T08:05:00Z',
        confidence_score: 98.5,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.detection_event_id).toBeDefined();
    expect(res.body.data.attendance_record).toBeDefined();
    expect(res.body.data.attendance_record.check_in_time).toBe('2026-08-30T08:05:00Z');

    recordId = res.body.data.attendance_record.id;
  });

  it('8. Should submit CHECK_OUT detection and compute final attendance status', async () => {
    const res = await request(app)
      .post(`/api/v1/${orgId}/attendance/detect`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-organization-id', orgId)
      .send({
        person_id: personId,
        session_id: sessionId,
        detection_method: 'RFID',
        event_type: 'CHECK_OUT',
        timestamp: '2026-08-30T17:02:00Z',
        confidence_score: 99.0,
      });

    expect(res.status).toBe(201);
    const record = res.body.data.attendance_record;
    expect(record.check_out_time).toBe('2026-08-30T17:02:00Z');
    // 5 min late but within 10-min grace → PRESENT
    expect(record.status).toBe('PRESENT');
    expect(record.working_minutes).toBeGreaterThan(0);
  });

  it('9. Should list attendance records with filters', async () => {
    const res = await request(app)
      .get(`/api/v1/${orgId}/attendance/records?person_id=${personId}&date_from=2026-08-30`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-organization-id', orgId);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].person_code).toBe('WORKER-201');
  });

  // -------------------------------------------------------
  // 5. ADMIN CORRECTION
  // -------------------------------------------------------
  it('10. Should allow admin to correct attendance record with audit trail', async () => {
    const res = await request(app)
      .put(`/api/v1/${orgId}/attendance/records/${recordId}/correct`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-organization-id', orgId)
      .send({
        corrected_status: 'EXCUSED',
        reason: 'Worker was on approved training offsite — retroactively marking as excused',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('EXCUSED');
    expect(res.body.data.is_corrected).toBeTruthy();
    expect(res.body.data.correction_reason).toContain('training offsite');
  });

  // -------------------------------------------------------
  // 6. SESSION COMPLETION
  // -------------------------------------------------------
  it('11. Should end / complete the session', async () => {
    const res = await request(app)
      .post(`/api/v1/${orgId}/sessions/${sessionId}/end`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-organization-id', orgId);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('COMPLETED');
  });

  // -------------------------------------------------------
  // 7. PURE ATTENDANCE ENGINE UNIT TESTS
  // -------------------------------------------------------
  it('12. Engine: ABSENT when no check-in recorded', () => {
    const result = attendanceEngine.evaluateAttendance({
      date: '2026-08-30',
      shift: {
        id: 'x', organization_id: 'x', name: 'Day', code: 'D',
        start_time: '08:00:00', end_time: '17:00:00',
        crosses_midnight: false, grace_period_minutes: 10,
        late_threshold_minutes: 30, early_leave_threshold_minutes: 15,
        min_working_minutes: 480, break_duration_minutes: 60,
        is_active: true, created_at: '',
      },
    });
    expect(result.status).toBe('ABSENT');
  });

  it('13. Engine: LATE when check-in exceeds grace period', () => {
    const result = attendanceEngine.evaluateAttendance({
      check_in_time: '2026-08-30T08:35:00Z',
      check_out_time: '2026-08-30T17:00:00Z',
      date: '2026-08-30',
      shift: {
        id: 'x', organization_id: 'x', name: 'Day', code: 'D',
        start_time: '08:00:00', end_time: '17:00:00',
        crosses_midnight: false, grace_period_minutes: 10,
        late_threshold_minutes: 30, early_leave_threshold_minutes: 15,
        min_working_minutes: 480, break_duration_minutes: 60,
        is_active: true, created_at: '',
      },
    });
    expect(result.status).toBe('LATE');
    expect(result.late_minutes).toBe(35);
  });

  it('14. Engine: LEAVE when person has approved leave', () => {
    const result = attendanceEngine.evaluateAttendance({
      date: '2026-08-30',
      is_on_approved_leave: true,
    });
    expect(result.status).toBe('LEAVE');
  });

  it('15. Engine: midnight-crossing Night Shift calculates correctly', () => {
    const result = attendanceEngine.evaluateAttendance({
      check_in_time: '2026-08-30T22:10:00Z',
      check_out_time: '2026-08-31T06:05:00Z',
      date: '2026-08-30',
      shift: {
        id: 'x', organization_id: 'x', name: 'Night', code: 'N',
        start_time: '22:00:00', end_time: '06:00:00',
        crosses_midnight: true, grace_period_minutes: 15,
        late_threshold_minutes: 30, early_leave_threshold_minutes: 15,
        min_working_minutes: 480, break_duration_minutes: 30,
        is_active: true, created_at: '',
      },
    });
    expect(result.status).toBe('PRESENT');
    // 10 minutes late but within 15-min grace
    expect(result.is_within_grace_period).toBe(true);
    expect(result.working_minutes).toBeGreaterThanOrEqual(475);
  });
});
