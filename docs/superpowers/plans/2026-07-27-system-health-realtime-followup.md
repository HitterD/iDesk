# System Health Realtime Follow-up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memperbaiki payload RAM realtime, recovery Redis, telemetry queue fallback, Redis health API, dan stale clock pada System Health yang sudah ada.

**Architecture:** Tetap gunakan `HealthSamplerService` sebagai pemilik sampling dan Redis client persisten. Fast payload membawa total RAM lengkap; lifecycle Redis mengosongkan reference client mati agar fast tier berikutnya membuat client baru. Frontend memakai satu clock state untuk uptime dan stale duration.

**Tech Stack:** NestJS 11, Socket.IO 4, ioredis 5, Jest 29, React 18, TypeScript, Vitest 4, React Testing Library.

## Global Constraints

- Jangan tambah dependency, Redis adapter, timer baru, atau abstraksi baru.
- Fast tier tetap `2_000` ms; slow tier tetap `30_000` ms; stale threshold tetap `6_000` ms.
- `HealthFastUpdate.memoryTotal` adalah field wajib number dalam setiap payload fast.
- Bila Redis client `end`, `close`, atau `PING` gagal, clear reference hanya bila identity client masih sama.
- Fast tier berikutnya membuat client Redis baru; recovery target maksimal 2 detik, tanpa restart backend.
- Bila Redis mati, payload adalah `{ status: 'error' }`; CPU, RAM, DB, dan WebSocket sensor tetap berjalan.
- Queue telemetry selalu memuat enam queue ini, urutan tetap: `notifications`, `emails`, `file-processing`, `reports`, `zoom-meetings`, `google-sync`.
- Command queue Redis yang error/null menjadi `0`; Redis detail seluruhnya boleh `undefined` bila Redis tidak tersedia.
- `checkRedisHealth()` tidak boleh membuka koneksi Redis baru; harus membaca snapshot sampler.
- `clockNow` adalah satu-satunya sumber waktu stale pada hook dan UI tidak boleh memanggil `Date.now()` untuk stale duration.
- Jangan mengubah `CacheService.get()` sinkron, autentikasi gateway `/health`, atau `.env.example`.

---

## Struktur Berkas

| Berkas | Peran |
|---|---|
| `apps/backend/src/modules/health/dto/health.dto.ts` | Tambah total RAM ke kontrak fast payload. |
| `apps/backend/src/modules/health/health-sampler.service.ts` | Teruskan total RAM dan buat Redis client pulih setelah terminal failure. |
| `apps/backend/src/modules/health/health-sampler.service.spec.ts` | Uji payload RAM, recovery Redis, dan fallback pipeline enam queue. |
| `apps/backend/src/modules/health/health.service.ts` | Baca Redis health dari snapshot sampler. |
| `apps/backend/src/modules/health/health.service.spec.ts` | Uji delegasi Redis health ke snapshot. |
| `apps/frontend/src/features/admin/hooks/useHealthSocket.ts` | Merge `memoryTotal`, hitung `isStale`/`staleSeconds` dari `clockNow`. |
| `apps/frontend/src/features/admin/hooks/__tests__/useHealthSocket.test.tsx` | Uji RAM fast payload dan stale seconds dengan fake timer. |
| `apps/frontend/src/features/admin/pages/SystemHealthPage.tsx` | Berikan stale duration dari hook ke `LivePulse`. |
| `apps/frontend/src/features/admin/pages/__tests__/SystemHealthPage.test.tsx` | Uji Memory stat memakai total dan penggunaan positif. |

## Kontrak Antar Task

Task backend menambah tipe ini di `health.dto.ts`:

```ts
export interface HealthFastUpdate {
    serverTime: string;
    uptime: number;
    cpuUsage: number;
    memoryUsage: number;
    memoryTotal: number;
    memoryFree: number;
    loadAverage: number[];
    database: InfrastructureStatus['database'];
    redis: InfrastructureStatus['redis'];
    websocket: InfrastructureStatus['websocket'];
}
```

Task frontend mengembalikan kontrak hook berikut:

