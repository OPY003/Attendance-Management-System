# MASTER PROMPT — UNIVERSAL ATTENDANCE & PRESENCE MANAGEMENT SYSTEM

You are the lead software architect, senior full-stack engineer, database engineer, security engineer, QA engineer, DevOps engineer, and UI/UX engineer responsible for building a production-oriented **Universal Attendance & Presence Management System (UAPMS)**.

Your task is to **inspect, design, implement, test, debug, secure, document, and validate** the complete system.

This is **NOT** a basic student attendance CRUD application.

The finished platform must support different organizations, people, schedules, locations, attendance rules, and physical/digital detection mechanisms using one extensible architecture.

---

# 1. PRIMARY OBJECTIVE

Build a universal multi-tenant attendance and presence platform supporting:

- Schools
- Colleges
- Universities
- Coaching centers
- Training institutes
- Offices
- Corporate organizations
- Banks
- Hospitals
- Clinics
- Factories
- Warehouses
- Construction sites
- Hotels
- Resorts
- Restaurants
- Retail stores
- Government organizations
- NGOs
- Events
- Conferences
- Clubs
- Gyms
- Sports organizations
- Transport companies
- Security organizations
- Field-work organizations
- Remote-work organizations
- Hybrid organizations
- Hostels and dormitories
- Custom organization types

The core system MUST NOT be hard-coded around `student`, `teacher`, `course`, or `employee`.

Use universal concepts:

Organization
Location
Unit
Person
Role
Assignment
Schedule
Shift
Session
Detection
Verification
Policy
Rule
Attendance
Evidence
Audit

---

# 2. DEVELOPMENT BEHAVIOR

Before writing code:

1. Inspect the entire repository.
2. Identify the existing technology stack.
3. Identify existing working functionality.
4. Identify existing database/schema/API/UI.
5. Preserve useful working code.
6. Do not blindly replace the entire project.
7. Identify missing functionality.
8. Create an implementation checklist based on this specification.
9. Document major architectural decisions.

Do not repeatedly ask for unnecessary confirmation.

When a detail is unspecified, choose the most standard, secure, maintainable approach and document the decision.

Do not invent requirements that conflict with this specification.

---

# 3. ABSOLUTE IMPLEMENTATION RULES

Do not:

- create fake buttons
- create fake APIs
- return hard-coded attendance data
- pretend hardware is connected when it is not
- leave core features as TODO placeholders
- implement only frontend screens
- perform authorization only on the frontend
- allow cross-tenant access
- expose secrets in source code
- silently delete suspicious attendance
- silently overwrite attendance history
- execute arbitrary server-side code from user-defined rules
- claim a provider is implemented when it is only simulated

A feature is not complete until the real business path works.

---

# 4. TARGET ARCHITECTURE

Use a modern production-grade architecture.

Preferred baseline:

Frontend:
- TypeScript
- React-based framework
- Responsive UI
- Reusable component library

Backend:
- TypeScript
- Modular server framework
- REST API
- WebSocket/realtime support where useful
- Background jobs

Database:
- PostgreSQL

Infrastructure:
- Redis where useful
- Background worker/queue
- Docker
- Environment-based configuration
- Object-storage abstraction where needed

Authentication:
- Secure session or token architecture
- Secure password hashing
- RBAC
- Proper session/token expiration and rotation

Use stable versions available at implementation time and pin dependencies.

---

# 5. MODULE ARCHITECTURE

Create clear modules/services for:

1. Authentication
2. Authorization
3. Organizations
4. People
5. Roles
6. Locations
7. Departments
8. Groups
9. Assignments
10. Devices
11. Schedules
12. Shifts
13. Attendance Sessions
14. Detection
15. Verification
16. Policies
17. Rules
18. Attendance Engine
19. Leave
20. Visitors
21. Notifications
22. Reports
23. Analytics
24. Fraud Detection
25. Audit
26. System Administration

Keep business logic out of random frontend components and route handlers.

---

# 6. MULTI-TENANCY

Implement strict tenant isolation.

Requirements:

- Organizations are isolated.
- Organization-owned records are tenant-aware.
- Backend authorization validates tenant access.
- Client-submitted organization IDs cannot bypass authorization.
- Platform-level admins may have global permissions.
- Organization users only see authorized organization data.

Write automated cross-tenant security tests.

Example test:

```text
Organization A user
tries to access
Organization B attendance
→ DENIED
```

---

# 7. PERSON MODEL

Create a generic `Person` entity.

Roles may include:

- Student
- Teacher
- Employee
- Manager
- Doctor
- Nurse
- Worker
- Guard
- Contractor
- Visitor
- Volunteer
- Member
- Guest
- Custom Role

A person may have:

- Multiple roles
- Multiple organization memberships
- Multiple assignments
- Different schedules
- Different policies

Do not duplicate the identity model for each organization type.

---

# 8. ORGANIZATION HIERARCHY

Support optional hierarchy such as:

```text
Organization
→ Region
→ Branch/Campus
→ Building
→ Floor
→ Room/Area
→ Attendance Zone
```

and:

