# UAPMS API Reference Documentation

**Version**: 2.0.0  
**Base URL**: `/api/v1`  
**Authentication**: Bearer Token (JWT)

---

## Table of Contents

1. [Authentication Endpoints](#authentication-endpoints)
2. [Organizations](#organizations)
3. [Persons](#persons)
4. [Roles & Permissions](#roles--permissions)
5. [Locations](#locations)
6. [Groups](#groups)
7. [Schedules & Shifts](#schedules--shifts)
8. [Attendance](#attendance)
9. [Leave Management](#leave-management)
10. [Error Handling](#error-handling)

---

## Authentication Endpoints

### Register User

```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123",
  "first_name": "John",
  "last_name": "Doe",
  "organization_name": "My Org",
  "organization_category": "CORPORATE"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "user_id": "uuid-here",
    "email": "user@example.com",
    "email_verification_token": "token-for-verification",
    "organization_id": "uuid-here"
  }
}
```

**Errors**:
- `409 EMAIL_ALREADY_EXISTS` - Email already registered
- `400 VALIDATION_ERROR` - Invalid input

---

### Verify Email

```http
POST /auth/verify-email
Content-Type: application/json

{
  "token": "email-verification-token"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "message": "Email verified successfully"
  }
}
```

---

### Login

```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123",
  "mfa_code": "123456"  // Required only if MFA is enabled
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid-here",
      "email": "user@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "is_email_verified": true,
      "mfa_enabled": false
    },
    "memberships": [
      {
        "id": "uuid-here",
        "organization_id": "uuid-here",
        "organization_name": "My Org",
        "organization_slug": "my-org",
        "role_id": "uuid-here",
        "role_code": "ORGANIZATION_OWNER",
        "role_name": "Organization Owner",
        "status": "ACTIVE"
      }
    ],
    "tokens": {
      "access_token": "jwt-access-token",
      "refresh_token": "jwt-refresh-token",
      "token_type": "Bearer",
      "expires_in": 900
    }
  }
}
```

**Special Cases**:
- **MFA Required**: If user has MFA enabled and mfa_code is missing:
  ```json
  {
    "success": true,
    "data": {
      "mfa_required": true,
      "message": "Multi-factor authentication code required"
    }
  }
  ```

- **Account Locked**: After 5 failed attempts:
  ```json
  {
    "success": false,
    "error": {
      "code": "ACCOUNT_LOCKED",
      "message": "Account locked for 15 minutes due to 5 failed login attempts.",
      "details": {
        "unlock_token": "token-to-unlock",
        "minutes_remaining": 15
      }
    }
  }
  ```

---

### Forgot Password

```http
POST /auth/forgot-password
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "message": "If the email exists, a password reset link has been sent",
    "reset_token": "token-for-reset"  // Returned for dev/testing
  }
}
```

---

### Reset Password

```http
POST /auth/reset-password
Content-Type: application/json

{
  "token": "password-reset-token",
  "new_password": "NewSecurePass123"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "message": "Password has been reset successfully"
  }
}
```

**Errors**:
- `400 INVALID_RESET_TOKEN` - Token is invalid or doesn't exist
- `400 RESET_TOKEN_EXPIRED` - Token has expired (1-hour window)
- `400 VALIDATION_ERROR` - Password doesn't meet requirements

---

### Setup MFA

```http
POST /auth/mfa/setup
Authorization: Bearer {access_token}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "secret": "JBSWY3DPEBLW64TMMQ2HY2LOM4======",
    "qr_code": "data:image/png;base64,...",
    "otpauth_url": "otpauth://totp/user@example.com?secret=..."
  }
}
```

User should:
1. Scan QR code with authenticator app (Google Authenticator, Authy, etc.)
2. Get 6-digit code from app
3. Call `/auth/mfa/verify` to confirm

---

### Verify & Enable MFA

```http
POST /auth/mfa/verify
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "totp_code": "123456"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "message": "MFA has been successfully verified and enabled",
    "backup_codes": [
      "ABC123",
      "DEF456",
      "..."
    ]
  }
}
```

---

### Unlock Account

```http
POST /auth/unlock
Content-Type: application/json

{
  "unlock_token": "token-from-lockout-error"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "message": "Account has been unlocked successfully"
  }
}
```

---

### Get Current User

```http
GET /auth/me
Authorization: Bearer {access_token}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid-here",
      "email": "user@example.com",
      "first_name": "John",
      "last_name": "Doe"
    },
    "tenantId": "org-uuid",
    "userRole": "ORGANIZATION_OWNER",
    "userPermissions": ["people:create", "people:delete", "attendance:correct"]
  }
}
```

---

### Refresh Token

```http
POST /auth/refresh
Content-Type: application/json

{
  "refresh_token": "jwt-refresh-token"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "access_token": "new-jwt-access-token",
    "refresh_token": "new-jwt-refresh-token",
    "token_type": "Bearer",
    "expires_in": 900
  }
}
```

---

### Logout

```http
POST /auth/logout
Authorization: Bearer {access_token}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  }
}
```

---

## Organizations

### List Organizations

```http
GET /organizations?page=1&limit=20
Authorization: Bearer {access_token}
x-organization-id: {org-id}
```

**Query Parameters**:
- `page` (int): Page number (default: 1)
- `limit` (int): Records per page (default: 20, max: 100)
- `status` (string): Filter by status (ACTIVE, TRIAL, SUSPENDED, CANCELLED)
- `category` (string): Filter by category

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-here",
      "slug": "my-org-abc1",
      "name": "My Organization",
      "category": "CORPORATE",
      "status": "ACTIVE",
      "subscription_plan_id": "plan-uuid",
      "created_at": "2026-08-30T10:00:00Z",
      "updated_at": "2026-08-30T10:00:00Z"
    }
  ],
  "metadata": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50,
      "total_pages": 3
    }
  }
}
```

---

### Get Organization Details

```http
GET /organizations/{id}
Authorization: Bearer {access_token}
x-organization-id: {org-id}
```

**Response** (200 OK): Same as List Organizations (single object)

**Errors**:
- `404 NOT_FOUND` - Organization doesn't exist
- `403 CROSS_TENANT_ACCESS_DENIED` - User doesn't have access to this org

---

### Get Organization Settings

```http
GET /organizations/{id}/settings
Authorization: Bearer {access_token}
x-organization-id: {org-id}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "organization_id": "uuid-here",
    "default_timezone": "UTC",
    "default_language": "en",
    "allowed_detection_methods": ["QR", "RFID", "GPS"],
    "biometrics_enabled": true,
    "gps_enabled": true,
    "qr_enabled": true,
    "rfid_enabled": true,
    "geofence_tolerance_meters": 15.0,
    "require_device_registration": false,
    "allow_offline_sync": true,
    "data_retention_days": 365,
    "mfa_required_for_admins": false,
    "allow_self_registration": false
  }
}
```

---

### Update Organization Settings

```http
PUT /organizations/{id}/settings
Authorization: Bearer {access_token}
x-organization-id: {org-id}
Content-Type: application/json

{
  "default_timezone": "America/New_York",
  "geofence_tolerance_meters": 50,
  "mfa_required_for_admins": true
}
```

**Required Permission**: `org:settings:write`

**Response** (200 OK): Updated settings object

---

## Persons

### List Persons

```http
GET /persons?page=1&limit=20&status=ACTIVE
Authorization: Bearer {access_token}
x-organization-id: {org-id}
```

**Query Parameters**:
- `page`, `limit`: Pagination
- `status`: Filter (ACTIVE, INACTIVE, ARCHIVED)
- `search`: Search by name or email
- `sort`: Sort by field (name, created_at, email)

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-here",
      "organization_id": "uuid-here",
      "user_id": "uuid-here-or-null",
      "person_code": "EMP-001",
      "first_name": "John",
      "last_name": "Doe",
      "email": "john.doe@example.com",
      "phone": "+1234567890",
      "status": "ACTIVE",
      "created_at": "2026-08-30T10:00:00Z",
      "updated_at": "2026-08-30T10:00:00Z"
    }
  ],
  "metadata": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "total_pages": 8
    }
  }
}
```

---

### Create Person

```http
POST /persons
Authorization: Bearer {access_token}
x-organization-id: {org-id}
Content-Type: application/json

{
  "person_code": "EMP-002",
  "first_name": "Jane",
  "last_name": "Smith",
  "email": "jane.smith@example.com",
  "phone": "+1234567890",
  "status": "ACTIVE"
}
```

**Required Permission**: `people:create`

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": "new-uuid",
    "organization_id": "org-uuid",
    "person_code": "EMP-002",
    "first_name": "Jane",
    "last_name": "Smith",
    "email": "jane.smith@example.com",
    "status": "ACTIVE"
  }
}
```

---

### Bulk Import Persons

```http
POST /persons/bulk-import
Authorization: Bearer {access_token}
x-organization-id: {org-id}
Content-Type: application/json

{
  "records": [
    {
      "person_code": "EMP-100",
      "first_name": "Alice",
      "last_name": "Johnson",
      "email": "alice@example.com",
      "status": "ACTIVE"
    },
    {
      "person_code": "EMP-101",
      "first_name": "Bob",
      "last_name": "Williams",
      "email": "bob@example.com",
      "status": "ACTIVE"
    }
  ]
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "imported": 2,
    "failed": 0,
    "errors": []
  }
}
```

---

## Attendance

### Submit Detection Event

```http
POST /attendance/detection
Authorization: Bearer {access_token}
x-organization-id: {org-id}
Content-Type: application/json

