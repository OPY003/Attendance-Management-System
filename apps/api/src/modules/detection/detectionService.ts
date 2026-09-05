import crypto from 'crypto';
import { getDatabase } from '../../core/database/db.js';
import { AppError } from '../../middleware/errorHandler.js';
import { qrProvider } from '../../providers/qrProvider.js';
import { gpsProvider, GeoCoordinate } from '../../providers/gpsProvider.js';
import { deviceProvider, DeviceTelemetry } from '../../providers/deviceProvider.js';
import { confidenceEngine, DetectionFactor } from '../../engines/confidenceEngine.js';
import { policyEngine } from '../../engines/policyEngine.js';
import { evidenceEngine } from '../../engines/evidenceEngine.js';
import { attendanceEngine } from '../../engines/attendanceEngine.js';

export interface VerifyDetectionInput {
  organization_id: string;
  person_id: string;
  session_id?: string;
  qr_token?: string;
  gps?: GeoCoordinate;
  device?: DeviceTelemetry;
  detection_method?: string;
  timestamp?: string;
}

export class DetectionService {
  /**
   * Generates a new dynamic QR token for an active session
   */
  public generateSessionQr(organizationId: string, sessionId: string, validitySeconds = 30): any {
    const db = getDatabase();

    // Verify session exists and is active
    const session = db
      .prepare(`SELECT * FROM attendance_sessions WHERE id = ? AND organization_id = ?`)
      .get(sessionId, organizationId) as any;

    if (!session) {
      throw new AppError('Attendance session not found', 404, 'SESSION_NOT_FOUND');
    }

    if (session.status !== 'ACTIVE' && session.status !== 'SCHEDULED') {
      throw new AppError(`Cannot generate QR: Session is ${session.status}`, 400, 'SESSION_INACTIVE');
    }

    const { token, qrPayload } = qrProvider.generateDynamicToken(organizationId, sessionId, validitySeconds);

    // Save active QR token state to session
    db.prepare(`
      UPDATE attendance_sessions 
      SET current_dynamic_qr = ?, qr_expires_at = ?, updated_at = ? 
      WHERE id = ?
    `).run(token, new Date(qrPayload.expires_at).toISOString(), new Date().toISOString(), sessionId);

    return {
      session_id: sessionId,
      token,
      expires_at: new Date(qrPayload.expires_at).toISOString(),
      validity_seconds: validitySeconds,
    };
  }

