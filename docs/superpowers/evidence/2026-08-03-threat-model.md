# iDesk Audit Hardening Threat Model

**Date:** 2026-08-03
**Scope:** Phase 0 security baseline. Controls below describe planned verification, not completed fixes.

| Threat | Asset | Entry point | Current control | Planned control | Detection | Residual risk |
|---|---|---|---|---|---|---|
| User-enumeration timing | Account existence | Email login | Error codes and audit log | Always run bcrypt comparison with precomputed dummy hash | Compare missing/existing login latency and bcrypt call count | Database lookup latency can still vary; measure before/after |
| Refresh-token replay | Active session | Refresh cookie | JWT signature/expiry and one bcrypt hash per user | Redis token ID/family, atomic consume, reuse family invalidation | `auth.refresh.reuse` metric and audit event | Redis outage must fail closed; operational Redis availability remains dependency |
| Brute force | Credentials | Login/register/reset/refresh | Endpoint throttles | IP + account limits with trusted proxy policy | Throttle rejection counters and masked audit records | Distributed attackers require broader detection and account policy |
| Proxy IP spoofing | Rate-limit identity | Forwarded headers | Existing framework request IP behavior | Explicit trusted proxy count/CIDR; ignore untrusted forwarded values | Tests with trusted/untrusted proxy fixtures | Misconfigured production proxy can lower limiter accuracy |
| Cookie theft/scope | Access/refresh session | Browser cookie | HttpOnly, production Secure, SameSite strict | Centralized set/clear options, explicit domain/path contract | Cookie parity integration test and redacted log scan | XSS or host compromise remains outside cookie flags |
| HRIS outage/fallback abuse | Authentication decision | NIK login | Axios timeout; transport errors return `null`; local fallback path exists | Fail closed by default, classify invalid/ineligible/unavailable, no provisioning on unknown state | HRIS error metric and outage test | Availability impact during genuine HRIS outage |
| Redis outage | Refresh authorization state | Refresh endpoint | Existing cache fallback can disable Redis | Security state never falls back to memory; controlled generic failure | Redis health/readiness and refresh failure metric | Users may require re-login during incident/cutover |
| Password policy bypass | User credentials | Register/change/reset | Length checks differ by DTO | One policy: minimum 12, maximum, complexity, common-password and user-info rejection | DTO/service validation tests | Existing weak passwords remain until changed by policy |
| Secret leakage | Passwords, JWTs, cookies, NIK | Logs/audit/telemetry | Partial audit logging | Recursive redaction and masked identifiers | Secret scan plus redaction tests | Third-party logs require separate retention/access review |
| MFA recovery abuse | MFA enrollment/session | Enrollment, verify, recovery | No MFA currently | TOTP, encrypted secret, hashed one-time backup codes, rate limits | MFA failure/reuse metrics and audit events | Account recovery support process remains operational risk |
| Schema rollback failure | User/session data | Migrations/deployments | TypeORM migration commands | Backup, compatibility window, migration Job, restore drill | Migration ledger and release evidence | Irreversible changes require tested restore, not app rollback |

## Security decisions

- HRIS outage default: fail closed. Do not silently treat transport failure as invalid credential or provision a user.
- Redis refresh state is authorization state. In-memory fallback is not acceptable for refresh validation.
- Audit and telemetry receive masked identifiers and bounded labels only.
- Error responses remain generic where changing detail would enumerate accounts or break clients.
- MFA first implementation is TOTP only. SMS is excluded.
