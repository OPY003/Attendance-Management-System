import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const app = createApp();

describe('Phase 2 hardening', () => {
  let token: string;
  let organizationId: string;
  let deviceId: string;

  beforeAll(async () => {
    const registration = await request(app).post('/api/v1/auth/register').send({
      email: `phase2_hardening_${Date.now()}@example.com`,
      password: 'Password123!',
      first_name: 'Phase2',
      last_name: 'Hardening',
      organization_name: 'Phase 2 Hardening Organization',
      organization_category: 'CORPORATE',
    });
    organizationId = registration.body.data.organization_id;

    const login = await request(app).post('/api/v1/auth/login').send({
      email: registration.body.data.email,
      password: 'Password123!',
    });
    token = login.body.data.tokens.access_token;
  });

  it('imports people as one transaction and rejects tenant duplicates', async () => {
    const response = await request(app)
      .post(`/api/v1/${organizationId}/persons/import`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', organizationId)
      .send({
        persons: [
          { person_code: 'P2-001', first_name: 'Ada', last_name: 'Lovelace' },
          { person_code: 'P2-002', first_name: 'Alan', last_name: 'Turing' },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body.data.imported).toBe(2);

    const duplicate = await request(app)
      .post(`/api/v1/${organizationId}/persons/import`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', organizationId)
      .send({
        persons: [
          { person_code: 'P2-003', first_name: 'Grace', last_name: 'Hopper' },
          { person_code: 'P2-001', first_name: 'Duplicate', last_name: 'Person' },
        ],
      });

    expect(duplicate.status).toBe(409);
    const newPerson = await request(app)
      .get(`/api/v1/${organizationId}/persons?search=P2-003`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', organizationId);
    expect(newPerson.body.metadata.total).toBe(0);
  });

  it('rotates device credentials and revokes the previous active credential', async () => {
    const registered = await request(app)
      .post(`/api/v1/${organizationId}/devices`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', organizationId)
      .send({ name: 'Hardening Kiosk', device_type: 'KIOSK', serial_number: 'P2-KIOSK-001' });
    deviceId = registered.body.data.device.id;
    const originalSecret = registered.body.data.credentials.api_secret;

    const rotated = await request(app)
      .post(`/api/v1/${organizationId}/devices/${deviceId}/rotate-credentials`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', organizationId);

    expect(rotated.status).toBe(200);
    expect(rotated.body.data.credentials.api_secret).toHaveLength(64);
    expect(rotated.body.data.credentials.api_secret).not.toBe(originalSecret);
    expect(rotated.body.data.device.credential_hash).toBeUndefined();
  });
});