import { v4 as uuidv4 } from 'uuid';
import { execute, query, queryOne, transaction } from '../../core/database/db.js';
import { AppError } from '../../middleware/errorHandler.js';
import { auditService } from '../audit/auditService.js';

export interface OfflineEventItem {
  local_event_id: string;
  timestamp: string; // Original client-side timestamp (preserved)
  detection_method: string;
  person_id?: string;
  person_code?: string;
  session_id?: string;
  event_type?: string; // 'CHECK_IN' | 'CHECK_OUT' | 'PRESENCE'
  location_id?: string;
  raw_payload: Record<string, any>;
  crypto_signature?: string;
}

export interface OfflineSyncBatchInput {
  organization_id: string;
  device_id: string;
  events: OfflineEventItem[];
  actor_id: string;
}

export interface SyncItemResult {
  local_event_id: string;
  server_event_id?: string;
  status: 'PROCESSED' | 'DUPLICATE' | 'CONFLICT' | 'REJECTED';
  original_timestamp: string;
  reason?: string;
}

export interface OfflineSyncBatchResult {
  batch_id: string;
  device_id: string;
  total_events: number;
  processed_count: number;
  duplicate_count: number;
  conflict_count: number;
  rejected_count: number;
  results: SyncItemResult[];
}

export const offlineSyncService = {
  processSyncBatch(input: OfflineSyncBatchInput): OfflineSyncBatchResult {
    const { organization_id, device_id, events, actor_id } = input;

    // 1. Verify device registration and status
    const device = queryOne<any>('SELECT * FROM devices WHERE id = ? AND organization_id = ?', [
      device_id,
      organization_id,
    ]);
    if (!device) {
      throw new AppError('Device not found in this organization', 404, 'DEVICE_NOT_FOUND');
    }
    if (device.status !== 'ACTIVE') {
      throw new AppError(`Device is not active (${device.status})`, 403, 'DEVICE_INACTIVE');
    }

    // 2. Verify organization settings
    const orgSettings = queryOne<any>('SELECT allow_offline_sync FROM organization_settings WHERE organization_id = ?', [
      organization_id,
    ]);
    if (orgSettings && orgSettings.allow_offline_sync === 0) {
      throw new AppError('Offline synchronization is disabled for this organization', 403, 'OFFLINE_SYNC_DISABLED');
    }

    const batchId = uuidv4();
    const now = new Date().toISOString();
    const results: SyncItemResult[] = [];
    let processedCount = 0;
    let duplicateCount = 0;
    let conflictCount = 0;
    let rejectedCount = 0;

    // Update device last seen
    execute('UPDATE devices SET last_seen_at = ?, updated_at = ? WHERE id = ?', [now, now, device_id]);

    transaction(() => {
      for (const item of events) {
        // Validate timestamp
        const itemDate = new Date(item.timestamp);
        if (isNaN(itemDate.getTime())) {
          rejectedCount++;
          results.push({
            local_event_id: item.local_event_id,
            status: 'REJECTED',
            original_timestamp: item.timestamp,
            reason: 'Invalid timestamp format',
          });
          continue;
        }

        // 3. Resolve Person
        let personId = item.person_id || item.raw_payload?.person_id;
        if (!personId && item.person_code) {
          const person = queryOne<any>('SELECT id FROM persons WHERE person_code = ? AND organization_id = ?', [
            item.person_code,
            organization_id,
          ]);
          personId = person?.id;
        } else if (!personId && item.raw_payload?.person_code) {
          const person = queryOne<any>('SELECT id FROM persons WHERE person_code = ? AND organization_id = ?', [
            item.raw_payload.person_code,
            organization_id,
          ]);
          personId = person?.id;
        }

        if (!personId) {
          rejectedCount++;
          results.push({
            local_event_id: item.local_event_id,
            status: 'REJECTED',
            original_timestamp: item.timestamp,
            reason: 'Unresolvable person identity',
          });
          continue;
        }

        const personExists = queryOne('SELECT id FROM persons WHERE id = ? AND organization_id = ?', [
          personId,
          organization_id,
        ]);
        if (!personExists) {
          rejectedCount++;
          results.push({
            local_event_id: item.local_event_id,
            status: 'REJECTED',
            original_timestamp: item.timestamp,
            reason: 'Person does not belong to this organization',
          });
          continue;
        }

        // 4. Duplicate Check (Idempotency)
        // Check if event already synced by local_event_id from this device
        const existingEvent = queryOne<any>(
          `SELECT id FROM attendance_events 
           WHERE organization_id = ? AND device_id = ? AND provider_reference = ?`,
          [organization_id, device_id, item.local_event_id]
        );

        if (existingEvent) {
          duplicateCount++;
          results.push({
            local_event_id: item.local_event_id,
            server_event_id: existingEvent.id,
            status: 'DUPLICATE',
            original_timestamp: item.timestamp,
            reason: 'Event already synchronized',
          });
          continue;
        }

        // Also check exact timestamp fingerprint duplication for the same person
        const duplicateRecord = queryOne<any>(
          `SELECT id FROM attendance_events
           WHERE organization_id = ? AND person_id = ? AND timestamp = ? AND detection_method = ?`,
          [organization_id, personId, item.timestamp, item.detection_method]
        );
        if (duplicateRecord) {
          duplicateCount++;
          results.push({
            local_event_id: item.local_event_id,
            server_event_id: duplicateRecord.id,
            status: 'DUPLICATE',
            original_timestamp: item.timestamp,
            reason: 'Duplicate detection timestamp for person',
          });
          continue;
        }

        // 5. Conflict Detection
        // Look for contradictory events (e.g. impossible travel: event within 5 minutes at completely different location)
        const locationId = item.location_id || device.location_id || null;
        const timeWindowBefore = new Date(itemDate.getTime() - 5 * 60 * 1000).toISOString();
        const timeWindowAfter = new Date(itemDate.getTime() + 5 * 60 * 1000).toISOString();

        const nearbyEvents = query<any>(
          `SELECT id, device_id, timestamp, location_data FROM attendance_events
           WHERE organization_id = ? AND person_id = ? AND timestamp BETWEEN ? AND ?
             AND device_id != ?`,
          [organization_id, personId, timeWindowBefore, timeWindowAfter, device_id]
        );

        const isConflict = nearbyEvents.length > 0;
        const eventId = uuidv4();
        const detectionEventId = uuidv4();
        const dateStr = item.timestamp.slice(0, 10);
        const eventType = item.event_type || 'CHECK_IN';

        // Master Prompt §26: "Preserve original timestamp, preserve device identity, validate duplicates/conflicts, do not silently overwrite conflicting events."
        const processingStatus = isConflict ? 'FLAGGED_CONFLICT' : 'PROCESSED';

        // Record normalized attendance_event
        execute(
          `INSERT INTO attendance_events (
            id, organization_id, person_id, device_id, session_id,
            detection_method, timestamp, timezone, location_data,
            provider_reference, is_simulated, metadata, processing_status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'UTC', ?, ?, 0, ?, ?, ?)`,
          [
            eventId,
            organization_id,
            personId,
            device_id,
            item.session_id || null,
            item.detection_method,
            item.timestamp, // Original client-side timestamp strictly preserved
            locationId ? JSON.stringify({ location_id: locationId }) : null,
            item.local_event_id,
            JSON.stringify({
              ...item.raw_payload,
              local_event_id: item.local_event_id,
              batch_id: batchId,
              is_conflict: isConflict,
              offline_sync: true,
            }),
            processingStatus,
            now,
          ]
        );

        // Record detection_event for raw audit trail
        execute(
          `INSERT INTO detection_events (
            id, organization_id, session_id, person_id, detection_method,
            event_type, timestamp, location_id, device_id, confidence_score,
            raw_payload, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0.95, ?, ?)`,
          [
            detectionEventId,
            organization_id,
            item.session_id || null,
            personId,
            item.detection_method,
            eventType,
            item.timestamp,
            locationId,
            device_id,
            JSON.stringify(item.raw_payload || {}),
            now,
          ]
        );

        // Record or update attendance_record
        const existingRecord = queryOne<any>(
          `SELECT id, check_in_time, check_out_time, status FROM attendance_records
           WHERE organization_id = ? AND person_id = ? AND date = ?`,
          [organization_id, personId, dateStr]
        );

        if (!existingRecord) {
          const recordId = uuidv4();
          execute(
            `INSERT INTO attendance_records (
              id, organization_id, person_id, session_id, date,
              status, check_in_time, check_in_method, check_in_event_id,
              status_explanation, confidence_score, confidence_verdict, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0.95, ?, ?, ?)`,
            [
              recordId,
              organization_id,
              personId,
              item.session_id || null,
              dateStr,
              isConflict ? 'SUSPICIOUS' : 'PRESENT',
              item.timestamp,
              item.detection_method,
              eventId,
              isConflict
                ? 'Offline sync detected conflicting location/device activity within 5 minutes'
                : 'Offline sync check-in recorded',
              isConflict ? 'SUSPICIOUS' : 'VERIFIED',
              now,
              now,
            ]
          );
        } else if (eventType === 'CHECK_OUT' && !existingRecord.check_out_time) {
          execute(
            `UPDATE attendance_records SET
              check_out_time = ?, check_out_method = ?, check_out_event_id = ?,
              status = CASE WHEN ? = 1 THEN 'SUSPICIOUS' ELSE status END,
              confidence_verdict = CASE WHEN ? = 1 THEN 'SUSPICIOUS' ELSE confidence_verdict END,
              status_explanation = CASE WHEN ? = 1 THEN 'Offline sync check-out conflict detected' ELSE status_explanation END,
              updated_at = ?
             WHERE id = ?`,
            [
              item.timestamp,
              item.detection_method,
              eventId,
              isConflict ? 1 : 0,
              isConflict ? 1 : 0,
              isConflict ? 1 : 0,
              now,
              existingRecord.id,
            ]
          );
        }

        if (isConflict) {
          conflictCount++;
          results.push({
            local_event_id: item.local_event_id,
            server_event_id: eventId,
            status: 'CONFLICT',
            original_timestamp: item.timestamp,
            reason: 'Conflicting event detected at another location/device within travel window',
          });
        } else {
          processedCount++;
          results.push({
            local_event_id: item.local_event_id,
            server_event_id: eventId,
            status: 'PROCESSED',
            original_timestamp: item.timestamp,
          });
        }
      }
    });

    auditService.log({
      organization_id,
      actor_id,
      action: 'OFFLINE_SYNC_COMPLETED',
      entity_type: 'DEVICE',
      entity_id: device_id,
      new_state: {
        batch_id: batchId,
        total: events.length,
        processed: processedCount,
        duplicates: duplicateCount,
        conflicts: conflictCount,
        rejected: rejectedCount,
      },
    });

    return {
      batch_id: batchId,
      device_id,
      total_events: events.length,
      processed_count: processedCount,
      duplicate_count: duplicateCount,
      conflict_count: conflictCount,
      rejected_count: rejectedCount,
      results,
    };
  },
};
