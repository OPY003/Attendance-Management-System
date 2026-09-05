import crypto from 'crypto';
import { getDatabase } from '../core/database/db.js';
import { ConfidenceEvaluationResult } from './confidenceEngine.js';
import { RuleEvaluationResult } from '@uapms/rule-engine-core';

export interface EvidenceRecordInput {
  attendance_record_id: string;
  organization_id: string;
  raw_events: any[];
  location_verified: boolean;
  location_details?: string;
  device_verified: boolean;
  device_details?: string;
  identity_verified: boolean;
  identity_details?: string;
  confidence_result: ConfidenceEvaluationResult;
  rules_evaluated: RuleEvaluationResult[];
}

export class EvidenceEngine {
  /**
   * Persists an immutable, audit-linked attendance evidence record
   */
  public recordEvidence(input: EvidenceRecordInput): string {
    const db = getDatabase();
    const evidenceId = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO attendance_evidence (
        id,
        attendance_record_id,
        organization_id,
        detection_events_json,
        location_verified,
        location_verification_details,
        device_verified,
        device_verification_details,
        identity_verified,
        identity_verification_details,
        confidence_breakdown_json,
        rules_evaluated_json,
        explanation,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      evidenceId,
      input.attendance_record_id,
      input.organization_id,
      JSON.stringify(input.raw_events),
      input.location_verified ? 1 : 0,
      input.location_details || null,
      input.device_verified ? 1 : 0,
      input.device_details || null,
      input.identity_verified ? 1 : 0,
      input.identity_details || null,
      JSON.stringify({
        total_score: input.confidence_result.total_score,
        verdict: input.confidence_result.verdict,
        factors: input.confidence_result.factors,
      }),
      JSON.stringify(input.rules_evaluated),
      input.confidence_result.explanation,
      now
    );

    return evidenceId;
  }

  /**
   * Retrieves full evidence by attendance record ID
   */
  public getEvidenceByRecordId(attendanceRecordId: string, organizationId: string): any {
    const db = getDatabase();
    const row = db.prepare(`
      SELECT * FROM attendance_evidence 
      WHERE attendance_record_id = ? AND organization_id = ?
    `).get(attendanceRecordId, organizationId) as any;

    if (!row) return null;

    return {
      id: row.id,
      attendance_record_id: row.attendance_record_id,
      organization_id: row.organization_id,
      detection_events: JSON.parse(row.detection_events_json || '[]'),
      location_verified: Boolean(row.location_verified),
      location_verification_details: row.location_verification_details,
      device_verified: Boolean(row.device_verified),
      device_verification_details: row.device_verification_details,
      identity_verified: Boolean(row.identity_verified),
      identity_verification_details: row.identity_verification_details,
      confidence_breakdown: JSON.parse(row.confidence_breakdown_json || '{}'),
      rules_evaluated: JSON.parse(row.rules_evaluated_json || '[]'),
      explanation: row.explanation,
      created_at: row.created_at,
    };
  }
}

export const evidenceEngine = new EvidenceEngine();
