/**
 * Universal Attendance & Presence Management System (UAPMS)
 * Core Shared Type Definitions
 */

// ==========================================
// 1. ORGANIZATION & SUBSCRIPTION TYPES
// ==========================================

export type OrganizationCategory =
  | 'SCHOOL'
  | 'COLLEGE'
  | 'UNIVERSITY'
  | 'COACHING_CENTER'
  | 'TRAINING_INSTITUTE'
  | 'OFFICE'
  | 'CORPORATE'
  | 'BANK'
  | 'HOSPITAL'
  | 'CLINIC'
  | 'FACTORY'
  | 'WAREHOUSE'
  | 'CONSTRUCTION_SITE'
  | 'HOTEL'
  | 'RESORT'
  | 'RESTAURANT'
  | 'RETAIL_STORE'
  | 'GOVERNMENT'
  | 'NGO'
  | 'EVENT'
  | 'CONFERENCE'
  | 'CLUB'
  | 'GYM'
  | 'SPORTS'
  | 'TRANSPORT'
  | 'SECURITY'
  | 'FIELD_WORK'
  | 'REMOTE_WORK'
  | 'HYBRID'
  | 'HOSTEL'
  | 'CUSTOM';

export type OrganizationStatus =
  | 'ACTIVE'
  | 'TRIAL'
  | 'PAST_DUE'
  | 'SUSPENDED'
  | 'CANCELLED';

export interface SubscriptionPlan {
  id: string;
  code: string;
  name: string;
  tier: 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
  max_people: number;
  max_devices: number;
  max_locations: number;
  max_api_requests_per_day: number;
  features: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TenantQuotas {
  organization_id: string;
  max_people: number;
  max_devices: number;
  max_locations: number;
  max_api_requests_per_day: number;
  features_enabled: string[];
  current_people_count: number;
  current_devices_count: number;
  current_locations_count: number;
}

export interface OrganizationSettings {
  organization_id: string;
  default_timezone: string;
  default_language: string;
  allowed_detection_methods: DetectionMethodType[];
  biometrics_enabled: boolean;
  gps_enabled: boolean;
  qr_enabled: boolean;
  rfid_enabled: boolean;
  geofence_tolerance_meters: number;
  require_device_registration: boolean;
  allow_offline_sync: boolean;
  data_retention_days: number;
  mfa_required_for_admins: boolean;
  allow_self_registration: boolean;
  custom_attributes?: Record<string, any>;
}

export interface Organization {
  id: string;
  slug: string;
  name: string;
  category: OrganizationCategory;
  custom_category_name?: string;
  status: OrganizationStatus;
  subscription_plan_id?: string;
  trial_ends_at?: string;
  settings?: OrganizationSettings;
  created_at: string;
  updated_at: string;
}

// ==========================================
// 2. EXTENSIBILITY & CUSTOM FIELDS
// ==========================================

export type CustomFieldEntityType =
  | 'PERSON'
  | 'LOCATION'
  | 'DEVICE'
  | 'ATTENDANCE_RECORD'
  | 'SESSION'
  | 'VISITOR';

export type CustomFieldType =
  | 'TEXT'
  | 'NUMBER'
  | 'BOOLEAN'
  | 'DATE'
  | 'SELECT';

export interface CustomFieldDefinition {
  id: string;
  organization_id: string;
  entity_type: CustomFieldEntityType;
  field_key: string;
  field_label: string;
  field_type: CustomFieldType;
  required: boolean;
  options?: string[]; // For select type
  validation_regex?: string;
  created_at: string;
}

export interface CustomFieldValue {
  id: string;
  organization_id: string;
  entity_type: CustomFieldEntityType;
  entity_id: string;
  field_key: string;
  value: string | number | boolean;
  created_at: string;
  updated_at: string;
}

// ==========================================
// 3. IDENTITY, USER, PERSON & RBAC
// ==========================================

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  is_email_verified: boolean;
  mfa_enabled: boolean;
  mfa_secret?: string;
  failed_login_attempts: number;
  locked_until?: string;
  created_at: string;
  updated_at: string;
}

export type PersonStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'ON_LEAVE' | 'TERMINATED';

