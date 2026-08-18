# PostgreSQL Recovery Evidence

## Symptom

`docker-compose.db.yml` PostgreSQL container exited during startup. Full Compose status was initially blocked by missing required application encryption variables, so database-only Compose was used for diagnosis.

## Root cause

`backups/postgres` contained a PostgreSQL cluster whose `pg_control` reported a clean shutdown, but PostgreSQL startup logged:

- `invalid primary checkpoint record`
- `PANIC: could not locate a valid checkpoint record`

Read-only `pg_controldata` and `pg_resetwal --dry-run` confirmed WAL recovery state. No destructive operation was run against original data.

## Recovery method

1. Created isolated PostgreSQL 15 recovery container and empty bind-mounted recovery directory.
2. Restored `backups/idesk_db_pre_redis_20260804_140354.sql` into isolated cluster.
3. Verified restored data: `users = 4773`, public tables `= 65`.
4. Stopped recovery container.
5. Moved original `backups/postgres` to `backups/postgres_corrupt_20260805` for quarantine.
6. Activated recovered directory as `backups/postgres`.
7. Started database-only Compose without `-v` or volume deletion.

## Current verification

- Container: `idesk-postgres`
- Status: healthy
- Published port: `5454`
- Query: `current_database() = idesk_db`, `users = 4773`
- TCP probe: `127.0.0.1:5454` succeeds
- Redis container remained running and healthy

Original cluster remains preserved at `backups/postgres_corrupt_20260805`. Do not delete it until backup/recovery review completes.