```text
Organization
→ Department
→ Team
→ Group
```

Do not hard-code hierarchy depth.

---

# 9. ATTENDANCE DATA MODEL

Support statuses:

- PRESENT
- ABSENT
- LATE
- EARLY
- EARLY_LEAVE
- CHECK_IN
- CHECK_OUT
- BREAK_START
- BREAK_END
- PARTIAL
- EXCUSED
- LEAVE
- REMOTE
- FIELD_WORK
- OFFICIAL_DUTY
- OVERTIME
- UNKNOWN
- SUSPICIOUS
- REJECTED
- PENDING_REVIEW
- MISSING_CHECKOUT

Allow future/custom statuses without requiring a redesign.

---

# 10. DETECTION ADAPTER ARCHITECTURE

Every detection technology must use a provider/adapter abstraction.

Create clean interfaces for:

- DetectionProvider
- IdentityDetectionProvider
- LocationDetectionProvider
- DeviceVerificationProvider
- BiometricProvider
- SensorProvider

All providers must output a normalized detection event.

Required methods/technologies to architect for:

### Identity

- QR
- Dynamic QR
- Barcode
- RFID
- NFC
- Smart Card
- PIN
- OTP
- Fingerprint
- Face Recognition
- Iris Recognition
- Palm Recognition
- Palm Vein
- Voice Recognition
- Digital Signature
- Manual Verification

### Location

- GPS
- Geofencing
- Wi-Fi
- Bluetooth
- BLE Beacon
- UWB
- Cellular location
- IP/network verification
- VPN

### Device/System

- Registered mobile
- Registered computer
- Web login
- Mobile app
- SSO
- VPN login
- Enterprise login
- Workstation login
- Access-control system
- Turnstile
- Smart lock

### Sensor/IoT

- Motion sensor
- Presence sensor
- Seat sensor
- Door sensor
- Gate sensor
- Camera
- CCTV
- IoT device
- Number plate recognition

### Digital/Remote

- Web session
- Mobile session
- Online class/session
- Video meeting presence
- Application session

### Manual/Fallback

- Teacher mark
- Manager mark
- Supervisor mark
- Admin mark
- Kiosk
- Imported attendance

---

# 11. HARDWARE INTEGRATION RULE

Do not pretend unavailable hardware is connected.

For a provider that is not available in the development environment:

1. Create the real provider interface.
2. Create a development simulator/mock provider.
3. Make the simulator generate the same normalized event type.
4. Write tests against the simulator.
5. Document the real hardware integration point.
6. Keep the core attendance engine independent of the provider.

This must apply to biometric scanners, RFID readers, NFC readers, CCTV/vision systems, BLE/UWB hardware, IoT devices, access-control systems, and similar external equipment.

---

# 12. NORMALIZED DETECTION EVENT

Create a shared internal representation conceptually containing:

- event ID
- organization ID
- person ID when resolved
- device ID
- session ID
- detection method
- timestamp
- timezone
- location information when available
- identity confidence when available
- device confidence when available
- provider reference
- evidence reference
- metadata
- processing state

Do not let individual providers directly create final attendance records.

---

# 13. PROCESSING PIPELINE

Use this pipeline:

```text
Detection Provider
        ↓
Normalized Detection Event
        ↓
Identity Resolution
        ↓
Verification
        ↓
Evidence Collection
        ↓
Attendance Policy
        ↓
Rule Evaluation
        ↓
Confidence Calculation
        ↓
Attendance Engine
        ↓
Attendance Result
        ↓
Audit / Notifications / Analytics
```

This pipeline must be consistent across all detection methods.

---

# 14. MULTI-METHOD ATTENDANCE

Support:

- AND
- OR
- Weighted combinations
- Fallback
- Ordered verification

Examples:

```text
Dynamic QR
AND
GPS
AND
Registered Device
```

```text
RFID
AND
Face
```

```text
SSO
AND
VPN
AND
Registered Laptop
```

```text
Face
OR
Fingerprint
```

Policies must determine how methods combine.

---

# 15. ATTENDANCE POLICY ENGINE

Policies must be configurable.

Support:

- Required methods
- Optional methods
- Allowed locations
- Geofence radius
- Allowed devices
- Time windows
- Grace periods
- Required confidence
- Duplicate handling
- Fallback methods
- Review thresholds
- Late rules
- Early-leave rules
- Checkout requirements
- Session restrictions

Example:

```text
University Classroom:
Dynamic QR + GPS + Registered Device
```

```text
Factory:
RFID + Face + Shift
```

```text
Remote Work:
SSO + Registered Device + VPN
```

Do not hard-code these examples as the only possible policies.

---

# 16. SAFE RULE ENGINE

Implement a structured rule engine.

Examples:

```text
IF check_in_time <= start_time + grace_period
THEN PRESENT
```

```text
IF check_in_time > start_time + grace_period
THEN LATE
```

```text
IF location outside allowed zone
THEN REJECT
```

```text
IF confidence < threshold
THEN PENDING_REVIEW
```

```text
IF attendance_rate < threshold
THEN CREATE_WARNING
```

Rules may reference:

- person
- role
- organization
- location
- group
- schedule
- shift
- date
- time
- detection
- device
- verification
- leave
- holiday
- previous attendance
- session

Do NOT execute arbitrary JavaScript, SQL, shell commands, or arbitrary server-side code from user-defined rules.

---

# 17. CONFIDENCE ENGINE

Implement configurable weighted verification.

Example:

```text
Dynamic QR          +30
GPS                 +25
Registered Device   +15
Face Match          +25
Correct Time         +5
------------------------
Total               100
```

Possible thresholds:

```text
90–100  VERIFIED
75–89   VALID
50–74   REVIEW
20–49   SUSPICIOUS
0–19    REJECTED
```

Weights and thresholds must be configurable per policy.

Store calculation details for auditability.

---

# 18. EVIDENCE AND EXPLAINABILITY

Every important attendance decision must be explainable.

Store appropriate evidence:

- Method
- QR token/session reference
- Device
- Location verification
- Identity verification
- Timestamp
- Policy ID/version
- Rule results
- Confidence details
- Manual operator
- Provider reference

The system should answer:

```text
Why was this person marked present?
Why was this event rejected?
Which policy was used?
Which verification methods succeeded?
Which methods failed?
```

---

# 19. DYNAMIC QR

Implement secure short-lived QR attendance.

Requirements:

- Short expiration
- Session binding
- Organization binding
- Optional location binding
- Optional device binding
- Replay prevention
- Duplicate scan prevention
- Server-side validation
- Rate limiting

Do not rely on predictable permanent QR codes.

---

# 20. LOCATION VERIFICATION

Implement provider abstraction for:

- GPS
- Geofence
- Polygon zones where appropriate
- Wi-Fi
- BLE
- UWB
- IP/network
- VPN

Do not assume any location signal is perfect.

Store the result of the location verification decision.

---

# 21. SCHEDULE AND SHIFT ENGINE

Support:

- Fixed schedules
- Class schedules
- Shift schedules
- Rotating shifts
- Flexible schedules
- Split shifts
- Overnight shifts
- Recurring schedules
- One-time sessions
- Event schedules
- Remote schedules
- Field schedules
- No-fixed-schedule mode

Correctly implement:

- Grace periods
- Late thresholds
- Early-leave thresholds
- Breaks
- Holidays
- Weekends
- Exceptions
- Midnight crossover
- Timezones
- DST changes where applicable

---

# 22. CHECK-IN/CHECK-OUT ENGINE

Support:

- Check-in
- Check-out
- Break start/end
- Multiple check-ins
- Multiple check-outs
- Overnight shifts
- Split shifts
- Missing checkout
- Manual correction

Calculate:

- Working duration
- Break duration
- Late duration
- Early leave
- Overtime

Do not assume one attendance event per person per day.

---

# 23. LEAVE MANAGEMENT

Implement configurable leave types.

Workflow:

```text
Request
→ Approval
→ Approved/Rejected
→ Attendance Interaction
```

Approved leave must be recognized separately from absence.

---

# 24. VISITOR MANAGEMENT

Implement:

- Visitor identity
- Host
- Purpose
- Allowed location
- Valid time period
- Temporary credential
- Entry
- Exit

Temporary visitor credentials must expire.

---

# 25. DEVICE MANAGEMENT

Implement device registration and management.

Store:

- Device ID
- Organization
- Location
- Type
- Serial
- Status
- Last seen
- Configuration
- Assigned policy
- Credential metadata

Support:

- Register
- Activate
- Deactivate
- Reassign
- Credential rotation
- Policy assignment
- Status monitoring
- Audit

---

# 26. OFFLINE SUPPORT

Supported devices/clients must be able to queue events during network loss.

Required flow:

```text
Offline
→ Secure local queue
→ Preserve original timestamp
→ Preserve device identity
→ Reconnect
→ Synchronize
→ Validate duplicates/conflicts
→ Apply policy
→ Store final result
```

Do not silently overwrite conflicting events.

---

# 27. FRAUD / ANOMALY DETECTION

Detect/flag:

- Duplicate attendance
- QR replay
- Expired QR
- Shared QR
- Invalid device
- GPS anomaly
- Impossible travel
- Face mismatch
- RFID/Face mismatch
- Multiple people on one device
- Excessive failed verification
- Suspicious timing
- Abnormal attendance patterns

Keep suspicious records and create reviewable alerts.

---

# 28. AUDIT LOG

Audit:

- Login
- Logout
- Permission changes
- Person changes
- Attendance creation
- Attendance correction
- Policy changes
- Device registration
- Device configuration
- Biometric configuration
- Leave decisions
- Report generation
- Export
- Organization changes
- Security events

Attendance correction must store:

```text
old value
new value
actor
timestamp
reason
source
```

Do not destroy history merely to simplify correction.

---

# 29. BIOMETRIC ARCHITECTURE

Biometric providers must be pluggable.

Do not tightly couple the system to one vendor.

Do not casually store raw biometric images/audio.

Use appropriate protection for biometric-related records:

- Encryption
- Access control
- Retention rules
- Deletion mechanisms
- Audit
- Provider abstraction