export interface Person {
  id: string;
  organization_id: string;
  user_id?: string;
  person_code: string; // Employee ID, Student ID, Badge ID, etc.
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  national_id?: string;
  status: PersonStatus;
  avatar_url?: string;
  primary_department_id?: string;
  primary_location_id?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export type StandardSystemRole =
  | 'PLATFORM_SUPER_ADMIN'
  | 'ORGANIZATION_OWNER'
  | 'ORGANIZATION_ADMIN'
  | 'BRANCH_ADMIN'
  | 'ATTENDANCE_ADMINISTRATOR'
  | 'HR'
  | 'MANAGER'
  | 'TEACHER'
  | 'SUPERVISOR'
  | 'SECURITY_OFFICER'
  | 'AUDITOR'
  | 'USER'
  | 'VISITOR';

export interface Role {
  id: string;
  organization_id?: string; // null for platform system roles
  code: string;
  name: string;
  description?: string;
  is_system_role: boolean;
  permissions: string[]; // List of permission codes
  created_at: string;
}

export interface Permission {
  id: string;
  code: string;
  name: string;
  description?: string;
  module: string;
}

export interface OrganizationMembership {
  id: string;
  organization_id: string;
  user_id: string;
  person_id?: string;
  role_id: string;
  status: 'ACTIVE' | 'INVITED' | 'SUSPENDED';
  joined_at: string;
}

// ==========================================
// 4. LOCATIONS & HIERARCHY
// ==========================================

export type LocationType =
  | 'REGION'
  | 'CAMPUS'
  | 'BRANCH'
  | 'BUILDING'
  | 'FLOOR'
  | 'ROOM'
  | 'ZONE'
  | 'GATE'
  | 'SITE'
  | 'CUSTOM';

export interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

export interface Location {
  id: string;
  organization_id: string;
  parent_id?: string;
  name: string;
  code: string;
  type: LocationType;
  hierarchy_path?: string; // Materialized path e.g. /campus-1/building-a/floor-2
  coordinates?: GeoCoordinates;
  radius_meters?: number;
  polygon_geojson?: string; // JSON string representing polygon geojson
  wifi_ssids?: string[];
  ble_beacons?: string[];
  ip_ranges?: string[];
  timezone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  organization_id: string;
  parent_id?: string;
  name: string;
  code: string;
  manager_person_id?: string;
  created_at: string;
}

export interface Group {
  id: string;
  organization_id: string;
  department_id?: string;
  name: string;
  code: string;
  group_type: 'CLASS' | 'TEAM' | 'PROJECT' | 'BATCH' | 'CUSTOM';
  leader_person_id?: string;
  created_at: string;
}

export interface GroupMembership {
  id: string;
  group_id: string;
  person_id: string;
  role_in_group?: string; // Student, Member, TA, etc.
  joined_at: string;
}

// ==========================================
// 5. SCHEDULES, SHIFTS & SESSIONS
// ==========================================

export type ScheduleType =
  | 'FIXED'
  | 'CLASS'
  | 'SHIFT'
  | 'ROTATING'
  | 'FLEXIBLE'
  | 'SPLIT'
  | 'OVERNIGHT'
  | 'RECURRING'
  | 'ONE_TIME'
  | 'EVENT'
  | 'REMOTE'
  | 'FIELD'
  | 'NO_FIXED';

export interface Shift {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  start_time: string; // HH:mm:ss format
  end_time: string;   // HH:mm:ss format
  crosses_midnight: boolean;
  grace_period_minutes: number;
  late_threshold_minutes: number;
  early_leave_threshold_minutes: number;
  min_working_minutes: number;
  break_duration_minutes: number;
  is_active: boolean;
  created_at: string;
}

export interface Schedule {
  id: string;
  organization_id: string;
  name: string;
  schedule_type: ScheduleType;
  timezone: string;
  valid_from: string;
  valid_until?: string;
  days_of_week: number[]; // 0 = Sunday, 1 = Monday ... 6 = Saturday
  default_shift_id?: string;
  is_active: boolean;
  created_at: string;
}

export type SessionStatus = 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export interface AttendanceSession {
  id: string;
  organization_id: string;
  location_id?: string;
  group_id?: string;
  schedule_id?: string;
  shift_id?: string;
  host_person_id?: string; // Teacher / Supervisor
  name: string;
  session_type: 'CLASS' | 'SHIFT' | 'EVENT' | 'MEETING' | 'WORK_SESSION' | 'CUSTOM';
  start_time: string; // ISO 8601 UTC
  end_time: string;   // ISO 8601 UTC
  status: SessionStatus;
  policy_id?: string;
  current_dynamic_qr?: string;
  qr_expires_at?: string;
  created_at: string;
  updated_at: string;
}

// ==========================================
// 6. DETECTION ADAPTERS & NORMALIZED EVENT
// ==========================================

export type DetectionMethodType =
  | 'QR'
  | 'DYNAMIC_QR'
  | 'BARCODE'
  | 'RFID'
  | 'NFC'
  | 'SMART_CARD'
  | 'PIN'
  | 'OTP'
  | 'FINGERPRINT'
  | 'FACE'
  | 'IRIS'
  | 'PALM'
  | 'PALM_VEIN'
  | 'VOICE'
  | 'DIGITAL_SIGNATURE'
  | 'MANUAL'
  | 'GPS'
  | 'GEOFENCE'
  | 'WIFI'
  | 'BLE'
  | 'UWB'
  | 'CELLULAR'
  | 'IP_NETWORK'
  | 'VPN'
  | 'REGISTERED_DEVICE'
  | 'SSO'
  | 'KIOSK'
  | 'SENSOR'
  | 'CCTV'
  | 'WEB_SESSION'
  | 'MOBILE_SESSION';

export interface DetectionLocationPayload {
  latitude?: number;
  longitude?: number;
  accuracy_meters?: number;
  altitude?: number;
  wifi_ssid?: string;
  ble_uuid?: string;
  ip_address?: string;
  is_vpn?: boolean;
}

export interface NormalizedDetectionEvent {
  event_id: string;
  organization_id: string;
  person_id?: string;
  device_id?: string;
  session_id?: string;
  detection_method: DetectionMethodType;
  timestamp: string; // ISO 8601 UTC
  timezone: string;
  location_data?: DetectionLocationPayload;
  raw_token?: string; // QR token, RFID card number, etc.
  identity_confidence?: number; // 0 - 100
  device_confidence?: number;   // 0 - 100
  provider_reference: string;
  evidence_reference?: string;
  is_simulated?: boolean;
  metadata?: Record<string, any>;
  processing_status: 'RECEIVED' | 'PROCESSING' | 'VERIFIED' | 'FAILED' | 'REJECTED';
}

// ==========================================
// 7. ATTENDANCE STATUSES & RECORDS
// ==========================================

export type AttendanceStatus =
  | 'PRESENT'
  | 'ABSENT'
  | 'LATE'
  | 'EARLY'
  | 'EARLY_LEAVE'
  | 'CHECK_IN'
  | 'CHECK_OUT'
  | 'BREAK_START'
  | 'BREAK_END'
  | 'PARTIAL'
  | 'EXCUSED'
  | 'LEAVE'
  | 'REMOTE'
  | 'FIELD_WORK'
  | 'OFFICIAL_DUTY'
  | 'OVERTIME'
  | 'UNKNOWN'
  | 'SUSPICIOUS'
  | 'REJECTED'
  | 'PENDING_REVIEW'
  | 'MISSING_CHECKOUT'
  | 'CUSTOM';

export type ConfidenceThresholdVerdict =
  | 'VERIFIED'   // 90 - 100
  | 'VALID'      // 75 - 89
  | 'REVIEW'     // 50 - 74
  | 'SUSPICIOUS' // 20 - 49
  | 'REJECTED';  // 0 - 19

export interface ConfidenceItemBreakdown {
  method: DetectionMethodType;
  score_awarded: number;
  max_weight: number;
  matched: boolean;
  reason: string;
}

export interface ConfidenceScoreResult {
  total_score: number; // 0 - 100
  max_possible: number;
  verdict: ConfidenceThresholdVerdict;
  breakdown: ConfidenceItemBreakdown[];
}

export interface AttendanceRecord {
  id: string;
  organization_id: string;
  person_id: string;
  session_id?: string;
  schedule_id?: string;
  shift_id?: string;
  date: string; // YYYY-MM-DD local organization date
  status: AttendanceStatus;
  custom_status_code?: string;
  check_in_time?: string; // ISO 8601 UTC
  check_out_time?: string;
  working_minutes?: number;
  break_minutes?: number;
  late_minutes?: number;
  early_leave_minutes?: number;
  overtime_minutes?: number;
  confidence_score: number; // 0 - 100
  confidence_verdict: ConfidenceThresholdVerdict;
  policy_id: string;
  is_corrected: boolean;
  created_at: string;
  updated_at: string;
}

export interface AttendanceEvidence {
  id: string;
  attendance_record_id: string;
  organization_id: string;
  detection_events: NormalizedDetectionEvent[];
  location_verified: boolean;
  location_verification_details?: Record<string, any>;
  device_verified: boolean;
  device_verification_details?: Record<string, any>;
  identity_verified: boolean;
  identity_verification_details?: Record<string, any>;
  confidence_breakdown: ConfidenceScoreResult;
  rules_evaluated: Array<{ rule_id: string; passed: boolean; action_taken: string }>;
  explanation: string;
  created_at: string;
}

export interface AttendanceCorrection {
  id: string;
  attendance_record_id: string;
  organization_id: string;
  previous_status: AttendanceStatus;
  new_status: AttendanceStatus;
  actor_id: string;
  actor_role: string;
  reason: string;
  source: 'MANUAL_DASHBOARD' | 'REALTIME_MONITOR' | 'API' | 'BULK_CORRECTION';
  timestamp: string;
}

// ==========================================
// 8. POLICIES & SAFE RULE ENGINE
// ==========================================

export interface MethodWeightConfig {
  method: DetectionMethodType;
  required: boolean;
  weight: number; // 0 - 100
}

export interface AttendancePolicy {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  required_methods: DetectionMethodType[];
  optional_methods: DetectionMethodType[];
  method_weights: MethodWeightConfig[];
  allowed_location_ids: string[];
  geofence_radius_meters: number;
  allowed_device_types: string[];
  grace_period_minutes: number;
  late_threshold_minutes: number;
  early_leave_threshold_minutes: number;
  min_confidence_score: number;
  duplicate_scan_window_seconds: number;
  auto_reject_below_score: number;
  review_threshold_score: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export type ASTOperator =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'GREATER_THAN'
  | 'GREATER_THAN_OR_EQUAL'
  | 'LESS_THAN'
  | 'LESS_THAN_OR_EQUAL'
  | 'IN'
  | 'NOT_IN'
  | 'CONTAINS'
  | 'AND'
  | 'OR'
  | 'NOT';

export interface ASTCondition {
  field?: string;
  operator: ASTOperator;
  value?: any;
  conditions?: ASTCondition[]; // For compound AND / OR / NOT
}

export interface PolicyRule {
  id: string;
  policy_id: string;
  priority: number;
  name: string;
  condition: ASTCondition;
  action: {
    set_status?: AttendanceStatus;
    modify_confidence?: number;
    flag_suspicious?: boolean;
    require_review?: boolean;
    create_notification?: boolean;
    notification_message?: string;
  };
  is_active: boolean;
}

// ==========================================
// 9. LEAVE & VISITOR MANAGEMENT
// ==========================================

export interface LeaveType {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  is_paid: boolean;
  days_allowed_per_year: number;
  requires_approval: boolean;
  is_active: boolean;
}

export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface LeaveRequest {
  id: string;
  organization_id: string;
  person_id: string;
  leave_type_id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  reason: string;
  status: LeaveStatus;
  reviewer_id?: string;
  reviewed_at?: string;
  reviewer_comments?: string;
  created_at: string;
  updated_at: string;
}

export type VisitorPassStatus = 'PRE_REGISTERED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'EXPIRED' | 'CANCELLED';

export interface VisitorPass {
  id: string;
  organization_id: string;
  visitor_name: string;
  visitor_email?: string;
  visitor_phone?: string;
  host_person_id: string;
  purpose: string;
  allowed_location_ids: string[];
  valid_from: string; // ISO 8601 UTC
  valid_until: string;
  pass_code: string;
  dynamic_qr_token?: string;
  status: VisitorPassStatus;
  check_in_time?: string;
  check_out_time?: string;
  created_at: string;
}

// ==========================================
// 10. DEVICES & OFFLINE QUEUE
// ==========================================

export type DeviceType =
  | 'MOBILE'
  | 'WEB'
  | 'RFID_READER'
  | 'NFC_READER'
  | 'FINGERPRINT_READER'
  | 'FACE_TERMINAL'
  | 'CAMERA'
  | 'KIOSK'
  | 'GATE'
  | 'TURNSTILE'
  | 'BEACON'
  | 'IOT_DEVICE'
  | 'ACCESS_CONTROL';

export type DeviceStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'DECOMMISSIONED';

export interface Device {
  id: string;
  organization_id: string;
  location_id?: string;
  name: string;
  device_type: DeviceType;
  serial_number: string;
  status: DeviceStatus;
  assigned_policy_id?: string;
  last_seen_at?: string;
  ip_address?: string;
  firmware_version?: string;
  credential_hash?: string;
  config?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface OfflineQueuedEvent {
  local_event_id: string;
  device_id: string;
  organization_id: string;
  timestamp: string; // Preserved original timestamp
  detection_method: DetectionMethodType;
  raw_payload: Record<string, any>;
  crypto_signature?: string;
}

// ==========================================
// 11. FRAUD, AUDIT & NOTIFICATIONS
// ==========================================

export type FraudAlertType =
  | 'DUPLICATE_ATTENDANCE'
  | 'QR_REPLAY'
  | 'EXPIRED_QR'
  | 'SHARED_QR'
  | 'INVALID_DEVICE'
  | 'GPS_ANOMALY'
  | 'IMPOSSIBLE_TRAVEL'
  | 'FACE_MISMATCH'
  | 'RFID_FACE_MISMATCH'
  | 'DEVICE_SHARING'
  | 'EXCESSIVE_FAILURES'
  | 'SUSPICIOUS_TIMING'
  | 'ABNORMAL_PATTERN';

export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface FraudAlert {
  id: string;
  organization_id: string;
  person_id?: string;
  attendance_record_id?: string;
  alert_type: FraudAlertType;
  severity: AlertSeverity;
  details: Record<string, any>;
  status: 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'DISMISSED';
  resolved_by_id?: string;
  resolved_at?: string;
  resolution_notes?: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  organization_id?: string;
  actor_id?: string;
  actor_role?: string;
  action: string;
  entity_type: string;
  entity_id: string;
  previous_state?: Record<string, any>;
  new_state?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  reason?: string;
  created_at: string;
}

export type NotificationChannel = 'IN_APP' | 'EMAIL' | 'SMS' | 'PUSH' | 'WEBHOOK';

export interface Notification {
  id: string;
  organization_id: string;
  recipient_person_id?: string;
  recipient_email?: string;
  title: string;
  message: string;
  channel: NotificationChannel;
  event_type: string;
  status: 'QUEUED' | 'SENT' | 'FAILED' | 'READ';
  metadata?: Record<string, any>;
  created_at: string;
}

// ==========================================
// 12. PRIVACY, CONSENT & DSAR
// ==========================================

export type ConsentCategory = 'BIOMETRIC' | 'PRECISE_LOCATION' | 'DEVICE_TRACKING' | 'PUSH_NOTIFICATIONS';

export interface ConsentRecord {
  id: string;
  organization_id: string;
  person_id: string;
  category: ConsentCategory;
  consent_given: boolean;
  consent_version: string;
  consent_text_snapshot: string;
  granted_at: string;
  withdrawn_at?: string;
}

export type DSARType = 'ACCESS_EXPORT' | 'ERASURE_ANONYMIZATION';

export interface DataSubjectRequest {
  id: string;
  organization_id: string;
  person_id: string;
  request_type: DSARType;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'REJECTED';
  requested_at: string;
  completed_at?: string;
  export_file_url?: string;
  notes?: string;
}

// ==========================================
// 13. API DTO PAYLOADS
// ==========================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    page?: number;
    limit?: number;
    total?: number;
    request_id?: string;
    timestamp?: string;
  };
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
}

export interface AuthUserPayload {
  user: User;
  organization_memberships: OrganizationMembership[];
  roles: Role[];
  permissions: string[];
  tokens: AuthTokens;
}

export interface DynamicQRTokenPayload {
  token: string;
  session_id: string;
  organization_id: string;
  expires_at: string;
  nonce: string;
}
