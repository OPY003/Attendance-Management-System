# Universal Attendance & Presence Management System (UAPMS)
## Complete System Structure & Architecture Specification

## 1. Product Definition

**Universal Attendance & Presence Management System (UAPMS)** is a configurable, multi-tenant attendance and presence platform designed to support different organization types, person types, locations, schedules, attendance rules, and detection technologies through one common architecture.

The platform must not be designed only for schools, universities, or offices.

### Supported organization categories

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

---

# 2. Core Architecture

The fundamental model is:

```text
Organization
    ↓
Location / Unit / Group
    ↓
Person
    ↓
Role / Assignment
    ↓
Schedule / Shift
    ↓
Attendance Session
    ↓
Detection Event
    ↓
Verification
    ↓
Policy / Rules
    ↓
Attendance Result
    ↓
Evidence + Audit
    ↓
Reports / Analytics / Notifications
```

The core engine must not be based on concepts such as:

```text
Student → Course → Teacher
```

or:

```text
Employee → Office → Shift
```

Those are configurations of the universal model.

---

# 3. Multi-Tenant Architecture

The platform supports multiple independent organizations.

```text
Platform
│
├── Organization A
│   ├── People
│   ├── Locations
│   ├── Units
│   ├── Devices
│   ├── Schedules
│   ├── Policies
│   └── Attendance
│
├── Organization B
│   ├── People
│   ├── Locations
│   ├── Units
│   ├── Devices
│   ├── Schedules
│   ├── Policies
│   └── Attendance
│
└── Organization C
```

Tenant isolation is mandatory.

A user must never be able to access another organization's data unless their permissions explicitly grant platform-level access.

---

# 4. Generic Person Model

Use a generic `Person` entity.

Possible roles include:

- Student
- Teacher
- Employee
- Manager
- Doctor
- Nurse
- Worker
- Security Guard
- Contractor
- Visitor
- Volunteer
- Member
- Guest
- Custom Role

A person can have:

- Multiple roles
- Multiple organization memberships
- Multiple assignments
- Different schedules
- Different attendance policies

Example:

```text
Person
 ├── Organization A → Employee
 ├── Organization B → Student
 └── Organization C → Club Member
```

---

# 5. Organization and Location Hierarchy

Organizations must support flexible hierarchy.

Generic model:

```text
Organization
    ↓
Region
    ↓
Branch / Campus
    ↓
Building
    ↓
Floor
    ↓
Room / Area
    ↓
Attendance Zone
```

Another organization may use:

```text
Organization
    ↓
Department
    ↓
Team
    ↓
Group
```

The hierarchy depth must not be hard-coded.

---

# 6. Attendance Event Model

The core unit is an **attendance event**, not merely a Present/Absent flag.

Supported statuses:

```text
PRESENT
ABSENT
LATE
EARLY
EARLY_LEAVE
CHECK_IN
CHECK_OUT
BREAK_START
BREAK_END
PARTIAL
EXCUSED
LEAVE
REMOTE
FIELD_WORK
OFFICIAL_DUTY
OVERTIME
UNKNOWN
SUSPICIOUS
REJECTED
PENDING_REVIEW
MISSING_CHECKOUT
```

Organizations should be able to define additional business statuses where needed.

---

# 7. Detection Technology Architecture

Use a **Detection Adapter / Provider architecture**.

Every detection source must produce a normalized internal detection event.

## 7.1 Identity Detection

- QR Code
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

## 7.2 Location Detection

- GPS
- Geofencing
- Wi-Fi
- Bluetooth
- BLE Beacon
- UWB
- Cellular Location
- IP / Network Verification
- VPN

## 7.3 Device / System Detection

- Registered Mobile Device
- Registered Computer
- Web Login
- Mobile App
- SSO
- VPN Login
- Enterprise Login
- Workstation Login
- Access Control System
- Turnstile
- Smart Lock

## 7.4 Sensor / IoT Detection

- Motion Sensor
- Presence Sensor
- Seat Sensor
- Door Sensor
- Gate Sensor
- Camera
- CCTV
- IoT Device
- Number Plate Recognition

