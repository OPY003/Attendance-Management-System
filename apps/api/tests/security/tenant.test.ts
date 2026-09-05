import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { queryOne } from '../../src/core/database/db.js';

const app = createApp();

describe('Multi-Tenancy Isolation Security Test Suite', () => {
  let userAToken: string;
  let userBToken: string;
  let superAdminToken: string;
  let orgAId: string;
  let orgBId: string;

  beforeAll(async () => {
    // 1. Get seeded Greenfield University (Org A) and Apex Manufacturing (Org B)
    const orgA = queryOne<any>('SELECT id FROM organizations WHERE slug = ?', ['greenfield-univ']);
    const orgB = queryOne<any>('SELECT id FROM organizations WHERE slug = ?', ['apex-mfg']);
    orgAId = orgA.id;
    orgBId = orgB.id;

    // 2. Login Teacher in Org A
    const loginA = await request(app).post('/api/v1/auth/login').send({
      email: 'teacher@greenfield.edu',
      password: 'Password123!',
    });
    userAToken = loginA.body.data.tokens.access_token;

    // 3. Login Manager in Org B
    const loginB = await request(app).post('/api/v1/auth/login').send({
      email: 'manager@apex-mfg.com',
      password: 'Password123!',
    });
    userBToken = loginB.body.data.tokens.access_token;

    // 4. Login Platform Super Admin
    const loginSuper = await request(app).post('/api/v1/auth/login').send({
      email: 'superadmin@uapms.io',
      password: 'Password123!',
    });
    superAdminToken = loginSuper.body.data.tokens.access_token;
  });

  it('1. Org A user can access Org A data successfully', async () => {
    const res = await request(app)
      .get(`/api/v1/organizations/${orgAId}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .set('x-organization-id', orgAId);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(orgAId);
  });

  it('2. Org A user attempting to access Org B data MUST BE DENIED with 403 Forbidden', async () => {
    const res = await request(app)
      .get(`/api/v1/organizations/${orgBId}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .set('x-organization-id', orgBId);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CROSS_TENANT_ACCESS_DENIED');
  });

  it('3. Org B user attempting to access Org A data MUST BE DENIED with 403 Forbidden', async () => {
    const res = await request(app)
      .get(`/api/v1/organizations/${orgAId}`)
      .set('Authorization', `Bearer ${userBToken}`)
      .set('x-organization-id', orgAId);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CROSS_TENANT_ACCESS_DENIED');
  });

  it('4. Platform Super Admin can access Org A and Org B data globally', async () => {
    const resA = await request(app)
      .get(`/api/v1/organizations/${orgAId}`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .set('x-organization-id', orgAId);

    expect(resA.status).toBe(200);
    expect(resA.body.data.id).toBe(orgAId);

    const resB = await request(app)
      .get(`/api/v1/organizations/${orgBId}`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .set('x-organization-id', orgBId);

    expect(resB.status).toBe(200);
    expect(resB.body.data.id).toBe(orgBId);
  });
});
