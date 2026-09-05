import { getDatabase } from '../core/database/db.js';

export interface DeviceTelemetry {
  device_id?: string;
  serial_number?: string;
  device_type?: string;
  platform?: string;
  ip_address?: string;
  user_agent?: string;
}

export interface DeviceVerificationResult {
  is_verified: boolean;
  is_registered: boolean;
  confidence_score: number;
  device_id?: string;
  device_name?: string;
  reason: string;
}

export class DeviceProvider {
  /**
   * Verifies if client device telemetry matches an active, authorized registered device in the organization
   */
  public verifyDevice(
    organizationId: string,
    telemetry: DeviceTelemetry,
    requireRegistration = false
  ): DeviceVerificationResult {
    const db = getDatabase();

    // 1. If device ID or serial number provided, check database
    if (telemetry.device_id || telemetry.serial_number) {
      let deviceQuery = `
        SELECT id, name, device_type, serial_number, status, ip_address 
        FROM devices 
        WHERE organization_id = ? AND status = 'ACTIVE'
      `;
      const params: any[] = [organizationId];

      if (telemetry.device_id && telemetry.serial_number) {
        deviceQuery += ` AND (id = ? OR serial_number = ?)`;
        params.push(telemetry.device_id, telemetry.serial_number);
      } else if (telemetry.device_id) {
        deviceQuery += ` AND id = ?`;
        params.push(telemetry.device_id);
      } else {
        deviceQuery += ` AND serial_number = ?`;
        params.push(telemetry.serial_number);
      }

      const device = db.prepare(deviceQuery).get(...params) as any;

      if (device) {
        // Update last seen timestamp
        try {
          db.prepare(`UPDATE devices SET last_seen_at = ?, updated_at = ? WHERE id = ?`).run(
            new Date().toISOString(),
            new Date().toISOString(),
            device.id
          );
        } catch {
          // non-critical
        }

        return {
          is_verified: true,
          is_registered: true,
          confidence_score: 1.0,
          device_id: device.id,
          device_name: device.name,
          reason: `Device verified against active registry (${device.name} - ${device.device_type})`,
        };
      }
    }

    // 2. If registration is strictly mandatory for the tenant, reject unregistered devices
    if (requireRegistration) {
      return {
        is_verified: false,
        is_registered: false,
        confidence_score: 0.0,
        reason: 'Organization policy mandates attendance submission from a registered device',
      };
    }

    // 3. Fallback: Device is unregistered but organization allows unregistered client web/mobile submissions
    return {
      is_verified: true,
      is_registered: false,
      confidence_score: 0.6,
      reason: 'Device is unregistered but client meets web/mobile submission baseline',
    };
  }
}

export const deviceProvider = new DeviceProvider();