## 7.5 Digital / Remote Detection

- Web Session
- Mobile Session
- Online Class / Session
- Video Meeting Presence
- Application Session

## 7.6 Manual / Fallback Detection

- Teacher Mark
- Manager Mark
- Supervisor Mark
- Administrator Mark
- Kiosk
- Imported Attendance
- Paper-to-Digital Entry

---

# 8. Normalized Detection Event

All providers must eventually create a common internal representation.

Conceptually:

```text
DetectionEvent
├── event_id
├── organization_id
├── person_id (optional until identity is resolved)
├── device_id (optional)
├── session_id (optional)
├── detection_method
├── timestamp
├── timezone
├── location_data (optional)
├── identity_confidence (optional)
├── device_confidence (optional)
├── provider_reference
├── evidence_reference
├── metadata
└── processing_status
```

The exact schema may evolve, but all providers must use the same normalized event pipeline.

---

# 9. Multi-Method Verification

The system must support:

- AND logic
- OR logic
- Weighted logic
- Fallback logic
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
Face Recognition
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

The combination must be configurable through policies.

---

# 10. Attendance Policy Engine

A policy controls how attendance is evaluated.

A policy can define:

- Allowed detection methods
- Required detection methods
- Optional detection methods
- Allowed locations
- Geofence radius
- Allowed devices
- Allowed time
- Grace period
- Required confidence
- Duplicate handling
- Fallback behavior
- Review behavior
- Late rules
- Early-leave rules
- Checkout requirements
- Leave interaction

### Example: University

```text
Dynamic QR = Required
GPS = Required
Registered Device = Required
Geofence Radius = 50 meters
Grace Period = 10 minutes
```

### Example: Factory

```text
RFID = Required
Face = Required
Shift = Required
Gate = Supporting Evidence
```

### Example: Remote Worker

```text
SSO = Required
Registered Device = Required
VPN = Required
```

---

# 11. Rule Engine

Rules must be configurable rather than hard-coded.

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
IF location is outside allowed zone
THEN REJECT
```

```text
IF verification_confidence < threshold
THEN PENDING_REVIEW
```

```text
IF attendance_rate < configured_threshold
THEN CREATE_WARNING
```

Rule inputs can include:

- Person
- Role
- Organization
- Department
- Group
- Location
- Schedule
- Shift
- Date
- Time
- Detection method
- Device
- Verification score
- Leave
- Holiday
- Previous attendance
- Current session

User-configurable rules must use a safe structured representation. Do not execute arbitrary user-provided server-side code.

---

# 12. Confidence Engine

Each detection can contribute evidence.

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

Example thresholds:

```text
90–100 → VERIFIED
75–89  → VALID
50–74  → REVIEW
20–49  → SUSPICIOUS
0–19   → REJECTED
```

Weights and thresholds must be configurable.

The system must preserve the calculation details, not only the final score.

---

# 13. Attendance Evidence

Every attendance decision should be explainable.

Evidence may include:

- Detection method
- QR token ID
- Device ID
- Location verification
- Identity verification
- Timestamp
- Policy version
- Rule results
- Confidence calculation
- Manual operator
- Provider reference

The system should be able to answer:

> Why was this person marked present?

and:

> Why was this attendance rejected?

---

# 14. Dynamic QR System

Dynamic QR should support:

- Short expiration
- Session binding
- Organization binding
- Optional location binding
- Optional device binding
- Replay protection
- Duplicate-scan prevention
- Server-side validation
- Rate limiting

Permanent predictable QR tokens must not be the only security mechanism.

---

# 15. Location Verification

Support:

- GPS point
- Radius geofence
- Polygon zones where appropriate
- Wi-Fi validation
- BLE beacon validation
- IP/network validation
- VPN validation
- Optional indoor positioning providers

Location must never be treated as automatically trustworthy.

Store enough verification information to audit the decision.

---

# 16. Schedule Engine

Support:

- Fixed schedules
- Class schedules
- Shift schedules
- Rotating shifts
- Flexible schedules
- Split shifts
- Overnight shifts
- One-time sessions
- Recurring sessions
- Event schedules
- Remote schedules
- Field schedules
- No-fixed-schedule mode

Handle:

- Midnight crossing
- Time zones
- Daylight-saving changes where applicable
- Grace periods
- Late thresholds
- Early-leave thresholds
- Breaks
- Holidays
- Weekends
- Schedule exceptions

---

# 17. Check-In / Check-Out Engine

Support:

- Check-in
- Check-out
- Break start
- Break end
- Multiple check-ins
- Multiple check-outs
- Overnight shifts
- Split shifts
- Missing check-out
- Manual corrections

Calculate:

- Working duration
- Break duration
- Late duration
- Early-leave duration
- Overtime

Do not assume one check-in and one check-out per day.

---

# 18. Leave Management

Configurable leave types:

- Annual
- Medical
- Casual
- Emergency
- Academic
- Official Duty
- Remote Work
- Maternity
- Paternity
- Custom

Workflow:

```text
Leave Request
    ↓