```ts
export interface UseHealthSocketReturn {
    healthData: DetailedHealthStatus | null;
    uptime: number;
    history: HealthHistory;
    isStale: boolean;
    staleSeconds: number;
    isConnected: boolean;
    isSubscribed: boolean;
    lastUpdate: Date | null;
    incidents: SystemIncident[];
    connect: () => void;
    disconnect: () => void;
    subscribe: () => void;
    unsubscribe: () => void;
}
```

---

### Task 1: Perbaiki backend memory payload, Redis lifecycle, dan Redis health API

**Files:**
- Modify: `apps/backend/src/modules/health/dto/health.dto.ts:102-112`
- Modify: `apps/backend/src/modules/health/health-sampler.service.ts:31-155, 196-207, 316-361`
- Modify: `apps/backend/src/modules/health/health.service.ts:144-174`
- Test: `apps/backend/src/modules/health/health-sampler.service.spec.ts`
- Test: `apps/backend/src/modules/health/health.service.spec.ts`

**Interfaces:**
- Consumes: `HealthService.getFastSystemMetrics(): Promise<Omit<SystemMetrics, 'diskUsage' | 'diskTotal' | 'diskFree'>>`.
- Produces: fast update dengan `memoryTotal`, snapshot dengan total RAM aktual, dan `checkRedisHealth(): Promise<{ status: 'connected' | 'disabled' | 'error'; latency?: number }>`.

- [ ] **Step 1: Tulis test backend yang gagal untuk RAM dan Redis snapshot**

Tambahkan test ini ke `health-sampler.service.spec.ts`:

```ts
it('copies memoryTotal to fast update and snapshot', async () => {
    const sampler = new HealthSamplerService(healthService as any, gateway as any, {
        get: jest.fn().mockReturnValue('false'),
    } as unknown as ConfigService);

    healthService.getFastSystemMetrics.mockResolvedValue({
        cpuUsage: 12, memoryUsage: 40, memoryTotal: 1_000, memoryFree: 600,
        platform: 'win32', arch: 'x64', nodeVersion: 'v24', loadAverage: [0, 0, 0],
    });

    await sampler.refreshFastTier();

    expect(sampler.getFastUpdate().memoryTotal).toBe(1_000);
    expect(sampler.getSnapshot().system.memoryTotal).toBe(1_000);
});
```

Tambahkan test ini ke `health.service.spec.ts`:

```ts
it('returns Redis health from the sampler snapshot', async () => {
    const dataSource = { query: jest.fn() } as unknown as DataSource;
    const sampler = {
        getSnapshot: jest.fn().mockReturnValue({
            infrastructure: { redis: { status: 'connected', latency: 4 } },
        }),
    };
    const service = new HealthService(
        dataSource,
        { get: jest.fn() } as unknown as ConfigService,
        sampler as any,
    );

    await expect(service.checkRedisHealth()).resolves.toEqual({ status: 'connected', latency: 4 });
    expect(dataSource.query).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run:

```bash
cd apps/backend && npx jest src/modules/health/health-sampler.service.spec.ts src/modules/health/health.service.spec.ts --runInBand
```

Expected: FAIL pada `memoryTotal` karena `HealthFastUpdate` dan fast snapshot belum memilikinya. Bila `node_modules` belum ada, command gagal dengan `jest is not recognized`; jalankan `npm ci` di `apps/backend`, lalu ulangi command yang sama.

- [ ] **Step 3: Tambahkan `memoryTotal` ke seluruh jalur fast payload**

Di `health.dto.ts`, tambah tepat satu field setelah `memoryUsage`:

```ts
memoryTotal: number;
```

Di `health-sampler.service.ts`:

1. Tambahkan `memoryTotal: 0` pada initial `fastSnapshot`.
2. Tambahkan `memoryTotal: 0` pada fallback `metrics` di `refreshFastTier()`.
3. Simpan `metrics.memoryTotal` saat menyusun `this.fastSnapshot`.
4. `getSnapshot()` gunakan `this.fastSnapshot.memoryTotal`, bukan literal `0`.
5. `getFastUpdate()` sertakan `memoryTotal: this.fastSnapshot.memoryTotal`.

Target kode:

```ts
this.fastSnapshot = {
    serverTime,
    uptime: process.uptime(),
    cpuUsage: metrics.cpuUsage,
    memoryUsage: metrics.memoryUsage,
    memoryTotal: metrics.memoryTotal,
    memoryFree: metrics.memoryFree,
    loadAverage: metrics.loadAverage,
    database,
    redis: { ...redis, detail: this.slowSnapshot.redisDetail },
    websocket: { status: 'active', clients: this.healthService.getWsClientCount() },
};
```

Tambahkan accessor `getWsClientCount(): number` ke `HealthService` dan gunakan itu, bukan cast `(this.healthService as any).wsClientCount`.

- [ ] **Step 4: Buat Redis terminal failure dapat membuat client baru**

Tambah helper privat di `HealthSamplerService`:

```ts
private clearRedisClient(client: any): void {
    if (this.redisClient === client) {
        this.redisClient = null;
    }
}
```

Di `createRedisClient()`, simpan object lokal lalu pasang listener sebelum `PING`:

```ts
const client = new Redis(options);
this.redisClient = client;
client.on('error', (error: Error) => {
    this.logger.warn(`Redis health client error: ${error.message}`);
});
client.once('end', () => this.clearRedisClient(client));
client.once('close', () => {
    if (client.status === 'end') this.clearRedisClient(client);
});

