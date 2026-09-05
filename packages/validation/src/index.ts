import { z } from 'zod';

// ==========================================
// 1. AUTH & ACCOUNT LIFECYCLE SCHEMAS
// ==========================================

export const RegisterUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  organization_name: z.string().optional(),
  organization_category: z.string().optional(),
});

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  mfa_code: z.string().optional(),
});

export const VerifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

export const ResendVerificationSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  new_password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export const SetupMFASchema = z.object({
  totp_code: z.string().length(6, 'MFA code must be 6 digits'),
});

export const UnlockAccountSchema = z.object({
  unlock_token: z.string().min(1, 'Unlock token is required'),
});

// ==========================================
// 2. ORGANIZATION & TENANT SCHEMAS
// ==========================================

export const CreateOrganizationSchema = z.object({
  name: z.string().min(2, 'Organization name must be at least 2 characters'),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must only contain lowercase letters, numbers, and dashes'),
  category: z.enum([
    'SCHOOL',
    'COLLEGE',
    'UNIVERSITY',
    'COACHING_CENTER',
    'TRAINING_INSTITUTE',
    'OFFICE',
    'CORPORATE',
    'BANK',
    'HOSPITAL',
    'CLINIC',
    'FACTORY',
    'WAREHOUSE',
    'CONSTRUCTION_SITE',
    'HOTEL',
    'RESORT',
    'RESTAURANT',
    'RETAIL_STORE',
    'GOVERNMENT',
    'NGO',
    'EVENT',
    'CONFERENCE',
    'CLUB',
    'GYM',
    'SPORTS',
    'TRANSPORT',
    'SECURITY',
    'FIELD_WORK',
    'REMOTE_WORK',
    'HYBRID',
    'HOSTEL',
    'CUSTOM',
  ]),
  custom_category_name: z.string().optional(),
  timezone: z.string().default('UTC'),
  default_language: z.string().default('en'),
});

export const UpdateOrganizationSettingsSchema = z.object({
  default_timezone: z.string().optional(),
  default_language: z.string().optional(),
  allowed_detection_methods: z.array(z.string()).optional(),
  biometrics_enabled: z.boolean().optional(),
  gps_enabled: z.boolean().optional(),
  qr_enabled: z.boolean().optional(),
  rfid_enabled: z.boolean().optional(),
  geofence_tolerance_meters: z.number().nonnegative().optional(),
  require_device_registration: z.boolean().optional(),
  allow_offline_sync: z.boolean().optional(),
  data_retention_days: z.number().int().positive().optional(),
  mfa_required_for_admins: z.boolean().optional(),
  allow_self_registration: z.boolean().optional(),
});

// ==========================================
// 3. EXTENSIBILITY & CUSTOM FIELDS
// ==========================================

export const CreateCustomFieldDefinitionSchema = z.object({
  entity_type: z.enum(['PERSON', 'LOCATION', 'DEVICE', 'ATTENDANCE_RECORD', 'SESSION', 'VISITOR']),
  field_key: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9_]+$/, 'Field key must be alphanumeric snake_case'),
  field_label: z.string().min(1, 'Label is required'),
  field_type: z.enum(['TEXT', 'NUMBER', 'BOOLEAN', 'DATE', 'SELECT']),
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(),
  validation_regex: z.string().optional(),
});

export const SetCustomFieldValueSchema = z.object({
  entity_type: z.enum(['PERSON', 'LOCATION', 'DEVICE', 'ATTENDANCE_RECORD', 'SESSION', 'VISITOR']),
  entity_id: z.string().uuid(),
  field_key: z.string().min(1),
  value: z.union([z.string(), z.number(), z.boolean()]),
});

// ==========================================
// 4. PERSON, ROLE & MEMBERSHIP SCHEMAS
// ==========================================

export const CreatePersonSchema = z.object({
  person_code: z.string().min(1, 'Person/ID code is required'),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  national_id: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'ON_LEAVE', 'TERMINATED']).default('ACTIVE'),
  primary_department_id: z.string().uuid().optional(),
  primary_location_id: z.string().uuid().optional(),
  metadata: z.record(z.any()).optional(),
  roles: z.array(z.string().uuid()).optional(),
});

export const AssignRoleSchema = z.object({
  person_id: z.string().uuid(),
  role_id: z.string().uuid(),
});

// ==========================================
// 5. LOCATION & HIERARCHY SCHEMAS
// ==========================================

export const CreateLocationSchema = z.object({
  parent_id: z.string().uuid().optional().nullable(),
  name: z.string().min(1, 'Location name is required'),
  code: z.string().min(1, 'Location code is required'),
  type: z.enum([
    'REGION',
    'CAMPUS',
    'BRANCH',
    'BUILDING',
    'FLOOR',
    'ROOM',
    'ZONE',
    'GATE',
    'SITE',
    'CUSTOM',
  ]),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  radius_meters: z.number().positive().optional(),
  polygon_geojson: z.string().optional(),
  wifi_ssids: z.array(z.string()).optional(),
  ble_beacons: z.array(z.string()).optional(),
  ip_ranges: z.array(z.string()).optional(),
  timezone: z.string().default('UTC'),
});

