# PHASE 1: Foundation & Architecture - Implementation Plan

**Status**: FOUNDATION READY - Proceeding with Enhancement

**Date**: 2026-08-30

---

## Executive Summary

The UAPMS repository has a **strong foundation** with:
- ✓ Comprehensive 50-table PostgreSQL schema
- ✓ 9 core API modules with proper architecture
- ✓ Multi-tenancy middleware and RBAC
- ✓ Authentication with JWT and session management
- ✓ Rate limiting and security headers
- ✓ Passing tests (auth, RBAC, tenant isolation)
- ✓ Proper monorepo structure (apps, packages, services)

**Problem Fixed**: Import error in attendanceService.ts (DetectionMethod → DetectionMethodType)

---

## Phase 1 Scope: Foundation Hardening & Enhancement

Phase 1 focuses on **solidifying the foundation** before building higher-level features. All components must be production-ready for multi-tenant isolation, security, and scalability.

### Phase 1 Deliverables

#### 1. **Authentication & Account Lifecycle** (Priority: CRITICAL)

**Current State:**
- ✓ JWT-based auth exists
- ✓ Password hashing with bcryptjs
- ✓ Basic login/register
- ✗ Email verification
- ✗ Forgot password flow
- ✗ MFA setup and validation
- ✗ Account lockout/unlock
- ✗ Person invitation flow
- ✗ Self-registration

**To Implement:**

1. **Email Verification**
   - Generate and store time-limited verification tokens
   - Email delivery stub (template ready, integration TBD)
   - Verification endpoint
   - Re-send verification email
   - Prevent login until verified (configurable by org)

2. **Forgot Password / Reset Password**
   - Password reset token generation (15-minute expiry)
   - Reset endpoint with token validation
   - New password confirmation
   - Audit logging of password changes

3. **Multi-Factor Authentication (MFA)**
   - MFA enablement for users
   - TOTP (Time-based One-Time Password) setup
   - Backup codes generation (10 codes)
   - MFA verification on login
   - Disable MFA with password confirmation
   - Store MFA secret encrypted

4. **Account Lockout**
   - Track failed login attempts
   - Lock account after 5 consecutive failures
   - 15-minute lockout window
   - Unlock via email link
   - Admin unlock capability
   - Audit logging of lock/unlock events

5. **Person Invitation Flow**
   - Generate time-limited invitation tokens (48 hours)
   - Send invitation email with setup link
   - Invitee sets own password and MFA
   - Invitation acceptance creates user account
   - Bulk invite support

6. **Self-Registration**
   - Gated by organization policy (`allow_self_registration`)
   - Email verification required
   - Password strength validation
   - CAPTCHA protection (stub, integration TBD)

**Files to Create/Modify:**
- [ ] `apps/api/src/modules/auth/authService.ts` - Add methods for new flows
- [ ] `apps/api/src/modules/auth/authController.ts` - Add endpoints
- [ ] `apps/api/src/modules/auth/authRoutes.ts` - Register new routes
- [ ] Database migrations for token fields (already in schema)
- [ ] Email templates (stub service, actual sending TBD)

#### 2. **Database & Multi-Tenancy Enforcement** (Priority: CRITICAL)

**Current State:**
- ✓ 50-table schema with tenant_id columns
- ✓ Tenant middleware extracts org_id from auth token
- ✗ Complete tenant isolation validation
- ✗ Comprehensive tenant-aware queries

**To Implement:**

1. **Tenant Context Validation**
   - Every organization-owned operation must validate tenant access
   - Client-submitted org_id must NOT override authenticated tenant
   - Cross-tenant queries must be prevented at API layer
   - Automated tenant filtering in all queries

2. **Row-Level Security (Optional but Recommended)**
   - Implement PostgreSQL RLS if using PostgreSQL
   - Fallback: Application-level tenant filtering

3. **Tenant Isolation Tests**
   - Test: Org A user cannot see Org B people
   - Test: Org A user cannot list Org B attendance
   - Test: Org A admin cannot edit Org B settings
   - Test: Spoofed org_id in request is rejected
   - Automated test suite for all sensitive endpoints