{
  "person_id": "person-uuid",
  "session_id": "session-uuid",
  "detection_method": "QR",
  "event_type": "CHECK_IN",
  "timestamp": "2026-08-30T08:30:00Z",
  "location_id": "location-uuid",
  "confidence_score": 95,
  "qr_token": "qr-token-string"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "event_id": "event-uuid",
    "status": "PRESENT",
    "confidence_score": 95,
    "evidence": {
      "detection_method": "QR",
      "timestamp": "2026-08-30T08:30:00Z",
      "verified": true
    }
  }
}
```

---

### List Attendance Records

```http
GET /attendance/records?person_id=uuid&date_from=2026-08-01&date_to=2026-08-31
Authorization: Bearer {access_token}
x-organization-id: {org-id}
```

**Query Parameters**:
- `person_id`: Filter by person
- `session_id`: Filter by session
- `date_from`, `date_to`: Date range (ISO 8601)
- `status`: Filter by status (PRESENT, ABSENT, LATE, etc.)
- `page`, `limit`: Pagination

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "record-uuid",
      "organization_id": "org-uuid",
      "person_id": "person-uuid",
      "session_id": "session-uuid",
      "date": "2026-08-30",
      "status": "PRESENT",
      "check_in_time": "2026-08-30T08:30:00Z",
      "check_out_time": "2026-08-30T17:30:00Z",
      "confidence_score": 95,
      "created_at": "2026-08-30T08:30:01Z"
    }
  ],
  "metadata": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 25,
      "total_pages": 2
    }
  }
}
```

