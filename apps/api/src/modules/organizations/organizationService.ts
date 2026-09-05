import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, execute, transaction } from '../../core/database/db.js';
import { AppError } from '../../middleware/errorHandler.js';
import { auditService } from '../audit/auditService.js';
import { Organization, OrganizationSettings, CustomFieldDefinition } from '@uapms/shared-types';

export const organizationService = {
  /**
   * Creates a new organization with settings and owner
   */
  createOrganization(params: {
    name: string;
    slug: string;
    category: string;
    custom_category_name?: string;
    timezone?: string;
    default_language?: string;
    userId: string;
    actor_role?: string;
    ip_address?: string;
  }) {
    const existing = queryOne('SELECT id FROM organizations WHERE slug = ?', [params.slug]);
    if (existing) {
      throw new AppError(`Organization with slug "${params.slug}" already exists`, 409, 'SLUG_ALREADY_EXISTS');
    }

    const orgId = uuidv4();
    const now = new Date().toISOString();

    return transaction((_db) => {
      execute(
        `INSERT INTO organizations (id, slug, name, category, custom_category_name, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`,
        [orgId, params.slug, params.name, params.category, params.custom_category_name || null, now, now]
      );

      execute(
        `INSERT INTO organization_settings (
          organization_id, default_timezone, default_language, allowed_detection_methods,
          biometrics_enabled, gps_enabled, qr_enabled, rfid_enabled, geofence_tolerance_meters
        ) VALUES (?, ?, ?, '["DYNAMIC_QR", "GPS", "REGISTERED_DEVICE", "RFID", "MANUAL"]', 1, 1, 1, 1, 15.0)`,
        [orgId, params.timezone || 'UTC', params.default_language || 'en']
      );

      // Create default quotas
      execute(
        `INSERT INTO tenant_quotas (
          organization_id, max_people, max_devices, max_locations, max_api_requests_per_day, features_enabled
        ) VALUES (?, 100, 10, 5, 10000, '["QR", "GPS", "RFID", "MANUAL", "REPORTS", "ANALYTICS"]')`,
        [orgId]
      );

      // Assign user as OrganizationOwner
      let ownerRole = queryOne<any>('SELECT id FROM roles WHERE code = ? AND (organization_id = ? OR is_system_role = 1)', ['ORGANIZATION_OWNER', orgId]);
      if (!ownerRole) {
        const roleId = uuidv4();
        execute(
          `INSERT INTO roles (id, code, name, description, is_system_role, created_at)
           VALUES (?, 'ORGANIZATION_OWNER', 'Organization Owner', 'Full control over the organization', 1, ?)`,
          [roleId, now]
        );
        ownerRole = { id: roleId };
      }

      // Check user
      const user = queryOne<any>('SELECT first_name, last_name, email FROM users WHERE id = ?', [params.userId]);
      const personId = uuidv4();
      execute(
        `INSERT INTO persons (id, organization_id, user_id, person_code, first_name, last_name, email, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`,
        [personId, orgId, params.userId, 'OWNER-001', user?.first_name || 'Owner', user?.last_name || 'User', user?.email || null, now, now]
      );

      execute(
        `INSERT INTO organization_memberships (id, organization_id, user_id, person_id, role_id, status, joined_at)
         VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?)`,
        [uuidv4(), orgId, params.userId, personId, ownerRole.id, now]
      );

      auditService.log({
        organization_id: orgId,
        actor_id: params.userId,
        action: 'ORGANIZATION_CREATED',
        entity_type: 'ORGANIZATION',
        entity_id: orgId,
        ip_address: params.ip_address,
      });

      return this.getOrganizationById(orgId);
    });
  },

  /**
   * Retrieves an organization by ID with settings and quotas
   */
  getOrganizationById(orgId: string): Organization | undefined {
    const org = queryOne<any>(
      `SELECT o.*, 
              os.default_timezone, os.default_language, os.allowed_detection_methods,
              os.biometrics_enabled, os.gps_enabled, os.qr_enabled, os.rfid_enabled,
              os.geofence_tolerance_meters, os.require_device_registration,
              os.allow_offline_sync, os.data_retention_days, os.mfa_required_for_admins,
              os.allow_self_registration,
              tq.max_people, tq.max_devices, tq.max_locations, tq.max_api_requests_per_day
       FROM organizations o
       LEFT JOIN organization_settings os ON os.organization_id = o.id
       LEFT JOIN tenant_quotas tq ON tq.organization_id = o.id
       WHERE o.id = ? OR o.slug = ?`,
      [orgId, orgId]
    );

    if (!org) return undefined;

    return {
      id: org.id,
      slug: org.slug,
      name: org.name,
      category: org.category,
      custom_category_name: org.custom_category_name,
      status: org.status,
      subscription_plan_id: org.subscription_plan_id,
      trial_ends_at: org.trial_ends_at,
      settings: {
        organization_id: org.id,
        default_timezone: org.default_timezone || 'UTC',
        default_language: org.default_language || 'en',
        allowed_detection_methods: JSON.parse(org.allowed_detection_methods || '[]'),
        biometrics_enabled: Boolean(org.biometrics_enabled),
        gps_enabled: Boolean(org.gps_enabled),
        qr_enabled: Boolean(org.qr_enabled),
        rfid_enabled: Boolean(org.rfid_enabled),
        geofence_tolerance_meters: org.geofence_tolerance_meters || 15,
        require_device_registration: Boolean(org.require_device_registration),
        allow_offline_sync: Boolean(org.allow_offline_sync),
        data_retention_days: org.data_retention_days || 365,
        mfa_required_for_admins: Boolean(org.mfa_required_for_admins),
        allow_self_registration: Boolean(org.allow_self_registration),
      },
      created_at: org.created_at,
      updated_at: org.updated_at,
    };
  },

  /**
   * Lists organizations for user or all for super admin
   */
  listOrganizations(userId: string, isSuperAdmin: boolean = false): Organization[] {
    let orgs: any[] = [];
    if (isSuperAdmin) {
      orgs = query<any>('SELECT * FROM organizations ORDER BY created_at DESC');
    } else {
      orgs = query<any>(
        `SELECT o.* FROM organizations o
         JOIN organization_memberships om ON om.organization_id = o.id
         WHERE om.user_id = ? AND om.status = 'ACTIVE'
         ORDER BY o.created_at DESC`,
        [userId]
      );
    }

    return orgs.map((o) => ({
      id: o.id,
      slug: o.slug,
      name: o.name,
      category: o.category,
      custom_category_name: o.custom_category_name,
      status: o.status,
      subscription_plan_id: o.subscription_plan_id,
      trial_ends_at: o.trial_ends_at,
      created_at: o.created_at,
      updated_at: o.updated_at,
    }));
  },

  /**
   * Updates organization settings
   */
  updateSettings(orgId: string, settings: Partial<OrganizationSettings>, actorId: string) {
    const current = queryOne<any>('SELECT * FROM organization_settings WHERE organization_id = ?', [orgId]);
    if (!current) {
      throw new AppError('Organization settings not found', 404, 'NOT_FOUND');
    }

    execute(
      `UPDATE organization_settings SET
        default_timezone = COALESCE(?, default_timezone),
        default_language = COALESCE(?, default_language),
        allowed_detection_methods = COALESCE(?, allowed_detection_methods),
        biometrics_enabled = COALESCE(?, biometrics_enabled),
        gps_enabled = COALESCE(?, gps_enabled),
        qr_enabled = COALESCE(?, qr_enabled),
        rfid_enabled = COALESCE(?, rfid_enabled),
        geofence_tolerance_meters = COALESCE(?, geofence_tolerance_meters),
        require_device_registration = COALESCE(?, require_device_registration),
        allow_offline_sync = COALESCE(?, allow_offline_sync),
        data_retention_days = COALESCE(?, data_retention_days),
        mfa_required_for_admins = COALESCE(?, mfa_required_for_admins),
        allow_self_registration = COALESCE(?, allow_self_registration)
      WHERE organization_id = ?`,
      [
        settings.default_timezone || null,
        settings.default_language || null,
        settings.allowed_detection_methods ? JSON.stringify(settings.allowed_detection_methods) : null,
        settings.biometrics_enabled !== undefined ? (settings.biometrics_enabled ? 1 : 0) : null,
        settings.gps_enabled !== undefined ? (settings.gps_enabled ? 1 : 0) : null,
        settings.qr_enabled !== undefined ? (settings.qr_enabled ? 1 : 0) : null,
        settings.rfid_enabled !== undefined ? (settings.rfid_enabled ? 1 : 0) : null,
        settings.geofence_tolerance_meters ?? null,
        settings.require_device_registration !== undefined ? (settings.require_device_registration ? 1 : 0) : null,
        settings.allow_offline_sync !== undefined ? (settings.allow_offline_sync ? 1 : 0) : null,
        settings.data_retention_days ?? null,
        settings.mfa_required_for_admins !== undefined ? (settings.mfa_required_for_admins ? 1 : 0) : null,
        settings.allow_self_registration !== undefined ? (settings.allow_self_registration ? 1 : 0) : null,
        orgId,
      ]
    );

    auditService.log({
      organization_id: orgId,
      actor_id: actorId,
      action: 'ORGANIZATION_SETTINGS_UPDATED',
      entity_type: 'ORGANIZATION_SETTINGS',
      entity_id: orgId,
      previous_state: current,
      new_state: settings,
    });

    return this.getOrganizationById(orgId);
  },

  /**
   * Custom field definitions management
   */
  createCustomFieldDefinition(params: {
    organization_id: string;
    entity_type: string;
    field_key: string;
    field_label: string;
    field_type: string;
    required: boolean;
    options?: string[];
    validation_regex?: string;
    actor_id: string;
  }): CustomFieldDefinition {
    const existing = queryOne(
      `SELECT id FROM custom_field_definitions WHERE organization_id = ? AND entity_type = ? AND field_key = ?`,
      [params.organization_id, params.entity_type, params.field_key]
    );

    if (existing) {
      throw new AppError(`Custom field key "${params.field_key}" already exists for ${params.entity_type}`, 409, 'FIELD_KEY_EXISTS');
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    execute(
      `INSERT INTO custom_field_definitions (
        id, organization_id, entity_type, field_key, field_label, field_type, required, options, validation_regex, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        params.organization_id,
        params.entity_type,
        params.field_key,
        params.field_label,
        params.field_type,
        params.required ? 1 : 0,
        params.options ? JSON.stringify(params.options) : null,
        params.validation_regex || null,
        now,
      ]
    );

    auditService.log({
      organization_id: params.organization_id,
      actor_id: params.actor_id,
      action: 'CUSTOM_FIELD_DEFINITION_CREATED',
      entity_type: 'CUSTOM_FIELD_DEFINITION',
      entity_id: id,
    });

    return {
      id,
      organization_id: params.organization_id,
      entity_type: params.entity_type as any,
      field_key: params.field_key,
      field_label: params.field_label,
      field_type: params.field_type as any,
      required: params.required,
      options: params.options,
      validation_regex: params.validation_regex,
      created_at: now,
    };
  },

  listCustomFieldDefinitions(organization_id: string, entity_type?: string): CustomFieldDefinition[] {
    let sql = 'SELECT * FROM custom_field_definitions WHERE organization_id = ?';
    const params: any[] = [organization_id];

    if (entity_type) {
      sql += ' AND entity_type = ?';
      params.push(entity_type);
    }

    const rows = query<any>(sql, params);
    return rows.map((r) => ({
      id: r.id,
      organization_id: r.organization_id,
      entity_type: r.entity_type,
      field_key: r.field_key,
      field_label: r.field_label,
      field_type: r.field_type,
      required: Boolean(r.required),
      options: r.options ? JSON.parse(r.options) : undefined,
      validation_regex: r.validation_regex,
      created_at: r.created_at,
    }));
  },
};