The system must work when biometric functionality is disabled.

---

# 30. AUTHENTICATION AND AUTHORIZATION

Implement secure authentication.

At minimum:

- Password hashing
- Session/token security
- Token/session expiry
- Secure logout
- RBAC
- Permission checks
- Rate limiting
- Account protection
- Backend authorization
- Tenant-aware access checks

Possible roles:

- Platform Super Admin
- Organization Owner
- Organization Admin
- Branch Admin
- Attendance Administrator
- HR
- Manager
- Teacher
- Supervisor
- Security Officer
- Auditor
- User
- Visitor

Permissions must be granular.

---

# 31. FRONTEND REQUIREMENTS

Pages/modules:

- Login
- Dashboard
- Organizations
- People
- Roles
- Departments
- Groups
- Locations
- Devices
- Schedules
- Shifts
- Sessions
- Attendance
- Policies
- Rules
- Leave
- Visitors
- Notifications
- Reports
- Analytics
- Audit
- Settings

Every important screen needs:

- Loading state
- Empty state
- Error state
- Success feedback
- Validation feedback
- Search where useful
- Filters where useful
- Pagination where useful
- Permission-aware controls
- Responsive behavior

Do not create an attractive UI that is disconnected from backend functionality.

---

# 32. DASHBOARDS

## Super Admin

- Organization count
- User count
- Device count
- Active sessions
- System health
- Security events
- Global analytics

## Organization Admin

- Present
- Absent
- Late
- Leave
- People
- Locations
- Devices
- Sessions
- Alerts
- Analytics
- Reports

## Manager/Teacher

- Assigned groups
- Current sessions
- Attendance
- Corrections
- Reports

## User

- Today's attendance
- Check-in
- Check-out
- Schedule
- Attendance history
- Leave
- Notifications

---

# 33. ANALYTICS

Implement server-side aggregation for important dashboards.

Metrics:

- Attendance rate
- Absence rate
- Late rate
- Early leave
- Working hours
- Overtime
- Leave
- Department comparison
- Location comparison
- Session attendance
- Shift compliance
- Detection-method usage
- Fraud/suspicious activity

Respect filters and date ranges.

---

# 34. NOTIFICATIONS

Create provider abstractions for:

- In-app
- Email
- SMS
- Push
- Webhook

Events can include:

- Low attendance
- Late arrival
- Missing checkout
- Suspicious activity
- Leave approval
- Leave rejection
- Schedule change
- Device offline
- Security event

---

# 35. REPORTING

Support:

- Daily
- Weekly
- Monthly
- Custom date range
- Person
- Department
- Group
- Location
- Session
- Shift
- Organization
- Leave
- Working hours
- Suspicious activity
- Detection method

Formats:

- PDF
- CSV
- Excel-compatible
- JSON

Use background jobs for large report generation.

---

# 36. DATABASE REQUIREMENTS

Use PostgreSQL.

Recommended entities:

```text
organizations
organization_settings

users
persons
person_roles
roles
permissions
role_permissions
organization_memberships

locations
location_types
attendance_zones

departments
groups
memberships

devices
device_types
device_credentials

schedules
schedule_rules
shifts
shift_assignments
holidays

attendance_sessions
attendance_events
attendance_records
attendance_evidence

detection_methods
detection_attempts
verification_results

attendance_policies
policy_rules

leave_types
leave_requests

visitors
visitor_passes

notifications
notification_preferences

fraud_alerts
audit_logs

api_keys
webhooks

report_jobs
files
```

Use:

- Foreign keys
- Unique constraints
- Appropriate indexes
- Check constraints
- Transactions
- Migrations
- Seed scripts
- Soft delete where appropriate
- Correct timestamp types

Do not use one enormous table for the entire system.

Do not use generic JSON instead of proper relational modeling unless the field genuinely requires provider-specific flexible metadata.

---

# 37. API REQUIREMENTS

Use clean REST APIs grouped by domain.

Possible groups:

```text
/auth
/organizations
/users
/persons
/roles
/permissions
/locations
/departments
/groups
/devices
/schedules
/shifts
/sessions
/detection
/verification
/attendance
/policies
/rules
/leave
/visitors
/notifications
/reports
/analytics
/fraud
/audit
```

Every endpoint must define:

- Authentication requirement
- Permission requirement
- Tenant requirement
- Validation
- Request body
- Parameters
- Success response
- Error responses
- Pagination/filtering when appropriate

Use consistent response and error formats.

Do not expose raw database errors.

---

# 38. SECURITY REQUIREMENTS

Implement:

- Secure password hashing
- Authentication protection
- RBAC
- Tenant isolation
- Input validation
- Output validation
- Rate limiting
- Secure headers
- Safe CORS
- SQL injection protection
- XSS protection
- CSRF protection where relevant
- Secure session/token handling
- Secret management
- Device authentication
- API authorization
- File upload validation
- Audit logging

Never put:

- API secrets
- database passwords
- private signing keys
- production credentials

in source code.

Use environment configuration.

---

# 39. TIMEZONE RULES

