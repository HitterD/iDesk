# iDesk Kubernetes Deployment

**Status:** Optional production follow-up. Docker Compose on Linux remains primary deployment.

## 1. Deployment model

```text
Ingress
  ├── frontend Service -> frontend Deployment
  └── /api -> backend Service -> backend Deployment

backend -> PostgreSQL
backend -> Redis
```

Recommended production topology:

- Run frontend/backend workloads in Kubernetes.
- Use managed/external PostgreSQL and Redis when available.
- Store endpoints and credentials in Kubernetes Secrets or an external secret manager.
- Use self-hosted PostgreSQL/Redis only with explicit backup, restore, replication, RPO, and RTO plans.

## 2. Prerequisites on Linux

- Kubernetes or k3s cluster.
- `kubectl` configured for target cluster.
- Private container registry.
- Ingress controller.
- StorageClass if stateful services run inside cluster.
- `metrics-server` if HPA is enabled.
- `cert-manager` or another TLS certificate workflow for HTTPS.
- PostgreSQL and Redis endpoints reachable from cluster.

Verify tools:

```bash
kubectl version --client
kubectl cluster-info
kubectl get nodes
kubectl get ingressclass
```

## 3. Resolve port contract before deployment

Current repository has a port mismatch:

- `apps/backend/src/main.ts` listens on `5050`.
- `apps/backend/Dockerfile` exposes `3001`.
- `docker-compose.yml` publishes `3001:3001`.
- `README.md` documents backend port `5050`.

Choose one internal container port and update Dockerfile, Compose, healthchecks, frontend proxy, Swagger URL, and Kubernetes manifests atomically. Recommended internal port: `5050`, because application code and README already use it.

Do not deploy Kubernetes until this contract is tested end to end.

## 4. Build immutable images

Run from repository root:

```bash
docker build -f apps/backend/Dockerfile -t registry.example/idesk-backend:<git-sha> .
docker build -f apps/frontend/Dockerfile -t registry.example/idesk-frontend:<git-sha> .
docker push registry.example/idesk-backend:<git-sha>
docker push registry.example/idesk-frontend:<git-sha>
```

Use immutable Git SHA tags. Do not deploy `latest` in production.

Confirm images:

```bash
docker image inspect registry.example/idesk-backend:<git-sha>
docker image inspect registry.example/idesk-frontend:<git-sha>
```

Images must run as non-root and must not contain `.env`, private keys, passwords, refresh tokens, or build artifacts that expose secrets.

## 5. Suggested repository layout

```text
deploy/
├── compose/
│   ├── docker-compose.yml
│   ├── docker-compose.db.yml
│   ├── .env.example
│   └── OPERATIONS.md
└── k8s/
    ├── base/
    │   ├── namespace.yaml
    │   ├── backend-deployment.yaml
    │   ├── backend-service.yaml
    │   ├── frontend-deployment.yaml
    │   ├── frontend-service.yaml
    │   ├── ingress.yaml
    │   ├── configmap.yaml
    │   ├── network-policy.yaml
    │   └── kustomization.yaml
    └── overlays/
        ├── staging/
        └── production/
            └── migration-job.yaml
```

Use Kustomize first. Helm is unnecessary until environment count or parameter complexity justifies it.

## 6. Create namespace

```bash
kubectl apply -f deploy/k8s/base/namespace.yaml
kubectl get namespace idesk-prod
```

Use separate namespaces for staging and production, for example `idesk-staging` and `idesk-prod`.

## 7. Configure secrets safely

Never commit plaintext Secret manifests. Create secrets through a secret manager or secure CI step. Example only:

```bash
kubectl -n idesk-prod create secret generic idesk-backend-secrets \
  --from-literal=JWT_SECRET='<strong-random-value>' \
  --from-literal=DB_USERNAME='<db-user>' \
  --from-literal=DB_PASSWORD='<db-password>' \
  --from-literal=DB_DATABASE='idesk_db' \
  --from-literal=DB_HOST='<postgres-host>' \
  --from-literal=DB_PORT='5432' \
  --from-literal=REDIS_HOST='<redis-host>' \
  --from-literal=REDIS_PORT='6379' \
  --from-literal=REDIS_PASSWORD='<redis-password>'
```

Add SMTP, Telegram, cookie-domain, and other required secrets using the same secure mechanism. Production config must fail startup when required secrets are absent.

Check that secret names exist without printing values:

```bash
kubectl -n idesk-prod get secret idesk-backend-secrets
```

## 8. Apply non-secret configuration and policy

```bash
kubectl apply -k deploy/k8s/overlays/staging
```

For production, inspect rendered manifests first:

```bash
kubectl kustomize deploy/k8s/overlays/production
```

Review:

- image tags;
- namespace;
- service ports;
- environment variable names;
- resource requests/limits;
- probes;
- Ingress hosts/TLS;
- NetworkPolicy selectors;
- security contexts.

Then apply:

```bash
kubectl apply -k deploy/k8s/overlays/production
```

## 9. Database migration

