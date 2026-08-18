# Telemetry and MFA Dependency Inventory

## Scope

Audit recommendations 12 (TOTP MFA) and 17 (OpenTelemetry) require dependencies and operational contracts not currently present in backend.

## Evidence

- `apps/backend/package.json` has no `@opentelemetry/*`, `otplib`, `speakeasy`, `qrcode`, or other TOTP package.
- `apps/backend/package-lock.json` has no matching OpenTelemetry, TOTP, MFA, or QR package entries.
- `apps/backend/src/modules/users/entities/user.entity.ts` has no MFA secret, enrollment state, verification timestamp, or backup-code fields.
- `apps/backend/src/modules/auth/application/auth.service.ts` issues access and refresh tokens after password/HRIS validation. Refresh calls the same session issuance path.
- `apps/backend/src/main.ts` has correlation middleware and logging, but no telemetry bootstrap or exporter configuration.
- Existing `AUTH_MFA_REQUIRED` enum/message is only an error contract; it is not an MFA implementation.

## Decision

Status: **needs evidence; not implemented**.

Do not add OpenTelemetry or TOTP packages until deployment owner approves:

1. Collector/exporter endpoint and ownership.
2. Sampling, retention, and data-classification policy.
3. TOTP library and QR/provisioning contract.
4. MFA schema ownership and rollback window.

## Required future gates

### OpenTelemetry

- Inventory and approve minimum official packages.
- Redact password, token, cookie, authorization, NIK, raw SQL parameters, and secrets.
- Exporter outage must not block requests or startup.
- Add config/redaction tests and runtime smoke evidence.

### TOTP MFA

- Store encrypted TOTP secret separately from password and never plaintext in logs.
- Store hashed one-time backup codes with atomic consumption.
- Add enrollment, verification, disable, recovery, challenge TTL, and rate limits.
- Enforce MFA before access/refresh session issuance for both email and NIK/HRIS login.
- Prevent refresh from bypassing an incomplete MFA challenge.
- Add migration, backup, restore, replay, invalidation, and rollback evidence.

No performance or security-impact percentage is claimed from this inventory.
