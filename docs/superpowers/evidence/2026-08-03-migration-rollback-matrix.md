# iDesk Migration and Rollback Matrix

**Date:** 2026-08-03
**Scope:** Phase 0 planning baseline. Migration filenames/timestamps are reserved by implementation plan; no schema migration executed in this phase.

| Change | Precondition | Forward action | Compatibility window | Rollback | Session/data rule |
|---|---|---|---|---|---|
| Redis refresh preparation | PostgreSQL backup, Redis auth/health pass, session count recorded | Add mode/config and any guarded metadata migration | `legacy`/`dual` until Redis reconciliation passes | Disable Redis mode, restore prior app image; leave legacy hash column | No raw refresh token stored; preserve legacy hash during window |
| Redis refresh cutover | Dual-read/dual-write or approved forced invalidation, Redis restore tested | Set Redis source of truth; atomic consume and family invalidation active | One release window, with reconciliation counts | Return to previous compatible app only; invalidate sessions if claims/storage differ | Never accept consumed/reused token after cutover |
| Remove `hashedRefreshToken` | Cutover and rollback window pass; no legacy reads | Drop legacy column via guarded migration | None after release gate | Restore DB backup; do not fake app rollback across irreversible schema | Users reauthenticate if restore invalidates sessions |
| Evidence-based index | Query plan and duplicate-index review pass | Add exact guarded index migration | Backward-compatible | Revert migration after traffic check, restore backup if needed | No authorization behavior change |
| MFA fields | Encryption key configured and backup tested | Add nullable encrypted secret/status/recovery hash columns | Feature flag disabled until E2E passes | Revert migration before enablement | Existing sessions unchanged until MFA policy explicitly enabled |
| API `/v1` | Route/client inventory complete | Serve `/v1` alongside documented legacy routes | Deprecation window until repository clients migrate | Disable versioned route config and retain legacy route | Cookie names/claims remain compatible |
| Port contract | Docker/Compose/frontend proxy/health references updated together | Use internal `5050` and test `/health/live` | Release-specific | Revert app/image and Compose atomically | Do not deploy mixed `3001`/`5050` contract |
| Kubernetes migration Job | Backup and rendered manifest review pass | Run same release image migration Job before rollout | Per release | Roll back app only if schema backward-compatible | Never roll back irreversible migration without restore |

## Required commands before schema changes

```bash
npm run migration:show --prefix apps/backend
```

Create PostgreSQL backup and verify restore in disposable environment. Record migration version, image tag, operator, time, backup identifier, and session invalidation result in release evidence. No destructive migration runs from application startup.