---

### Correct Attendance Record

```http
PUT /attendance/records/{record_id}/correct
Authorization: Bearer {access_token}
x-organization-id: {org-id}
Content-Type: application/json

{
  "corrected_status": "LATE",
  "reason": "User submitted appeal with proof of delay"
}
```

**Required Permission**: `attendance:correct`

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "record-uuid",
    "status": "LATE",
    "previous_status": "ABSENT",
    "corrected_by": "admin-uuid",
    "correction_reason": "User submitted appeal with proof of delay",
    "corrected_at": "2026-08-30T15:00:00Z"
  }
}
```

---

## Error Handling

All errors follow a consistent format:

### Validation Error (400)

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "One or more fields are invalid",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      },
      {
        "field": "password",
        "message": "Password must be at least 8 characters"
      }
    ]
  }
}
```

### Authentication Error (401)

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing or invalid authentication token"
  }
}
```

### Permission Denied (403)

```json
{
  "success": false,
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "You do not have permission to perform this action",
    "details": {
      "required_permission": "people:delete"
    }
  }
}
```

### Not Found (404)

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Resource not found: Person with ID xyz does not exist"
  }
}
```

### Rate Limited (429)

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests. Please try again in 15 minutes.",
    "details": {
      "retry_after_seconds": 900
    }
  }
}
```

### Server Error (500)

```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An unexpected error occurred. Please contact support.",
    "details": {
      "reference_id": "error-tracking-id"
    }
  }
}
```

---

## Rate Limiting

Rate limits are enforced per IP address and user:

| Endpoint Group | Limit | Window |
|---|---|---|
| General API | 100 req | 15 min |
| Auth (register, login) | 20 req | 15 min |
| Password operations | 5 req | 15 min |
| Detection (high-volume) | 100 req | 1 min |

When rate limit is exceeded:
- HTTP 429 Too Many Requests
- Header: `Retry-After: 900` (seconds)

---

## Pagination

All list endpoints support pagination:

**Request Parameters**:
```
?page=1&limit=20
```

**Response Metadata**:
```json
{
  "metadata": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "total_pages": 8
    }
  }
}
```

- Default limit: 20
- Max limit: 100
- Minimum page: 1

---

## Filtering & Sorting

### Filtering

```
GET /persons?status=ACTIVE&sort=name&search=john
```

Filters are resource-specific. Common filters:
- `status`: Resource status (ACTIVE, INACTIVE, ARCHIVED)
- `organization_id`: Organization scope
- `date_from`, `date_to`: Date range

### Sorting

Most list endpoints support `sort` parameter:

```
GET /persons?sort=created_at:desc
```

---

## Authentication

All protected endpoints require:

```
Authorization: Bearer {jwt_access_token}
```

The JWT contains:
- `sub`: User ID
- `email`: User email
- `type`: "access"
- `exp`: Expiration timestamp
- `iat`: Issued at timestamp

---

**Document Version**: 1.0  
**Last Updated**: 2026-08-30  
**Status**: Phase 1 Reference (Additional endpoints documented as implemented)
