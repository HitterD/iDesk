# iDesk Migration and Rollback Matrix

**Date:** 2026-08-03
**Scope:** Phase 0 planning baseline. Migration filenames/timestamps are reserved by implementation plan; no schema migration executed in this phase.

| Change | Precondition | Forward action | Compatibility window | Rollback | Session/data rule |
|---|---|---|---|---|---|
| Redis refresh preparation | PostgreSQL backup, Redis auth/health pass, session count recorded | `1785000000000-PrepareRefreshSessionCutover` (guarded `ADD COLUMN IF NOT EXISTS`, logs legacy session count only) | `legacy`/`dual` until Redis reconciliation passes | Disable Redis mode, restore prior app image; leave legacy hash column | No raw refresh token stored; preserve legacy hash during window |
| Redis refresh cutover | `REDIS_ENABLED=true` (enforced by `assertRefreshSessionConfig` at boot), Redis restore tested | `AUTH_REFRESH_SESSION_MODE=dual` first (dual-write; pre-cutover tokens without `tokenId`/`familyId` still honoured via legacy column), then `redis` (source of truth, atomic consume + family invalidation, claim-less tokens refused) | One release window, with reconciliation counts | Set mode back to `dual`/`legacy` and return to previous compatible app; `redis` → forced reauthentication for pre-cutover tokens | Never accept consumed/reused token after cutover |
| Remove `hashedRefreshToken` | Cutover and rollback window pass; no legacy reads; `AUTH_LEGACY_REFRESH_DROP=confirmed` set deliberately | `1785000001000-RemoveLegacyRefreshTokenColumn` — no-op without the env gate (records itself as run, column intact), so re-run `migration:run` with the gate set; no new migration needed | None after release gate | `down` restores the column definition only (hashes are credentials, not regenerable); restore DB backup for contents | Users reauthenticate if restore invalidates sessions |
| Evidence-based index | Query plan and duplicate-index review pass | Add exact guarded index migration | Backward-compatible | Revert migration after traffic check, restore backup if needed | No authorization behavior change |
| MFA fields | Encryption key configured and backup tested | Add nullable encrypted secret/status/recovery hash columns | Feature flag disabled until E2E passes | Revert migration before enablement | Existing sessions unchanged until MFA policy explicitly enabled |
| API `/v1` | Route/client inventory complete | Serve `/v1` alongside documented legacy routes | Deprecation window until repository clients migrate | Disable versioned route config and retain legacy route | Cookie names/claims remain compatible |
| Port contract | Docker/Compose/frontend proxy/health references updated together | Use internal `5050` and test `/health/live` | Release-specific | Revert app/image and Compose atomically | Do not deploy mixed `3001`/`5050` contract |
| Kubernetes migration Job | Backup and rendered manifest review pass | Run same release image migration Job before rollout | Per release | Roll back app only if schema backward-compatible | Never roll back irreversible migration without restore |

## Refresh-session cutover: no data migration

`users.hashedRefreshToken` holds a bcrypt hash of one token per user, with no `tokenId`,
`familyId`, or digest. No active session can be translated into the Redis schema, so there is
no data migration. `dual` mode is the bridge instead: pre-cutover tokens keep working through
the legacy column while every new session is written to both stores. Switching to `redis`
refuses claim-less tokens, which is the approved forced-invalidation path — those users log in
again once.

## Required commands before schema changes

```bash
npm run migration:show --prefix apps/backend
```

Create PostgreSQL backup and verify restore in disposable environment. Record migration version, image tag, operator, time, backup identifier, and session invalidation result in release evidence. No destructive migration runs from application startup.
