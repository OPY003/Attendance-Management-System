import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { queryOne } from '../src/core/database/db.js';

const app = createApp();

describe('Granular RBAC Permission Test Suite', () => {
  let studentToken: string;
  let teacherToken: string;
  let univId: string;

  beforeAll(async () => {
    const org = queryOne<any>('SELECT id FROM organizations WHERE slug = ?', ['greenfield-univ']);
    univId = org.id;

    // Login Student (Role: USER - lacks org:settings:write)
    const loginStudent = await request(app).post('/api/v1/auth/login').send({
      email: 'student@greenfield.edu',
      password: 'Password123!',
    });
    studentToken = loginStudent.body.data.tokens.access_token;

    // Login Teacher (Role: TEACHER)
    const loginTeacher = await request(app).post('/api/v1/auth/login').send({
      email: 'teacher@greenfield.edu',
      password: 'Password123!',
    });
    teacherToken = loginTeacher.body.data.tokens.access_token;
  });

  it('1. Student attempting to update organization settings MUST BE DENIED with 403 PERMISSION_DENIED', async () => {
    const res = await request(app)
      .put(`/api/v1/organizations/${univId}/settings`)
      .set('Authorization', `Bearer ${studentToken}`)
      .set('x-organization-id', univId)
      .send({
        geofence_tolerance_meters: 100,
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('PERMISSION_DENIED');
  });

  it('2. Organization Owner/Admin can create custom fields', async () => {
    // Register new org owner
    const regRes = await request(app).post('/api/v1/auth/register').send({
      email: `owner_${Date.now()}@example.com`,
      password: 'Password123!',
      first_name: 'Owner',
      last_name: 'User',
      organization_name: 'Permission Test Org',
    });

    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: regRes.body.data.email,
      password: 'Password123!',
    });
    const ownerToken = loginRes.body.data.tokens.access_token;
    const orgId = regRes.body.data.organization_id;

    const createFieldRes = await request(app)
      .post(`/api/v1/organizations/${orgId}/custom-fields`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-organization-id', orgId)
      .send({
        entity_type: 'PERSON',
        field_key: 'custom_badge_id',
        field_label: 'Custom Badge ID',
        field_type: 'TEXT',
        required: false,
      });

    expect(createFieldRes.status).toBe(201);
    expect(createFieldRes.body.success).toBe(true);
    expect(createFieldRes.body.data.field_key).toBe('custom_badge_id');
  });
});