// ==========================================
// 6. SCHEDULE & SHIFT SCHEMAS
// ==========================================

export const CreateShiftSchema = z.object({
  name: z.string().min(1, 'Shift name is required'),
  code: z.string().min(1, 'Shift code is required'),
  start_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/, 'Format must be HH:mm:ss or HH:mm'),
  end_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/, 'Format must be HH:mm:ss or HH:mm'),
  crosses_midnight: z.boolean().optional(),
  grace_period_minutes: z.number().int().nonnegative().default(10),
  late_threshold_minutes: z.number().int().nonnegative().default(30),
  early_leave_threshold_minutes: z.number().int().nonnegative().default(15),
  min_working_minutes: z.number().int().nonnegative().default(480),
  break_duration_minutes: z.number().int().nonnegative().default(60),
});

export const CreateScheduleSchema = z.object({
  name: z.string().min(1, 'Schedule name is required'),
  schedule_type: z.enum([
    'FIXED',
    'CLASS',
    'SHIFT',
    'ROTATING',
    'FLEXIBLE',
    'SPLIT',
    'OVERNIGHT',
    'RECURRING',
    'ONE_TIME',
    'EVENT',
    'REMOTE',
    'FIELD',
    'NO_FIXED',
  ]),
  timezone: z.string().default('UTC'),
  valid_from: z.string(),
  valid_until: z.string().optional(),
  days_of_week: z.array(z.number().int().min(0).max(6)).default([1, 2, 3, 4, 5]),
  default_shift_id: z.string().uuid().optional(),
});

export const CreateSessionSchema = z.object({
  name: z.string().min(1, 'Session name is required'),
  session_type: z.enum(['CLASS', 'SHIFT', 'EVENT', 'MEETING', 'WORK_SESSION', 'CUSTOM']),
  location_id: z.string().uuid().optional(),
  group_id: z.string().uuid().optional(),
  schedule_id: z.string().uuid().optional(),
  shift_id: z.string().uuid().optional(),
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
  policy_id: z.string().uuid().optional(),
});

// ==========================================
// 7. DETECTION & ATTENDANCE SUBMISSION SCHEMAS
// ==========================================

export const SubmitDetectionEventSchema = z.object({
  person_id: z.string().uuid().optional(),
  device_id: z.string().uuid().optional(),
  session_id: z.string().uuid().optional(),
  detection_method: z.enum([
    'QR',
    'DYNAMIC_QR',
    'BARCODE',
    'RFID',
    'NFC',
    'SMART_CARD',
    'PIN',
    'OTP',
    'FINGERPRINT',
    'FACE',
    'IRIS',
    'PALM',
    'PALM_VEIN',
    'VOICE',
    'DIGITAL_SIGNATURE',
    'MANUAL',
    'GPS',
    'GEOFENCE',
    'WIFI',
    'BLE',
    'UWB',
    'CELLULAR',
    'IP_NETWORK',
    'VPN',
    'REGISTERED_DEVICE',
    'SSO',
    'KIOSK',
    'SENSOR',
    'CCTV',
    'WEB_SESSION',
    'MOBILE_SESSION',
  ]),
  timestamp: z.string().datetime().optional(),
  raw_token: z.string().optional(),
  location: z
    .object({
      latitude: z.number().min(-90).max(90).optional(),
      longitude: z.number().min(-180).max(180).optional(),
      accuracy_meters: z.number().optional(),
      altitude: z.number().optional(),
      wifi_ssid: z.string().optional(),
      ble_uuid: z.string().optional(),
      ip_address: z.string().optional(),
      is_vpn: z.boolean().optional(),
    })
    .optional(),
  identity_confidence: z.number().min(0).max(100).optional(),
  device_confidence: z.number().min(0).max(100).optional(),
  is_simulated: z.boolean().default(false),
  metadata: z.record(z.any()).optional(),
});

/**
 * Simplified detection submission schema used by the attendance detection API.
 * Requires explicit person_id, event_type and detection_method.
 */
