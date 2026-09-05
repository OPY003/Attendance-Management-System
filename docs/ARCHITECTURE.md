# UAPMS Architecture Documentation

## System Overview

The Universal Attendance & Presence Management System (UAPMS) is a production-grade, multi-tenant SaaS platform designed to support diverse organization types (schools, factories, hospitals, offices, events, etc.) with a unified, configurable attendance management system.

### Core Design Principles

1. **Universal, Not Specific**: Architecture is generic (Person, Organization, Location, Schedule) rather than hard-coded around student/teacher/employee
2. **Multi-Tenant by Design**: Complete tenant isolation enforced at backend layer, not just frontend
3. **Pluggable Detection Methods**: Support for 50+ detection technologies via provider abstraction
4. **Configurable Business Logic**: Policies and rules configure behavior; hard-coded logic avoided
5. **Evidence-Based Decisions**: Every attendance decision is explainable and auditable
6. **Security First**: RBAC, encryption, rate limiting, audit logging built in from start

---

## Technology Stack

### Frontend
- TypeScript + React (planned, not yet implemented)
- Responsive UI framework
- State management
- Component library

### Backend
- **Language**: TypeScript
- **Server**: Express.js (4.19.2)
- **Port**: 3000 (configurable)
- **Database**: PostgreSQL (primary) or SQLite (development)
- **Cache**: Redis (optional, for session/rate limit storage)
- **Authentication**: JWT + Sessions
- **Validation**: Zod

### Infrastructure
- Docker for containerization
- docker-compose for local development
- Environment-based configuration
- Monorepo structure (npm workspaces)

### Development Tools
- Vitest for testing
- Supertest for API testing
- TypeScript for type safety
- ESLint for code quality

---

## Monorepo Structure

```
Attendance_Management_System/
│
├── apps/
│   ├── api/                          # Express.js backend API
│   ├── web/                          # React frontend (stub)
│   └── mobile/                       # Mobile app (planned)
│
├── packages/
│   ├── shared-types/                 # TypeScript type definitions
│   ├── validation/                   # Zod validation schemas
│   └── rule-engine-core/             # Safe rule engine
│
├── services/
│   ├── notification-service/         # Email, SMS, push notifications
│   ├── worker-service/               # Background jobs, async tasks
│   ├── device-service/               # Device management and registration
│   └── analytics-service/            # Analytics and aggregation
│
├── database/
│   ├── migrations/                   # SQL migration scripts
│   ├── seeds/                        # Initial data seeding
│   └── procedures/                   # Stored procedures (optional)
│
├── docs/
│   ├── spec/                         # Product specifications
│   ├── architecture/                 # Architecture documentation
│   ├── api/                          # API reference
│   └── deployment/                   # Deployment guides
│
└── infrastructure/
    ├── docker/                       # Docker configurations
    └── monitoring/                   # Monitoring and alerting setup
```

---

## Database Architecture

### 50 Core Tables

The system uses a comprehensive relational schema with 50 tables covering all aspects of attendance management:

#### Organization & Multi-Tenancy (4 tables)
- `organizations` - Org metadata, category, status
- `organization_settings` - Org configuration (timezone, features, policies)
- `subscription_plans` - SaaS billing tiers
- `tenant_quotas` - Per-org resource limits

#### Identity & Access (8 tables)
- `users` - Platform user accounts (email, password, MFA, lockout)
- `persons` - Universal person entity (not student/employee/teacher specific)
- `roles` - RBAC roles (OWNER, ADMIN, MANAGER, USER, etc.)
- `permissions` - Granular permission definitions
- `role_permissions` - Role-permission mapping
- `person_roles` - Person-role assignments
- `organization_memberships` - User membership in orgs + roles
- `invitations` - Time-limited org invitations

#### Organizational Structure (6 tables)
- `locations` - Physical/logical locations (building, floor, room, etc.)
- `location_types` - Classification of locations
- `attendance_zones` - Geofenced attendance areas within locations
- `departments` - Organizational departments
- `groups` - Dynamic person groupings (teams, classes, etc.)
- `group_memberships` - Person group membership

#### Attendance Scheduling (7 tables)
- `schedules` - Schedule definitions (fixed, rotating, flexible, etc.)
- `schedule_rules` - Business rules for schedule application
- `shifts` - Shift definitions (time, breaks, policies)
- `shift_assignments` - Person-shift assignments
- `holidays` - Non-working days per organization
- `attendance_policies` - Policy definitions for attendance evaluation
- `policy_rules` - Rules within a policy

#### Attendance Recording (6 tables)
- `attendance_sessions` - Attendance session (class, shift, event, etc.)
- `attendance_events` - Raw detection events (QR scans, GPS, face, etc.)
- `attendance_records` - Final attendance status (PRESENT, LATE, ABSENT, etc.)
- `attendance_evidence` - Evidence supporting attendance decision
- `attendance_corrections` - Audit trail of corrections
- `leave_types` - Configurable leave categories

