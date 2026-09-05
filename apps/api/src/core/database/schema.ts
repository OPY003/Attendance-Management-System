/**
 * Complete DDL Schema for UAPMS
 * Supports SQLite and PostgreSQL syntax with pure relational constraints, foreign keys, and indexes.
 */

export const CREATE_TABLES_SQL = `
-- 1. Organizations & Settings
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  custom_category_name TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  subscription_plan_id TEXT,
  trial_ends_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS organization_settings (
  organization_id TEXT PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  default_timezone TEXT NOT NULL DEFAULT 'UTC',
  default_language TEXT NOT NULL DEFAULT 'en',
  allowed_detection_methods TEXT NOT NULL DEFAULT '[]',
  biometrics_enabled INTEGER NOT NULL DEFAULT 1,
  gps_enabled INTEGER NOT NULL DEFAULT 1,
  qr_enabled INTEGER NOT NULL DEFAULT 1,
  rfid_enabled INTEGER NOT NULL DEFAULT 1,
  geofence_tolerance_meters REAL NOT NULL DEFAULT 15.0,
  require_device_registration INTEGER NOT NULL DEFAULT 0,
  allow_offline_sync INTEGER NOT NULL DEFAULT 1,
  data_retention_days INTEGER NOT NULL DEFAULT 365,
  mfa_required_for_admins INTEGER NOT NULL DEFAULT 0,
  allow_self_registration INTEGER NOT NULL DEFAULT 0,
  custom_attributes TEXT
);

-- 2. Subscriptions & Quotas
CREATE TABLE IF NOT EXISTS subscription_plans (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  tier TEXT NOT NULL,
  max_people INTEGER NOT NULL,
  max_devices INTEGER NOT NULL,
  max_locations INTEGER NOT NULL,
  max_api_requests_per_day INTEGER NOT NULL,
  features TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES subscription_plans(id),
  status TEXT NOT NULL,
  current_period_start TEXT NOT NULL,
  current_period_end TEXT NOT NULL,
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tenant_quotas (
  organization_id TEXT PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  max_people INTEGER NOT NULL,
  max_devices INTEGER NOT NULL,
  max_locations INTEGER NOT NULL,
  max_api_requests_per_day INTEGER NOT NULL,
  features_enabled TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS billing_events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  amount REAL,
  currency TEXT DEFAULT 'USD',
  status TEXT NOT NULL,
  provider_reference TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL
);

-- 3. Extensibility & Custom Fields
CREATE TABLE IF NOT EXISTS custom_field_definitions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  field_key TEXT NOT NULL,
  field_label TEXT NOT NULL,
  field_type TEXT NOT NULL,
  required INTEGER NOT NULL DEFAULT 0,
  options TEXT,
  validation_regex TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(organization_id, entity_type, field_key)
);

CREATE TABLE IF NOT EXISTS custom_field_values (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  field_key TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(organization_id, entity_type, entity_id, field_key)
);

-- 4. Identity & Account Lifecycle
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  is_email_verified INTEGER NOT NULL DEFAULT 0,
  email_verification_token TEXT,
  email_verification_expires_at TEXT,
  reset_password_token TEXT,
  reset_password_expires_at TEXT,
  mfa_enabled INTEGER NOT NULL DEFAULT 0,
  mfa_secret TEXT,
  mfa_backup_codes TEXT,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  unlock_token TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_system_role INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE(organization_id, code)
);

CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  module TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY(role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS persons (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  person_code TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  national_id TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  avatar_url TEXT,
  primary_department_id TEXT,
  primary_location_id TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(organization_id, person_code)
);

CREATE TABLE IF NOT EXISTS person_roles (
  person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  PRIMARY KEY(person_id, role_id)
);

CREATE TABLE IF NOT EXISTS organization_memberships (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  person_id TEXT REFERENCES persons(id) ON DELETE SET NULL,
  role_id TEXT NOT NULL REFERENCES roles(id),
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  joined_at TEXT NOT NULL,
  UNIQUE(organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS invitations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role_id TEXT NOT NULL REFERENCES roles(id),
  token TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  invited_by_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL
);

-- 5. Locations & Hierarchy
CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES locations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  type TEXT NOT NULL,
  hierarchy_path TEXT,
  latitude REAL,
  longitude REAL,
  radius_meters REAL,
  polygon_geojson TEXT,
  wifi_ssids TEXT,
  ble_beacons TEXT,
  ip_ranges TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(organization_id, code)
);

CREATE TABLE IF NOT EXISTS location_types (
  id TEXT PRIMARY KEY,
  organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS attendance_zones (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  polygon_geojson TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(organization_id, code)
);

CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES departments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  manager_person_id TEXT REFERENCES persons(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  UNIQUE(organization_id, code)
);

CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  group_type TEXT NOT NULL,
  leader_person_id TEXT REFERENCES persons(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  UNIQUE(organization_id, code)
);

CREATE TABLE IF NOT EXISTS group_memberships (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  role_in_group TEXT,
  joined_at TEXT NOT NULL,
  UNIQUE(group_id, person_id)
);

-- 6. Devices & Credentials
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id TEXT REFERENCES locations(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  device_type TEXT NOT NULL,
  serial_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  assigned_policy_id TEXT,
  last_seen_at TEXT,
  ip_address TEXT,
  firmware_version TEXT,
  credential_hash TEXT,
  config TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(organization_id, serial_number)
);

CREATE TABLE IF NOT EXISTS device_credentials (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  api_key_hash TEXT NOT NULL,
  secret_hash TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  expires_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS device_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL,
  last_used_at TEXT NOT NULL
);

-- 7. Schedules, Shifts & Policies
CREATE TABLE IF NOT EXISTS shifts (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  crosses_midnight INTEGER NOT NULL DEFAULT 0,
  grace_period_minutes INTEGER NOT NULL DEFAULT 10,
  late_threshold_minutes INTEGER NOT NULL DEFAULT 30,
  early_leave_threshold_minutes INTEGER NOT NULL DEFAULT 15,
  min_working_minutes INTEGER NOT NULL DEFAULT 480,
  break_duration_minutes INTEGER NOT NULL DEFAULT 60,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  UNIQUE(organization_id, code)
);

CREATE TABLE IF NOT EXISTS schedules (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  schedule_type TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  valid_from TEXT NOT NULL,
  valid_until TEXT,
  days_of_week TEXT NOT NULL,
  default_shift_id TEXT REFERENCES shifts(id) ON DELETE SET NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS schedule_rules (
  id TEXT PRIMARY KEY,
  schedule_id TEXT NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL,
  shift_id TEXT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS shift_assignments (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  shift_id TEXT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  schedule_id TEXT REFERENCES schedules(id) ON DELETE CASCADE,
  start_date TEXT NOT NULL,
  end_date TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS holidays (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date TEXT NOT NULL,
  location_id TEXT REFERENCES locations(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS attendance_policies (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  required_methods TEXT NOT NULL DEFAULT '[]',
  optional_methods TEXT NOT NULL DEFAULT '[]',
  method_weights TEXT NOT NULL DEFAULT '[]',
  allowed_location_ids TEXT NOT NULL DEFAULT '[]',
  geofence_radius_meters REAL NOT NULL DEFAULT 50.0,
  allowed_device_types TEXT NOT NULL DEFAULT '[]',
  grace_period_minutes INTEGER NOT NULL DEFAULT 10,
  late_threshold_minutes INTEGER NOT NULL DEFAULT 30,
  early_leave_threshold_minutes INTEGER NOT NULL DEFAULT 15,
  min_confidence_score REAL NOT NULL DEFAULT 75.0,
  duplicate_scan_window_seconds INTEGER NOT NULL DEFAULT 60,
  auto_reject_below_score REAL NOT NULL DEFAULT 20.0,
  review_threshold_score REAL NOT NULL DEFAULT 50.0,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS policy_rules (
  id TEXT PRIMARY KEY,
  policy_id TEXT NOT NULL REFERENCES attendance_policies(id) ON DELETE CASCADE,
  priority INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL,
  condition_json TEXT NOT NULL,
  action_json TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1
);

-- 8. Sessions, Events, Records & Evidence
CREATE TABLE IF NOT EXISTS attendance_sessions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id TEXT REFERENCES locations(id) ON DELETE SET NULL,
  group_id TEXT REFERENCES groups(id) ON DELETE SET NULL,
  schedule_id TEXT REFERENCES schedules(id) ON DELETE SET NULL,
  shift_id TEXT REFERENCES shifts(id) ON DELETE SET NULL,
  host_person_id TEXT REFERENCES persons(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  session_type TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'SCHEDULED',
  policy_id TEXT REFERENCES attendance_policies(id) ON DELETE SET NULL,
  current_dynamic_qr TEXT,
  qr_expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS attendance_events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  person_id TEXT REFERENCES persons(id) ON DELETE SET NULL,
  device_id TEXT REFERENCES devices(id) ON DELETE SET NULL,
  session_id TEXT REFERENCES attendance_sessions(id) ON DELETE SET NULL,
  detection_method TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  timezone TEXT NOT NULL,
  location_data TEXT,
  raw_token TEXT,
  identity_confidence REAL,
  device_confidence REAL,
  provider_reference TEXT NOT NULL,
  evidence_reference TEXT,
  is_simulated INTEGER NOT NULL DEFAULT 0,
  metadata TEXT,
  processing_status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS detection_events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_id TEXT REFERENCES attendance_sessions(id) ON DELETE SET NULL,
  person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  detection_method TEXT NOT NULL,
  event_type TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  location_id TEXT REFERENCES locations(id) ON DELETE SET NULL,
  latitude REAL,
  longitude REAL,
  device_id TEXT REFERENCES devices(id) ON DELETE SET NULL,
  qr_token TEXT,
  confidence_score REAL DEFAULT 1.0,
  raw_payload TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS attendance_records (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  session_id TEXT REFERENCES attendance_sessions(id) ON DELETE SET NULL,
  schedule_id TEXT REFERENCES schedules(id) ON DELETE SET NULL,
  shift_id TEXT REFERENCES shifts(id) ON DELETE SET NULL,
  date TEXT NOT NULL,
  status TEXT NOT NULL,
  custom_status_code TEXT,
  check_in_time TEXT,
  check_in_method TEXT,
  check_in_event_id TEXT,
  check_out_time TEXT,
  check_out_method TEXT,
  check_out_event_id TEXT,
  working_minutes INTEGER DEFAULT 0,
  break_minutes INTEGER DEFAULT 0,
  late_minutes INTEGER DEFAULT 0,
  early_leave_minutes INTEGER DEFAULT 0,
  overtime_minutes INTEGER DEFAULT 0,
  status_explanation TEXT,
  confidence_score REAL NOT NULL DEFAULT 0.0,
  confidence_verdict TEXT DEFAULT 'VERIFIED',
  policy_id TEXT REFERENCES attendance_policies(id),
  is_corrected INTEGER NOT NULL DEFAULT 0,
  corrected_by TEXT REFERENCES users(id),
  correction_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS attendance_evidence (
  id TEXT PRIMARY KEY,
  attendance_record_id TEXT NOT NULL REFERENCES attendance_records(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  detection_events_json TEXT NOT NULL,
  location_verified INTEGER NOT NULL DEFAULT 0,
  location_verification_details TEXT,
  device_verified INTEGER NOT NULL DEFAULT 0,
  device_verification_details TEXT,
  identity_verified INTEGER NOT NULL DEFAULT 0,
  identity_verification_details TEXT,
  confidence_breakdown_json TEXT NOT NULL,
  rules_evaluated_json TEXT NOT NULL,
  explanation TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS attendance_corrections (
  id TEXT PRIMARY KEY,
  attendance_record_id TEXT NOT NULL REFERENCES attendance_records(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  previous_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  actor_id TEXT NOT NULL REFERENCES users(id),
  actor_role TEXT NOT NULL,
  reason TEXT NOT NULL,
  source TEXT NOT NULL,
  timestamp TEXT NOT NULL
);

-- 9. Leave & Visitors
CREATE TABLE IF NOT EXISTS leave_types (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  is_paid INTEGER NOT NULL DEFAULT 1,
  days_allowed_per_year INTEGER NOT NULL DEFAULT 14,
  requires_approval INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  UNIQUE(organization_id, code)
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  leave_type_id TEXT NOT NULL REFERENCES leave_types(id),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  reviewer_id TEXT REFERENCES users(id),
  reviewed_at TEXT,
  reviewer_comments TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS visitors (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  visitor_name TEXT NOT NULL,
  visitor_email TEXT,
  visitor_phone TEXT,
  host_person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL,
  allowed_location_ids TEXT NOT NULL,
  valid_from TEXT NOT NULL,
  valid_until TEXT NOT NULL,
  pass_code TEXT UNIQUE NOT NULL,
  dynamic_qr_token TEXT,
  status TEXT NOT NULL DEFAULT 'PRE_REGISTERED',
  check_in_time TEXT,
  check_out_time TEXT,
  created_at TEXT NOT NULL
);

-- 10. Fraud Alerts, Audit Logs & Notifications
CREATE TABLE IF NOT EXISTS fraud_alerts (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  person_id TEXT REFERENCES persons(id) ON DELETE SET NULL,
  attendance_record_id TEXT REFERENCES attendance_records(id) ON DELETE SET NULL,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  details TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  resolved_by_id TEXT REFERENCES users(id),
  resolved_at TEXT,
  resolution_notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  actor_role TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  previous_state TEXT,
  new_state TEXT,
  ip_address TEXT,
  user_agent TEXT,
  reason TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  recipient_person_id TEXT REFERENCES persons(id) ON DELETE CASCADE,
  recipient_email TEXT,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  channel TEXT NOT NULL,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'QUEUED',
  metadata TEXT,
  created_at TEXT NOT NULL
);

-- 11. Privacy, Consent & Integrations
CREATE TABLE IF NOT EXISTS consent_records (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  consent_given INTEGER NOT NULL,
  consent_version TEXT NOT NULL,
  consent_text_snapshot TEXT NOT NULL,
  granted_at TEXT NOT NULL,
  withdrawn_at TEXT
);

CREATE TABLE IF NOT EXISTS data_subject_requests (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  requested_at TEXT NOT NULL,
  completed_at TEXT,
  export_file_url TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS integration_connections (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  system_type TEXT NOT NULL,
  name TEXT NOT NULL,
  config TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  last_sync_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS integration_sync_logs (
  id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  records_synced INTEGER NOT NULL DEFAULT 0,
  error_details TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS scheduled_reports (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL,
  format TEXT NOT NULL,
  schedule_cron TEXT NOT NULL,
  recipient_emails TEXT NOT NULL,
  filters TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  last_run_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key_name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  scopes TEXT NOT NULL,
  expires_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS webhooks (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  endpoint_url TEXT NOT NULL,
  secret TEXT NOT NULL,
  event_subscriptions TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

-- ==========================================
-- INDEXES FOR HIGH-PERFORMANCE MULTI-TENANCY
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_org_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_persons_org ON persons(organization_id);
CREATE INDEX IF NOT EXISTS idx_persons_user ON persons(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON organization_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_org ON organization_memberships(organization_id);
CREATE INDEX IF NOT EXISTS idx_locations_org ON locations(organization_id);
CREATE INDEX IF NOT EXISTS idx_locations_parent ON locations(parent_id);
CREATE INDEX IF NOT EXISTS idx_devices_org ON devices(organization_id);
CREATE INDEX IF NOT EXISTS idx_schedules_org ON schedules(organization_id);
CREATE INDEX IF NOT EXISTS idx_shifts_org ON shifts(organization_id);
CREATE INDEX IF NOT EXISTS idx_sessions_org ON attendance_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON attendance_sessions(status);
CREATE INDEX IF NOT EXISTS idx_events_org ON attendance_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_events_person ON attendance_events(person_id);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON attendance_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_records_org ON attendance_records(organization_id);
CREATE INDEX IF NOT EXISTS idx_records_person ON attendance_records(person_id);
CREATE INDEX IF NOT EXISTS idx_records_date ON attendance_records(date);
CREATE INDEX IF NOT EXISTS idx_records_status ON attendance_records(status);
CREATE INDEX IF NOT EXISTS idx_leave_org_person ON leave_requests(organization_id, person_id);
CREATE INDEX IF NOT EXISTS idx_visitors_org ON visitors(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_fraud_org ON fraud_alerts(organization_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_person_id);
CREATE INDEX IF NOT EXISTS idx_custom_fields_lookup ON custom_field_values(organization_id, entity_type, entity_id);

-- Additional composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_users_email_active ON users(email, is_active);
CREATE INDEX IF NOT EXISTS idx_persons_org_status ON persons(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_persons_org_user ON persons(organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_org_status ON organization_memberships(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_devices_org_status ON devices(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_locations_org_parent ON locations(organization_id, parent_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_org_person_date ON attendance_records(organization_id, person_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_events_org_person_timestamp ON attendance_events(organization_id, person_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_org_start_status ON attendance_sessions(organization_id, start_time, status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_org_person_status ON leave_requests(organization_id, person_id, status);
CREATE INDEX IF NOT EXISTS idx_group_members_group_person ON group_memberships(group_id, person_id);
CREATE INDEX IF NOT EXISTS idx_roles_org_code ON roles(organization_id, code);
CREATE INDEX IF NOT EXISTS idx_schedule_rules_schedule ON schedule_rules(schedule_id);
CREATE INDEX IF NOT EXISTS idx_policy_rules_policy ON policy_rules(policy_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_timestamp ON audit_logs(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- Email verification and password reset indexes
CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(email_verification_token);
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_password_token);
CREATE INDEX IF NOT EXISTS idx_users_unlock_token ON users(unlock_token);

-- Device authentication indexes
CREATE INDEX IF NOT EXISTS idx_device_credentials_device ON device_credentials(device_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens(user_id);

-- Shift and schedule assignment indexes
CREATE INDEX IF NOT EXISTS idx_shift_assignments_org_person ON shift_assignments(organization_id, person_id);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_org_shift ON shift_assignments(organization_id, shift_id);

-- Visitor management indexes
CREATE INDEX IF NOT EXISTS idx_visitors_org_status ON visitors(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_visitors_host_person ON visitors(host_person_id);

-- Fraud and anomaly detection indexes
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_org_timestamp ON fraud_alerts(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_org_person_timestamp ON fraud_alerts(organization_id, person_id, created_at);

-- Notification preferences and delivery indexes
CREATE INDEX IF NOT EXISTS idx_notifications_org_recipient_status ON notifications(organization_id, recipient_person_id, status);
CREATE INDEX IF NOT EXISTS idx_consent_records_org_person ON consent_records(organization_id, person_id);
`;