try {
    await client.ping();
} catch (error) {
    this.clearRedisClient(client);
    throw error;
}
```

Di fungsi lokal `pingRedis()` pada `refreshFastTier()`, tangkap gagal ping dan clear client yang diping sebelum lempar ulang supaya `Promise.allSettled` tetap menghasilkan Redis `error`:

```ts
const client = this.redisClient;
try {
    const start = Date.now();
    await client.ping();
    return { status: 'connected' as const, latency: Date.now() - start };
} catch (error) {
    this.clearRedisClient(client);
    throw error;
}
```

Jangan mengubah batas `retryStrategy` 10 attempt. Fast tier berikutnya akan membuat client baru karena `redisClient` sudah null.

- [ ] **Step 5: Ganti `checkRedisHealth()` yang salah dengan snapshot delegate**

Ganti isi `HealthService.checkRedisHealth()` dengan:

```ts
async checkRedisHealth(): Promise<{ status: 'connected' | 'disabled' | 'error'; latency?: number }> {
    const { status, latency } = this.sampler.getSnapshot().infrastructure.redis;
    return latency === undefined ? { status } : { status, latency };
}
```

Jangan ubah signature `getInfrastructureStatus()`; ia sudah memanggil method ini dan otomatis memakai snapshot Redis sesudah perubahan.

- [ ] **Step 6: Jalankan backend tests dan build**

Run:

```bash
cd apps/backend && npx jest src/modules/health/health-sampler.service.spec.ts src/modules/health/health.service.spec.ts --runInBand
npm run build
```

Expected: semua existing backend health tests plus dua test baru PASS; build exit 0.

- [ ] **Step 7: Commit backend payload dan lifecycle**

```bash
git add apps/backend/src/modules/health/dto/health.dto.ts \
  apps/backend/src/modules/health/health-sampler.service.ts \
  apps/backend/src/modules/health/health-sampler.service.spec.ts \
  apps/backend/src/modules/health/health.service.ts \
  apps/backend/src/modules/health/health.service.spec.ts
git commit -m "fix(health): restore memory payload and Redis recovery"
```

---

### Task 2: Uji recovery Redis dan fallback pipeline secara aktual

**Files:**
- Modify: `apps/backend/src/modules/health/health-sampler.service.spec.ts`

**Interfaces:**
- Consumes: `HealthSamplerService.refreshFastTier()`, `refreshSlowTier()`, `getSlowUpdate()`.
- Produces: test regression untuk recovery client dan queue fallback enam nama.

- [ ] **Step 1: Tulis mock ioredis terkendali dan test yang gagal**

Di awal test file, tambahkan mock constructor ioredis. Mock harus menyediakan `on`, `once`, `ping`, `pipeline`, `quit`, dan `status`:

```ts
const redisClients: any[] = [];
const RedisMock = jest.fn().mockImplementation(() => {
    const client = {
        status: 'ready',
        on: jest.fn(),
        once: jest.fn(),
        ping: jest.fn().mockResolvedValue('PONG'),
        pipeline: jest.fn(),
        quit: jest.fn().mockResolvedValue('OK'),
    };
    redisClients.push(client);
    return client;
});

