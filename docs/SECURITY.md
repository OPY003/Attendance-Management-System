# UAPMS Security Documentation

**Version**: 1.0  
**Date**: 2026-08-30  
**Classification**: Internal

---

## Table of Contents

1. [Security Overview](#security-overview)
2. [Authentication Security](#authentication-security)
3. [Authorization & Access Control](#authorization--access-control)
4. [Data Security](#data-security)
5. [Network Security](#network-security)
6. [Secrets Management](#secrets-management)
7. [Audit & Monitoring](#audit--monitoring)
8. [Compliance](#compliance)
9. [Incident Response](#incident-response)
10. [Security Checklist](#security-checklist)

---

## Security Overview

### Security Principles

1. **Defense in Depth**: Multiple layers of security controls
2. **Least Privilege**: Users have minimum necessary permissions
3. **Secure by Default**: Security settings are most restrictive
4. **Assume Breach**: Design assumes attacker may compromise a system
5. **Audit Everything**: All sensitive actions are logged
6. **Encrypt Sensitive Data**: Passwords, tokens, PII encrypted/hashed

### Threat Model

**Threats Considered**:
- Unauthorized access to data (cross-tenant, privilege escalation)
- Password brute-force attacks
- Session hijacking
- SQL injection
- XSS attacks
- CSRF attacks
- Account takeover
- Data exfiltration
- Insider threats

---

## Authentication Security

### Password Policy

**Requirements**:
- Minimum 8 characters
- At least 1 uppercase letter (A-Z)
- At least 1 lowercase letter (a-z)
- At least 1 digit (0-9)
- **Recommended** (not enforced): Special character

**Examples of Valid Passwords**:
- ✓ `SecurePass123`
- ✓ `MyPassword456`
- ✗ `password123` (no uppercase)
- ✗ `PASSWORD123` (no lowercase)
- ✗ `Password` (no digit)

### Password Hashing

```typescript
// Implementation
const passwordHash = await bcrypt.hash(password, 12);
```

**Details**:
- Algorithm: bcrypt (industry standard)
- Rounds: 12 (configurable, 2^12 = 4096 iterations)
- Salting: Automatic per bcrypt
- Verification: `await bcrypt.compare(plainPassword, hash)`
- One-way: Cannot reverse hash to get plaintext

**Protection Against**:
- Rainbow table attacks: Salting prevents pre-computed tables
- GPU cracking: bcrypt is computationally expensive
- Timing attacks: bcrypt has constant-time comparison

### Account Lockout

**Mechanism**:
- After 5 consecutive failed login attempts within a time window
- Account locked for 15 minutes
- Locked status stored in `users.locked_until`
- Unlock token sent via email
- Admin can unlock immediately
- Audit logged for every lockout/unlock

**Benefits**:
- Prevents brute-force attacks
- Limits attacker's attempts
- User retains account recovery option

**Bypass Prevention**:
- Attacker cannot guess unlock token (32-char random UUID)
- Account unlock only via email link or admin
- Attempt logging prevents distributed attacks

### Email Verification

**Workflow**:
1. User registers with email
2. Random 32-char verification token generated (24-hour expiry)
3. Email sent with verification link
4. User clicks link or enters token
5. `is_email_verified` flag set
6. Token invalidated

**Purpose**:
- Confirm email ownership
- Prevent fake email registrations
- Opt-in to communications

**Token Security**:
- Random UUID (cryptographically secure)
- Stored in plaintext in database (read-only)
- Single-use (invalidated after verification)
- Time-limited (24 hours)

### Multi-Factor Authentication (MFA)

**Supported Methods**:
- TOTP (Time-based One-Time Password)
- QR code for setup
- Backup codes for account recovery

**Implementation**:
```typescript
import { authenticator } from 'otplib';

// Setup
const secret = authenticator.generateSecret();
const otpauth = authenticator.keyuri(email, 'UAPMS', secret);

// Verification
const isValid = authenticator.check(code, secret);
```

**Security**:
- Uses HMAC-SHA1 algorithm (RFC 6238)
- 30-second time window
- 6-digit codes (unlikely collisions)
- Backup codes prevent lockout (10 one-time use codes)

**Enforcement**:
- Can be mandatory for admin roles
- Optional for regular users
- Verified on every login

### Session Management

**Token Types**:

1. **Access Token**
   - Lifespan: 15 minutes (900 seconds)
   - Contains: user ID, email, token type
   - Used for: API authentication
   - Storage: Memory (client-side)
   - Verified on every request

2. **Refresh Token**
   - Lifespan: 7 days (604,800 seconds)
   - Contains: user ID, email, token type
   - Used for: Obtain new access token
   - Storage: HttpOnly cookie (secure)
   - Optional: Implement token rotation

**Token Signing**:
```typescript
const accessToken = jwt.sign(
  { sub: userId, email, type: 'access' },
  JWT_SECRET,
  { expiresIn: '15m', algorithm: 'HS256' }
);
```

**Token Validation**:
- Signature verified with JWT_SECRET
- Expiration checked
- Token type verified ('access' for API calls)
- User existence verified in database

**Logout**:
- Token is not immediately invalidated (stateless)
- Alternative 1: Maintain token blacklist (Redis)
- Alternative 2: Check logout flag in database
- Client: Remove tokens from storage

**Refresh Flow**:
```
1. Client calls GET /api/v1/auth/me with access token
2. Token expires → 401 Unauthorized
3. Client calls POST /api/v1/auth/refresh with refresh token
4. Server issues new access token
5. Repeat process
```

---

## Authorization & Access Control

### Role-Based Access Control (RBAC)

**Platform Roles**:
- `SUPER_ADMIN` - Global administrator

**Organization Roles**:
- `ORGANIZATION_OWNER` - Full organizational control
- `ORGANIZATION_ADMIN` - Org settings, users, policies
- `BRANCH_ADMIN` - Branch-level management
- `ATTENDANCE_ADMIN` - Attendance CRUD
- `HR_MANAGER` - People, leave, reports
- `MANAGER` - Team attendance, corrections
- `TEACHER` - Class/session attendance
- `SECURITY_OFFICER` - Fraud detection
- `AUDITOR` - Read-only audit logs
- `USER` - Own attendance, basic info

**Permission Enforcement**:

```typescript
// Middleware example
async function authorize(req, res, next) {
  const requiredPermission = 'people:delete';
  
  if (!req.userPermissions.includes(requiredPermission)) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'PERMISSION_DENIED',
        message: 'You lack required permission: ' + requiredPermission
      }
    });
  }
  next();
}
```

### Tenant Isolation

**Principle**: User can ONLY access data from organizations they're a member of.

**Implementation**:

1. **Auth Middleware**: Extract user from JWT
2. **Tenant Middleware**: Determine organization from user's memberships
3. **Query Filtering**: All queries filtered by `organization_id`
4. **Permission Check**: Verify user's role in organization

**Example**:
```typescript
// Request to GET /api/v1/organizations/ORG_B
// User is member of ORG_A only
// Response: 403 CROSS_TENANT_ACCESS_DENIED
```

**Testing**:
```typescript
// Test 1: User A cannot see Organization B data
// Test 2: User B cannot see Organization A data
// Test 3: Platform admin CAN see both
// Test 4: Spoofed org_id header is ignored
```

### Resource-Level Authorization

**Example: Attendance Correction**

Only authorized users can correct their own or others' attendance:

```typescript
if (requestingUser.id !== attendanceRecord.person_id) {
  // Cross-user correction: require 'attendance:correct' permission
  if (!userPermissions.includes('attendance:correct')) {
    return 403;
  }
}
```

---

## Data Security

### Data Sensitivity Classification

| Classification | Data Type | Protection |
|---|---|---|
| **PUBLIC** | Organization name, public schedules | None required |
| **INTERNAL** | Attendance records, person info | Authentication required |
| **CONFIDENTIAL** | Passwords, MFA secrets, PII | Encryption + Access control |
| **RESTRICTED** | Biometric data, medical leave | Encryption + Audit logging |

### Encryption

**In Transit (TLS/SSL)**:
- All communications over HTTPS in production
- Certificate: Valid, non-expired, signed by trusted CA
- Protocol: TLS 1.2 or higher
- Cipher Suites: Strong, no deprecated algorithms

**At Rest**:
- Passwords: Hashed with bcrypt (one-way)
- MFA Secrets: Encrypted (optional)
- PII: Encrypted (optional, in sensitive organizations)
- Audit Logs: Immutable (prevent tampering)

**Example**:
```typescript
// Password: Hashed, cannot be reversed
const hash = await bcrypt.hash(password, 12);
// Output: $2b$12$... (cannot get plaintext back)

// MFA Secret: Optionally encrypted
const encrypted = encrypt(secret, encryptionKey);
```

### Data Retention & Purge

**Configurable Retention**:
```
organization_settings.data_retention_days
Default: 365 days (1 year)
```

**Purge Strategy**:
1. Run nightly job: Find records older than retention days
2. Log records to audit trail before deletion
3. Delete records (or soft-delete)
4. Verify deletion

**Audit Preservation**:
- Attendance records may be deleted
- Audit logs of attendance changes are preserved
- Historical accountability maintained

### PII Protection

**Personal Identifiable Information (PII)**:
- Name, email, phone
- Employee ID, badge ID
- Location/geofence data
- Biometric data (if applicable)

**Protection Measures**:
- Access control: Only authorized roles
- Encryption: At-rest encryption for sensitive orgs
- Audit logging: All PII access logged
- Data minimization: Collect only necessary data

---

## Network Security

### CORS (Cross-Origin Resource Sharing)

**Production Configuration**:
```typescript
cors({
  origin: [
    'https://app.uapms.com',
    'https://web.uapms.com',
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-organization-id'],
  credentials: true,
  maxAge: 3600
});
```

**Development Configuration**:
```typescript
cors({
  origin: '*', // Allow all origins for development
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
});
```

### Security Headers

**Helmet.js Configuration**:
```typescript
helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Avoid unsafe-inline in production
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.uapms.com"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"]
    }
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  frameGuard: { action: 'deny' },
  xssFilter: true,
  referrerPolicy: { policy: 'no-referrer' }
});
```

**Headers Set**:
- `Strict-Transport-Security`: HTTPS only
- `Content-Security-Policy`: XSS prevention
- `X-Content-Type-Options`: nosniff
- `X-Frame-Options`: DENY (prevent clickjacking)
- `X-XSS-Protection`: 1; mode=block
- `Referrer-Policy`: no-referrer

### Rate Limiting

**Implementation**:
```typescript
// Per-IP, rolling window
rateLimit({
  windowMs: 900000, // 15 minutes
  max: 100, // 100 requests
  keyGenerator: (req) => req.ip,
  skip: (req) => isBypassedIP(req.ip), // Optional: bypass for trusted IPs
  handler: (req, res) => {
    res.status(429).json({
      error: { code: 'RATE_LIMIT_EXCEEDED' }
    });
  }
});
```

**Limits by Endpoint**:
| Endpoint | Limit | Window |
|---|---|---|
| `/auth/register` | 10 req | 1 hour |
| `/auth/login` | 20 req | 15 min |
| `/auth/forgot-password` | 5 req | 1 hour |
| `/attendance/detection` | 100 req | 1 min |
| General API | 100 req | 15 min |

---

## Secrets Management

### Environment Variables

**NEVER hardcoded** in source code. Use environment variables:

```
# .env (local, gitignored)
JWT_SECRET=random-32-character-string-here
REFRESH_TOKEN_SECRET=another-random-32-character-string
DATABASE_URL=postgresql://user:password@localhost:5432/uapms
EMAIL_API_KEY=sendgrid-api-key
SMS_API_KEY=twilio-api-key
ENCRYPTION_KEY=32-character-encryption-key
```

**In Production**:
- Managed by: Docker secrets, Kubernetes secrets, HashiCorp Vault
- Rotation: Every 90 days (recommend)
- Audit: All secret access logged
- No hardcoding in Docker images

### Secret Rotation

**Schedule**:
- JWT_SECRET: Every 90 days (issue new tokens, invalidate old)
- API Keys: Every 30 days (regenerate in services)
- Database passwords: Every 60 days

**Process**:
1. Generate new secret
2. Deploy with dual-secret support (old + new)
3. Rotate traffic to new secret
4. Wait for token expiry window
5. Decommission old secret

### API Key Management

**Generation**:
```typescript
const apiKey = crypto.randomBytes(32).toString('hex');
const hash = await bcrypt.hash(apiKey, 12);
// Store hash in database
// Return plaintext to user once
```

**Usage**:
```
Authorization: ApiKey {plaintext_api_key}
```

**Verification**:
```typescript
const storedHash = await getApiKeyHash(keyPrefix);
const isValid = await bcrypt.compare(plaintext, storedHash);
```

---

## Audit & Monitoring

### Audit Logging

**Events Logged**:
- User login/logout
- MFA setup/verification
- Password change/reset
- Account lockout/unlock
- Permission changes
- Person CRUD operations
- Attendance creation/correction
- Policy changes
- Device registration
- Leave approval/rejection
- Report exports
- Organization changes
- Security events (failed auth, rate limit, etc.)

**Audit Log Entry**:
```json
{
  "id": "audit-uuid",
  "organization_id": "org-uuid",
  "actor_id": "user-uuid",
  "action": "ATTENDANCE_CORRECTED",
  "entity_type": "ATTENDANCE_RECORD",
  "entity_id": "record-uuid",
  "old_value": { "status": "ABSENT" },
  "new_value": { "status": "PRESENT" },
  "reason": "User submitted appeal with proof",
  "ip_address": "192.168.1.1",
  "user_agent": "Mozilla/5.0...",
  "created_at": "2026-08-30T15:00:00Z"
}
```

### Log Retention

**Policy**:
- Retention: 7 years (for compliance)
- Immutable: Cannot modify audit logs
- Backup: Daily backups to secure storage
- Access: Limited to security/compliance team

### Monitoring & Alerting

**Metrics to Monitor**:
- Failed login attempts (spike = attack?)
- Account lockouts (frequency)
- Rate limit violations (DDoS?)
- API errors (health issues)
- Database query latency (performance)
- Failed MFA attempts (compromised account?)

**Alerts**:
- 50+ failed logins in 1 hour → Alert security team
- 10+ accounts locked in 1 hour → Possible attack
- Error rate > 5% → Alert ops team
- API latency p95 > 2s → Investigate

---

## Compliance

### Standards Compliance

**GDPR (General Data Protection Regulation)**:
- ✓ Data subject access requests
- ✓ Right to deletion
- ✓ Data retention policies
- ✓ Consent tracking
- ✓ Audit trail

**SOC 2 (Service Organization Control)**:
- ✓ Access controls (RBAC)
- ✓ Audit logging
- ✓ Encryption
- ✓ Incident response
- ✓ Change management

**ISO 27001 (Information Security Management)**:
- ✓ Security policies
- ✓ Access control
- ✓ Encryption
- ✓ Incident management
- ✓ Business continuity

### Data Residency

**Configuration**:
- Database location: Configurable per organization
- Backup location: Same region or specified
- Compliance: GDPR requires EU data stay in EU

---

## Incident Response

### Security Incident Protocol

**Upon Detecting Compromise**:

1. **Immediate Actions** (0-1 hour):
   - Isolate affected systems
   - Preserve evidence (logs, files)
   - Notify security team
   - Do NOT overwrite logs

2. **Investigation** (1-4 hours):
   - Determine scope of compromise
   - Identify affected users/data
   - Review audit logs
   - Check for data exfiltration

3. **Containment** (4-8 hours):
   - Invalidate compromised credentials
   - Force password reset for affected users
   - Revoke API keys
   - Patch vulnerability

4. **Notification** (8-24 hours):
   - Notify affected users
   - Notify regulators (if required)
   - Prepare disclosure statement
   - Publish incident report

5. **Recovery** (24+ hours):
   - Deploy patches to production
   - Monitor for recurrence
   - Improve controls
   - Post-incident review

### Breach Notification

**Notification Timeline**:
- Within 72 hours: Regulatory authorities (GDPR)
- Within 30 days: Affected customers
- Immediately: Internal stakeholders

---

## Security Checklist

### Pre-Deployment

- [ ] No secrets in source code (environment variables only)
- [ ] All dependencies updated and scanned (`npm audit`)
- [ ] HTTPS configured with valid certificate
- [ ] CORS origins restricted to known domains
- [ ] Rate limiting configured and tested
- [ ] Security headers enabled (Helmet.js)
- [ ] Password hashing configured (bcryptjs with 12 rounds)
- [ ] JWT secrets configured (different for access + refresh)
- [ ] Database connection encrypted (SSL)
- [ ] Audit logging configured and tested
- [ ] MFA available for admin accounts
- [ ] Email verification required for registration
- [ ] Account lockout after 5 failed attempts
- [ ] Password reset token expires in 1 hour
- [ ] RBAC tested (permission denials verified)
- [ ] Tenant isolation tested (cross-org access prevented)
- [ ] Rate limit tested (429 responses correct)
- [ ] Error messages don't leak sensitive info
- [ ] Database backups configured
- [ ] Incident response plan documented

### Post-Deployment

- [ ] Monitor error rates and latency
- [ ] Review audit logs daily
- [ ] Check for failed login spikes
- [ ] Review API key usage
- [ ] Patch security updates within 48 hours
- [ ] Rotate secrets quarterly
- [ ] Audit user permissions monthly
- [ ] Scan dependencies weekly
- [ ] Test incident response plan quarterly
- [ ] Review security policies annually

---

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [bcryptjs Documentation](https://www.npmjs.com/package/bcryptjs)
- [GDPR Compliance Guide](https://gdpr-info.eu/)

---

**Document Version**: 1.0  
**Last Updated**: 2026-08-30  
**Owner**: Security Team  
**Classification**: Internal
