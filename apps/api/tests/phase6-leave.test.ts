import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const app = createApp();

describe('Phase 6 Leave Management', () => {
  let token: string;
  let organizationId: string;
  let personId: string;
  let leaveTypeId: string;
  let requestId: string;

  beforeAll(async () => {
    const registration = await request(app).post('/api/v1/auth/register').send({
      email: `phase6_leave_${Date.now()}@example.com`,
      password: 'Password123!',
      first_name: 'Leave',
      last_name: 'Admin',
      organization_name: 'Phase 6 Leave Organization',
      organization_category: 'CORPORATE',
    });
    organizationId = registration.body.data.organization_id;
    const login = await request(app).post('/api/v1/auth/login').send({ email: registration.body.data.email, password: 'Password123!' });
    token = login.body.data.tokens.access_token;

    const person = await request(app)
      .post(`/api/v1/${organizationId}/persons`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', organizationId)
      .send({ person_code: 'LEAVE-001', first_name: 'Ada', last_name: 'Lovelace' });
    personId = person.body.data.id;
  });

  it('creates a leave type and submits a pending request', async () => {
    const type = await request(app)
      .post(`/api/v1/${organizationId}/leave/types`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', organizationId)
      .send({ name: 'Annual Leave', code: 'ANNUAL', is_paid: true, days_allowed_per_year: 20 });
    expect(type.status).toBe(201);
    leaveTypeId = type.body.data.id;

    const leaveRequest = await request(app)
      .post(`/api/v1/${organizationId}/leave/requests`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', organizationId)
      .send({ person_id: personId, leave_type_id: leaveTypeId, start_date: '2026-10-05', end_date: '2026-10-07', reason: 'Personal leave' });
    expect(leaveRequest.status).toBe(201);
    expect(leaveRequest.body.data.status).toBe('PENDING');
    requestId = leaveRequest.body.data.id;
  });

  it('rejects an invalid date range', async () => {
    const response = await request(app)
      .post(`/api/v1/${organizationId}/leave/requests`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', organizationId)
      .send({ person_id: personId, leave_type_id: leaveTypeId, start_date: '2026-10-08', end_date: '2026-10-01', reason: 'Invalid range' });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_DATE_RANGE');
  });

  it('approves the pending request and lists it by status', async () => {
    const review = await request(app)
      .put(`/api/v1/${organizationId}/leave/requests/${requestId}/review`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', organizationId)
      .send({ status: 'APPROVED', comments: 'Approved by organization admin' });
    expect(review.status).toBe(200);
    expect(review.body.data.status).toBe('APPROVED');

    const list = await request(app)
      .get(`/api/v1/${organizationId}/leave/requests?status=APPROVED`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', organizationId);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
  });
});