Organizations/locations must have configured timezones.

Store timestamps consistently.

Correctly handle:

- Local date
- Overnight shifts
- Day boundaries
- DST transitions where applicable
- Report periods
- Schedule boundaries

Never implement important business logic by comparing timezone-ambiguous strings.

---

# 40. DATA RETENTION

Make retention configurable for categories such as:

- Attendance events
- Audit logs
- Location evidence
- Provider metadata
- Visitor records
- Biometric-related records

Implement controlled cleanup/archive jobs.

Do not delete records without respecting audit/business requirements.

---

# 41. PERFORMANCE REQUIREMENTS

Design for large organizations.

Use:

- Pagination
- Server-side filtering
- Indexed queries
- Server-side aggregation
- Background jobs
- Batch inserts
- Caching where useful
- Queue-based processing when necessary

Do not load huge attendance histories into the browser.

Separate high-volume event ingestion concerns from dashboard querying where needed.

---

# 42. TESTING REQUIREMENTS

Create:

## Unit tests

Cover:

- Attendance calculations
- Late rules
- Grace periods
- Shifts
- Overnight schedules
- Leave interaction
- Confidence calculation
- Policy evaluation
- Duplicate prevention

## Integration tests

Cover:

- Authentication
- Tenant isolation
- Database operations
- Attendance creation
- Policy engine
- Detection adapters
- Device management
- Reports

## E2E tests

At minimum:

1. Admin creates organization
2. Admin creates person
3. Admin creates location
4. Admin creates schedule
5. Admin creates policy
6. Session starts
7. User performs detection
8. Detection is validated
9. Attendance is created
10. User sees attendance
11. Admin sees attendance
12. Correction workflow works
13. Audit record exists

## Security tests

Test:

- Cross-tenant access
- Privilege escalation
- Unauthorized endpoints
- Invalid tokens
- Replay attacks
- Expired QR
- Duplicate attendance
- Malicious input
- Rate limits

---

# 43. REQUIRED EDGE CASE TESTS

Test at minimum:

- Duplicate QR scan
- Expired QR
- QR used for wrong organization
- QR used for wrong session
- User outside geofence
- GPS unavailable
- Unregistered device
- No schedule
- Overnight shift
- Midnight event
- DST transition where applicable
- Missing checkout
- Double check-in
- Double checkout
- Late arrival
- Early departure
- Approved leave
- Rejected leave
- Holiday
- Weekend
- Manual correction
- Conflicting detection results
- Low confidence
- Provider failure
- Network failure
- Offline synchronization
- Deactivated user
- Deactivated device
- Revoked device credential
- High-volume event ingestion

---

# 44. SEED DATA

Create safe fake development data containing:

- At least 3 organizations
- Different organization types
- Multiple locations
- Departments/groups
- Multiple roles
- Multiple people
- Schedules
- Shifts
- Attendance policies
- Devices
- Attendance records
- Leave records
- Suspicious events
- Audit events

Do not use real personal data.

---

# 45. DEMO/SIMULATOR MODE

Provide development simulators for:

- QR
- Dynamic QR
- GPS
- RFID
- Face
- Fingerprint
- Registered device
- Failed verification
- Duplicate attendance
- Suspicious location
- Offline device

The simulator MUST produce the same normalized detection events used by actual providers.

Do not create a separate fake attendance engine for demos.

---

# 46. DOCUMENTATION

Create:

```text
README.md
ARCHITECTURE.md
DATABASE.md
API.md
SECURITY.md
DEPLOYMENT.md
DETECTION_PROVIDERS.md
ATTENDANCE_RULES.md
```

Document:

- Setup
- Environment variables
- Database migration
- Seed process
- Development commands
- Testing
- Architecture
- API usage
- Detection provider integration
- Policy/rule configuration
- Security
- Deployment
- Known limitations

---

# 47. ENVIRONMENT CONFIGURATION

Create `.env.example`.

Use environment variables for:

- Database
- Redis
- Authentication secrets
- Storage
- Email
- SMS
- Push notifications
- Maps/geolocation
- Biometrics
- Webhooks

Validate required configuration at startup.

Never commit secrets.

---

# 48. OBSERVABILITY

Implement structured logging.

Track:

- Request ID
- Authentication events
- Attendance processing failures
- Detection provider failures
- Queue failures
- Synchronization failures
- Security events
- Unexpected application errors

Where appropriate provide:

- Health endpoint
- Readiness endpoint
- Basic metrics
- Queue status

---

# 49. HISTORICAL ATTENDANCE RULE

Attendance history is important business data.

Do not overwrite historical information without traceability.

A correction should preferably create:

```text
Original Attendance
+
Correction
+
Actor
+
Reason
+
Timestamp
```

rather than simply replacing the original record.

---

# 50. PRIVACY / BIOMETRIC RULE

Biometric and location information may be sensitive.

Design the system so organizations can choose which methods are enabled.

Example:

```text
Organization A:
Face = OFF
GPS = ON
QR = ON
```

```text
Organization B:
Face = ON
RFID = ON
GPS = OFF
```

Do not make biometrics mandatory for every tenant.

