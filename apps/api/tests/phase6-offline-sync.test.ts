import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const app = createApp();

describe('Phase 6 Offline Synchronization', () => {
  let tokenA: string;
  let orgIdA: string;
  let personIdA: string;
  let locationIdA: string;
  let deviceIdA: string;
  let deviceApiKeyA: string;
  let deviceApiSecretA: string;

  let tokenB: string;
  let orgIdB: string;

  beforeAll(async () => {
    // Org A setup
    const regA = await request(app).post('/api/v1/auth/register').send({
      email: `sync_admin_a_${Date.now()}@example.com`,
      password: 'Password123!',
      first_name: 'Sync',
      last_name: 'Admin',
      organization_name: 'Org A Sync',
      organization_category: 'FACTORY',
    });
    orgIdA = regA.body.data.organization_id;
    const loginA = await request(app).post('/api/v1/auth/login').send({
      email: regA.body.data.email,
      password: 'Password123!',
    });
    tokenA = loginA.body.data.tokens.access_token;

    // Create location
    const locA = await request(app)
      .post(`/api/v1/${orgIdA}/locations`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-organization-id', orgIdA)
      .send({ name: 'Factory Floor A', code: 'FACT-01', type: 'SITE' });
    locationIdA = locA.body.data.id;

    // Create person
    const personA = await request(app)
      .post(`/api/v1/${orgIdA}/persons`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-organization-id', orgIdA)
      .send({ person_code: 'WRK-100', first_name: 'Worker', last_name: 'One' });
    personIdA = personA.body.data.id;

    // Register device in Org A
    const devA = await request(app)
      .post(`/api/v1/${orgIdA}/devices`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-organization-id', orgIdA)
      .send({
        name: 'Factory Terminal 1',
        device_type: 'KIOSK',
        serial_number: `KIOSK-SYNC-${Date.now()}`,
        location_id: locationIdA,
      });
    deviceIdA = devA.body.data.device.id;
    deviceApiKeyA = devA.body.data.credentials.api_key;
    deviceApiSecretA = devA.body.data.credentials.api_secret;

    // Org B setup
    const regB = await request(app).post('/api/v1/auth/register').send({
      email: `sync_admin_b_${Date.now()}@example.com`,
      password: 'Password123!',
      first_name: 'SyncB',
      last_name: 'Admin',
      organization_name: 'Org B Sync',
      organization_category: 'WAREHOUSE',
    });
    orgIdB = regB.body.data.organization_id;
    const loginB = await request(app).post('/api/v1/auth/login').send({
      email: regB.body.data.email,
      password: 'Password123!',
    });
    tokenB = loginB.body.data.tokens.access_token;
  });

  it('authenticates device and processes offline event batch preserving original timestamps', async () => {
    const historicalTimestamp = '2026-09-10T08:15:30.000Z';
    const localEventId = `offline_ev_${Date.now()}`;

    const res = await request(app)
      .post(`/api/v1/${orgIdA}/sync/offline-events`)
      .set('x-device-id', deviceIdA)
      .set('x-device-key', deviceApiKeyA)
      .set('x-organization-id', orgIdA)
      .send({
        device_id: deviceIdA,
        events: [
          {
            local_event_id: localEventId,
            timestamp: historicalTimestamp,
            detection_method: 'RFID',
            raw_payload: {
              person_id: personIdA,
              rfid_tag: 'TAG-998877',
              battery_level: 95,
            },
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.total_events).toBe(1);
    expect(res.body.data.processed_count).toBe(1);
    expect(res.body.data.duplicate_count).toBe(0);
    expect(res.body.data.results[0].status).toBe('PROCESSED');
    expect(res.body.data.results[0].original_timestamp).toBe(historicalTimestamp);

    // Verify the attendance record preserved original check-in timestamp and source_type
    const records = await request(app)
      .get(`/api/v1/${orgIdA}/attendance/records?date=2026-09-10`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-organization-id', orgIdA);

    expect(records.status).toBe(200);
    const workerRecord = records.body.data.find((r: any) => r.person_id === personIdA);
    expect(workerRecord).toBeDefined();
    expect(workerRecord.check_in_time).toBe(historicalTimestamp);
    expect(workerRecord.status_explanation).toBe('Offline sync check-in recorded');
    expect(workerRecord.confidence_verdict).toBe('VERIFIED');
  });

  it('enforces idempotency: re-submitting duplicate event batch reports DUPLICATE and avoids duplicate records', async () => {
    const historicalTimestamp = '2026-09-10T08:15:30.000Z';
    const localEventId = `offline_ev_idem_${Date.now()}`;

    // First submission
    const res1 = await request(app)
      .post(`/api/v1/${orgIdA}/sync/offline-events`)
      .set('x-device-id', deviceIdA)
      .set('x-device-key', deviceApiKeyA)
      .set('x-organization-id', orgIdA)
      .send({
        device_id: deviceIdA,
        events: [
          {
            local_event_id: localEventId,
            timestamp: historicalTimestamp,
            detection_method: 'FINGERPRINT',
            raw_payload: {
              person_id: personIdA,
            },
          },
        ],
      });
    expect(res1.status).toBe(200);

    // Second submission of the exact same event
    const res2 = await request(app)
      .post(`/api/v1/${orgIdA}/sync/offline-events`)
      .set('x-device-id', deviceIdA)
      .set('x-device-key', deviceApiKeyA)
      .set('x-organization-id', orgIdA)
      .send({
        device_id: deviceIdA,
        events: [
          {
            local_event_id: localEventId,
            timestamp: historicalTimestamp,
            detection_method: 'FINGERPRINT',
            raw_payload: {
              person_id: personIdA,
            },
          },
        ],
      });

    expect(res2.status).toBe(200);
    expect(res2.body.data.duplicate_count).toBe(1);
    expect(res2.body.data.processed_count).toBe(0);
    expect(res2.body.data.results[0].status).toBe('DUPLICATE');
  });

  it('detects impossible travel / conflicting events without silently overwriting', async () => {
    // Register a second device in another location
    const locB = await request(app)
      .post(`/api/v1/${orgIdA}/locations`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-organization-id', orgIdA)
      .send({ name: 'Remote Outpost', code: 'OUTPOST-01', type: 'SITE' });
    const remoteLocationId = locB.body.data.id;

    const dev2 = await request(app)
      .post(`/api/v1/${orgIdA}/devices`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-organization-id', orgIdA)
      .send({
        name: 'Remote Kiosk',
        device_type: 'KIOSK',
        serial_number: `KIOSK-REMOTE-${Date.now()}`,
        location_id: remoteLocationId,
      });
    const deviceId2 = dev2.body.data.device.id;
    const deviceApiKey2 = dev2.body.data.credentials.api_key;

    // Synchronize event at device 2 within 1 minute of another event
    const timestampConflict = '2026-09-10T08:16:00.000Z'; // 30 seconds after previous event at location A
    const res = await request(app)
      .post(`/api/v1/${orgIdA}/sync/offline-events`)
      .set('x-device-id', deviceId2)
      .set('x-device-key', deviceApiKey2)
      .set('x-organization-id', orgIdA)
      .send({
        device_id: deviceId2,
        events: [
          {
            local_event_id: `conflict_ev_${Date.now()}`,
            timestamp: timestampConflict,
            detection_method: 'FACE_TERMINAL',
            raw_payload: {
              person_id: personIdA,
            },
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.conflict_count).toBe(1);
    expect(res.body.data.results[0].status).toBe('CONFLICT');
  });

  it('enforces multi-tenant security: device from Org A cannot submit events for Org B', async () => {
    const res = await request(app)
      .post(`/api/v1/${orgIdB}/sync/offline-events`)
      .set('x-device-id', deviceIdA)
      .set('x-device-key', deviceApiKeyA)
      .set('x-organization-id', orgIdB)
      .send({
        device_id: deviceIdA,
        events: [
          {
            local_event_id: `cross_tenant_${Date.now()}`,
            timestamp: '2026-09-11T09:00:00.000Z',
            detection_method: 'RFID',
            raw_payload: { person_id: personIdA },
          },
        ],
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CROSS_TENANT_ACCESS_DENIED');
  });
});
