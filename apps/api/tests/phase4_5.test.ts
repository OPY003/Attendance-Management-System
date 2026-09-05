import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { qrProvider } from '../src/providers/qrProvider.js';
import { gpsProvider } from '../src/providers/gpsProvider.js';
import { deviceProvider } from '../src/providers/deviceProvider.js';
import { kioskProvider } from '../src/providers/kioskProvider.js';
import { confidenceEngine } from '../src/engines/confidenceEngine.js';

const app = createApp();

describe('Phase 4 & Phase 5: Detection Providers, Policy Engine & Confidence Verification', () => {
  let orgOwnerToken: string;
  let orgId: string;
  let testPersonId: string;
  let testSessionId: string;
  let testLocationId: string;
  let registeredDeviceId: string;

  beforeAll(async () => {
    // 1. Sign up organization owner
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: `phase4_owner_${Date.now()}@apexcorp.com`,
        password: 'Password@12345!',
        first_name: 'Apex',
        last_name: 'Director',
        organization_name: 'Apex Industrial Corp',
        organization_category: 'INDUSTRIAL_FACTORY',
      });

    expect(regRes.status).toBe(201);
    orgId = regRes.body.data.organization_id;

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: regRes.body.data.email,
        password: 'Password@12345!',
      });

    expect(loginRes.status).toBe(200);
    orgOwnerToken = loginRes.body.data.tokens.access_token;

    // 2. Create a Location with circular and polygon geofence
    const polygonGeoJson = JSON.stringify({
      type: 'Polygon',
      coordinates: [
        [
          [90.41, 23.77],
          [90.41, 23.78],
          [90.43, 23.78],
          [90.43, 23.77],
          [90.41, 23.77],
        ],
      ],
    });

    const locRes = await request(app)
      .post(`/api/v1/${orgId}/locations`)
      .set('Authorization', `Bearer ${orgOwnerToken}`)
      .set('x-organization-id', orgId)
      .send({
        name: 'Apex Manufacturing Plant 1',
        code: `LOC-APEX-${Date.now()}`,
        type: 'CAMPUS',
        latitude: 23.777,
        longitude: 90.42,
        radius_meters: 100.0,
        polygon_geojson: polygonGeoJson,
      });

    expect(locRes.status).toBe(201);
    testLocationId = locRes.body.data.id;

    // 3. Create a Person
    const personRes = await request(app)
      .post(`/api/v1/${orgId}/persons`)
      .set('Authorization', `Bearer ${orgOwnerToken}`)
      .set('x-organization-id', orgId)
      .send({
        first_name: 'Tariq',
        last_name: 'Rahman',
        person_code: `P4-EMP-${Date.now()}`,
        email: `tariq_${Date.now()}@apexcorp.com`,
      });

    expect(personRes.status).toBe(201);
    testPersonId = personRes.body.data.id;

    // 4. Create an Attendance Session
    const sessionRes = await request(app)
      .post(`/api/v1/${orgId}/sessions`)
      .set('Authorization', `Bearer ${orgOwnerToken}`)
      .set('x-organization-id', orgId)
      .send({
        name: 'Morning Industrial Shift Session',
        session_type: 'SHIFT',
        location_id: testLocationId,
        start_time: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        end_time: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
      });

    expect(sessionRes.status).toBe(201);
    testSessionId = sessionRes.body.data.id;
  });

  // =========================================================================
  // 1. Dynamic QR Code Provider Tests
  // =========================================================================
  describe('1. Dynamic QR Provider (HMAC-SHA256 & Anti-Replay)', () => {
    it('should generate a valid signed time-bound dynamic QR token', () => {
      const { token, qrPayload } = qrProvider.generateDynamicToken(orgId, testSessionId, 30);
      expect(token).toBeDefined();
      expect(token).toContain('.');
      expect(qrPayload.organization_id).toBe(orgId);
      expect(qrPayload.session_id).toBe(testSessionId);
      expect(qrPayload.expires_at).toBeGreaterThan(Date.now());
    });

    it('should successfully verify a freshly minted dynamic QR token', () => {
      const { token } = qrProvider.generateDynamicToken(orgId, testSessionId, 30);
      const verifyRes = qrProvider.verifyDynamicToken(token, orgId, testSessionId, testPersonId);
      expect(verifyRes.is_valid).toBe(true);
      expect(verifyRes.payload?.organization_id).toBe(orgId);
    });

    it('should reject a tampered QR token with signature mismatch', () => {
      const { token } = qrProvider.generateDynamicToken(orgId, testSessionId, 30);
      const [payload, sig] = token.split('.');
      const tamperedToken = `${payload}.${sig.replace(/a/g, 'b')}`;

      const verifyRes = qrProvider.verifyDynamicToken(tamperedToken, orgId, testSessionId);
      expect(verifyRes.is_valid).toBe(false);
      expect(verifyRes.reason).toContain('signature mismatch');
    });

    it('should enforce anti-replay / anti-screenshot: duplicate scan of same QR is rejected', () => {
      const { token } = qrProvider.generateDynamicToken(orgId, testSessionId, 30);

      // First redemption: success
      const firstUse = qrProvider.verifyDynamicToken(token, orgId, testSessionId, testPersonId);
      expect(firstUse.is_valid).toBe(true);

      // Second redemption with same token: rejected
      const secondUse = qrProvider.verifyDynamicToken(token, orgId, testSessionId, testPersonId);
      expect(secondUse.is_valid).toBe(false);
      expect(secondUse.reason).toContain('Replay detected');
    });

    it('should reject an expired dynamic QR token', () => {
      // Token with negative validity
      const { token } = qrProvider.generateDynamicToken(orgId, testSessionId, -5);
      const verifyRes = qrProvider.verifyDynamicToken(token, orgId, testSessionId);
      expect(verifyRes.is_valid).toBe(false);
      expect(verifyRes.reason).toContain('expired');
    });
  });

  // =========================================================================
  // 2. GPS & Geofence Provider Tests
  // =========================================================================
  describe('2. GPS & Geofence Provider (Haversine & Polygon Ray-Casting)', () => {
    it('should accurately calculate distance using Haversine formula', () => {
      // 1 degree latitude ~ 111,000 meters
      const p1 = { latitude: 23.777, longitude: 90.42 };
      const p2 = { latitude: 23.778, longitude: 90.42 };
      const dist = gpsProvider.calculateDistanceMeters(p1, p2);
      expect(dist).toBeGreaterThan(100);
      expect(dist).toBeLessThan(120);
    });

    it('should verify coordinate inside circular geofence boundary', () => {
      const insideCoord = { latitude: 23.7771, longitude: 90.4201, accuracy_meters: 10 };
      const target = { id: testLocationId, name: 'Apex Plant', latitude: 23.777, longitude: 90.42, radius_meters: 100 };

      const res = gpsProvider.verifyGeofence(insideCoord, target);
      expect(res.is_inside).toBe(true);
      expect(res.accuracy_acceptable).toBe(true);
    });

    it('should reject coordinate outside circular geofence boundary', () => {
      // Point 5km away
      const farCoord = { latitude: 23.82, longitude: 90.42, accuracy_meters: 10 };
      const target = { id: testLocationId, name: 'Apex Plant', latitude: 23.777, longitude: 90.42, radius_meters: 100 };

      const res = gpsProvider.verifyGeofence(farCoord, target);
      expect(res.is_inside).toBe(false);
      expect(res.distance_meters).toBeGreaterThan(100);
    });

    it('should accurately verify coordinate inside multi-vertex GeoJSON polygon', () => {
      const insidePoint = { latitude: 23.775, longitude: 90.42, accuracy_meters: 8 };
      const target = {
        id: testLocationId,
        name: 'Apex Plant',
        polygon_geojson: JSON.stringify({
          type: 'Polygon',
          coordinates: [
            [
              [90.41, 23.77],
              [90.41, 23.78],
              [90.43, 23.78],
              [90.43, 23.77],
              [90.41, 23.77],
            ],
          ],
        }),
      };

      const res = gpsProvider.verifyGeofence(insidePoint, target);
      expect(res.is_inside).toBe(true);
    });

    it('should detect and reject Mock GPS / Fake Location Provider telemetry', () => {
      const mockCoord = { latitude: 23.777, longitude: 90.42, is_mock: true };
      const target = { id: testLocationId, name: 'Apex Plant', latitude: 23.777, longitude: 90.42, radius_meters: 100 };

      const res = gpsProvider.verifyGeofence(mockCoord, target);
      expect(res.is_inside).toBe(false);
      expect(res.mock_detected).toBe(true);
      expect(res.reason).toContain('Mock GPS');
    });
  });

  // =========================================================================
  // 3. Physical Kiosk Provider Tests
  // =========================================================================
  describe('3. Shared Physical Kiosk Provider', () => {
    it('should initialize kiosk terminal session and enforce sequential anti-double-scan cooldown', () => {
      const kiosk = kioskProvider.initializeKiosk('KIOSK-DEV-001', orgId, testLocationId, 3);
      expect(kiosk.current_state).toBe('IDLE');

      // First scan: allowed
      const attempt1 = kioskProvider.attemptScan('KIOSK-DEV-001', 'person-123');
      expect(attempt1.allowed).toBe(true);
      expect(attempt1.state).toBe('PROCESSING');

      // Immediate second scan by same person: rejected by cooldown
      const attempt2 = kioskProvider.attemptScan('KIOSK-DEV-001', 'person-123');
      expect(attempt2.allowed).toBe(false);
      expect(attempt2.reason).toContain('Rapid scan detected');

      // Complete scan resets state
      kioskProvider.completeScan('KIOSK-DEV-001', true);
    });
  });

  // =========================================================================
  // 4. Confidence Engine Tests
  // =========================================================================
  describe('4. Multi-Factor Confidence Scoring Engine', () => {
    it('should compute score and assign VERIFIED verdict for multi-factor match (QR + GPS + Device)', () => {
      const factors = [
        { factor_name: 'DYNAMIC_QR', weight: 40, earned_score: 40, max_score: 40, passed: true },
        { factor_name: 'GPS_GEOFENCE', weight: 30, earned_score: 30, max_score: 30, passed: true },
        { factor_name: 'REGISTERED_DEVICE', weight: 20, earned_score: 20, max_score: 20, passed: true },
      ];

      const result = confidenceEngine.evaluateConfidence(factors);
      expect(result.total_score).toBe(100);
      expect(result.verdict).toBe('VERIFIED');
      expect(result.is_acceptable).toBe(true);
    });

    it('should assign SUSPICIOUS verdict when factors fall below threshold', () => {
      const factors = [
        { factor_name: 'DYNAMIC_QR', weight: 40, earned_score: 0, max_score: 40, passed: false },
        { factor_name: 'GPS_GEOFENCE', weight: 30, earned_score: 10, max_score: 30, passed: false },
        { factor_name: 'REGISTERED_DEVICE', weight: 20, earned_score: 20, max_score: 20, passed: true },
      ];

      const result = confidenceEngine.evaluateConfidence(factors);
      expect(result.total_score).toBeLessThan(50);
      expect(result.verdict).toBe('SUSPICIOUS');
    });
  });

  // =========================================================================
  // 5. End-to-End Detection API & Evidence Trail
  // =========================================================================
  describe('5. Multi-Modal Detection API & Explainable Evidence Retrieval', () => {
    let generatedQrToken: string;

    it('should generate dynamic QR code via /api/v1/detection/qr/generate endpoint', async () => {
      const res = await request(app)
        .post('/api/v1/detection/qr/generate')
        .set('Authorization', `Bearer ${orgOwnerToken}`)
        .set('x-organization-id', orgId)
        .send({
          session_id: testSessionId,
          validity_seconds: 45,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.session_id).toBe(testSessionId);
      generatedQrToken = res.body.data.token;
    });

    it('should verify multi-modal check-in (Dynamic QR + GPS + Device) via /api/v1/detection/verify', async () => {
      const res = await request(app)
        .post('/api/v1/detection/verify')
        .set('Authorization', `Bearer ${orgOwnerToken}`)
        .set('x-organization-id', orgId)
        .send({
          person_id: testPersonId,
          session_id: testSessionId,
          qr_token: generatedQrToken,
          gps: {
            latitude: 23.777,
            longitude: 90.42,
            accuracy_meters: 12,
          },
          device: {
            device_type: 'MOBILE_APP',
            platform: 'iOS',
            serial_number: 'SN-APEX-PHONE-001',
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('PRESENT');
      expect(res.body.data.confidence_score).toBeGreaterThanOrEqual(80);
      expect(res.body.data.confidence_verdict).toBe('VERIFIED');
      expect(res.body.data.record_id).toBeDefined();
      expect(res.body.data.evidence_id).toBeDefined();

      const recordId = res.body.data.record_id;

      // Now query the explainable evidence trail
      const evidenceRes = await request(app)
        .get(`/api/v1/detection/evidence/${recordId}`)
        .set('Authorization', `Bearer ${orgOwnerToken}`)
        .set('x-organization-id', orgId);

      expect(evidenceRes.status).toBe(200);
      expect(evidenceRes.body.data.location_verified).toBe(true);
      expect(evidenceRes.body.data.confidence_breakdown.verdict).toBe('VERIFIED');
      expect(evidenceRes.body.data.explanation).toContain('verification factors satisfied');
    });

    it('should flag attendance as REJECTED when QR code is invalid or expired', async () => {
      const res = await request(app)
        .post('/api/v1/detection/verify')
        .set('Authorization', `Bearer ${orgOwnerToken}`)
        .set('x-organization-id', orgId)
        .send({
          person_id: testPersonId,
          session_id: testSessionId,
          qr_token: 'fake.invalid.token.123',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('REJECTED');
      expect(res.body.data.confidence_verdict).toBe('REJECTED');
    });
  });
});