  /**
   * Verifies submitted multi-modal detection signals (Dynamic QR, GPS, Device) through the complete engine pipeline
   */
  public verifyAndProcessDetection(input: VerifyDetectionInput): any {
    const db = getDatabase();
    const timestamp = input.timestamp || new Date().toISOString();

    // 1. Verify person exists and belongs to organization
    const person = db
      .prepare(`SELECT * FROM persons WHERE id = ? AND organization_id = ?`)
      .get(input.person_id, input.organization_id) as any;

    if (!person) {
      throw new AppError('Person not found in this organization', 404, 'PERSON_NOT_FOUND');
    }

    // 2. Fetch session and its assigned location & policy if provided
    let session: any = null;
    let location: any = null;
    let shift: any = null;

    if (input.session_id) {
      session = db
        .prepare(`SELECT * FROM attendance_sessions WHERE id = ? AND organization_id = ?`)
        .get(input.session_id, input.organization_id) as any;

      if (!session) {
        throw new AppError('Attendance session not found', 404, 'SESSION_NOT_FOUND');
      }

      if (session.location_id) {
        location = db
          .prepare(`SELECT * FROM locations WHERE id = ? AND organization_id = ?`)
          .get(session.location_id, input.organization_id) as any;
      }

      if (session.shift_id) {
        shift = db
          .prepare(`SELECT * FROM shifts WHERE id = ? AND organization_id = ?`)
          .get(session.shift_id, input.organization_id) as any;
      }
    }

    // 3. Track detection factors for Confidence Scoring
    const factors: DetectionFactor[] = [];
    const providedMethods: string[] = [];

    // Factor A: Dynamic QR Code
    let qrVerified = false;
    let qrReason = 'No QR token provided';
    if (input.qr_token) {
      providedMethods.push('DYNAMIC_QR');
      const qrResult = qrProvider.verifyDynamicToken(
        input.qr_token,
        input.organization_id,
        input.session_id,
        input.person_id
      );

      qrVerified = qrResult.is_valid;
      qrReason = qrResult.reason || (qrVerified ? 'Dynamic QR signature and timestamp verified' : 'Invalid QR');

      factors.push({
        factor_name: 'DYNAMIC_QR',
        weight: 40,
        earned_score: qrVerified ? 40 : 0,
        max_score: 40,
        passed: qrVerified,
        details: qrReason,
      });
    }

    // Factor B: GPS & Geofence
    let locationVerified = false;
    let locationDetails = 'No GPS telemetry submitted';
    if (input.gps && location) {
      providedMethods.push('GPS');
      const gpsResult = gpsProvider.verifyGeofence(input.gps, location);
      locationVerified = gpsResult.is_inside && !gpsResult.mock_detected && gpsResult.accuracy_acceptable;
      locationDetails = gpsResult.reason || (locationVerified ? 'Within verified geofence boundary' : 'Outside boundary');

      factors.push({
        factor_name: 'GPS_GEOFENCE',
        weight: 30,
        earned_score: locationVerified ? 30 : gpsResult.mock_detected ? -20 : 0,
        max_score: 30,
        passed: locationVerified,
        details: locationDetails,
      });
    } else if (input.gps && !location) {
      // GPS provided but location has no geofence restriction
      providedMethods.push('GPS');
      locationVerified = true;
      locationDetails = 'GPS submitted; location has no boundary restrictions';
      factors.push({
        factor_name: 'GPS_GEOFENCE',
        weight: 30,
        earned_score: 30,
        max_score: 30,
        passed: true,
        details: locationDetails,
      });
    }

    // Factor C: Registered Device Check
    let deviceVerified = false;
    let deviceDetails = 'No device telemetry submitted';
    if (input.device) {
      providedMethods.push('REGISTERED_DEVICE');
      const deviceResult = deviceProvider.verifyDevice(input.organization_id, input.device, false);
      deviceVerified = deviceResult.is_verified;
      deviceDetails = deviceResult.reason;

      factors.push({
        factor_name: 'REGISTERED_DEVICE',
        weight: 20,
        earned_score: deviceResult.is_registered ? 20 : 12,
        max_score: 20,
        passed: deviceVerified,
        details: deviceDetails,
      });
    }

    // Fallback if other detection method specified (e.g. RFID or KIOSK)
    if (input.detection_method && !providedMethods.includes(input.detection_method)) {
      providedMethods.push(input.detection_method);
      factors.push({
        factor_name: input.detection_method,
        weight: 30,
        earned_score: 30,
        max_score: 30,
        passed: true,
        details: `Verified by provider: ${input.detection_method}`,
      });
    }

    // 4. Compute Confidence Score
    const confidenceResult = confidenceEngine.evaluateConfidence(factors);

    // 5. Evaluate Policy Engine and AST Rules
    const policyResult = policyEngine.evaluatePolicy(
      input.organization_id,
      session?.policy_id,
      providedMethods,
      {
        person: {
          id: person.id,
          person_code: person.person_code,
          roles: [],
          department_id: person.department_id,
          status: person.status,
        },
        session: session
          ? {
              id: session.id,
              session_type: session.session_type,
              start_time: session.start_time,
              end_time: session.end_time,
            }
          : undefined,
        location: location
          ? {
              location_id: location.id,
              is_within_geofence: locationVerified,
              is_allowed_location: true,
            }
          : undefined,
        detection: {
          method: providedMethods.join(','),
          identity_confidence: confidenceResult.total_score,
          timestamp,
        },
        confidence_score: confidenceResult.total_score,
      }
    );

    // 6. Record Raw Detection Event
    const detectionEventId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO detection_events (
        id,
        organization_id,
        session_id,
        person_id,
        detection_method,
        event_type,
        timestamp,
        location_id,
        latitude,
        longitude,
        confidence_score,
        raw_payload,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      detectionEventId,
      input.organization_id,
      input.session_id || null,
      input.person_id,
      providedMethods.join(',') || 'UNKNOWN',
      'CHECK_IN',
      timestamp,
      location?.id || null,
      input.gps?.latitude || null,
      input.gps?.longitude || null,
      confidenceResult.total_score / 100,
      JSON.stringify(input),
      new Date().toISOString()
    );

    // 7. Determine Attendance Status with Attendance Calculation Engine
    let finalStatus = 'PRESENT';
    let statusExplanation = 'Attendance verified and recorded';

    if (!policyResult.is_compliant || confidenceResult.verdict === 'REJECTED') {
      finalStatus = 'REJECTED';
      statusExplanation = policyResult.reason || confidenceResult.explanation;
    } else if (confidenceResult.verdict === 'SUSPICIOUS' || confidenceResult.verdict === 'REVIEW') {
      finalStatus = 'SUSPICIOUS';
      statusExplanation = `Confidence score (${confidenceResult.total_score}%) requires supervisor review: ${confidenceResult.explanation}`;
    } else if (shift) {
      // Calculate punctuality relative to shift window
      const checkResult = attendanceEngine.evaluateCheckIn(timestamp, shift);
      finalStatus = checkResult.status;
      statusExplanation = checkResult.explanation;
    }

    // 8. Create or Update Attendance Record
    const recordId = crypto.randomUUID();
    const date = timestamp.split('T')[0];

    db.prepare(`
      INSERT INTO attendance_records (
        id,
        organization_id,
        person_id,
        session_id,
        shift_id,
        date,
        status,
        check_in_time,
        check_in_method,
        check_in_event_id,
        confidence_score,
        confidence_verdict,
        policy_id,
        status_explanation,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      recordId,
      input.organization_id,
      input.person_id,
      input.session_id || null,
      shift?.id || null,
      date,
      finalStatus,
      timestamp,
      providedMethods.join(',') || 'UNKNOWN',
      detectionEventId,
      confidenceResult.total_score,
      confidenceResult.verdict,
      policyResult.policy_id || null,
      statusExplanation,
      new Date().toISOString(),
      new Date().toISOString()
    );

    // 9. Record Immutable Evidence Trail
    const evidenceId = evidenceEngine.recordEvidence({
      attendance_record_id: recordId,
      organization_id: input.organization_id,
      raw_events: [input],
      location_verified: locationVerified,
      location_details: locationDetails,
      device_verified: deviceVerified,
      device_details: deviceDetails,
      identity_verified: qrVerified || providedMethods.length > 0,
      identity_details: qrReason,
      confidence_result: confidenceResult,
      rules_evaluated: policyResult.rule_results,
    });

    return {
      record_id: recordId,
      detection_event_id: detectionEventId,
      evidence_id: evidenceId,
      status: finalStatus,
      confidence_score: confidenceResult.total_score,
      confidence_verdict: confidenceResult.verdict,
      is_acceptable: confidenceResult.is_acceptable && policyResult.is_compliant,
      status_explanation: statusExplanation,
      policy_evaluation: {
        policy_id: policyResult.policy_id,
        is_compliant: policyResult.is_compliant,
        missing_required_methods: policyResult.missing_required_methods,
        rule_results: policyResult.rule_results,
      },
    };
  }
}

export const detectionService = new DetectionService();