export const SubmitDetectionSchema = z.object({
  person_id: z.string().uuid('Person ID is required'),
  session_id: z.string().uuid().optional(),
  detection_method: z.enum([
    'QR', 'DYNAMIC_QR', 'BARCODE', 'RFID', 'NFC', 'SMART_CARD', 'PIN', 'OTP',
    'FINGERPRINT', 'FACE', 'IRIS', 'PALM', 'PALM_VEIN', 'VOICE', 'DIGITAL_SIGNATURE',
    'MANUAL', 'GPS', 'GEOFENCE', 'WIFI', 'BLE', 'UWB', 'CELLULAR', 'IP_NETWORK',
    'VPN', 'REGISTERED_DEVICE', 'SSO', 'KIOSK', 'SENSOR', 'CCTV', 'WEB_SESSION', 'MOBILE_SESSION',
  ]),
  event_type: z.enum(['CHECK_IN', 'CHECK_OUT']),
  timestamp: z.string().datetime(),
  location_id: z.string().uuid().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  device_id: z.string().uuid().optional(),
  qr_token: z.string().optional(),
  confidence_score: z.number().min(0).max(100).optional(),
  raw_payload: z.record(z.any()).optional(),
});

export const CorrectAttendanceRecordSchema = z.object({
  new_status: z.enum([
    'PRESENT',
    'ABSENT',
    'LATE',
    'EARLY',
    'EARLY_LEAVE',
    'CHECK_IN',
    'CHECK_OUT',
    'BREAK_START',
    'BREAK_END',
    'PARTIAL',
    'EXCUSED',
    'LEAVE',
    'REMOTE',
    'FIELD_WORK',
    'OFFICIAL_DUTY',
    'OVERTIME',
    'UNKNOWN',
    'SUSPICIOUS',
    'REJECTED',
    'PENDING_REVIEW',
    'MISSING_CHECKOUT',
    'CUSTOM',
  ]),
  reason: z.string().min(5, 'Reason must be at least 5 characters'),
});

// ==========================================
// 8. POLICY & SAFE RULE SCHEMAS
// ==========================================

export const CreatePolicySchema = z.object({
  name: z.string().min(2, 'Policy name is required'),
  description: z.string().optional(),
  required_methods: z.array(z.string()).default([]),
  optional_methods: z.array(z.string()).default([]),
  method_weights: z
    .array(
      z.object({
        method: z.string(),
        required: z.boolean(),
        weight: z.number().min(0).max(100),
      })
    )
    .default([]),
  allowed_location_ids: z.array(z.string().uuid()).default([]),
  geofence_radius_meters: z.number().nonnegative().default(50),
  allowed_device_types: z.array(z.string()).default([]),
  grace_period_minutes: z.number().int().nonnegative().default(10),
  late_threshold_minutes: z.number().int().nonnegative().default(30),
  early_leave_threshold_minutes: z.number().int().nonnegative().default(15),
  min_confidence_score: z.number().min(0).max(100).default(75),
  duplicate_scan_window_seconds: z.number().int().nonnegative().default(60),
  auto_reject_below_score: z.number().min(0).max(100).default(20),
  review_threshold_score: z.number().min(0).max(100).default(50),
  is_default: z.boolean().default(false),
});

// ==========================================
// 9. LEAVE & VISITOR SCHEMAS
// ==========================================

export const CreateLeaveRequestSchema = z.object({
  person_id: z.string().uuid(),
  leave_type_id: z.string().uuid(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format must be YYYY-MM-DD'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format must be YYYY-MM-DD'),
  reason: z.string().min(3, 'Reason is required'),
});

export const ReviewLeaveRequestSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  comments: z.string().optional(),
});

export const CreateVisitorPassSchema = z.object({
  visitor_name: z.string().min(2, 'Visitor name is required'),
  visitor_email: z.string().email().optional().or(z.literal('')),
  visitor_phone: z.string().optional(),
  host_person_id: z.string().uuid(),
  purpose: z.string().min(3, 'Purpose is required'),
  allowed_location_ids: z.array(z.string().uuid()).default([]),
  valid_from: z.string().datetime(),
  valid_until: z.string().datetime(),
});

// ==========================================
// 10. DEVICE & OFFLINE QUEUE SCHEMAS
// ==========================================

export const RegisterDeviceSchema = z.object({
  name: z.string().min(1, 'Device name is required'),
  device_type: z.enum([
    'MOBILE',
    'WEB',
    'RFID_READER',
    'NFC_READER',
    'FINGERPRINT_READER',
    'FACE_TERMINAL',
    'CAMERA',
    'KIOSK',
    'GATE',
    'TURNSTILE',
    'BEACON',
    'IOT_DEVICE',
    'ACCESS_CONTROL',
  ]),
  serial_number: z.string().min(1, 'Serial number is required'),
  location_id: z.string().uuid().optional(),
  assigned_policy_id: z.string().uuid().optional(),
  config: z.record(z.any()).optional(),
});

export const OfflineSyncBatchSchema = z.object({
  device_id: z.string().uuid(),
  events: z.array(
    z.object({
      local_event_id: z.string(),
      timestamp: z.string().datetime(),
      detection_method: z.string(),
      raw_payload: z.record(z.any()),
      crypto_signature: z.string().optional(),
    })
  ),
});
