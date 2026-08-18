# Compose Operations on Linux

Operational runbook for the iDesk stack on a Linux host using Docker Compose.
Applies to `docker-compose.yml` (production, full stack) and `docker-compose.db.yml`
(development, PostgreSQL + Redis only).

**Never echo secret values.** Every command below reads secrets from `.env` or prompts
the shell; none of them print a password to stdout or to shell history.

---

## 1. Environment file

`.env` lives at the repository root, next to `docker-compose.yml`.

```bash
cp .env.example .env
chmod 600 .env
chown "$(id -u):$(id -g)" .env
```

Generate the required secrets (each command prints one new random value — paste it into
`.env`, do not commit it):

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"   # JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # REDIS_PASSWORD
```

Required, no default:

| Variable | Notes |
|---|---|
| `DB_USERNAME` | Required for PostgreSQL and backend connection. |
| `DB_PASSWORD` | Required; no known-password fallback. |
| `DB_DATABASE` | Required database name. |
| `REDIS_PASSWORD` | Compose fails to start if unset or empty. |
| `JWT_SECRET` | Compose fails to start if unset or empty. |
| `ENCRYPTION_KEY` | Required 32-byte hex credential key. |
| `EFORM_ENCRYPTION_KEY` | Required 32-byte hex E-Form key. |
| `FRONTEND_URL` | Required production CORS origin. |
| `WS_CORS_ORIGIN` | Required production WebSocket origin. |

Relevant defaults: `REDIS_ENABLED=true` (fixed in the production file),
`AUTH_REFRESH_SESSION_MODE=legacy`.

Verify `.env` is not world-readable and is ignored by git:

```bash
stat -c '%a %U:%G %n' .env      # expect 600
git check-ignore -v .env        # expect a .gitignore match
```

## 2. Host volume ownership

Both files bind-mount host directories, so the host ownership must match the container
users. In the Alpine images PostgreSQL runs as `70:70` and Redis as `999:1000` (verify with
`docker run --rm postgres:15-alpine id postgres` and `docker run --rm redis:7-alpine id redis`).

```bash
mkdir -p backups/postgres backups/redis
sudo chown -R 70:70 backups/postgres
sudo chown -R 999:1000 backups/redis
sudo chmod 700 backups/postgres backups/redis
```

## 3. Validate before starting

`config` interpolates every variable and fails loudly on a missing required one — run it
after any `.env` or Compose change.

```bash
docker compose config --quiet          # production; silent = valid
docker compose -f docker-compose.db.yml config --quiet
```

A missing `REDIS_PASSWORD` produces:

```
required variable REDIS_PASSWORD is missing a value: REDIS_PASSWORD must be set and non-empty
```

## 4. Startup and restart

```bash
# Production, full stack
docker compose up -d
docker compose ps                       # every service should be healthy/running

# Development databases only
docker compose -f docker-compose.db.yml up -d
```

Restart a single service (Redis keeps its AOF on the mounted volume):

```bash
docker compose restart redis
docker compose logs --tail=50 redis
```

Redis is `restart: unless-stopped`, so the daemon brings it back after a host reboot or a
crash. An explicit `docker compose stop redis` stays stopped until you start it again.

Application probes:

```bash
curl -fsS localhost:5050/v1/health/live     # liveness, no dependencies
curl -isS localhost:5050/v1/health/ready    # 200 when ready, 503 when a required dep is down
```

`/health/ready` requires PostgreSQL always, and Redis only when
`AUTH_REFRESH_SESSION_MODE` is `dual` or `redis` (refresh-session security state lives in
Redis in those modes). The response body has the same shape for 200 and 503.

## 5. Authenticated redis-cli

Redis has no published host port in production; reach it through the container. The
password comes from the container's own environment, so it never appears in the command
or in shell history:

```bash
docker compose exec redis sh -lc 'redis-cli --no-auth-warning -a "$REDIS_PASSWORD" ping'
docker compose exec redis sh -lc 'redis-cli --no-auth-warning -a "$REDIS_PASSWORD" info memory'
docker compose exec redis sh -lc 'redis-cli --no-auth-warning -a "$REDIS_PASSWORD" dbsize'
```

Count refresh sessions without dumping their contents:

```bash
docker compose exec redis sh -lc \
  'redis-cli --no-auth-warning -a "$REDIS_PASSWORD" --scan --pattern "auth:refresh:*" | wc -l'
```

Never run `FLUSHDB` or `FLUSHALL` against a shared Redis: it destroys every active refresh
session and forces all users to log in again.

## 6. Backup

### Redis (AOF)

Force a rewrite, wait for it to finish, then copy the append-only directory:

```bash
docker compose exec redis sh -lc 'redis-cli --no-auth-warning -a "$REDIS_PASSWORD" bgrewriteaof'
docker compose exec redis sh -lc \
  'redis-cli --no-auth-warning -a "$REDIS_PASSWORD" info persistence | grep aof_rewrite_in_progress'
# proceed once aof_rewrite_in_progress:0

sudo tar -czf "redis-aof-$(date +%F-%H%M).tar.gz" -C backups/redis .
```

### PostgreSQL

```bash
docker compose exec -T postgres sh -lc \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -F c' > "idesk-$(date +%F-%H%M).dump"
```

Store both archives off-host with the same 600 permissions as `.env`.

## 7. Restore

Order matters — restore the database first, then Redis, then start the application.

1. Stop the application so nothing writes during the restore:
   ```bash
   docker compose stop backend frontend
   ```
2. Restore PostgreSQL into the running database:
   ```bash
   docker compose exec -T postgres sh -lc \
     'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' < idesk-<timestamp>.dump
   ```
3. Restore the Redis AOF with Redis stopped, so it is not overwritten on shutdown:
   ```bash
   docker compose stop redis
   sudo rm -rf backups/redis/*
   sudo tar -xzf redis-aof-<timestamp>.tar.gz -C backups/redis
   sudo chown -R 999:1000 backups/redis
   docker compose up -d redis
   ```
4. Verify both dependencies, then start the application:
   ```bash
   docker compose exec redis sh -lc 'redis-cli --no-auth-warning -a "$REDIS_PASSWORD" ping'
   docker compose up -d backend frontend
   curl -isS localhost:5050/v1/health/ready
   ```

Restoring a Redis snapshot that predates the current tokens invalidates any refresh
session issued after the backup; affected users log in again. Access tokens stay valid
until they expire.

## 8. Rollback

### Roll back a Compose or `.env` change

```bash
git diff -- docker-compose.yml docker-compose.db.yml   # review before reverting
git checkout -- docker-compose.yml docker-compose.db.yml
docker compose config --quiet
docker compose up -d
```

### Roll back an application release

```bash
docker compose stop backend frontend
git checkout <previous-tag>
docker compose build backend frontend
docker compose up -d backend frontend
curl -isS localhost:5050/v1/health/ready
```

Migrations run at backend startup in production (`migrationsRun`), so a rollback across a
migration boundary needs the matching `down` migration applied before starting the older
image. Check `docs/superpowers/evidence/2026-08-03-migration-rollback-matrix.md` for the
per-migration rollback path.

### Roll back the refresh-session mode

`AUTH_REFRESH_SESSION_MODE` moves backwards safely only while the legacy column still
exists (`legacy` ← `dual` ← `redis`). Going back to `legacy` from `redis` invalidates
Redis-only sessions:

```bash
# edit AUTH_REFRESH_SESSION_MODE in .env
docker compose up -d backend
curl -isS localhost:5050/v1/health/ready
```