---

# 51. DEVELOPMENT PHASES

Follow this implementation order.

## Phase 1
Repository inspection
Architecture
Database
Authentication
RBAC
Multi-tenancy

## Phase 2
Organizations
People
Roles
Locations
Departments
Groups

## Phase 3
Schedules
Shifts
Sessions
Attendance statuses
Attendance engine

## Phase 4
Detection abstraction
QR
Dynamic QR
GPS
Geofence
Registered device
Manual attendance

## Phase 5
Policy engine
Rule engine
Confidence engine
Evidence

## Phase 6
Leave
Visitors
Devices
Offline synchronization

## Phase 7
Fraud detection
Audit
Notifications

## Phase 8
Reports
Analytics
Dashboards

## Phase 9
RFID adapter
NFC adapter
Biometric adapter
BLE/UWB abstraction
IoT adapter
Access-control adapter
CCTV/vision adapter
Other provider interfaces

## Phase 10
Security hardening
Performance
Testing
Documentation
Deployment

Do not build advanced hardware integrations before the normalized detection architecture is stable.

---

# 52. ACCEPTANCE CRITERIA

Do not declare the system complete until all core acceptance criteria pass.

The system must support:

- Authentication
- RBAC
- Multi-tenancy
- Organization management
- Person management
- Location management
- Schedule management
- Shift management
- Attendance sessions
- Attendance engine
- Detection adapters
- QR
- Dynamic QR
- GPS/geofence where supported
- Registered device verification
- Manual attendance
- Attendance policies
- Rule evaluation
- Confidence calculation
- Evidence
- Leave
- Visitors
- Devices
- Offline architecture
- Fraud/anomaly alerts
- Audit
- Notifications
- Reporting
- Analytics
- Automated tests
- Documentation
- Deployment instructions

---

# 53. QUALITY GATE BEFORE COMPLETION

Before saying "complete", run:

1. Build
2. Type checking
3. Lint
4. Unit tests
5. Integration tests
6. E2E tests
7. Security tests
8. Database migration test
9. Seed test
10. API test
11. Frontend/backend integration test
12. Tenant-isolation test
13. Attendance edge-case tests
14. Offline synchronization test
15. Error-path tests

Fix critical failures before completion.

Do not hide unresolved errors.

---

# 54. FINAL DELIVERABLE

At the end provide:

1. Final project structure
2. Architecture summary
3. Database/ER summary
4. API summary
5. Authentication/RBAC summary
6. Detection-provider summary
7. Attendance policy/rule summary
8. Testing summary
9. Security summary
10. Deployment instructions
11. Known limitations
12. Exact commands to run the project

Explicitly separate:

- Fully implemented features
- Simulated/provider-interface features
- Known limitations
- Future enhancements

Never represent simulated hardware integration as real hardware integration.

---

# 55. MOST IMPORTANT PRINCIPLE

The platform is successful only if a new organization can mostly be configured through:

- Organization settings
- Roles
- Locations
- Groups
- Schedules
- Shifts
- Policies
- Detection providers
- Rules
- Notifications

without rewriting the core attendance engine.

Use this principle throughout development:

> ONE ATTENDANCE ENGINE + MANY ORGANIZATIONS + MANY PEOPLE + MANY SCHEDULES + MANY RULES + MANY DETECTION METHODS

The system must always be able to explain:

```text
WHO was present?
WHERE were they?
WHEN were they present?
HOW were they detected?
HOW was identity verified?
WHICH policy was applied?
WHICH rules were triggered?
WHAT evidence supports the decision?
WHO changed the record?
WHEN was it changed?
```

Build the system around this requirement from the beginning.

---

# 56. START COMMAND

START NOW.

First inspect the existing repository and produce an internal implementation checklist based on this specification.

Then implement phase by phase.

Do not skip foundational architecture.

Do not build disconnected screens.

Do not replace functioning code without a reason.

Do not ask for unnecessary confirmation.

When an implementation choice is not explicitly specified, use a secure, maintainable industry-standard solution and document the decision.

Continue until the acceptance criteria and validation gates are satisfied.

# 57. API QUALITY RULE

For every endpoint document:

method
path
authentication
permissions
request body
parameters
success response
validation errors
authorization errors
server errors

Use one consistent error response format.

---

# 58. DATABASE QUALITY RULE

Do not create a giant database table containing every possible organization field.

Use normalized tables with clear relations.

Do not create duplicated user identity tables for every organization type.

Use generic identity and role assignments.

---

# 59. PRODUCT PHILOSOPHY

The core principle is:

"One attendance engine, many organizations, many rules, many detection methods."

The system should be able to answer:

WHO was present?

WHERE were they?

WHEN were they present?

HOW were they detected?

HOW was their identity verified?

WHICH policy was applied?

WHY was the final attendance status assigned?

WHAT evidence supports the decision?

WHO changed the record?

WHEN was it changed?

This explainability must be built into the architecture.

---

# 60. FINAL OUTPUT REQUIRED FROM THE CODING AGENT

At the end provide:

Completed project structure
Architecture summary
Database ER description
API summary
Authentication/RBAC summary
Detection-provider summary
Attendance-policy summary
Test summary
Security summary
Deployment instructions
Known limitations
Exact commands to run the project

Do not hide unresolved errors.

If a real external hardware/provider integration is unavailable, explicitly identify it as a simulator/provider interface rather than claiming full hardware integration.

The implementation should be clean, modular, testable, secure, extensible, and production-oriented.

START BY INSPECTING THE EXISTING REPOSITORY AND BUILDING A WRITTEN IMPLEMENTATION CHECKLIST.

THEN IMPLEMENT THE SYSTEM PHASE BY PHASE.

DO NOT SKIP PHASES.

DO NOT INVENT REQUIREMENTS THAT CONFLICT WITH THIS SPECIFICATION.

WHEN A DETAIL IS NOT SPECIFIED, CHOOSE THE MOST STANDARD, SECURE, MAINTAINABLE OPTION AND DOCUMENT THE DECISION.

DO NOT ASK FOR UNNECESSARY CONFIRMATION.

CONTINUE UNTIL THE SYSTEM PASSES THE ACCEPTANCE CRITERIA AND TEST VALIDATION.

---
# The most important part

The architecture above is deliberately centered on this:

                    ANY ORGANIZATION
                           ↓
                      ANY PERSON
                           ↓
                    ANY SCHEDULE
                           ↓
                    ANY LOCATION
                           ↓
                  ANY DETECTION METHOD
                           ↓
                 NORMALIZED EVENT
                           ↓
                 VERIFICATION ENGINE
                           ↓
                  POLICY / RULE ENGINE
                           ↓
                CONFIDENCE + EVIDENCE
                           ↓
                  ATTENDANCE ENGINE
                           ↓
             REPORTS / ANALYTICS / ALERTS

---

# 61. ACCOUNT & IDENTITY LIFECYCLE

Authentication in Section 30 covers session/token security. This section covers the full account lifecycle, which must also be implemented.

Implement:

- Email verification on account creation
- Forgot-password / reset-password flow with expiring tokens
- Resend-verification flow
- Multi-factor authentication (MFA/2FA) for privileged roles (Org Owner, Org Admin, Attendance Administrator, Platform Super Admin at minimum)
- Account lockout after repeated failed login attempts, with unlock path
- Secure "remember this device" handling, separate from attendance device registration
- Person invitation flow: invite by email/SMS, time-limited invite token, invited person sets their own credentials
- Self-registration flow where an organization enables it (e.g., events, gyms, clubs), gated by organization policy

Do not treat "authentication" as complete until password reset, email verification, and account lockout all work end-to-end.

---

# 62. TENANT ONBOARDING & BILLING

This is a multi-tenant SaaS platform. Organization creation and monetization must be architected, not assumed.

Implement:

- Organization sign-up / provisioning flow (self-service and/or platform-admin-created)
- Organization onboarding checklist (create first location, first role, first schedule, first policy)
- Subscription plan model: plan tiers, feature flags per plan, trial period
- Tenant-level resource quotas: max people, max devices, max locations, API request quotas
- Billing status affecting access (active, trial, past-due, suspended, cancelled)
- Payment provider abstraction (do not hard-code one payment vendor into core logic)
- Downgrade/upgrade path that does not silently delete data when a tenant exceeds a lower plan's limits

Do not couple attendance business logic to billing logic. Billing status gates access; it does not participate in attendance calculation.

---

# 63. EXTENSIBILITY / CUSTOM FIELDS

Section 58 prohibits one giant table with every possible field, and prohibits misusing JSON instead of relational modeling. This section resolves how organizations still get custom attributes without violating that rule.

Implement a structured custom-field mechanism:

```text
custom_field_definitions
  - organization_id
  - entity_type (person, location, device, attendance_record, etc.)
  - field_key
  - field_label
  - field_type (text, number, boolean, date, select)
  - required
  - validation_rule

custom_field_values
  - organization_id
  - entity_type
  - entity_id
  - field_key
  - value
```

Rules:

- Custom fields are metadata-driven, defined per organization, not per-code-change.
- Core entities (`persons`, `locations`, `devices`, etc.) remain normalized and stable.
- Custom field values are validated against their definition at write time.
- Custom fields must not be usable to bypass rule-engine safety (Section 16) — they are data, never executable logic.
- New attendance statuses (Section 9) follow the same pattern: organizations register custom status codes, not custom executable behavior.

---

# 64. BULK IMPORT / EXPORT & INVITATIONS

Seed data (Section 44) is for development. Production organizations need real bulk onboarding tools.

Implement:

- Bulk import of people via CSV/Excel with:
  - Column mapping
  - Row-level validation
  - Per-row error reporting (do not fail the whole batch silently)
  - Dry-run/preview mode before committing
- Bulk invitation sending (invite N people at once)
- Bulk export of organization data (people, attendance, devices) for migration or backup, distinct from analytical reports in Section 35
- Import/export operations are audited (Section 28) and tenant-scoped (Section 6)

---

# 65. PRIVACY, CONSENT & DATA RIGHTS