Approver
    ↓
Approved / Rejected
    ↓
Attendance Engine
```

Approved leave must be distinguished from ordinary absence.

---

# 19. Visitor Management

Visitor lifecycle:

```text
Visitor Registration
    ↓
Host Assignment
    ↓
Reason / Purpose
    ↓
Allowed Location
    ↓
Temporary Pass
    ↓
Entry
    ↓
Exit
```

Temporary visitor credentials must expire automatically.

---

# 20. Device Management

Devices are first-class entities.

Store:

- Device ID
- Organization ID
- Location ID
- Device Type
- Serial Number
- Status
- IP/network information where appropriate
- Last Seen
- Firmware information where applicable
- Assigned Policy
- Device Credential
- Configuration

Possible device types:

- Mobile
- Web
- RFID Reader
- NFC Reader
- Fingerprint Reader
- Face Terminal
- Camera
- Kiosk
- Gate
- Turnstile
- Beacon
- IoT Device
- Access Control Device

---

# 21. Offline Attendance

When a supported client/device loses connectivity:

```text
Device
  ↓
Offline
  ↓
Secure local event queue
  ↓
Original timestamp preserved
  ↓
Connection restored
  ↓
Synchronization
  ↓
Duplicate / conflict validation
  ↓
Policy evaluation
  ↓
