import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const app = createApp();

describe('Phase 2 Device Management', () => {
  let token: string;
  let organizationId: string;
  let deviceId: string;

  beforeAll(async () => {
    const registration = await request(app).post('/api/v1/auth/register').send({
      email: `device_admin_${Date.now()}@example.com`,
      password: 'Password123!',
      first_name: 'Device',
      last_name: 'Admin',
      organization_name: 'Device Test Organization',
      organization_category: 'CORPORATE',
    });

    organizationId = registration.body.data.organization_id;
    const login = await request(app).post('/api/v1/auth/login').send({
      email: registration.body.data.email,
      password: 'Password123!',
    });
    token = login.body.data.tokens.access_token;
  });

  it('registers a device and returns credentials once', async () => {
    const response = await request(app)
      .post(`/api/v1/${organizationId}/devices`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', organizationId)
      .send({
        name: 'Front Gate Kiosk',
        device_type: 'KIOSK',
        serial_number: 'KIOSK-001',
      });

    expect(response.status).toBe(201);
    expect(response.body.data.device.serial_number).toBe('KIOSK-001');
    expect(response.body.data.credentials.api_key).toMatch(/^uapms_/);
    expect(response.body.data.credentials.api_secret).toHaveLength(64);
    expect(response.body.data.device.credential_hash).toBeUndefined();
    deviceId = response.body.data.device.id;
  });

  it('rejects duplicate serial numbers within the tenant', async () => {
    const response = await request(app)
      .post(`/api/v1/${organizationId}/devices`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', organizationId)
      .send({ name: 'Duplicate', device_type: 'KIOSK', serial_number: 'KIOSK-001' });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('DEVICE_SERIAL_EXISTS');
  });

  it('lists and updates devices within the tenant', async () => {
    const list = await request(app)
      .get(`/api/v1/${organizationId}/devices?status=ACTIVE`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', organizationId);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);

    const update = await request(app)
      .put(`/api/v1/${organizationId}/devices/${deviceId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', organizationId)
      .send({ status: 'SUSPENDED' });
    expect(update.status).toBe(200);
    expect(update.body.data.status).toBe('SUSPENDED');
  });
});