Section 29/50 cover biometric protection and optional enablement. This section adds consent and data-subject rights, which are legally required in many jurisdictions (GDPR, CCPA, BIPA, and similar).

Implement:

- Explicit, revocable consent capture before collecting biometric or precise-location data from a person
- Consent status stored per person, per data category, with timestamp and version of the consent text shown
- Withdrawal-of-consent flow that disables the relevant detection method for that person without breaking their other attendance methods
- Data subject access request (DSAR) support: a person or admin can request an export of that person's personal data
- Right-to-erasure support: delete or anonymize a person's personal data while preserving audit/attendance integrity where legally required (do not silently break historical attendance records — see Section 49)
- Data residency awareness: document which region an organization's data is stored in, and support region-pinned storage where required

Consent and data-rights records are themselves audited (Section 28).

---

# 66. INTERNATIONALIZATION & ACCESSIBILITY

The platform explicitly targets organizations of many types across many regions (Section 1). Localization is therefore a core requirement, not an enhancement.

Implement:

- UI internationalization (i18n) framework: externalized strings, language switching, right-to-left layout support
- Locale-aware date, time, and number formatting, consistent with the timezone rules in Section 39
- Organization-level default language and person-level language preference
- Frontend accessibility baseline (keyboard navigation, screen-reader labels, sufficient color contrast) for all screens listed in Section 31

---

# 67. EXTERNAL SYSTEM INTEGRATION

Section 34 covers outbound webhooks as a notification channel. This section covers integration with the external systems attendance data naturally needs to flow to and from.

Implement provider-style abstractions (same pattern as detection providers in Section 10) for:

- Payroll system export (hours worked, overtime, leave)
- HRIS/employee-directory sync (import/sync person and role data)
- LMS/SIS integration for academic organizations (class rosters, session schedules)
- Access-control/security-system integration beyond attendance (e.g., door system also used for building security)

Requirements:

- Machine-readable API contract (OpenAPI/Swagger) in addition to the API.md documentation from Section 46
- API versioning strategy so integrations do not break when the API evolves
- Integration failures are logged and retryable, not silently dropped

---

# 68. OPERATIONAL READINESS

Section 48 covers logging and health endpoints. This section covers the remaining operational requirements for running the platform in production.

Implement/document:

- Backup strategy for the database and object storage, with defined Recovery Point Objective (RPO) and Recovery Time Objective (RTO)
- Restore-from-backup test as part of the deployment documentation
- CI/CD pipeline: build, test, and deploy stages, with separate staging and production environments
- Concrete performance targets to validate against (e.g., target requests/second for detection ingestion, target concurrent devices, target dashboard query latency) rather than qualitative goals only
- Scheduled/automated report delivery (e.g., a daily/weekly report emailed automatically), in addition to on-demand report generation from Section 35

---

# 69. SHARED / KIOSK DEVICE ARCHITECTURE

Section 25 lists "Kiosk" as a manual/fallback detection method. A shared physical kiosk has different requirements from a personally registered device and must be specified separately.

Implement:

- Kiosk session flow: a single physical device processes a sequence of different people, one at a time
- Per-person identification at the kiosk (PIN, card, face, QR) distinct from the kiosk's own device authentication
- Queue/timeout handling so one person's slow interaction does not corrupt the next person's event
- Kiosk offline queueing follows the same offline pipeline as Section 26, tagged with the kiosk's device ID, not an individual person's device ID

---

# 70. REAL-TIME MONITORING

Section 4 requires WebSocket/realtime support at the infrastructure level. This section specifies the feature it enables.

Implement a live session monitor view for Manager/Teacher/Supervisor roles showing:

- Attendance events arriving in real time for an active session
- Live count of present/absent/pending-review people for that session
- Ability to trigger a manual correction from the live view, which follows the same audited correction path as Section 28/49

---

# 71. ADDITIONAL DATABASE ENTITIES

Extend the entity list in Section 36 with:

```text
subscriptions
subscription_plans
tenant_quotas
billing_events

custom_field_definitions
custom_field_values

invitations
bulk_import_jobs

consent_records
data_subject_requests

integration_connections
integration_sync_logs

device_tokens (push notifications)
scheduled_reports
```

These follow the same normalization, foreign-key, and tenant-isolation rules already defined in Section 36 and Section 6.

---

# 72. UPDATED ACCEPTANCE CRITERIA

In addition to Section 52, the system must also support:

- Full account lifecycle: email verification, password reset, MFA, account lockout
- Organization self-service onboarding and subscription/plan enforcement
- Custom fields per organization without core schema changes
- Bulk import/export with row-level validation
- Consent capture/withdrawal for biometric and location data, and data subject access/erasure requests
- Localized UI in at least one additional language beyond the default, proving the i18n framework works
- At least one external system integration (payroll, HRIS, or LMS) implemented against the provider abstraction
- Documented backup/restore test and CI/CD pipeline
- Kiosk multi-person flow tested with at least 3 sequential people on one simulated device
- Live real-time session monitor functioning against the simulator from Section 45

Do not declare the system complete until these, in addition to Section 52, pass.
