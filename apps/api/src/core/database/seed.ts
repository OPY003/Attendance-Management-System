import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase, execute, transaction, queryOne } from './db.js';

export const STANDARD_PERMISSIONS = [
  // Auth & Org
  { code: 'org:read', name: 'View Organization', module: 'organization' },
  { code: 'org:write', name: 'Edit Organization', module: 'organization' },
  { code: 'org:settings:write', name: 'Update Org Settings', module: 'organization' },
  { code: 'org:custom_fields:manage', name: 'Manage Custom Fields', module: 'organization' },
  { code: 'roles:manage', name: 'Manage Roles and Permissions', module: 'organization' },

  // People & Hierarchy
  { code: 'persons:read', name: 'View People', module: 'person' },
  { code: 'persons:write', name: 'Create/Edit People', module: 'person' },
  { code: 'persons:delete', name: 'Delete People', module: 'person' },
  { code: 'persons:assign_role', name: 'Assign Roles to People', module: 'person' },
  { code: 'locations:read', name: 'View Locations', module: 'location' },
  { code: 'locations:write', name: 'Manage Locations', module: 'location' },
  { code: 'departments:manage', name: 'Manage Departments', module: 'location' },
  { code: 'groups:manage', name: 'Manage Groups/Classes', module: 'location' },

  // Schedules & Sessions
  { code: 'schedules:read', name: 'View Schedules', module: 'schedule' },
  { code: 'schedules:write', name: 'Manage Schedules', module: 'schedule' },
  { code: 'shifts:read', name: 'View Shifts', module: 'schedule' },
  { code: 'shifts:write', name: 'Create/Edit Shifts', module: 'schedule' },
  { code: 'shifts:manage', name: 'Manage Shifts', module: 'schedule' },
  { code: 'sessions:read', name: 'View Attendance Sessions', module: 'schedule' },
  { code: 'sessions:write', name: 'Create/Edit Attendance Sessions', module: 'schedule' },
  { code: 'sessions:manage', name: 'Manage Attendance Sessions', module: 'schedule' },
  { code: 'sessions:monitor', name: 'Real-time Live Session Monitor', module: 'schedule' },

  // Attendance & Detection
  { code: 'attendance:read', name: 'View Attendance Records', module: 'attendance' },
  { code: 'attendance:read_self', name: 'View Personal Attendance', module: 'attendance' },
  { code: 'attendance:write', name: 'Submit Attendance Event', module: 'attendance' },
  { code: 'attendance:submit', name: 'Submit Detection Event', module: 'attendance' },
  { code: 'attendance:correct', name: 'Correct Attendance Records', module: 'attendance' },
  { code: 'dynamic_qr:generate', name: 'Generate Dynamic QR', module: 'detection' },
  { code: 'kiosk:operate', name: 'Operate Kiosk Mode', module: 'detection' },

  // Policies & Rules
  { code: 'policies:read', name: 'View Attendance Policies', module: 'policy' },
  { code: 'policies:write', name: 'Manage Attendance Policies', module: 'policy' },
  { code: 'rules:manage', name: 'Manage Safe Rules', module: 'policy' },

  // Leave & Visitors & Devices
  { code: 'leave:request', name: 'Submit Leave Request', module: 'leave' },
  { code: 'leave:review', name: 'Approve/Reject Leave', module: 'leave' },
  { code: 'visitors:manage', name: 'Manage Visitors and Passes', module: 'visitor' },
  { code: 'devices:manage', name: 'Manage Hardware and Devices', module: 'device' },

  // Security, Audit, Reporting, Analytics
  { code: 'fraud:read', name: 'View Fraud & Anomaly Alerts', module: 'security' },
  { code: 'fraud:resolve', name: 'Resolve Fraud Alerts', module: 'security' },
  { code: 'audit:read', name: 'View Audit Logs', module: 'audit' },
  { code: 'reports:generate', name: 'Generate Reports', module: 'reports' },
  { code: 'analytics:read', name: 'View Analytics Dashboards', module: 'analytics' },
  { code: 'privacy:consent:manage', name: 'Manage Consent & Privacy', module: 'privacy' },
  { code: 'privacy:dsar:manage', name: 'Process DSAR & Erasure Requests', module: 'privacy' },
];

