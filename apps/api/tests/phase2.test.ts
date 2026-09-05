import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { queryOne } from '../src/core/database/db.js';

const app = createApp();

describe('Phase 2 Test Suite: People, Roles, Locations & Hierarchy, Groups', () => {
  let adminToken: string;
  let orgId: string;
  let personId: string;
  let campusLocationId: string;
  let buildingLocationId: string;
  let deptId: string;
  let groupId: string;

  beforeAll(async () => {
    // 1. Create a dedicated organization for Phase 2 tests
    const regRes = await request(app).post('/api/v1/auth/register').send({
      email: `phase2_admin_${Date.now()}@example.com`,
      password: 'Password123!',
      first_name: 'Phase2',
      last_name: 'Admin',
      organization_name: 'Metro Tech Institute',
      organization_category: 'TRAINING_INSTITUTE',
    });

    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: regRes.body.data.email,
      password: 'Password123!',
    });

    adminToken = loginRes.body.data.tokens.access_token;
    orgId = regRes.body.data.organization_id;
  });

  // -------------------------------------------------------------
  // 1. PERSON CRUD & MULTI-ROLE ASSIGNMENT
  // -------------------------------------------------------------
  it('1. Should create a new Person in the organization', async () => {
    const res = await request(app)
      .post(`/api/v1/${orgId}/persons`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-organization-id', orgId)
      .send({
        person_code: 'TRAINEE-101',
        first_name: 'Grace',
        last_name: 'Hopper',
        email: 'grace.hopper@metrotech.edu',
        phone: '+1-555-0199',
        status: 'ACTIVE',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.person_code).toBe('TRAINEE-101');

    personId = res.body.data.id;
  });

  it('2. Should reject duplicate person_code in the same organization', async () => {
    const res = await request(app)
      .post(`/api/v1/${orgId}/persons`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-organization-id', orgId)
      .send({
        person_code: 'TRAINEE-101',
        first_name: 'Duplicate',
        last_name: 'Person',
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PERSON_CODE_EXISTS');
  });

  it('3. Should list persons with pagination and search', async () => {
    const res = await request(app)
      .get(`/api/v1/${orgId}/persons?search=Grace`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-organization-id', orgId);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].first_name).toBe('Grace');
    expect(res.body.metadata.total).toBe(1);
  });

  it('4. Should assign a role to the person', async () => {
    const role = queryOne<any>('SELECT id FROM roles WHERE code = ? AND is_system_role = 1', ['USER']);

    const res = await request(app)
      .post(`/api/v1/${orgId}/persons/assign-role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-organization-id', orgId)
      .send({
        person_id: personId,
        role_id: role.id,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.roles.some((r: any) => r.code === 'USER')).toBe(true);
  });

  it('5. Should set and retrieve dynamic custom fields on person', async () => {
    // Create custom field definition for PERSON
    await request(app)
      .post(`/api/v1/organizations/${orgId}/custom-fields`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-organization-id', orgId)
      .send({
        entity_type: 'PERSON',
        field_key: 'lab_pass_number',
        field_label: 'Lab Pass Number',
        field_type: 'TEXT',
        required: false,
      });

    // Set custom field value
    const setRes = await request(app)
      .post(`/api/v1/${orgId}/persons/${personId}/custom-field`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-organization-id', orgId)
      .send({
        field_key: 'lab_pass_number',
        value: 'LAB-NYC-889',
      });

    expect(setRes.status).toBe(200);

    // Retrieve person and verify custom field attached
    const getRes = await request(app)
      .get(`/api/v1/${orgId}/persons/${personId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-organization-id', orgId);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.custom_fields.some((cf: any) => cf.field_key === 'lab_pass_number' && cf.value === 'LAB-NYC-889')).toBe(true);
  });

  // -------------------------------------------------------------
  // 2. HIERARCHICAL LOCATIONS & GEOFENCING
  // -------------------------------------------------------------
  it('6. Should create a root Campus location', async () => {
    const res = await request(app)
      .post(`/api/v1/${orgId}/locations`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-organization-id', orgId)
      .send({
        name: 'Downtown Main Campus',
        code: 'CAMPUS-DT',
        type: 'CAMPUS',
        latitude: 40.7128,
        longitude: -74.006,
        radius_meters: 250,
        timezone: 'America/New_York',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.hierarchy_path).toBe('/campus-dt');

    campusLocationId = res.body.data.id;
  });

  it('7. Should create a child Building location with computed hierarchy path', async () => {
    const res = await request(app)
      .post(`/api/v1/${orgId}/locations`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-organization-id', orgId)
      .send({
        parent_id: campusLocationId,
        name: 'Science & Robotics Building',
        code: 'BLDG-ROBOTICS',
        type: 'BUILDING',
        latitude: 40.713,
        longitude: -74.0062,
        radius_meters: 60,
        wifi_ssids: ['MetroTech-Secure-5G', 'RoboticsLab-Guest'],
        ble_beacons: ['UUID-9988-1122'],
        ip_ranges: ['192.168.10.0/24'],
        timezone: 'America/New_York',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.parent_id).toBe(campusLocationId);
    expect(res.body.data.hierarchy_path).toBe('/campus-dt/bldg-robotics');
    expect(res.body.data.wifi_ssids).toContain('MetroTech-Secure-5G');

    buildingLocationId = res.body.data.id;
  });

  it('8. Should list locations hierarchically', async () => {
    const res = await request(app)
      .get(`/api/v1/${orgId}/locations`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-organization-id', orgId);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
  });

  // -------------------------------------------------------------
  // 3. DEPARTMENTS, GROUPS & ENROLLMENTS
  // -------------------------------------------------------------
  it('9. Should create a Department and a Group', async () => {
    // Create Department
    const deptRes = await request(app)
      .post(`/api/v1/${orgId}/departments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-organization-id', orgId)
      .send({
        name: 'Computer Science & AI',
        code: 'CS-AI',
      });

    expect(deptRes.status).toBe(201);
    deptId = deptRes.body.data.id;

    // Create Group / Class
    const groupRes = await request(app)
      .post(`/api/v1/${orgId}/groups`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-organization-id', orgId)
      .send({
        department_id: deptId,
        name: 'Advanced Machine Learning Batch 2026',
        code: 'CS-AML-2026',
        group_type: 'CLASS',
      });

    expect(groupRes.status).toBe(201);
    groupId = groupRes.body.data.id;
  });

  it('10. Should enroll members into Group and list group members', async () => {
    const enrollRes = await request(app)
      .post(`/api/v1/${orgId}/groups/${groupId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-organization-id', orgId)
      .send({
        person_ids: [personId],
        role_in_group: 'STUDENT',
      });

    expect(enrollRes.status).toBe(200);

    const listRes = await request(app)
      .get(`/api/v1/${orgId}/groups/${groupId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-organization-id', orgId);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBe(1);
    expect(listRes.body.data[0].id).toBe(personId);
    expect(listRes.body.data[0].role_in_group).toBe('STUDENT');
  });
});