Final result
```

Offline synchronization must not silently overwrite conflicts.

---

# 22. Fraud and Anomaly Detection

Detect or flag:

- Duplicate attendance
- QR replay
- Expired QR
- Shared QR behavior
- Invalid device
- GPS anomalies
- Impossible travel
- Face mismatch
- RFID / Face mismatch
- Multiple people using one device
- Repeated failed authentication
- Suspicious timing
- Abnormal attendance patterns
- Unexpected device behavior

Suspicious records should be retained and marked for review instead of silently deleted.

---

# 23. Audit System

Audit sensitive actions such as:

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
- Leave approval/rejection
- Report generation
- Export
- Organization changes
- Security events

For attendance corrections record:

```text
Previous value
New value
Actor
Timestamp
Reason
Source
```

Historical attendance must remain explainable.

---

# 24. Biometric Architecture

Biometric functionality must be modular.

Use provider abstractions.

Do not tightly couple the system to one vendor.

Do not casually store raw biometric media.

Separate biometric-related information from normal profile data.

Use:

- Encryption
- Authorization
- Retention settings
- Deletion mechanisms
- Audit logging
- Provider abstraction
- Development mock provider

The platform must still work when biometrics are disabled.

---

# 25. Dashboard Structure

## Super Admin Dashboard

- Organizations
- Global users
- Active devices
- Current sessions
- System health
- Security events
- Global analytics

## Organization Admin Dashboard

- People
- Attendance
- Absent
- Late
- Leave
- Locations
- Devices
- Sessions
- Alerts
- Reports

## Manager / Teacher Dashboard

- Assigned groups
- Active sessions
- Attendance
- Corrections
- Reports

## User Dashboard

- Today's attendance
- Check-in
- Check-out
- Schedule
- Attendance history
- Leave
- Notifications

---

# 26. Analytics

Support:

- Attendance rate
- Absence rate
- Late rate
- Early-leave rate
- Working hours
- Overtime
- Leave statistics
- Department comparison
- Location comparison
- Session attendance
- Shift compliance
- Detection method statistics
- Suspicious attendance statistics

Charts must always respect the selected date range and filters.

---

# 27. Notifications

Support configurable alerts such as:

- Low attendance
- Late arrival
- Missing checkout
- Suspicious attendance
- Leave approval
- Leave rejection
- Schedule changes
- Device offline
- Device/security problems

Delivery abstraction:

- In-app
- Email
- SMS
- Push
- Webhook

---

# 28. Reporting

Reports:

- Daily attendance
- Weekly attendance
- Monthly attendance
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
- Detection method
- Suspicious attendance

Formats:

- PDF
- CSV
- Excel-compatible
- JSON

Large reports should use background jobs.

---

# 29. Recommended Core Database Entities

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

Use proper relationships, foreign keys, indexes, unique constraints, check constraints, transactions, and migrations.

---

# 30. Suggested Repository Architecture

```text
universal-attendance/
│
├── apps/
│   ├── web/
│   ├── api/
│   ├── mobile/
│   └── kiosk/
│
├── packages/
│   ├── shared-types/
│   ├── validation/
│   ├── auth/
│   ├── attendance-engine/
│   ├── rule-engine/
│   ├── detection-core/
│   ├── reporting/
│   └── ui/
│
├── services/
│   ├── notification-service/
│   ├── worker-service/
│   ├── device-service/
│   └── analytics-service/
│
├── database/
│   ├── migrations/
│   ├── seeds/
│   └── procedures/
│
├── infrastructure/
│   ├── docker/
│   ├── nginx/
│   └── monitoring/
│
├── docs/
│   ├── architecture/
│   ├── api/
│   ├── database/
│   ├── deployment/
│   └── security/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── security/
│
├── .env.example
├── docker-compose.yml
├── README.md
└── LICENSE
```

---

# 31. Security Architecture

Mandatory controls:

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
- Secret management through environment variables
- Audit logging
- Device authentication
- API authorization
- Safe file-upload validation

Never hard-code secrets.

---

# 32. Data Retention and Privacy

Make retention configurable for:

- Attendance events
- Audit records
- Provider metadata
- Biometric-related information
- Location evidence
- Visitor records

Sensitive information should have appropriate access control and encryption.

Provide controlled deletion or archival mechanisms.

---

# 33. Time and Timezone Model

The platform must support organization/location time zones.

Store timestamps consistently.

Correctly handle:

- Local attendance date
- Overnight shifts
- DST transitions where applicable
- Report periods
- Schedule boundaries

Never perform business logic using timezone-ambiguous local strings.

---

# 34. Product Design Principle

The most important architectural rule is:

> One attendance engine, many organizations, many rules, many detection methods.

The system must always be able to explain:

- Who was present?
- Where were they?
- When were they present?
- How were they detected?
- How was identity verified?
- Which policy was used?
- Which rules were evaluated?
- What evidence supports the decision?
- Who changed the record?
- When was it changed?

This explainability should be built into the data model, not added later.

---

# 35. Example Organization Configurations

## University

```text
Dynamic QR
+ GPS
+ Registered Device
→ Class Attendance
```

## School

```text
Gate Face/RFID
→ School Entry
+
Classroom Attendance
```

## Corporate Office

```text
Face/RFID Gate
+
Registered Computer Login
+
Optional Network Verification
```

## Factory

```text
RFID
+
Face
+
Shift
+
Gate
```

## Hospital

```text
Staff Card
+
Hospital Location
+
Shift Schedule
```

## Construction

```text
Face Selfie
+
GPS
+
Project Geofence
```

## Delivery Team

```text
Mobile Authentication
+
Route/Location
+
Operational Activity
```

## Remote Work

```text
SSO
+
Registered Device
+
VPN
+
Configured Work Session
```

## Event

```text
Registration
→ Ticket QR
→ Entry Scan
→ Session Scan
→ Exit
```

---

# 36. Universal Architecture Diagram

```text
                  UNIVERSAL ATTENDANCE PLATFORM
                              │
                       Identity System
                              │
           ┌──────────────────┼──────────────────┐
           │                  │                  │
      Organizations        People             Devices
           │                  │                  │
     Locations/Units       Roles            IoT / Apps
           └──────────────────┼──────────────────┘
                              ↓
                      Schedule Engine
                              ↓
                      Attendance Session
                              ↓
       ┌───────────┬─────────┼─────────┬───────────┐
       │           │         │         │           │
      QR         RFID      NFC       GPS        Face
       │           │         │         │           │
       ├───────────┼─────────┼─────────┼───────────┤
       │           │         │         │           │
    Fingerprint  Wi-Fi    BLE/UWB    IoT       Manual
       └───────────┴─────────┼─────────┴───────────┘
                              ↓
                       Evidence Collector
                              ↓
                       Verification Engine
                              ↓
                    Policy / Rule Evaluation
                              ↓
                      Confidence Engine
                              ↓
                      Attendance Engine
                              ↓
             ┌────────────────┼────────────────┐
             │                │                │
          Reports          Analytics        Alerts