4. **Database Indexes**
   - Composite indexes on (organization_id, resource_id) for common queries
   - Indexes on frequently filtered columns (status, created_at, updated_at)
   - Index on person_id for attendance queries

**Files to Modify:**
- [ ] `apps/api/src/middleware/tenant.ts` - Enhance tenant validation
- [ ] `apps/api/src/core/database/db.ts` - Add tenant-aware query builders
- [ ] `apps/api/src/core/database/schema.ts` - Add indexes and RLS
- [ ] `apps/api/tests/security/tenant.test.ts` - Expand cross-tenant tests

#### 3. **Role-Based Access Control (RBAC) Enhancement** (Priority: HIGH)

**Current State:**
- ✓ Roles, permissions, and role_permissions tables
- ✓ RBAC middleware exists
- ✗ Comprehensive permission set
- ✗ Granular permission checks
- ✗ Permission inheritance and delegation

**To Implement:**

1. **Core Roles Definition**
   - Platform Super Admin (global access)
   - Organization Owner (full org access)
   - Organization Admin (org settings, users, policies)
   - Branch Admin (branch-level management)
   - Attendance Administrator (attendance CRUD)
   - HR Manager (people, leave, reports)
   - Manager/Supervisor (team attendance, corrections)
   - Teacher/Instructor (class/session attendance)
   - Security Officer (fraud alerts, device management)
   - Auditor (read-only audit logs)
   - User/Employee (own attendance, basic reports)
   - Visitor (limited, temporary access)

2. **Permission Matrix**
   - Create comprehensive permission set (50+ permissions)
   - Permissions organized by domain (people, attendance, policies, etc.)
   - Granular permissions (read, create, update, delete, approve, export)
   - Permission inheritance from roles

3. **Permission Enforcement**
   - Decorator-based permission checks on all endpoints
   - Fine-grained checks (e.g., user can only correct their own attendance)
   - Conditional permissions based on resource ownership
   - Audit logging of permission denials

**Files to Modify:**
- [ ] `apps/api/src/middleware/rbac.ts` - Enhance permission checking
- [ ] Database seed: Define core roles and permissions
- [ ] All route handlers: Add permission checks
- [ ] Create permission matrix documentation

#### 4. **Request Validation & Error Handling** (Priority: HIGH)

**Current State:**
- ✓ Zod validation in middleware
- ✓ Error handler middleware
- ✓ Basic error responses
- ✗ Consistent validation schemas
- ✗ Detailed validation error messages
- ✗ Proper HTTP status codes

**To Implement:**

1. **Validation Schemas**
   - Create Zod schemas for every endpoint
   - Reusable field validation (email, phone, dates, times, coordinates, etc.)
   - Custom validators (timezone, geofence, schedule times, etc.)
   - Error message localization (future: translations)

2. **Error Response Standardization**
   ```
   {
     "success": false,
     "error": {
       "code": "VALIDATION_ERROR",
       "message": "One or more fields are invalid",
       "details": [
         { "field": "email", "message": "Invalid email format" },
         { "field": "start_time", "message": "Start time cannot be after end time" }
       ]
     }
   }
   ```

3. **HTTP Status Code Consistency**
   - 200 OK - Successful GET
   - 201 Created - Successful POST that creates resource
   - 204 No Content - Successful DELETE
   - 400 Bad Request - Validation error
   - 401 Unauthorized - No auth
   - 403 Forbidden - Auth exists but permission denied
   - 404 Not Found - Resource not found
   - 409 Conflict - Business logic error (e.g., duplicate key)
   - 429 Too Many Requests - Rate limit exceeded
   - 500 Internal Server Error - Unhandled exception

**Files to Modify:**
- [ ] `packages/validation/src/index.ts` - Create centralized validation schemas
- [ ] `apps/api/src/middleware/errorHandler.ts` - Enhance error formatting
- [ ] All route files: Apply validation middleware

