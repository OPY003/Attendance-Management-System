# Project Lock

**Locked baseline:** 2026-09-12  
**Scope:** Phase 1 foundation through Phase 6 (Foundation, Core Entities, Schedules, Detection, Policies, Leave, Devices, Visitors, and Offline Synchronization)  
**Status:** Phase 6 complete; ready for Phase 7  

## Verified Baseline

- `npm run build` passes with zero TypeScript compilation errors across all workspaces (`@uapms/shared-types`, `@uapms/validation`, `@uapms/rule-engine-core`, `@uapms/api`).
- The repository test suite passes with **81 / 81 passing tests across 13 test suites (0 failures)**.
- The repository is on `main` and tracks `origin/main`.

## Included In This Lock

- **Phase 1 Foundation**: Authentication, MFA, account recovery, account lockout, RBAC, multi-tenant isolation, security middleware, and audit trails.
- **Phase 2 Core Entities**: People, locations, departments, groups, device registration, credential rotation, and bulk person import.
- **Phase 3 Schedules & Presence**: Schedules, shifts, attendance sessions, attendance records, and presence engine.
- **Phase 4/5 Detection & Policy**: Detection abstraction (Dynamic QR, GPS geofencing, device fingerprinting), confidence engine, rule engine, policy evaluation, and evidence trail.
- **Phase 6 Operational Continuity & Extended Entities**:
  - **Leave Management**: Leave types, quota allocation, leave requests, approval workflow, and status validation.
  - **Device Management & Authentication**: Device registration, credential verification middleware (`authenticateDevice`), and API key rotation.
  - **Visitor Management**: Visitor pre-registration, temporary credentials, dynamic QR passes, time window enforcement, allowed location validation, check-in/out, and cancellation.
  - **Offline Synchronization**: Queued event batch ingestion, original client-timestamp preservation, idempotency / duplicate detection, conflict / impossible travel detection, and audit logging.
- **Documentation**: Architecture, API reference, security policy, and completion specifications in `docs/`.

## Next Phase Scope (Phase 7+)

- Advanced Fraud Detection (QR replay, impossible travel heuristics across web/mobile).
- System-wide Notifications & Webhooks.
- Scheduled & ad-hoc Reporting & Analytics.
- Biometric & physical access adapter connectors.
- Production readiness: cloud secrets management, HTTPS termination, database backups, and load testing.

## Unlock Criteria

Make changes only when starting Phase 7, fixing a verified defect/security issue, or updating deployment configuration. Update this file whenever the locked baseline changes.
