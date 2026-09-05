import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, execute } from '../../core/database/db.js';
import { AppError } from '../../middleware/errorHandler.js';
import { auditService } from '../audit/auditService.js';
import { Location, LocationType } from '@uapms/shared-types';

export const locationService = {
  /**
   * Lists all locations for an organization
   */
  listLocations(organizationId: string, parentId?: string): Location[] {
    let sql = 'SELECT * FROM locations WHERE organization_id = ?';
    const params: any[] = [organizationId];

    if (parentId !== undefined) {
      if (parentId === 'null' || parentId === '') {
        sql += ' AND parent_id IS NULL';
      } else {
        sql += ' AND parent_id = ?';
        params.push(parentId);
      }
    }

    sql += ' ORDER BY name ASC';
    const rows = query<any>(sql, params);

    return rows.map((r) => ({
      id: r.id,
      organization_id: r.organization_id,
      parent_id: r.parent_id,
      name: r.name,
      code: r.code,
      type: r.type as LocationType,
      hierarchy_path: r.hierarchy_path,
      coordinates: r.latitude && r.longitude ? { latitude: r.latitude, longitude: r.longitude } : undefined,
      radius_meters: r.radius_meters,
      polygon_geojson: r.polygon_geojson,
      wifi_ssids: r.wifi_ssids ? JSON.parse(r.wifi_ssids) : undefined,
      ble_beacons: r.ble_beacons ? JSON.parse(r.ble_beacons) : undefined,
      ip_ranges: r.ip_ranges ? JSON.parse(r.ip_ranges) : undefined,
      timezone: r.timezone || 'UTC',
      is_active: Boolean(r.is_active),
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));
  },

  /**
   * Retrieves single location by ID
   */
  getLocationById(organizationId: string, locationId: string): Location | undefined {
    const r = queryOne<any>('SELECT * FROM locations WHERE id = ? AND organization_id = ?', [locationId, organizationId]);
    if (!r) return undefined;

    return {
      id: r.id,
      organization_id: r.organization_id,
      parent_id: r.parent_id,
      name: r.name,
      code: r.code,
      type: r.type as LocationType,
      hierarchy_path: r.hierarchy_path,
      coordinates: r.latitude && r.longitude ? { latitude: r.latitude, longitude: r.longitude } : undefined,
      radius_meters: r.radius_meters,
      polygon_geojson: r.polygon_geojson,
      wifi_ssids: r.wifi_ssids ? JSON.parse(r.wifi_ssids) : undefined,
      ble_beacons: r.ble_beacons ? JSON.parse(r.ble_beacons) : undefined,
      ip_ranges: r.ip_ranges ? JSON.parse(r.ip_ranges) : undefined,
      timezone: r.timezone || 'UTC',
      is_active: Boolean(r.is_active),
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
  },

  /**
   * Creates a hierarchical location with computed materialized hierarchy path
   */
  createLocation(params: {
    organization_id: string;
    parent_id?: string | null;
    name: string;
    code: string;
    type: string;
    latitude?: number;
    longitude?: number;
    radius_meters?: number;
    polygon_geojson?: string;
    wifi_ssids?: string[];
    ble_beacons?: string[];
    ip_ranges?: string[];
    timezone?: string;
    actor_id: string;
  }): Location {
    const existing = queryOne('SELECT id FROM locations WHERE organization_id = ? AND code = ?', [
      params.organization_id,
      params.code,
    ]);

    if (existing) {
      throw new AppError(`Location with code "${params.code}" already exists in this organization`, 409, 'LOCATION_CODE_EXISTS');
    }

    let hierarchyPath = `/${params.code.toLowerCase()}`;
    if (params.parent_id) {
      const parent = this.getLocationById(params.organization_id, params.parent_id);
      if (!parent) {
        throw new AppError('Parent location not found', 404, 'PARENT_LOCATION_NOT_FOUND');
      }
      hierarchyPath = `${parent.hierarchy_path || ''}/${params.code.toLowerCase()}`;
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    execute(
      `INSERT INTO locations (
        id, organization_id, parent_id, name, code, type, hierarchy_path,
        latitude, longitude, radius_meters, polygon_geojson, wifi_ssids, ble_beacons, ip_ranges,
        timezone, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        id,
        params.organization_id,
        params.parent_id || null,
        params.name,
        params.code,
        params.type,
        hierarchyPath,
        params.latitude ?? null,
        params.longitude ?? null,
        params.radius_meters ?? null,
        params.polygon_geojson || null,
        params.wifi_ssids ? JSON.stringify(params.wifi_ssids) : null,
        params.ble_beacons ? JSON.stringify(params.ble_beacons) : null,
        params.ip_ranges ? JSON.stringify(params.ip_ranges) : null,
        params.timezone || 'UTC',
        now,
        now,
      ]
    );

    auditService.log({
      organization_id: params.organization_id,
      actor_id: params.actor_id,
      action: 'LOCATION_CREATED',
      entity_type: 'LOCATION',
      entity_id: id,
      new_state: { name: params.name, code: params.code, type: params.type, hierarchyPath },
    });

    return this.getLocationById(params.organization_id, id)!;
  },

  /**
   * Updates location details
   */
  updateLocation(organization_id: string, locationId: string, updates: Partial<Location>, actorId: string) {
    const current = this.getLocationById(organization_id, locationId);
    if (!current) throw new AppError('Location not found', 404, 'LOCATION_NOT_FOUND');

    const now = new Date().toISOString();

    execute(
      `UPDATE locations SET
        name = COALESCE(?, name),
        latitude = COALESCE(?, latitude),
        longitude = COALESCE(?, longitude),
        radius_meters = COALESCE(?, radius_meters),
        polygon_geojson = COALESCE(?, polygon_geojson),
        wifi_ssids = COALESCE(?, wifi_ssids),
        ble_beacons = COALESCE(?, ble_beacons),
        ip_ranges = COALESCE(?, ip_ranges),
        timezone = COALESCE(?, timezone),
        is_active = COALESCE(?, is_active),
        updated_at = ?
      WHERE id = ? AND organization_id = ?`,
      [
        updates.name || null,
        updates.coordinates?.latitude ?? null,
        updates.coordinates?.longitude ?? null,
        updates.radius_meters ?? null,
        updates.polygon_geojson || null,
        updates.wifi_ssids ? JSON.stringify(updates.wifi_ssids) : null,
        updates.ble_beacons ? JSON.stringify(updates.ble_beacons) : null,
        updates.ip_ranges ? JSON.stringify(updates.ip_ranges) : null,
        updates.timezone || null,
        updates.is_active !== undefined ? (updates.is_active ? 1 : 0) : null,
        now,
        locationId,
        organization_id,
      ]
    );

    auditService.log({
      organization_id,
      actor_id: actorId,
      action: 'LOCATION_UPDATED',
      entity_type: 'LOCATION',
      entity_id: locationId,
      previous_state: current,
      new_state: updates,
    });

    return this.getLocationById(organization_id, locationId);
  },
};