```

---

# 37. Recommended Development Strategy

Build the platform in this order:

1. Multi-tenancy
2. Authentication and RBAC
3. Organizations and people
4. Locations and groups
5. Schedules and shifts
6. Attendance sessions and engine
7. Detection abstraction
8. Dynamic QR
9. GPS/geofence
10. Registered device verification
11. Policy and rule engine
12. Evidence and confidence
13. Leave and visitors
14. Device management
15. Offline synchronization
16. Fraud detection
17. Audit
18. Notifications
19. Reports and analytics
20. Hardware provider adapters
21. Security hardening
22. Performance optimization
23. Automated testing
24. Documentation
25. Deployment

---

# 38. Definition of a Truly Universal System

The system is only genuinely universal when a new organization can be configured mostly through:

- Roles
- Units
- Locations
- Schedules
- Policies
- Detection providers
- Rules
- Notifications

rather than requiring new attendance logic to be programmed for every organization.

The universal engine should stay stable while configuration changes around it.

---

# 39. Account & Identity Lifecycle

Authentication (Section 31) covers session/token security in the abstract. The full account lifecycle must also exist:

- Email verification
- Forgot-password / reset-password (expiring tokens)
- Multi-factor authentication (MFA) for privileged roles
- Account lockout after repeated failed logins, with unlock path
- Person invitation flow (invite by email/SMS, time-limited token, invitee sets own credentials)
- Self-registration flow, gated by organization policy (useful for events, gyms, clubs)

---

# 40. Tenant Onboarding & Billing

The platform is multi-tenant SaaS (Section 3). Organization creation and monetization need explicit structure:

```text
Organization Sign-Up
    ↓
Onboarding Checklist
    ↓
Subscription Plan (trial / active / past-due / suspended / cancelled)
    ↓
Feature Flags + Resource Quotas
    ↓
Billing Events
```

- Plan tiers gate features and quotas (max people, devices, locations, API calls)
- Payment provider is abstracted, not hard-coded
- Downgrades never silently delete data

Billing status gates access. It never participates in attendance calculation logic.

---

# 41. Extensibility / Custom Fields

Section 29 (database rules, in the Master Prompt) forbids one giant table and forbids misusing JSON in place of relational modeling. Custom attributes are still needed per organization, resolved as:

```text
custom_field_definitions
  organization_id, entity_type, field_key, field_label, field_type, required, validation_rule

custom_field_values
  organization_id, entity_type, entity_id, field_key, value