jest.mock('ioredis', () => RedisMock);
```

Tambahkan recovery test:

```ts
it('recreates the Redis client after a failed ping', async () => {
    const config = {
        get: jest.fn((key: string, fallback?: unknown) => key === 'REDIS_ENABLED' ? 'true' : fallback),
    } as unknown as ConfigService;
    const sampler = new HealthSamplerService(healthService as any, gateway as any, config);

    await sampler.onModuleInit();
    const firstClient = redisClients[0];
    firstClient.ping.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    await sampler.refreshFastTier();
    await sampler.refreshFastTier();

    expect(RedisMock).toHaveBeenCalledTimes(2);
    expect(sampler.getFastUpdate().redis.status).toBe('connected');
});
```

Tambahkan queue fallback test dengan pipeline responses. Untuk setiap queue berikan tiga tuple `[error, value]`; minimal satu `Error` dan satu `null`:

```ts
it('returns all monitored queues and zeroes failed pipeline values', async () => {
    const config = {
        get: jest.fn((key: string, fallback?: unknown) => key === 'REDIS_ENABLED' ? 'true' : fallback),
    } as unknown as ConfigService;
    const sampler = new HealthSamplerService(healthService as any, gateway as any, config);
    await sampler.onModuleInit();
    const client = redisClients.at(-1);
    const pipeline = {
        info: jest.fn().mockReturnThis(), dbsize: jest.fn().mockReturnThis(),
        llen: jest.fn().mockReturnThis(), scard: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
            [null, 'used_memory:2048\r\n'], [null, 9],
            [null, 3], [new Error('active failed'), null], [null, 1],
            [null, 0], [null, 0], [null, 0],
            [null, 2], [null, 4], [null, 0],
            [null, 0], [null, 0], [null, 0],
            [null, 8], [null, 1], [null, 0],
            [null, 0], [null, 0], [null, 0],
        ]),
    };
    client.pipeline.mockReturnValue(pipeline);

    await sampler.refreshSlowTier();

    expect(sampler.getSlowUpdate().redisDetail).toEqual({
        usedMemory: 2048,
        keys: 9,
        queues: [
            { name: 'notifications', waiting: 3, active: 0, failed: 1 },
            { name: 'emails', waiting: 0, active: 0, failed: 0 },
            { name: 'file-processing', waiting: 2, active: 4, failed: 0 },
            { name: 'reports', waiting: 0, active: 0, failed: 0 },
            { name: 'zoom-meetings', waiting: 8, active: 1, failed: 0 },
            { name: 'google-sync', waiting: 0, active: 0, failed: 0 },
        ],
    });
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run:

```bash
cd apps/backend && npx jest src/modules/health/health-sampler.service.spec.ts --runInBand
```

Expected: recovery test FAIL jika client reference belum dibersihkan; queue test FAIL jika `[Error, null]` menjadi null/non-number atau test lama masih satu-satunya assertion.

- [ ] **Step 3: Pastikan parser pipeline menangani error dan null sebagai nol**

Di `getRedisDetail()`, tambahkan helper lokal yang hanya menerima finite number:

```ts
const resultNumber = (result: [Error | null, unknown] | undefined): number => {
    const value = result?.[1];
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
};
```

Pakai helper itu untuk `keys`, `waiting`, `active`, `failed`. Jangan cast `results[index]?.[1] as number` langsung. Tetap parse `used_memory` hanya bila `results[0]?.[0]` null dan response string valid; selain itu gunakan `0`.

```ts
const memoryInfo = results[0]?.[0] ? '' : String(results[0]?.[1] ?? '');
const usedMemory = Number(memoryInfo.match(/^used_memory:(\d+)$/m)?.[1] ?? 0);
```

- [ ] **Step 4: Jalankan test sampler dan build**

Run:

```bash
cd apps/backend && npx jest src/modules/health/health-sampler.service.spec.ts --runInBand
npm run build
```

Expected: semua sampler tests PASS; test queue membuktikan enam nama dan fallback nilai; build exit 0.

- [ ] **Step 5: Commit test hardening Redis telemetry**

```bash
git add apps/backend/src/modules/health/health-sampler.service.ts \
  apps/backend/src/modules/health/health-sampler.service.spec.ts
git commit -m "test(health): cover Redis recovery and queue fallbacks"
```