#### 5. **Configuration & Environment Setup** (Priority: MEDIUM)

**Current State:**
- ✓ config/index.ts reads environment
- ✓ .env file exists
- ✗ Complete configuration documentation
- ✗ Configuration validation on startup

**To Implement:**

1. **Environment Configuration**
   - DATABASE_URL (PostgreSQL connection string)
   - JWT_SECRET (signing key)
   - JWT_EXPIRY (token lifetime, e.g., 24h)
   - REFRESH_TOKEN_SECRET (refresh token key)
   - REFRESH_TOKEN_EXPIRY (e.g., 7d)
   - BCRYPT_ROUNDS (password hashing rounds, e.g., 12)
   - RATE_LIMIT_WINDOW_MS (e.g., 900000 for 15 min)
   - RATE_LIMIT_MAX_REQUESTS (e.g., 100 per window)
   - CORS_ORIGINS (comma-separated allowed origins)
   - LOG_LEVEL (debug, info, warn, error)
   - NODE_ENV (development, staging, production)
   - EMAIL_SERVICE (sendgrid, mailgun, smtp, stub)
   - EMAIL_API_KEY (service-specific)
   - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS (if SMTP)
   - EMAIL_FROM (sender email)
   - SMS_SERVICE (twilio, vonage, stub)
   - SMS_API_KEY (service-specific)

2. **Configuration Validation**
   - Validate all required env vars on startup
   - Fail fast if critical config missing
   - Log loaded configuration (without secrets)

3. **Documentation**
   - .env.example with all variables
   - docs/configuration.md explaining each setting
   - Quick start guide

**Files to Create/Modify:**
- [ ] `apps/api/src/config/index.ts` - Enhance and validate config
- [ ] `.env.example` - Document all variables
- [ ] `.env` - Add all variables (gitignored)
- [ ] `docs/configuration.md` - Detailed guide

#### 6. **Database Seeding & Migration** (Priority: MEDIUM)

**Current State:**
- ✓ schema.ts has DDL
- ✓ seed.ts has basic seed
- ✗ Production-ready migrations
- ✗ Comprehensive test data

**To Implement:**

1. **Database Initialization**
   - create-tables script (idempotent, using IF NOT EXISTS)
   - Initialize seed data on first run
   - Verify database connection on startup

2. **Seed Data**
   - Platform-level roles and permissions
   - Sample organizations (university, factory, office, remote)
   - Sample locations, departments, groups
   - Sample users with different roles
   - Sample schedules and shifts
   - Sample policies and rules
   - Test data for automated testing

3. **Migration Strategy**
   - Clear migration directory structure
   - Versioned migrations (001_create_tables.sql, etc.)
   - Reversible migrations where possible
   - Migration runner script
   - Production safety checks (backup before migrate)

**Files to Modify:**
- [ ] `apps/api/src/core/database/seed.ts` - Enhance seed data
- [ ] Create `apps/api/migrations/` directory
- [ ] Create migration runner script
- [ ] Document migration strategy

#### 7. **Logging & Monitoring** (Priority: MEDIUM)

**Current State:**
- ✓ logger.ts exists
- ✓ Basic logging in place
- ✗ Structured logging
- ✗ Log levels properly used
- ✗ Performance monitoring

**To Implement:**

1. **Structured Logging**
   - Use consistent log format (JSON in production)
   - Include context (request ID, user ID, organization ID, timestamp)
   - Log levels: debug, info, warn, error, fatal
   - No sensitive data in logs (passwords, tokens, SSNs)

2. **Log Points**
   - Application startup
   - Database connections
   - Authentication success/failure
   - Authorization failures
   - Unusual activity (failed attempts, suspicious patterns)
   - Error stack traces
   - API latency (optional: for performance monitoring)

3. **Log Storage & Rotation**
   - Daily log rotation
   - Keep 30 days of logs in development
   - Production: Send to centralized logging service (ELK, Datadog, etc.)