```

- Core entities (`persons`, `locations`, `devices`) stay normalized and stable
- Values are validated against their definition at write time
- Custom fields are data only — never executable logic, consistent with the safe rule engine in Section 11

---

# 42. Bulk Import / Export & Invitations

Beyond development seed data, organizations need real onboarding tools:

- CSV/Excel bulk import of people: column mapping, per-row validation, per-row error reporting, dry-run preview before commit
- Bulk invitation sending
- Bulk export of organization data for migration/backup, distinct from analytical reports (Section 28)
- All import/export actions are tenant-scoped and audited (Sections 3, 23)

---

# 43. Privacy, Consent & Compliance

Biometric protection (Section 24) covers encryption/retention/deletion. Consent and data-subject rights are the missing legal layer (GDPR, CCPA, BIPA, and similar):

```text
Consent Capture (per person, per data category)
    ↓
Consent Version + Timestamp Stored
    ↓
Withdrawal → Disables that detection method for that person
    ↓
Data Subject Access Request → Export person's data
    ↓
Right to Erasure → Delete/anonymize personal data
    while preserving audit/attendance integrity where legally required
```

- Consent and data-rights actions are themselves audited (Section 23)
- Data residency should be documented per organization/region, with region-pinned storage where required

---

# 44. Internationalization & Accessibility

The platform targets many organization types across many regions (Section 1), so localization is core, not optional:

- UI i18n framework: externalized strings, language switching, right-to-left layout support
- Locale-aware date/time/number formatting, consistent with the timezone model (Section 33)
- Organization-level default language and person-level language preference
- Accessibility baseline (keyboard navigation, screen-reader labels, color contrast) across all dashboard screens (Section 25)

---

# 45. External System Integration

Outbound webhooks (Section 27, notifications) are one channel. Attendance data also needs structured integration with adjacent systems, using the same provider-abstraction pattern as detection (Section 7):

- Payroll export (hours, overtime, leave)
- HRIS/employee-directory sync
- LMS/SIS integration for academic organizations (rosters, session schedules)
- Access-control/security-system integration

Requirements:

- Machine-readable API contract (OpenAPI/Swagger)
- API versioning strategy
- Integration failures are logged and retryable, not silently dropped

---

# 46. Operational Readiness

Beyond logging and health endpoints, production operation requires:

- Backup strategy with defined RPO/RTO, and a tested restore procedure
- CI/CD pipeline with separate staging and production environments
- Concrete performance targets (requests/second for ingestion, concurrent devices, dashboard query latency) rather than qualitative goals
- Scheduled/automated report delivery in addition to on-demand generation (Section 28)

---

# 47. Shared / Kiosk Device Architecture

"Kiosk" appears as a manual/fallback method (Section 7.6), but a shared physical device has distinct requirements:

```text
Kiosk Device (single, shared)
    ↓
Person A identifies (PIN/card/face/QR) → event → queue clears
    ↓
Person B identifies → event → queue clears
    ↓
...
```

- Per-person identification is distinct from the kiosk's own device authentication
- Timeout/queue handling prevents one slow interaction from corrupting the next
- Kiosk offline queueing (Section 21) is tagged with the kiosk's device ID, not an individual's device ID

---

# 48. Real-Time Monitoring

Realtime infrastructure (Section 2) enables a concrete feature: a live session monitor for Manager/Teacher/Supervisor dashboards (Section 25) showing:

- Attendance events arriving in real time for an active session
- Live present/absent/pending-review counts
- Manual correction triggered from the live view, following the same audited correction path (Sections 11, 23)

---

# 49. Additional Database Entities

Extend Section 29 with:

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

device_tokens
scheduled_reports
```

Same normalization, foreign-key, and tenant-isolation rules as the rest of Section 29 apply.

---

# 50. Updated Definition of a Truly Universal System

In addition to Section 38, the system is only genuinely complete when it also supports, without core-engine changes:

- Full account lifecycle (verification, reset, MFA, lockout)
- Self-service tenant onboarding with plan/quota enforcement
- Per-organization custom fields
- Bulk import/export with row-level validation
- Consent capture/withdrawal and data subject access/erasure
- A second UI language proving the i18n framework works
- At least one external integration (payroll, HRIS, or LMS) via the provider abstraction
- A tested backup/restore procedure and CI/CD pipeline
- A kiosk flow handling multiple sequential people on one device
- A working live real-time session monitor

The universal engine stays stable; everything above is configuration and provider abstraction around it — never a rewrite of the attendance engine itself.