---

### Task 3: Perbaiki frontend fast memory merge dan stale clock deterministik

**Files:**
- Modify: `apps/frontend/src/features/admin/hooks/useHealthSocket.ts:88-129, 162-180, 212-237, 314-327`
- Modify: `apps/frontend/src/features/admin/pages/SystemHealthPage.tsx:161-190, 257-262`
- Test: `apps/frontend/src/features/admin/hooks/__tests__/useHealthSocket.test.tsx`
- Test: `apps/frontend/src/features/admin/pages/__tests__/SystemHealthPage.test.tsx`

**Interfaces:**
- Consumes: backend `HealthFastUpdate` dengan `memoryTotal`.
- Produces: `UseHealthSocketReturn.staleSeconds: number`; `LivePulse` menerima `staleSeconds`.

- [ ] **Step 1: Tambah test hook dan page yang gagal**

Tambahkan `memoryTotal: 100` ke fast update pada test existing `ticks uptime locally and resyncs on a fast update`, lalu assert:

```ts
expect(result.current.healthData?.system.memoryTotal).toBe(100);
```

Tambahkan test stale duration:

```ts
it('increments staleSeconds from the shared clock', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useHealthSocket(true));
    act(() => handlers.get('health:snapshot')?.(snapshot));

    act(() => vi.advanceTimersByTime(7_000));

    expect(result.current.isStale).toBe(true);
    expect(result.current.staleSeconds).toBe(7);

    act(() => vi.advanceTimersByTime(2_000));

    expect(result.current.staleSeconds).toBe(9);
});
```

Di `SystemHealthPage.test.tsx`, assert stat Memory yang positif:

```tsx
expect(screen.getByText('200 B / 1000 B')).toBeInTheDocument();
```

- [ ] **Step 2: Jalankan frontend tests untuk memastikan gagal**

Run:

```bash
cd apps/frontend && npx vitest run src/features/admin/hooks/__tests__/useHealthSocket.test.tsx src/features/admin/pages/__tests__/SystemHealthPage.test.tsx --pool=forks
```

Expected: FAIL karena fast handler belum merge `memoryTotal`, hook belum expose `staleSeconds`, dan page belum menerima prop baru.

- [ ] **Step 3: Merge total RAM dan hitung stale dari `clockNow`**

Di `HealthFastUpdate`, tambahkan field:

```ts
memoryTotal: number;
```

Di listener `health:fast`, tambah:

```ts
memoryTotal: update.memoryTotal,
```

pada object `system` yang di-merge.

Ganti stale expression dengan:

```ts
const isStale = Boolean(
    lastFastUpdate && clockNow - lastFastUpdate > STALE_THRESHOLD_MS,
);
const staleSeconds = lastFastUpdate
    ? Math.floor((clockNow - lastFastUpdate) / 1_000)
    : 0;
```

Tambahkan `staleSeconds` ke return hook. `clockNow` sekarang dipakai oleh expression; jangan hapus interval, karena interval yang sama juga menjaga uptime berjalan.

- [ ] **Step 4: Buat `LivePulse` memakai stale duration dari hook**

Ubah props:

```ts
const LivePulse: React.FC<{
    isConnected: boolean;
    isSubscribed: boolean;
    isStale: boolean;
    staleSeconds: number;
}> = ({ isConnected, isSubscribed, isStale, staleSeconds }) => {
```

Hapus `lastUpdate` prop dan seluruh `Date.now()` dari `LivePulse`. Ganti tampilan:

```tsx
<span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
    Stale {staleSeconds}s
</span>
```

Destructure `staleSeconds` dari hook lalu teruskan ke `LivePulse`.

- [ ] **Step 5: Jalankan frontend tests dan build**

Run:

```bash
cd apps/frontend && npx vitest run src/features/admin/hooks/__tests__/useHealthSocket.test.tsx src/features/admin/pages/__tests__/SystemHealthPage.test.tsx --pool=forks
npm run build
```

Expected: 6 frontend health tests PASS (empat existing + dua baru); build exit 0.

- [ ] **Step 6: Commit frontend follow-up**