Run migrations as a controlled Kubernetes Job before application rollout. The Job must be idempotent and use the same image/version as the backend release.

```bash
kubectl -n idesk-prod apply -f deploy/k8s/overlays/production/migration-job.yaml
kubectl -n idesk-prod wait --for=condition=complete job/idesk-migration --timeout=300s
kubectl -n idesk-prod logs job/idesk-migration
```

Do not run destructive migration automatically in an application container startup hook. Back up the database before irreversible schema changes.

## 10. Deploy backend and frontend

```bash
kubectl -n idesk-prod apply -k deploy/k8s/overlays/production
kubectl -n idesk-prod rollout status deployment/idesk-backend --timeout=300s
kubectl -n idesk-prod rollout status deployment/idesk-frontend --timeout=300s
```

Inspect workload status:

```bash
kubectl -n idesk-prod get deploy,pods,svc,ingress
kubectl -n idesk-prod describe deployment/idesk-backend
kubectl -n idesk-prod logs deployment/idesk-backend --all-containers=true --tail=200
```

## 11. Health and readiness contract

Backend should expose separate endpoints or equivalent probe behavior:

- **Startup:** process boot and configuration initialization.
- **Liveness:** process is alive.
- **Readiness:** required DB and Redis dependencies are ready and authenticated.

Do not mark backend Ready when Redis is required for refresh-token security but unavailable. Do not make liveness depend on transient external services or Kubernetes can enter a restart loop.

Example checks:

```bash
kubectl -n idesk-prod get pods
kubectl -n idesk-prod port-forward svc/idesk-backend 5050:5050
curl -fsS http://127.0.0.1:5050/health
```

Adjust endpoint and port to the final application contract.

## 12. Ingress and TLS

Ingress must:

- terminate TLS;
- route frontend traffic to frontend Service;
- route API traffic to backend Service;
- set request size/timeouts appropriate for uploads;
- avoid exposing PostgreSQL or Redis Services publicly;
- use production hostnames and certificate policy.

Verify:

```bash
kubectl -n idesk-prod get ingress
curl -fsSI https://<production-host>/
curl -fsSI https://<production-host>/api/health
```

## 13. Security controls

Apply these controls before production:

- non-root containers;
- dropped Linux capabilities;
- read-only root filesystem where images support it;
- `seccompProfile: RuntimeDefault`;
- resource requests and limits;
- NetworkPolicy allowing only required traffic;
- least-privilege ServiceAccount;
- no public Redis/PostgreSQL Service;
- immutable image tags;
- Secret manager or sealed/external secrets;
- log redaction for password, JWT, refresh token, cookie, and full identifier values.

## 14. Scaling and availability

Add HPA only after metrics-server and load baseline exist:

```bash
kubectl -n idesk-prod get hpa
kubectl -n idesk-prod describe hpa idesk-backend
```

Recommended later controls:

- backend HPA based on CPU and measured request metrics;
- PodDisruptionBudget;
- anti-affinity/topology spread for multiple nodes;
- rolling update strategy with minimum availability;
- graceful shutdown and connection draining.

One backend replica, one PostgreSQL pod, or one Redis pod is not high availability.

## 15. Backup and restore

For external managed services, follow provider backup and restore procedures. For self-hosted stateful services:

- PostgreSQL backup runs off-cluster;
- Redis AOF/RDB backup runs off-cluster;
- backup credentials are separate from runtime credentials;
- restore is tested on a schedule;
- RPO/RTO are documented;
- backup success/failure is monitored.

Do not claim production readiness from PVC persistence alone.

## 16. Smoke test after deployment

Run in staging first, then production canary:

1. frontend loads over HTTPS;
2. backend health passes;
3. login with email works;
4. NIK/HRIS flow works or fails closed during simulated outage;
5. refresh rotates token;
6. replayed refresh token is rejected and family invalidated;
7. logout clears session;
8. password change invalidates old sessions;
9. Redis outage produces intended readiness/error behavior;
10. database queries and ticket read/write smoke pass;
11. no secret appears in logs;
12. TLS and Ingress route correctly.

## 17. Rollback

If application rollout fails:

```bash
kubectl -n idesk-prod rollout history deployment/idesk-backend
kubectl -n idesk-prod rollout undo deployment/idesk-backend
kubectl -n idesk-prod rollout status deployment/idesk-backend --timeout=300s
```

Rollback rules:

- application rollback is safe only when schema remains backward compatible;
- never roll back past an irreversible migration without a tested database recovery plan;
- invalidate refresh sessions if token storage/claims changed incompatibly;
- record deployed image tag, migration version, and operator/time in release notes.

## 18. Production gate

Kubernetes production deployment is approved only when:

- port contract is consistent;
- images are immutable and non-root;
- migration Job is tested;
- readiness/liveness/startup probes are tested;
- Secrets are not committed or logged;
- Redis authentication, TTL, persistence, and failure mode are tested;
- backup and restore drill passes for self-hosted state;
- TLS/Ingress/NetworkPolicy are verified;
- staging smoke tests pass;
- rollback procedure has been rehearsed.
