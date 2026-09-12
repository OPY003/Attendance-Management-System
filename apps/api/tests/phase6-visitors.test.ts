import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const app = createApp();

describe('Phase 6 Visitor Management', () => {
  let tokenA: string;
  let orgIdA: string;
  let hostPersonIdA: string;
  let locationIdA: string;
  let unauthorizedLocationIdA: string;

  let tokenB: string;
  let orgIdB: string;

  let visitorPassId: string;
  let passCode: string;

  beforeAll(async () => {
    // Org A setup
    const regA = await request(app).post('/api/v1/auth/register').send({
      email: `visitor_admin_a_${Date.now()}@example.com`,
      password: 'Password123!',
      first_name: 'Visitor',
      last_name: 'Admin',
      organization_name: 'Org A Visitors',
      organization_category: 'OFFICE',
    });
    orgIdA = regA.body.data.organization_id;
    const loginA = await request(app).post('/api/v1/auth/login').send({
      email: regA.body.data.email,
      password: 'Password123!',
    });
    tokenA = loginA.body.data.tokens.access_token;

    // Create host person in Org A
    const personA = await request(app)
      .post(`/api/v1/${orgIdA}/persons`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-organization-id', orgIdA)
      .send({ person_code: 'HOST-001', first_name: 'Host', last_name: 'Person' });
    hostPersonIdA = personA.body.data.id;

    // Create locations in Org A
    const loc1 = await request(app)
      .post(`/api/v1/${orgIdA}/locations`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-organization-id', orgIdA)
      .send({ name: 'HQ Lobby', code: 'LOBBY-01', type: 'BUILDING' });
    locationIdA = loc1.body.data.id;

    const loc2 = await request(app)
      .post(`/api/v1/${orgIdA}/locations`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-organization-id', orgIdA)
      .send({ name: 'Server Room', code: 'SRV-01', type: 'ROOM' });
    unauthorizedLocationIdA = loc2.body.data.id;

    // Org B setup for cross-tenant isolation tests
    const regB = await request(app).post('/api/v1/auth/register').send({
      email: `visitor_admin_b_${Date.now()}@example.com`,
      password: 'Password123!',
      first_name: 'TenantB',
      last_name: 'Admin',
      organization_name: 'Org B Visitors',
      organization_category: 'CORPORATE',
    });
    orgIdB = regB.body.data.organization_id;
    const loginB = await request(app).post('/api/v1/auth/login').send({
      email: regB.body.data.email,
      password: 'Password123!',
    });
    tokenB = loginB.body.data.tokens.access_token;
  });

  it('rejects visitor pass with invalid time range (valid_until <= valid_from)', async () => {
    const res = await request(app)
      .post(`/api/v1/${orgIdA}/visitors`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-organization-id', orgIdA)
      .send({
        visitor_name: 'Alice Guest',
        host_person_id: hostPersonIdA,
        purpose: 'Meeting',
        allowed_location_ids: [locationIdA],
        valid_from: '2026-10-02T12:00:00.000Z',
        valid_until: '2026-10-02T10:00:00.000Z',
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_TIME_RANGE');
  });

  it('creates a visitor pass with dynamic QR token and temporary pass code', async () => {
    const now = new Date();
    const validFrom = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
    const validUntil = new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString();

    const res = await request(app)
      .post(`/api/v1/${orgIdA}/visitors`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-organization-id', orgIdA)
      .send({
        visitor_name: 'Alice Guest',
        visitor_email: 'alice.guest@example.com',
        visitor_phone: '+1555123456',
        host_person_id: hostPersonIdA,
        purpose: 'Vendor Assessment',
        allowed_location_ids: [locationIdA],
        valid_from: validFrom,
        valid_until: validUntil,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('PRE_REGISTERED');
    expect(res.body.data.pass_code).toMatch(/^VP-[A-F0-9]{8}$/);
    expect(res.body.data.dynamic_qr_token).toMatch(/^vqr_/);
    expect(res.body.data.allowed_location_ids).toContain(locationIdA);

    visitorPassId = res.body.data.id;
    passCode = res.body.data.pass_code;
  });

  it('rejects check-in at an unauthorized location', async () => {
    const res = await request(app)
      .post(`/api/v1/${orgIdA}/visitors/${visitorPassId}/check-in`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-organization-id', orgIdA)
      .send({
        location_id: unauthorizedLocationIdA,
        pass_code: passCode,
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('LOCATION_NOT_ALLOWED');
  });

  it('successfully checks in visitor at authorized location', async () => {
    const res = await request(app)
      .post(`/api/v1/${orgIdA}/visitors/${visitorPassId}/check-in`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-organization-id', orgIdA)
      .send({
        location_id: locationIdA,
        pass_code: passCode,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CHECKED_IN');
    expect(res.body.data.check_in_time).toBeDefined();
  });

  it('rejects double check-in for already checked-in visitor', async () => {
    const res = await request(app)
      .post(`/api/v1/${orgIdA}/visitors/${visitorPassId}/check-in`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-organization-id', orgIdA)
      .send({
        location_id: locationIdA,
        pass_code: passCode,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VISITOR_ALREADY_CHECKED_IN');
  });

  it('successfully checks out visitor and records exit timestamp', async () => {
    const res = await request(app)
      .post(`/api/v1/${orgIdA}/visitors/${visitorPassId}/check-out`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-organization-id', orgIdA)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CHECKED_IN' ? 'CHECKED_OUT' : res.body.data.status);
    expect(res.body.data.check_out_time).toBeDefined();
  });

  it('rejects check-in for expired visitor pass', async () => {
    // Create an already-expired visitor pass
    const expiredPass = await request(app)
      .post(`/api/v1/${orgIdA}/visitors`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-organization-id', orgIdA)
      .send({
        visitor_name: 'Late Visitor',
        host_person_id: hostPersonIdA,
        purpose: 'Past meeting',
        allowed_location_ids: [locationIdA],
        valid_from: '2026-01-01T08:00:00.000Z',
        valid_until: '2026-01-01T10:00:00.000Z',
      });
    expect(expiredPass.status).toBe(201);

    const checkIn = await request(app)
      .post(`/api/v1/${orgIdA}/visitors/${expiredPass.body.data.id}/check-in`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-organization-id', orgIdA)
      .send({ location_id: locationIdA });

    expect(checkIn.status).toBe(400);
    expect(checkIn.body.error.code).toBe('PASS_EXPIRED');
  });

  it('strictly enforces multi-tenant isolation (Org B cannot access or modify Org A visitor)', async () => {
    // Org B tries to view Org A visitor
    const viewRes = await request(app)
      .get(`/api/v1/${orgIdA}/visitors/${visitorPassId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .set('x-organization-id', orgIdA);
    expect(viewRes.status).toBe(403);
    expect(viewRes.body.error.code).toBe('CROSS_TENANT_ACCESS_DENIED');

    // Org B tries to access using their own org context
    const checkInB = await request(app)
      .post(`/api/v1/${orgIdB}/visitors/${visitorPassId}/check-in`)
      .set('Authorization', `Bearer ${tokenB}`)
      .set('x-organization-id', orgIdB)
      .send({ location_id: locationIdA });
    expect(checkInB.status).toBe(404);
  });
});