#### Leave & Visitor Management (3 tables)
- `leave_requests` - Leave request submission, approval, usage
- `visitors` - Temporary visitor passes and tracking
- `visitor_passes` - Credential assignment for visitors

#### Device Management (3 tables)
- `devices` - Physical devices (scanners, kiosks, gates, mobile devices)
- `device_types` - Device classification
- `device_credentials` - Device authentication tokens
- `device_tokens` - Session tokens for devices

#### Security & Audit (4 tables)
- `fraud_alerts` - Suspicious attendance flagged for review
- `audit_logs` - Immutable audit trail (login, changes, actions)
- `consent_records` - Data consent tracking (GDPR)
- `data_subject_requests` - Data subject access requests

#### Notifications & Integration (4 tables)
- `notifications` - Outbound notifications (email, SMS, push)
- `notification_preferences` - User notification preferences
- `webhooks` - Outbound webhook subscriptions
- `api_keys` - API authentication keys for third-party integrations

#### Extensibility (2 tables)
- `custom_field_definitions` - Organization-specific custom fields
- `custom_field_values` - Values of custom fields

---

## Multi-Tenancy Implementation

### Tenant Isolation Strategy

**Principle**: Every organization-owned record includes `organization_id`. Backend enforces tenant access at EVERY layer.

### Tenant Context Flow

```
HTTP Request with JWT Token
    ↓
Auth Middleware (extract user from JWT)
    ↓
Tenant Middleware (extract organization from user's memberships)
    ↓
RBAC Middleware (verify permission for action)
    ↓
Service Layer (ALL queries automatically filtered by organization_id)
    ↓
Database (row-level filtering via application logic)
```

### Tenant Access Rules

1. **User can only access organizations they're a member of**
   - Authenticated via `organization_memberships` join
   - Reflected in JWT claims (optional for optimization)

2. **Organization-owned operations require tenant validation**
   - Every `/api/v1/organizations/{id}/*` call checks: Does user have access to {id}?
   - Returns 403 Forbidden if not

3. **Platform Admins have global access**
   - Platform-level admins can access any organization
   - Identified by global SUPER_ADMIN role

4. **Client-submitted organization ID is NEVER trusted**
   - Header `x-organization-id` is logged for debugging but not used for auth
   - True tenant determined from JWT + `organization_memberships` table

### Row-Level Security (Optional, Recommended for PostgreSQL)

If using PostgreSQL, implement RLS:

```sql
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY attendance_records_org_isolation ON attendance_records
  FOR ALL
  USING (organization_id = current_setting('app.organization_id')::text);
```

---

## Authentication Architecture

### Account Lifecycle

1. **Registration**
   - Email validation
   - Password hashing (bcryptjs, 12 rounds)
   - Email verification token (24-hour expiry)
   - Optional: Create organization for self-signup

2. **Email Verification**
   - Token sent to email
   - User clicks link or enters token
   - `is_email_verified` flag set
   - Token invalidated

3. **Login**
   - Email + password verification
   - Failed login tracking (5 attempts = 15-min lockout)
   - MFA check if enabled
   - Generate JWT tokens

4. **MFA (Multi-Factor Authentication)**
   - TOTP (Time-based One-Time Password)
   - Setup via app (secret + QR code)
   - Backup codes (10 one-time use codes)
   - Verify on login

5. **Forgot Password**
   - Request password reset link
   - Token generation (1-hour expiry)
   - Email link + token validation
   - New password hashing
   - Reset tokens invalidated

6. **Account Lockout & Unlock**
   - Automatic after 5 failed attempts
   - 15-minute lockout window
   - Unlock via email link
   - Admin unlock capability
   - Audit logged

### Token Management

**Access Token**
- Lifespan: 900 seconds (15 minutes)
- Contains: user ID, email, token type
- Signed with JWT_SECRET
- Used for API authentication

**Refresh Token**
- Lifespan: 7 days (604,800 seconds)
- Contains: user ID, email, token type
- Signed with REFRESH_TOKEN_SECRET (different key)
- Used to obtain new access token without re-login
- Optional: Token rotation (invalidate old token on refresh)