**Files to Modify:**
- [ ] `apps/api/src/core/logger.ts` - Enhance logging
- [ ] All services: Add appropriate log calls

#### 8. **Security Hardening** (Priority: CRITICAL)

**Current State:**
- ✓ Helmet headers
- ✓ CORS configured
- ✓ Rate limiting
- ✓ Password hashing
- ✗ Complete security checklist

**To Implement:**

1. **Headers & CORS**
   - ✓ Helmet already configured
   - Verify CORS restricts to configured origins
   - Add X-Request-ID header for tracing
   - Content-Security-Policy (if serving frontend)

2. **Input Validation**
   - ✓ Zod validation in place
   - SQL injection protection (parameterized queries)
   - XSS protection (output encoding)
   - File upload validation (if applicable)

3. **Password Security**
   - ✓ Hashing with bcryptjs (12 rounds)
   - Require minimum 8 characters
   - Complexity rules (uppercase, lowercase, numbers, symbols) - optional but recommended
   - Prevent common passwords (password, 123456, etc.)
   - Password history (prevent reuse of last 5 passwords) - optional

4. **Rate Limiting**
   - ✓ Global rate limiter in place
   - Authentication endpoints: Stricter limits (e.g., 5 per minute)
   - Detection endpoints: Higher limits (e.g., 100 per minute)
   - Per-user limits (track by user ID, not just IP)

5. **Session & Token Security**
   - JWT signing key protected (environment variable)
   - Token expiry enforcement
   - Refresh token rotation (optional but recommended)
   - Logout invalidation (token blacklist or database check)
   - Secure cookie flags (HttpOnly, Secure, SameSite)

6. **Audit Logging**
   - ✓ audit_logs table exists
   - Log all authentication events
   - Log permission changes
   - Log data access (especially sensitive data)
   - Immutable audit log (prevent tampering)

7. **Security Checklist**
   - No hardcoded secrets ✓
   - Environment-based configuration ✓
   - HTTPS enforced in production
   - Secrets rotated regularly
   - Dependency scanning (npm audit)
   - Security headers configured
   - CORS configured appropriately
   - Rate limiting active
   - Input validation on all endpoints

**Files to Review/Modify:**
- [ ] `apps/api/src/app.ts` - Verify security middleware
- [ ] `apps/api/src/core/logger.ts` - No secrets in logs
- [ ] Create `SECURITY.md` - Security best practices
- [ ] Create security checklist

#### 9. **Testing Framework & Initial Test Suite** (Priority: HIGH)

**Current State:**
- ✓ Vitest configured
- ✓ Basic auth, RBAC, tenant tests passing
- ✗ Comprehensive test coverage
- ✗ Test organization and fixtures
- ✗ Integration test setup

**To Implement:**

1. **Test Structure**
   ```
   apps/api/tests/
   ├── fixtures/          # Reusable test data
   ├── unit/             # Unit tests
   ├── integration/      # Integration tests
   ├── security/         # Security tests (existing)
   ├── setup.ts          # Test database setup
   └── helpers.ts        # Common test utilities
   ```

2. **Test Fixtures**
   - Create test organizations, users, locations, schedules
   - Create test data builder functions
   - Clean database between tests
   - Use separate test database

3. **Unit Tests**
   - Attendance calculation logic
   - Grace period calculation
   - Late threshold detection
   - Shift scheduling
   - Leave interaction
   - Confidence scoring
   - Policy evaluation
   - Duplicate detection

4. **Integration Tests**
   - Full authentication flow
   - Tenant isolation enforcement
   - Attendance submission and recording
   - Leave request and approval workflow
   - Policy application
   - Audit logging

5. **Security Tests**
   - Cross-tenant access prevention ✓
   - RBAC enforcement
   - Rate limiting effectiveness
   - Account lockout mechanism
   - Privilege escalation prevention
   - Token expiry validation

6. **Test Coverage Goals**
   - Critical path: 100% (auth, RBAC, attendance, policies)
   - Core logic: 80%+ (calculations, rules)
   - Overall: 70%+

