import { Device } from '@uapms/shared-types';
import { createHash, randomBytes } from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import { execute, query, queryOne, transaction } from '../../core/database/db.js';
import { AppError } from '../../middleware/errorHandler.js';
import { auditService } from '../audit/auditService.js';

function mapDevice(row: any): Device {
  const { credential_hash: _credentialHash, ...safeRow } = row;
  return {
    ...safeRow,
    config: safeRow.config ? JSON.parse(safeRow.config) : undefined,
  };
}

function hashCredential(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export const deviceService = {
  listDevices(organizationId: string, status?: string): Device[] {
    let sql = 'SELECT * FROM devices WHERE organization_id = ?';
    const params: string[] = [organizationId];
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    sql += ' ORDER BY name ASC';
    return query<any>(sql, params).map(mapDevice);
  },

  getDeviceById(organizationId: string, deviceId: string): Device | undefined {
    const row = queryOne<any>('SELECT * FROM devices WHERE id = ? AND organization_id = ?', [deviceId, organizationId]);
    return row ? mapDevice(row) : undefined;
  },

  registerDevice(params: {
    organization_id: string;
    location_id?: string | null;
    name: string;
    device_type: string;
    serial_number: string;
    ip_address?: string;
    firmware_version?: string;
    config?: Record<string, any>;
    actor_id: string;
  }) {
    const existing = queryOne('SELECT id FROM devices WHERE organization_id = ? AND serial_number = ?', [
      params.organization_id,
      params.serial_number,
    ]);
    if (existing) {
      throw new AppError(`Device with serial number "${params.serial_number}" already exists in this organization`, 409, 'DEVICE_SERIAL_EXISTS');
    }

    if (params.location_id) {
      const location = queryOne('SELECT id FROM locations WHERE id = ? AND organization_id = ?', [params.location_id, params.organization_id]);
      if (!location) throw new AppError('Location not found', 404, 'LOCATION_NOT_FOUND');
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    const apiKey = `uapms_${randomBytes(18).toString('hex')}`;
    const apiSecret = randomBytes(32).toString('hex');

    execute(
      `INSERT INTO devices (
        id, organization_id, location_id, name, device_type, serial_number, status,
        ip_address, firmware_version, credential_hash, config, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?, ?)`,
      [
        id,
        params.organization_id,
        params.location_id || null,
        params.name,
        params.device_type,
        params.serial_number,
        params.ip_address || null,
        params.firmware_version || null,
        hashCredential(apiSecret),
        params.config ? JSON.stringify(params.config) : null,
        now,
        now,
      ]
    );

    execute(
      `INSERT INTO device_credentials (id, device_id, api_key_hash, secret_hash, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [uuidv4(), id, hashCredential(apiKey), hashCredential(apiSecret), now]
    );

    auditService.log({
      organization_id: params.organization_id,
      actor_id: params.actor_id,
      action: 'DEVICE_REGISTERED',
      entity_type: 'DEVICE',
      entity_id: id,
      new_state: { name: params.name, device_type: params.device_type, serial_number: params.serial_number },
    });

    return {
      device: this.getDeviceById(params.organization_id, id)!,
      credentials: { api_key: apiKey, api_secret: apiSecret },
    };
  },

  updateDevice(organizationId: string, deviceId: string, updates: Record<string, any>, actorId: string) {
    const current = this.getDeviceById(organizationId, deviceId);
    if (!current) throw new AppError('Device not found', 404, 'DEVICE_NOT_FOUND');

    if (updates.location_id) {
      const location = queryOne('SELECT id FROM locations WHERE id = ? AND organization_id = ?', [updates.location_id, organizationId]);
      if (!location) throw new AppError('Location not found', 404, 'LOCATION_NOT_FOUND');
    }

    execute(
      `UPDATE devices SET
        location_id = COALESCE(?, location_id), name = COALESCE(?, name),
        device_type = COALESCE(?, device_type), ip_address = COALESCE(?, ip_address),
        firmware_version = COALESCE(?, firmware_version), status = COALESCE(?, status),
        config = COALESCE(?, config), updated_at = ?
       WHERE id = ? AND organization_id = ?`,
      [
        updates.location_id || null,
        updates.name || null,
        updates.device_type || null,
        updates.ip_address || null,
        updates.firmware_version || null,
        updates.status || null,
        updates.config ? JSON.stringify(updates.config) : null,
        new Date().toISOString(),
        deviceId,
        organizationId,
      ]
    );

    auditService.log({
      organization_id: organizationId,
      actor_id: actorId,
      action: 'DEVICE_UPDATED',
      entity_type: 'DEVICE',
      entity_id: deviceId,
      previous_state: current,
      new_state: updates,
    });
    return this.getDeviceById(organizationId, deviceId);
  },

  rotateCredentials(organizationId: string, deviceId: string, actorId: string) {
    const device = this.getDeviceById(organizationId, deviceId);
    if (!device) throw new AppError('Device not found', 404, 'DEVICE_NOT_FOUND');

    const apiKey = `uapms_${randomBytes(18).toString('hex')}`;
    const apiSecret = randomBytes(32).toString('hex');
    const now = new Date().toISOString();

    transaction(() => {
      execute('UPDATE device_credentials SET is_active = 0 WHERE device_id = ? AND is_active = 1', [deviceId]);
      execute(
        `INSERT INTO device_credentials (id, device_id, api_key_hash, secret_hash, is_active, created_at)
         VALUES (?, ?, ?, ?, 1, ?)`,
        [uuidv4(), deviceId, hashCredential(apiKey), hashCredential(apiSecret), now]
      );
      execute('UPDATE devices SET credential_hash = ?, updated_at = ? WHERE id = ? AND organization_id = ?', [
        hashCredential(apiSecret),
        now,
        deviceId,
        organizationId,
      ]);
    });

    auditService.log({
      organization_id: organizationId,
      actor_id: actorId,
      action: 'DEVICE_CREDENTIALS_ROTATED',
      entity_type: 'DEVICE',
      entity_id: deviceId,
    });

    return { device: this.getDeviceById(organizationId, deviceId)!, credentials: { api_key: apiKey, api_secret: apiSecret } };
  },

  verifyDeviceCredentials(params: {
    organization_id: string;
    device_id: string;
    api_key: string;
    api_secret?: string;
  }): Device {
    const device = queryOne<any>('SELECT * FROM devices WHERE id = ?', [params.device_id]);
    if (!device) {
      throw new AppError('Invalid device credentials or device not found', 401, 'INVALID_DEVICE_CREDENTIALS');
    }

    if (device.organization_id !== params.organization_id) {
      throw new AppError('Cross-tenant access denied: Device does not belong to this organization', 403, 'CROSS_TENANT_ACCESS_DENIED');
    }

    if (device.status !== 'ACTIVE') {
      throw new AppError('Device is inactive or disabled', 403, 'DEVICE_INACTIVE');
    }

    const keyHash = hashCredential(params.api_key);
    let sql = `
      SELECT dc.* FROM device_credentials dc
      WHERE dc.device_id = ?
        AND dc.api_key_hash = ?
        AND dc.is_active = 1
    `;
    const queryParams = [params.device_id, keyHash];

    if (params.api_secret) {
      sql += ' AND dc.secret_hash = ?';
      queryParams.push(hashCredential(params.api_secret));
    }

    const cred = queryOne<any>(sql, queryParams);
    if (!cred) {
      throw new AppError('Invalid device credentials', 401, 'INVALID_DEVICE_CREDENTIALS');
    }

    const now = new Date().toISOString();
    execute('UPDATE devices SET last_seen_at = ?, updated_at = ? WHERE id = ?', [now, now, params.device_id]);
    return mapDevice(device);
  },
};