**Token Storage**
- Access token: Memory (client-side)
- Refresh token: HttpOnly cookie (secure, client doesn't have JS access)
- Logout: Optional token blacklist or stateless validation

---

## Authorization Architecture (RBAC)

### Role Hierarchy

**Platform Level**
- `SUPER_ADMIN` - Global platform administrator

**Organization Level**
- `ORGANIZATION_OWNER` - Full organizational control
- `ORGANIZATION_ADMIN` - Organization settings, users, policies
- `BRANCH_ADMIN` - Branch/department-level management
- `ATTENDANCE_ADMIN` - Attendance CRUD and correction
- `HR_MANAGER` - People, leave, reports
- `MANAGER` / `SUPERVISOR` - Team attendance, corrections
- `TEACHER` / `INSTRUCTOR` - Class/session attendance
- `SECURITY_OFFICER` - Fraud detection, device management
- `AUDITOR` - Read-only audit logs
- `USER` / `EMPLOYEE` - Own attendance, basic reports
- `VISITOR` - Limited, temporary access

### Permission Model

**Granular Permissions** (50+):
- `people:read` - View person details
- `people:create` - Create person
- `people:update` - Edit person
- `people:delete` - Delete person
- `attendance:read` - View attendance records
- `attendance:correct` - Modify attendance
- `policies:manage` - Create/edit policies
- `devices:manage` - Register/manage devices
- `reports:export` - Generate and export reports
- etc.

**Permission Enforcement**
- Middleware: `requirePermission(permission)` decorator
- Service: Check before executing business logic
- Database: RLS optional (application-level filters primary)
- Audit: Log all permission denials

---

## API Architecture

### API Structure

```
/api/v1/
├── /auth                     # Authentication endpoints
│   ├── POST /register
│   ├── POST /login
│   ├── POST /verify-email
│   ├── POST /reset-password
│   ├── POST /mfa/setup
│   └── GET  /me
│
├── /organizations            # Organization management
│   ├── GET    /
│   ├── POST   /
│   ├── GET    /{id}
│   ├── PUT    /{id}
│   └── /settings
│
├── /persons                  # Person management
│   ├── GET    /
│   ├── POST   /
│   ├── GET    /{id}
│   ├── PUT    /{id}
│   └── /bulk-import
│
├── /locations               # Location management
│   ├── GET    /
│   ├── POST   /
│   ├── GET    /{id}
│   └── PUT    /{id}
│
├── /groups                   # Group management
│   ├── GET    /
│   ├── POST   /
│   └── /{id}/members
│
├── /roles & /permissions    # RBAC management
├── /schedules               # Schedule management
├── /shifts                  # Shift management
├── /attendance              # Attendance endpoints
│   ├── POST   /detection
│   ├── GET    /records
│   ├── PUT    /{id}/correct
│   └── GET    /analytics
│
├── /policies                # Policy management
├── /leave                   # Leave management
├── /visitors                # Visitor management
├── /devices                 # Device management
├── /reports                 # Report generation
├── /audit                   # Audit log queries
└── /admin                   # System administration
```

### Response Format

**Success Response**
```json
{
  "success": true,
  "data": { /* resource or array */ },
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

**Error Response**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "One or more validation errors",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  }
}
```

### HTTP Status Codes
- 200 OK - Successful GET/PUT
- 201 Created - Successful POST (resource created)
- 204 No Content - Successful DELETE
- 400 Bad Request - Validation error
- 401 Unauthorized - Missing/invalid authentication
- 403 Forbidden - Authenticated but permission denied
- 404 Not Found - Resource not found
- 409 Conflict - Business logic conflict (duplicate, etc.)
- 429 Too Many Requests - Rate limit exceeded
- 500 Internal Server Error - Unhandled exception

---

## Security Implementation

### Password Security
- **Hashing**: bcryptjs with 12 rounds (config.auth.passwordHashRounds)
- **Strength**: Min 8 chars, 1 uppercase, 1 lowercase, 1 number
- **History**: (Optional) Prevent reuse of last 5 passwords
- **Reset**: Time-limited token (1 hour)

### Session & Token Security
- **Signing Key**: JWT_SECRET (environment variable, never hardcoded)
- **Expiry**: 15 minutes for access token, 7 days for refresh
- **Refresh**: Via `/auth/refresh` endpoint
- **Logout**: Optional: token blacklist; or validate against DB
- **Secure Cookies**: HttpOnly, Secure, SameSite=Strict (for refresh token)

### Rate Limiting
- **Global**: 100 requests per 15-minute window per IP
- **Auth Endpoints**: 5-20 attempts per 15 minutes per IP
- **Detection Endpoints**: 100+ per minute (high-volume)
- **Implementation**: In-memory or Redis-backed

### Input/Output Validation
- **Input**: Zod schemas on all endpoints
- **Output**: No sensitive data in error messages
- **SQL Injection**: Parameterized queries (all database calls)
- **XSS**: Content-Type: application/json, no raw HTML in responses

### Audit Logging
- **Authentication**: login, logout, MFA, password change, account lockout
- **Authorization**: Permission denied, role changes
- **Data Changes**: Create, update, delete (old value, new value)
- **Sensitive Actions**: Device registration, policy changes, exports
- **Immutable**: Audit logs are append-only, never modified

### Secrets Management
- **Never Hardcoded**: All secrets in environment variables
- **Examples**:
  - JWT_SECRET
  - REFRESH_TOKEN_SECRET
  - DATABASE_URL
  - API_KEYS (for external services)
  - ENCRYPTION_KEYS (for sensitive data)

---

## Data Flow Architecture

### Attendance Recording Pipeline

```
Detection Source (QR, RFID, Face, GPS, etc.)
    ↓
Detection Adapter (normalize to common format)
    ↓
POST /api/v1/attendance/detection
    ↓
API Validation & Auth
    ↓
Attendance Service
    ├─ Verify session exists
    ├─ Verify person exists
    ├─ Verify detection method allowed (policy)
    ├─ Perform verification (confidence calculation)
    ├─ Evaluate policies & rules
    ├─ Determine final status (PRESENT, LATE, ABSENT, etc.)
    ├─ Store detection event
    ├─ Store attendance evidence
    ├─ Create/update attendance record
    └─ Log audit trail
    ↓
Database Transaction
    ├─ INSERT INTO attendance_events
    ├─ INSERT INTO attendance_evidence
    ├─ INSERT/UPDATE INTO attendance_records
    ├─ INSERT INTO audit_logs
    └─ Commit atomically
    ↓
Response with Attendance Decision
    ├─ Status (PRESENT, PENDING_REVIEW, REJECTED, etc.)
    ├─ Confidence score
    ├─ Evidence summary
    └─ Audit trail reference
```

### Query Optimization

**Common Queries & Indexes**
- Get person's attendance for date range:
  - `idx_attendance_records_org_person_date`
- Get all people's attendance for session:
  - `idx_attendance_events_org_person_timestamp`
- List pending reviews:
  - `idx_attendance_records_org_person_date` + `status = 'PENDING_REVIEW'`
- Fraud detection:
  - `idx_fraud_alerts_org_timestamp` for recent alerts
  - `idx_fraud_alerts_org_person_timestamp` for person-specific anomalies

---

## Deployment Architecture

### Prerequisites
- Node.js 18+ (LTS)
- PostgreSQL 12+ (or SQLite for dev)
- Redis (optional, for caching/rate limiting)
- Docker & docker-compose (for containerization)

### Environment Configuration
```
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/uapms
JWT_SECRET=<random-32-char-string>
REFRESH_TOKEN_SECRET=<random-32-char-string>
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
CORS_ORIGINS=https://app.example.com,https://web.example.com
LOG_LEVEL=info
EMAIL_SERVICE=sendgrid
EMAIL_API_KEY=<api-key>
SMS_SERVICE=twilio
SMS_API_KEY=<api-key>
```

### Deployment Steps
1. Database migration
2. Seed essential data (roles, permissions)
3. Start API server (port 3000)
4. Health check: `GET /health`
5. Readiness check: `GET /ready`

---

## Performance Considerations

### Database Performance
- Composite indexes on (organization_id, filter_column)
- Pagination: All list endpoints return ≤ 100 records by default
- Query optimization: Avoid N+1 queries (use JOINs)
- Connection pooling: pg-promise or similar

### API Performance
- Gzip compression
- Response caching headers (Cache-Control)
- Batch operations for bulk imports
- Background jobs for report generation, exports, notifications

### Frontend Performance (Future)
- Lazy loading for large lists
- Virtual scrolling for attendance tables
- Server-side aggregation for dashboards
- GraphQL or field selection (optional)

---

## Monitoring & Observability

### Health Checks
- `GET /health` - Service health
- `GET /ready` - Database connectivity and readiness

### Logging
- Structured logging (JSON format in production)
- Log levels: debug, info, warn, error, fatal
- No sensitive data (passwords, tokens, SSNs)
- Centralized logging (ELK, Datadog, etc.)

### Metrics (Recommended)
- Request latency (p50, p95, p99)
- Error rate by endpoint
- Active sessions
- Database query performance
- Queue depth (if using background jobs)

---

## Future Enhancements

1. **Frontend Implementation**: React-based web UI
2. **Mobile App**: Native iOS/Android apps
3. **Real-time Features**: WebSocket for live attendance updates
4. **Advanced Detection**: Biometric adapters, RFID readers, access control systems
5. **Analytics**: Advanced dashboards, machine learning-based anomaly detection
6. **Internationalization**: Multi-language support
7. **Custom Workflows**: Low-code workflow builder for policies and leave approvals
8. **API Marketplace**: Third-party integrations via webhooks and APIs

---

## References

- Specifications: `docs/spec/`
- API Documentation: (To be generated via Swagger/OpenAPI)
- Database Schema: `apps/api/src/core/database/schema.ts`
- Test Examples: `apps/api/tests/`

---

**Document Version**: 1.0
**Last Updated**: 2026-08-30
**Author**: UAPMS Engineering Team