**Files to Create/Modify:**
- [ ] `apps/api/tests/setup.ts` - Database setup for tests
- [ ] `apps/api/tests/fixtures/` - Test data builders
- [ ] `apps/api/tests/unit/` - Unit test files
- [ ] `apps/api/tests/integration/` - Integration test files
- [ ] Expand `apps/api/tests/security/` - More security tests

#### 10. **Documentation** (Priority: MEDIUM)

**Current State:**
- ✓ Specifications in docs/spec/
- ✗ Architecture documentation
- ✗ API documentation
- ✗ Database documentation
- ✗ Development guide

**To Create:**

1. **Architecture Documentation**
   - System overview with diagram
   - Module descriptions and responsibilities
   - Data flow diagrams
   - Security architecture
   - Tenant isolation strategy
   - Scalability considerations

2. **API Documentation**
   - OpenAPI/Swagger spec (auto-generated from code)
   - Endpoint reference (path, method, auth, params, response)
   - Authentication guide
   - Error codes reference
   - Rate limits documentation
   - Example requests and responses

3. **Database Documentation**
   - Entity-relationship diagram
   - Table descriptions
   - Key relationships
   - Indexes and optimization notes
   - Data retention policies

4. **Development Guide**
   - Environment setup
   - Database initialization
   - Running tests
   - Adding new endpoints (checklist)
   - Security best practices
   - Debugging tips

5. **Deployment Guide**
   - Prerequisites (Node.js, PostgreSQL, Redis)
   - Environment configuration
   - Database migration
   - Running the server
   - Health checks
   - Monitoring setup
   - Troubleshooting

**Files to Create:**
- [ ] `docs/architecture.md`
- [ ] `docs/api.md` or use Swagger/OpenAPI
- [ ] `docs/database.md`
- [ ] `docs/development-guide.md`
- [ ] `docs/deployment.md`
- [ ] `docs/security.md`

---

## Phase 1 Implementation Order

1. **Week 1: Core Authentication & Identity**
   - Email verification flow
   - Forgot password / reset password
   - MFA setup and validation
   - Account lockout mechanism
   - Unit tests for auth flows

2. **Week 2: Authorization & Tenant Isolation**
   - Comprehensive RBAC roles and permissions
   - Permission enforcement on all endpoints
   - Tenant isolation validation tests
   - Database indexes for tenant-aware queries
   - Security hardening audit

3. **Week 3: Validation, Configuration & Logging**
   - Comprehensive validation schemas
   - Error response standardization
   - Environment configuration
   - Structured logging
   - Configuration documentation

4. **Week 4: Database, Testing & Documentation**
   - Database migration strategy
   - Comprehensive test suite setup
   - Seed data for development
   - Architecture documentation
   - API documentation
   - Deployment guide

---

## Phase 1 Success Criteria

- [x] Build passes without errors
- [x] All existing tests pass
- [ ] New tests pass (auth lifecycle, RBAC, tenant isolation, validation)
- [ ] Code review checklist complete
- [ ] Security checklist complete
- [ ] Configuration documentation complete
- [ ] Development guide complete
- [ ] API documented
- [ ] Database documented
- [ ] 0 hardcoded secrets
- [ ] 100% of endpoints have permission checks
- [ ] 100% of organization-owned endpoints have tenant validation
- [ ] Cross-tenant access prevention verified

---

## Notes

- This Phase 1 focuses on **foundation quality**
- Higher-level features (detection adapters, policies, rules, etc.) depend on solid foundation
- All code must be production-ready before moving to Phase 2
- Security is non-negotiable
- Documentation is essential for maintainability
- Testing is built in from the start

---

## Next Steps

1. ✓ Inspect repository (completed)
2. ✓ Create implementation plan (this document)
3. → Begin Phase 1 implementation
4. → Weekly progress reviews
5. → Phase 1 completion and validation
6. → Phase 2: Core Entities Enhancement