```bash
git add apps/frontend/src/features/admin/hooks/useHealthSocket.ts \
  apps/frontend/src/features/admin/hooks/__tests__/useHealthSocket.test.tsx \
  apps/frontend/src/features/admin/pages/SystemHealthPage.tsx \
  apps/frontend/src/features/admin/pages/__tests__/SystemHealthPage.test.tsx
git commit -m "fix(health): keep realtime memory and stale state accurate"
```

---

### Task 4: Verifikasi integrasi Redis recovery dan payload hidup

**Files:**
- Modify locally only: `apps/backend/.env:46` bila Redis belum aktif.
- No commit: `.env` lokal tidak boleh masuk Git.

**Interfaces:**
- Consumes: health endpoint `/v1/health/detailed`, container `idesk-redis`, Redis config lokal.
- Produces: bukti runtime Redis recovery tanpa restart backend.

- [ ] **Step 1: Pastikan dependency backend dan Redis dev tersedia**

Run:

```bash
cd apps/backend
if [ ! -x node_modules/.bin/jest ]; then npm ci; fi
grep -nE '^REDIS_(ENABLED|HOST|PORT|PASSWORD)=' .env
cd ../..
docker ps --format '{{.Names}} {{.Status}}' | grep idesk-redis
```

Expected: backend `node_modules/.bin/jest` ada setelah command; `idesk-redis` healthy. Bila `REDIS_ENABLED=false`, ubah hanya line itu menjadi `REDIS_ENABLED=true` dan restart backend dev.

- [ ] **Step 2: Verifikasi normal payload**

Run:

```bash
curl -s http://localhost:5050/v1/health/detailed
```

Expected JSON:

```json
{
  "system": {
    "memoryTotal": 1,
    "memoryFree": 1
  },
  "infrastructure": {
    "redis": {
      "status": "connected"
    }
  }
}
```

Nilai memory aktual lebih besar dari nol; `memoryTotal >= memoryFree`; Redis latency dapat nol atau lebih. Buka UI dan pastikan Memory tidak negatif serta uptime bergerak setiap detik.

- [ ] **Step 3: Verifikasi Redis stop/recovery**

Run:

```bash
docker stop idesk-redis
# Tunggu minimal 3 detik untuk fast tier.
curl -s http://localhost:5050/v1/health/detailed
docker start idesk-redis
# Tunggu minimal 3 detik untuk fast tier.
curl -s http://localhost:5050/v1/health/detailed
```

Expected urutan:

1. Setelah stop, `infrastructure.redis.status` adalah `error`; DB tetap `connected`; CPU/RAM tetap angka valid.
2. Setelah start, Redis kembali `connected` tanpa backend restart.
3. Slow tier berikutnya menampilkan `redis.detail.queues` berisi enam queue dengan `waiting`, `active`, `failed` berbentuk number.

- [ ] **Step 4: Jalankan regression akhir**

Run:

```bash
cd apps/backend && npx jest src/modules/health/health-sampler.service.spec.ts src/modules/health/health.service.spec.ts --runInBand && npm run build
cd ../frontend && npx vitest run src/features/admin/hooks/__tests__/useHealthSocket.test.tsx src/features/admin/pages/__tests__/SystemHealthPage.test.tsx --pool=forks && npm run build
```

Expected: semua command exit 0.

- [ ] **Step 5: Catat hasil tanpa mengubah scope**

Laporan akhir wajib menyebut:

- command dan hasil test/build aktual;
- Redis failure/recovery aktual;
- `CacheService.get()` sinkron belum diperbaiki dan masih perlu audit sebelum Redis cache production;
- `.env` tetap lokal dan tidak di-commit.

---

## Cakupan Self-Review

| Requirement spec | Task |
|---|---|
| `memoryTotal` pada fast payload/snapshot/UI | Task 1, Task 3 |
| Redis reference clear dan client recreate ≤2s | Task 1, Task 2, Task 4 |
| Enam queue dan command fallback `0` | Task 2 |
| `checkRedisHealth()` memakai snapshot | Task 1 |
| `clockNow` sebagai stale source | Task 3 |
| Backend/frontend test serta runtime recovery | Task 1-4 |
| Tidak ubah CacheService/auth/env example | Global Constraints, Task 4 |

Placeholder scan: tidak ada `TBD`, `TODO`, atau langkah tanpa kode, test, atau command. Nama field/interface konsisten dengan kontrak di awal plan.