export async function seedDatabase(dbPath?: string) {
  const db = getDatabase(dbPath);
  const now = new Date().toISOString();
  const passwordHash = await bcrypt.hash('Password123!', 10);

  return transaction((_tx) => {
    // 1. Seed Permissions
    const permissionMap = new Map<string, string>();
    for (const perm of STANDARD_PERMISSIONS) {
      let existing = queryOne<{ id: string }>('SELECT id FROM permissions WHERE code = ?', [perm.code]);
      let permId = existing?.id;
      if (!permId) {
        permId = uuidv4();
        execute(
          'INSERT INTO permissions (id, code, name, description, module) VALUES (?, ?, ?, ?, ?)',
          [permId, perm.code, perm.name, perm.name, perm.module]
        );
      }
      permissionMap.set(perm.code, permId);
    }

    // 2. Seed System Roles
    const systemRoles = [
      { code: 'PLATFORM_SUPER_ADMIN', name: 'Platform Super Admin', perms: Array.from(permissionMap.keys()) },
      { code: 'ORGANIZATION_OWNER', name: 'Organization Owner', perms: Array.from(permissionMap.keys()) },
      {
        code: 'ORGANIZATION_ADMIN',
        name: 'Organization Admin',
        perms: [
          'org:read', 'org:write', 'org:settings:write', 'org:custom_fields:manage', 'roles:manage',
          'persons:read', 'persons:write', 'persons:delete', 'persons:assign_role',
          'locations:read', 'locations:write', 'departments:manage', 'groups:manage',
          'schedules:read', 'schedules:write', 'shifts:read', 'shifts:write', 'shifts:manage', 'sessions:read', 'sessions:write', 'sessions:manage', 'sessions:monitor',
          'attendance:read', 'attendance:write', 'attendance:submit', 'attendance:correct', 'dynamic_qr:generate', 'kiosk:operate',
          'policies:read', 'policies:write', 'rules:manage', 'leave:request', 'leave:review',
          'visitors:manage', 'devices:manage', 'fraud:read', 'fraud:resolve', 'audit:read',
          'reports:generate', 'analytics:read', 'privacy:consent:manage', 'privacy:dsar:manage',
        ],
      },
      {
        code: 'MANAGER',
        name: 'Manager',
        perms: [
          'persons:read', 'locations:read', 'groups:manage', 'schedules:read', 'sessions:manage', 'sessions:monitor',
          'attendance:read', 'attendance:write', 'attendance:correct', 'dynamic_qr:generate',
          'leave:request', 'leave:review', 'visitors:manage', 'reports:generate', 'analytics:read',
        ],
      },
      {
        code: 'TEACHER',
        name: 'Teacher / Faculty',
        perms: [
          'persons:read', 'locations:read', 'groups:manage', 'schedules:read', 'sessions:manage', 'sessions:monitor',
          'attendance:read', 'attendance:write', 'attendance:correct', 'dynamic_qr:generate',
          'leave:request', 'reports:generate',
        ],
      },
      {
        code: 'SUPERVISOR',
        name: 'Supervisor',
        perms: [
          'persons:read', 'locations:read', 'schedules:read', 'sessions:manage', 'sessions:monitor',
          'attendance:read', 'attendance:write', 'attendance:correct', 'dynamic_qr:generate', 'kiosk:operate',
          'leave:request', 'leave:review', 'reports:generate',
        ],
      },
      {
        code: 'USER',
        name: 'Standard User / Employee / Student',
        perms: ['attendance:read_self', 'attendance:write', 'leave:request'],
      },
      {
        code: 'VISITOR',
        name: 'Visitor',
        perms: ['attendance:read_self'],
      },
    ];

    const roleMap = new Map<string, string>();
    for (const r of systemRoles) {
      let roleRecord = queryOne<{ id: string }>('SELECT id FROM roles WHERE code = ? AND is_system_role = 1', [r.code]);
      let roleId = roleRecord?.id;
      if (!roleId) {
        roleId = uuidv4();
        execute(
          'INSERT INTO roles (id, code, name, description, is_system_role, created_at) VALUES (?, ?, ?, ?, 1, ?)',
          [roleId, r.code, r.name, r.name, now]
        );
      }
      roleMap.set(r.code, roleId);

      // Link role permissions
      for (const permCode of r.perms) {
        const permId = permissionMap.get(permCode);
        if (permId) {
          execute('INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [roleId, permId]);
        }
      }
    }

    // 3. Seed Platform Super Admin User
    let systemOrg = queryOne<{ id: string }>('SELECT id FROM organizations WHERE id = ?', ['SYSTEM']);
    if (!systemOrg) {
      execute(
        `INSERT INTO organizations (id, slug, name, category, status, created_at, updated_at)
         VALUES ('SYSTEM', 'platform-system', 'Platform System', 'CUSTOM', 'ACTIVE', ?, ?)`,
        [now, now]
      );
    }

    let superAdminUser = queryOne<{ id: string }>('SELECT id FROM users WHERE email = ?', ['superadmin@uapms.io']);
    let superAdminId = superAdminUser?.id;
    if (!superAdminId) {
      superAdminId = uuidv4();
      execute(
        `INSERT INTO users (id, email, password_hash, first_name, last_name, is_email_verified, created_at, updated_at)
         VALUES (?, 'superadmin@uapms.io', ?, 'Platform', 'SuperAdmin', 1, ?, ?)`,
        [superAdminId, passwordHash, now, now]
      );
    }

    // Ensure superadmin has PLATFORM_SUPER_ADMIN membership
    const superAdminRoleId = roleMap.get('PLATFORM_SUPER_ADMIN')!;
    const existingMembership = queryOne(
      'SELECT id FROM organization_memberships WHERE user_id = ? AND role_id = ?',
      [superAdminId, superAdminRoleId]
    );
    if (!existingMembership) {
      // Create a global system membership (using a fixed system org id or first org)
      execute(
        `INSERT INTO organization_memberships (id, organization_id, user_id, role_id, status, joined_at)
         VALUES (?, 'SYSTEM', ?, ?, 'ACTIVE', ?)`,
        [uuidv4(), superAdminId, superAdminRoleId, now]
      );
    }

    // 4. Seed Organization 1: Greenfield University
    let univ = queryOne<{ id: string }>('SELECT id FROM organizations WHERE slug = ?', ['greenfield-univ']);
    let univId = univ?.id;
    if (!univId) {
      univId = uuidv4();
      execute(
        `INSERT INTO organizations (id, slug, name, category, status, created_at, updated_at)
         VALUES (?, 'greenfield-univ', 'Greenfield University', 'UNIVERSITY', 'ACTIVE', ?, ?)`,
        [univId, now, now]
      );

      execute(
        `INSERT INTO organization_settings (
          organization_id, default_timezone, default_language, allowed_detection_methods,
          biometrics_enabled, gps_enabled, qr_enabled, rfid_enabled, geofence_tolerance_meters
        ) VALUES (?, 'America/New_York', 'en', '["DYNAMIC_QR", "GPS", "REGISTERED_DEVICE", "MANUAL"]', 1, 1, 1, 0, 50.0)`,
        [univId]
      );

      execute(
        `INSERT INTO tenant_quotas (organization_id, max_people, max_devices, max_locations, max_api_requests_per_day, features_enabled)
         VALUES (?, 5000, 100, 50, 50000, '["ALL"]')`,
        [univId]
      );

      // Locations for Univ
      const campusId = uuidv4();
      execute(
        `INSERT INTO locations (id, organization_id, name, code, type, latitude, longitude, radius_meters, timezone, created_at, updated_at)
         VALUES (?, ?, 'Main Campus', 'CAMPUS-MAIN', 'CAMPUS', 40.7128, -74.0060, 500.0, 'America/New_York', ?, ?)`,
        [campusId, univId, now, now]
      );

      const hallId = uuidv4();
      execute(
        `INSERT INTO locations (id, organization_id, parent_id, name, code, type, latitude, longitude, radius_meters, timezone, created_at, updated_at)
         VALUES (?, ?, ?, 'Engineering Hall Room 101', 'ENG-101', 'ROOM', 40.7128, -74.0060, 30.0, 'America/New_York', ?, ?)`,
        [hallId, univId, campusId, now, now]
      );

      // Shift & Schedule for Univ
      const classShiftId = uuidv4();
      execute(
        `INSERT INTO shifts (id, organization_id, name, code, start_time, end_time, grace_period_minutes, late_threshold_minutes, is_active, created_at)
         VALUES (?, ?, 'Morning Lecture Shift', 'LEC-AM', '09:00:00', '11:00:00', 10, 20, 1, ?)`,
        [classShiftId, univId, now]
      );

      // Policy for Univ (Dynamic QR + GPS + Registered Device)
      const univPolicyId = uuidv4();
      execute(
        `INSERT INTO attendance_policies (
          id, organization_id, name, description, required_methods, optional_methods, method_weights,
          allowed_location_ids, geofence_radius_meters, min_confidence_score, is_default, created_at, updated_at
        ) VALUES (?, ?, 'University Classroom Policy', 'Requires Dynamic QR, GPS, and Registered Device',
          '["DYNAMIC_QR", "GPS", "REGISTERED_DEVICE"]', '[]',
          '[{"method":"DYNAMIC_QR","required":true,"weight":40},{"method":"GPS","required":true,"weight":35},{"method":"REGISTERED_DEVICE","required":true,"weight":25}]',
          '["${hallId}"]', 50.0, 80.0, 1, ?, ?)`,
        [univPolicyId, univId, now, now]
      );

      // Teacher User
      const teacherUserId = uuidv4();
      execute(
        `INSERT INTO users (id, email, password_hash, first_name, last_name, is_email_verified, created_at, updated_at)
         VALUES (?, 'teacher@greenfield.edu', ?, 'Alan', 'Turing', 1, ?, ?)`,
        [teacherUserId, passwordHash, now, now]
      );

      const teacherPersonId = uuidv4();
      execute(
        `INSERT INTO persons (id, organization_id, user_id, person_code, first_name, last_name, email, status, created_at, updated_at)
         VALUES (?, ?, ?, 'PROF-001', 'Alan', 'Turing', 'teacher@greenfield.edu', 'ACTIVE', ?, ?)`,
        [teacherPersonId, univId, teacherUserId, now, now]
      );

      execute(
        `INSERT INTO organization_memberships (id, organization_id, user_id, person_id, role_id, status, joined_at)
         VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?)`,
        [uuidv4(), univId, teacherUserId, teacherPersonId, roleMap.get('TEACHER')!, now]
      );

      // Student User
      const studentUserId = uuidv4();
      execute(
        `INSERT INTO users (id, email, password_hash, first_name, last_name, is_email_verified, created_at, updated_at)
         VALUES (?, 'student@greenfield.edu', ?, 'Ada', 'Lovelace', 1, ?, ?)`,
        [studentUserId, passwordHash, now, now]
      );

      const studentPersonId = uuidv4();
      execute(
        `INSERT INTO persons (id, organization_id, user_id, person_code, first_name, last_name, email, status, created_at, updated_at)
         VALUES (?, ?, ?, 'STU-1001', 'Ada', 'Lovelace', 'student@greenfield.edu', 'ACTIVE', ?, ?)`,
        [studentPersonId, univId, studentUserId, now, now]
      );

      execute(
        `INSERT INTO organization_memberships (id, organization_id, user_id, person_id, role_id, status, joined_at)
         VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?)`,
        [uuidv4(), univId, studentUserId, studentPersonId, roleMap.get('USER')!, now]
      );
    }

    // 5. Seed Organization 2: Apex Manufacturing
    let mfg = queryOne<{ id: string }>('SELECT id FROM organizations WHERE slug = ?', ['apex-mfg']);
    let mfgId = mfg?.id;
    if (!mfgId) {
      mfgId = uuidv4();
      execute(
        `INSERT INTO organizations (id, slug, name, category, status, created_at, updated_at)
         VALUES (?, 'apex-mfg', 'Apex Manufacturing', 'FACTORY', 'ACTIVE', ?, ?)`,
        [mfgId, now, now]
      );

      execute(
        `INSERT INTO organization_settings (
          organization_id, default_timezone, default_language, allowed_detection_methods,
          biometrics_enabled, gps_enabled, qr_enabled, rfid_enabled, geofence_tolerance_meters
        ) VALUES (?, 'America/Chicago', 'en', '["RFID", "FACE", "FINGERPRINT", "KIOSK", "MANUAL"]', 1, 0, 0, 1, 10.0)`,
        [mfgId]
      );

      execute(
        `INSERT INTO tenant_quotas (organization_id, max_people, max_devices, max_locations, max_api_requests_per_day, features_enabled)
         VALUES (?, 2000, 50, 10, 20000, '["ALL"]')`,
        [mfgId]
      );

      // Factory Shift (Night shift crossing midnight)
      const nightShiftId = uuidv4();
      execute(
        `INSERT INTO shifts (id, organization_id, name, code, start_time, end_time, crosses_midnight, grace_period_minutes, late_threshold_minutes, is_active, created_at)
         VALUES (?, ?, 'Night Production Shift', 'SHIFT-NIGHT', '22:00:00', '06:00:00', 1, 15, 30, 1, ?)`,
        [nightShiftId, mfgId, now]
      );

      // Policy for Factory (RFID + Face Match + Shift)
      const mfgPolicyId = uuidv4();
      execute(
        `INSERT INTO attendance_policies (
          id, organization_id, name, description, required_methods, optional_methods, method_weights,
          min_confidence_score, is_default, created_at, updated_at
        ) VALUES (?, ?, 'Factory Gate Policy', 'Requires RFID Card and Face Match at Turnstile',
          '["RFID", "FACE"]', '["KIOSK"]',
          '[{"method":"RFID","required":true,"weight":50},{"method":"FACE","required":true,"weight":50}]',
          90.0, 1, ?, ?)`,
        [mfgPolicyId, mfgId, now, now]
      );

      // Factory Manager
      const managerUserId = uuidv4();
      execute(
        `INSERT INTO users (id, email, password_hash, first_name, last_name, is_email_verified, created_at, updated_at)
         VALUES (?, 'manager@apex-mfg.com', ?, 'Robert', 'Oppenheimer', 1, ?, ?)`,
        [managerUserId, passwordHash, now, now]
      );

      const managerPersonId = uuidv4();
      execute(
        `INSERT INTO persons (id, organization_id, user_id, person_code, first_name, last_name, email, status, created_at, updated_at)
         VALUES (?, ?, ?, 'MGR-001', 'Robert', 'Oppenheimer', 'manager@apex-mfg.com', 'ACTIVE', ?, ?)`,
        [managerPersonId, mfgId, managerUserId, now, now]
      );

      execute(
        `INSERT INTO organization_memberships (id, organization_id, user_id, person_id, role_id, status, joined_at)
         VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?)`,
        [uuidv4(), mfgId, managerUserId, managerPersonId, roleMap.get('SUPERVISOR')!, now]
      );
    }

    // 6. Seed Organization 3: NovaTech Solutions (Remote / Corporate)
    let nova = queryOne<{ id: string }>('SELECT id FROM organizations WHERE slug = ?', ['novatech-solutions']);
    let novaId = nova?.id;
    if (!novaId) {
      novaId = uuidv4();
      execute(
        `INSERT INTO organizations (id, slug, name, category, status, created_at, updated_at)
         VALUES (?, 'novatech-solutions', 'NovaTech Solutions', 'CORPORATE', 'ACTIVE', ?, ?)`,
        [novaId, now, now]
      );

      execute(
        `INSERT INTO organization_settings (
          organization_id, default_timezone, default_language, allowed_detection_methods,
          biometrics_enabled, gps_enabled, qr_enabled, rfid_enabled, require_device_registration
        ) VALUES (?, 'Europe/London', 'en', '["SSO", "VPN", "REGISTERED_DEVICE", "WEB_SESSION"]', 0, 0, 1, 0, 1)`,
        [novaId]
      );

      execute(
        `INSERT INTO tenant_quotas (organization_id, max_people, max_devices, max_locations, max_api_requests_per_day, features_enabled)
         VALUES (?, 500, 1000, 5, 25000, '["ALL"]')`,
        [novaId]
      );

      // NovaTech Policy (SSO + Registered Device + VPN)
      const novaPolicyId = uuidv4();
      execute(
        `INSERT INTO attendance_policies (
          id, organization_id, name, description, required_methods, optional_methods, method_weights,
          min_confidence_score, is_default, created_at, updated_at
        ) VALUES (?, ?, 'Remote Corporate Work Policy', 'Requires SSO, Registered Laptop and VPN verification',
          '["SSO", "REGISTERED_DEVICE", "VPN"]', '[]',
          '[{"method":"SSO","required":true,"weight":40},{"method":"REGISTERED_DEVICE","required":true,"weight":35},{"method":"VPN","required":true,"weight":25}]',
          85.0, 1, ?, ?)`,
        [novaPolicyId, novaId, now, now]
      );
    }

    return {
      message: 'Database seeded successfully with permissions, system roles, and 3 test organizations.',
    };
  });
}
