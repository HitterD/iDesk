# System Health Realtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membuat System Health memantau sensor secara realtime dengan sampling dua tier, Redis telemetry, uptime per detik, dan sparkline 60 sampel tanpa memblokir event loop.

**Architecture:** `HealthSamplerService` menjadi satu pemilik jadwal, snapshot, riwayat, dan koneksi Redis persisten. Fast tier (2 detik) mengukur metrik ringan dan memancarkan delta; slow tier (30 detik) mengukur disk, service, backup, Redis detail, serta queue depth. Gateway hanya mengirim snapshot/delta Socket.IO; controller REST membaca snapshot yang sama tanpa menjalankan probe baru.

**Tech Stack:** NestJS 11, `@nestjs/schedule`, Socket.IO 4, TypeORM, ioredis 5, Node.js 24 `fs.promises.statfs`, React 18, TypeScript, TanStack Query, Vitest, React Testing Library, Jest.

## Global Constraints

- Fast tier tepat `2000` ms; slow tier tepat `30000` ms; data dianggap basi setelah `6000` ms.
- Ring buffer in-memory menyimpan tepat maksimal `60` sampel, urutan paling lama ke paling baru; tidak persisten lintas restart.
- Jangan tambah dependency. Gunakan `ioredis`, `@nestjs/bull`, `fs.promises.statfs`, dan `Sparkline` yang sudah terpasang.
- Jangan gunakan `child_process`, `wmic`, atau operasi file sinkron untuk sensor disk.
- `REDIS_ENABLED=false` wajib tetap berfungsi: tanpa Redis client dan `redis.status === 'disabled'`.
- Redis mati tidak boleh menghentikan sensor lain. Probe yang gagal harus memberi fallback berbentuk valid.
- API existing tetap kompatibel: `GET /v1/health/detailed` tetap mengembalikan `DetailedHealthStatus` lengkap, dari snapshot, tanpa memicu probe baru.
- Jangan mengubah `CacheService.get()` pada pekerjaan ini. Jalur sinkron itu selalu cache-miss saat Redis aktif dan perlu audit terpisah.
- Jangan tambah autentikasi khusus gateway `/health` pada pekerjaan ini; pola gateway saat ini belum memakai guard.
- Queue yang ditampilkan: `notifications`, `emails`, `file-processing`, `reports`, `zoom-meetings`, `google-sync`.
- Semua perubahan mengikuti indentasi 4 spasi backend dan gaya frontend yang ada.

---

## Struktur Berkas

| Berkas | Peran |
|---|---|
| `apps/backend/src/modules/health/dto/health.dto.ts` | Kontrak REST lama serta kontrak snapshot, fast delta, slow delta, riwayat, dan Redis queue telemetry. |
| `apps/backend/src/modules/health/health-sampler.service.ts` | Baru. Menjalankan dua tier, menyimpan snapshot/ring buffer, mengelola Redis client persisten, dan memancarkan event gateway. |
| `apps/backend/src/modules/health/health-sampler.service.spec.ts` | Unit test sampler: tier isolation, fallback, ring buffer, Redis disabled/error, incident. |
| `apps/backend/src/modules/health/health.service.ts` | Probe DB/service/backup/CPU/disk dan komposisi `DetailedHealthStatus` dari snapshot sampler. Tidak punya cron atau Redis client per-check. |
| `apps/backend/src/modules/health/health.service.spec.ts` | Unit test kompatibilitas REST: snapshot dipakai tanpa probe ulang. |
| `apps/backend/src/modules/health/health.gateway.ts` | Relay Socket.IO untuk `health:snapshot`, `health:fast`, `health:slow`, `health:incident`; tanpa interval probing. |
| `apps/backend/src/modules/health/health.module.ts` | Mendaftarkan dan mengekspor sampler; memakai `forwardRef` untuk siklus provider yang memang diperlukan. |
| `apps/backend/src/modules/health/health.controller.ts` | Endpoint versioned tetap membaca DTO dari HealthService/sampler. |
| `apps/backend/.env` | Mengaktifkan Redis pada lingkungan dev setelah kode lulus test. File lokal, tidak di-commit. |
| `apps/frontend/src/features/admin/hooks/useHealthSocket.ts` | Menggabungkan snapshot/delta, menyimpan history, menghitung uptime lokal tiap detik, dan menentukan `isStale`. |
| `apps/frontend/src/features/admin/hooks/__tests__/useHealthSocket.test.tsx` | Test Socket.IO mock, penggabungan payload, ring buffer, uptime tick, stale state. |
| `apps/frontend/src/features/admin/pages/SystemHealthPage.tsx` | Memakai uptime realtime/history/stale/Redis detail dan `Sparkline` yang sudah ada. |

## Kontrak Antar Komponen

Tambahkan kontrak berikut di `dto/health.dto.ts`; semua task berikut memakai nama tepat ini.

```ts
export const FAST_INTERVAL_MS = 2_000;
export const SLOW_INTERVAL_MS = 30_000;
export const HISTORY_SIZE = 60;

export interface RedisQueueDepth {
    name: string;
    waiting: number;
    active: number;
    failed: number;
}

export interface RedisDetail {
    usedMemory: number;
    keys: number;
    queues: RedisQueueDepth[];
}

export interface HealthHistory {
    cpu: number[];
    memory: number[];
    dbLatency: number[];
    redisLatency: number[];
}

export interface HealthFastUpdate {
    serverTime: string;
    uptime: number;
    cpuUsage: number;
    memoryUsage: number;
    memoryFree: number;
    loadAverage: number[];
    database: InfrastructureStatus['database'];
    redis: InfrastructureStatus['redis'];
    websocket: InfrastructureStatus['websocket'];
}

export interface HealthSlowUpdate {
    serverTime: string;
    status: DetailedHealthStatus['status'];
    disk: Pick<SystemMetrics, 'diskUsage' | 'diskTotal' | 'diskFree'>;
    services: ServiceStatus[];
    redisDetail?: RedisDetail;
    backup: InfrastructureStatus['backup'];
}

export interface HealthSnapshot extends DetailedHealthStatus {
    serverTime: string;
    history: HealthHistory;
    sampledAt: { fast: string; slow: string };
    redisDetail?: RedisDetail;
}
```

`InfrastructureStatus.redis` ditambah `detail?: RedisDetail`; `DetailedHealthStatus` tetap memiliki semua field lama, sehingga consumer REST lama tetap valid.

---

### Task 1: Tambah DTO realtime dan HealthSamplerService yang teruji

**Files:**
- Modify: `apps/backend/src/modules/health/dto/health.dto.ts`
- Modify: `apps/backend/src/modules/health/health.service.ts`
- Modify: `apps/backend/src/modules/health/health.gateway.ts`
- Create: `apps/backend/src/modules/health/health-sampler.service.ts`
- Create: `apps/backend/src/modules/health/health-sampler.service.spec.ts`

**Interfaces:**
- Consumes: probe public dari `HealthService` yang akan disediakan Task 2: `getFastSystemMetrics()`, `checkDatabaseHealth()`, `getDiskUsage()`, `checkBackupStatus()`, `getServicesStatus()`. Redis ping dan Redis detail adalah milik sampler, memakai client persisten yang sama.
- Consumes: `HealthGateway.pushFast(update)`, `pushSlow(update)`, `pushIncident(incident)` dari Task 3.
- Produces: `HealthSamplerService.getSnapshot(): HealthSnapshot`, `getFastUpdate(): HealthFastUpdate`, `getSlowUpdate(): HealthSlowUpdate`, `getHistory(): HealthHistory`, `refreshFastTier(): Promise<void>`, `refreshSlowTier(): Promise<void>`.

- [ ] **Step 1: Tambah kontrak DTO dan test sampler yang gagal**

Tambahkan konstanta dan interface pada bagian akhir `health.dto.ts` seperti kontrak di atas. Tulis `health-sampler.service.spec.ts` memakai mock plain object, bukan koneksi DB atau Redis sungguhan:

```ts
import { ConfigService } from '@nestjs/config';
import { HealthSamplerService } from './health-sampler.service';
import { HISTORY_SIZE } from './dto/health.dto';

describe('HealthSamplerService', () => {
    const healthService = {
        getFastSystemMetrics: jest.fn(),
        checkDatabaseHealth: jest.fn(),
        checkBackupStatus: jest.fn(),
        getServicesStatus: jest.fn(),
        getOverallStatus: jest.fn(),
        getRecentIncidents: jest.fn().mockReturnValue([]),
    };
    const gateway = {
        pushFast: jest.fn(),
        pushSlow: jest.fn(),
        pushIncident: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        healthService.getFastSystemMetrics.mockResolvedValue({
            cpuUsage: 12, memoryUsage: 40, memoryTotal: 1000, memoryFree: 600,
            diskUsage: 0, diskTotal: 0, diskFree: 0,
            platform: 'win32', arch: 'x64', nodeVersion: 'v24', loadAverage: [0, 0, 0],
        });
        healthService.checkDatabaseHealth.mockResolvedValue({ status: 'connected', latency: 3 });
        healthService.checkBackupStatus.mockResolvedValue({ configured: false });
        healthService.getServicesStatus.mockResolvedValue([]);
        healthService.getOverallStatus.mockReturnValue('ok');
    });

    it('refreshes fast probes without running slow probes', async () => {
        const sampler = new HealthSamplerService(
            healthService as any,
            gateway as any,
            { get: jest.fn().mockReturnValue('false') } as unknown as ConfigService,
        );

        await sampler.refreshFastTier();

        expect(healthService.getFastSystemMetrics).toHaveBeenCalledTimes(1);
        expect(healthService.checkDatabaseHealth).toHaveBeenCalledTimes(1);
        expect(healthService.getServicesStatus).not.toHaveBeenCalled();
        expect(gateway.pushFast).toHaveBeenCalledWith(expect.objectContaining({ uptime: expect.any(Number) }));
    });

    it('keeps only HISTORY_SIZE values in oldest-to-newest order', async () => {
        const sampler = new HealthSamplerService(healthService as any, gateway as any, {
            get: jest.fn().mockReturnValue('false'),
        } as unknown as ConfigService);

        for (let index = 0; index < HISTORY_SIZE + 1; index++) {
            healthService.getFastSystemMetrics.mockResolvedValueOnce({
                cpuUsage: index, memoryUsage: 40, memoryTotal: 1000, memoryFree: 600,
                platform: 'win32', arch: 'x64', nodeVersion: 'v24', loadAverage: [0, 0, 0],
            });
            await sampler.refreshFastTier();
        }

        expect(sampler.getHistory().cpu).toHaveLength(HISTORY_SIZE);
        expect(sampler.getHistory().cpu[0]).toBe(1);
        expect(sampler.getHistory().cpu.at(-1)).toBe(HISTORY_SIZE);
    });

    it('reports disabled Redis without constructing a client', async () => {
        const sampler = new HealthSamplerService(healthService as any, gateway as any, {
            get: jest.fn().mockReturnValue('false'),
        } as unknown as ConfigService);

        await sampler.refreshFastTier();

        expect(sampler.getFastUpdate().redis).toEqual({ status: 'disabled' });
    });

    it('keeps fast data valid when the database probe rejects', async () => {
        healthService.checkDatabaseHealth.mockRejectedValue(new Error('DB offline'));
        const sampler = new HealthSamplerService(healthService as any, gateway as any, {
            get: jest.fn().mockReturnValue('false'),
        } as unknown as ConfigService);

        await sampler.refreshFastTier();

        expect(sampler.getFastUpdate()).toEqual(expect.objectContaining({
            cpuUsage: 12,
            database: expect.objectContaining({ status: 'disconnected' }),
        }));
    });
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run:

```bash
cd apps/backend && npx jest src/modules/health/health-sampler.service.spec.ts --runInBand
```

Expected: FAIL karena `HealthSamplerService` belum ada dan DTO realtime belum diekspor.

- [ ] **Step 3: Pecah probe cepat dari pengukuran disk sebelum membuat sampler**

Di `health.service.ts`, ubah method publik yang sekarang bernama `getSystemMetrics()` menjadi `getFastSystemMetrics()` dan hapus pemanggilan `getDiskUsage()` dari method itu. Kembalikan hanya field CPU/RAM/platform/arch/Node/load average; disk akan diisi sampler pada slow tier. Tambahkan `getSystemMetrics()` tipis untuk consumer non-sampler bila masih dibutuhkan, yang menggabungkan `await getFastSystemMetrics()` dengan `await getDiskUsage()`.

Pada langkah ini juga jadikan `checkDatabaseHealth()`, `checkBackupStatus()`, `getServicesStatus()`, dan `getDiskUsage()` public agar sampler dapat memakainya dan TypeScript dapat build. Tambahkan `getOverallStatus()` dengan signature di Task 2. Jangan hapus `checkRedisHealth()` sampai Task 2, tetapi sampler tidak boleh memanggilnya.

```ts
async getFastSystemMetrics(): Promise<Omit<SystemMetrics, 'diskUsage' | 'diskTotal' | 'diskFree'>> {
    const cpuUsage = await this.getCpuUsage();
    const memoryTotal = os.totalmem();
    const memoryFree = os.freemem();
    return {
        cpuUsage: Math.round(cpuUsage * 100) / 100,
        memoryUsage: Math.round(((memoryTotal - memoryFree) / memoryTotal) * 10_000) / 100,
        memoryTotal,
        memoryFree,
        platform: os.platform(), arch: os.arch(), nodeVersion: process.version, loadAverage: os.loadavg(),
    };
}
```

Task 1 hanya menambah split fast dan tidak mengubah strategi `statfs`; penggantian `wmic` lengkap terjadi di Task 2.

- [ ] **Step 4: Tambah relay gateway yang dipanggil sampler**

Di `health.gateway.ts`, tambahkan import `HealthFastUpdate`, `HealthSlowUpdate`, dan `SystemIncident` dari DTO lalu tambah tiga method ini. Method tidak boleh memanggil HealthService atau melakukan probe:

```ts
pushFast(update: HealthFastUpdate): void {
    this.server?.to('health-updates').emit('health:fast', update);
}

pushSlow(update: HealthSlowUpdate): void {
    this.server?.to('health-updates').emit('health:slow', update);
}

pushIncident(incident: SystemIncident): void {
    this.server?.to('health-updates').emit('health:incident', incident);
}
```

`broadcastHealthUpdate()` lama belum dihapus di task ini; Task 3 menghapusnya setelah sampler siap.

- [ ] **Step 5: Implementasi minimal sampler dan ring buffer**

Buat `health-sampler.service.ts`. Gunakan `@Inject(forwardRef(() => HealthService))` dan `@Inject(forwardRef(() => HealthGateway))`; kedua dependency diperlukan karena HealthService menyusun REST DTO dari sampler dan sampler mengirim delta ke gateway.

Gunakan konstanta dan array queue berikut, jangan duplikasi string queue di fungsi lain:

```ts
const MONITORED_QUEUES = [
    'notifications',
    'emails',
    'file-processing',
    'reports',
    'zoom-meetings',
    'google-sync',
] as const;

private readonly history: HealthHistory = {
    cpu: [], memory: [], dbLatency: [], redisLatency: [],
};

private appendHistory(key: keyof HealthHistory, value: number): void {
    const values = this.history[key];
    values.push(value);
    if (values.length > HISTORY_SIZE) values.shift();
}
```

`refreshFastTier()` wajib memakai `Promise.allSettled` untuk `getFastSystemMetrics()`, `checkDatabaseHealth()`, dan Redis ping dari client persisten sampler. `getFastSystemMetrics()` hanya menghitung CPU/RAM/platform/arch/Node/load average, tidak memanggil disk. Gunakan fallback valid bila result reject:

```ts
const metrics = metricsResult.status === 'fulfilled'
    ? metricsResult.value
    : this.fastSnapshot.system;
const database = databaseResult.status === 'fulfilled'
    ? databaseResult.value
    : { status: 'disconnected' as const, latency: 0 };
```

Set `fastSnapshot`, update empat history array, set `sampledAt.fast`, lalu panggil `gateway.pushFast(this.getFastUpdate())`. Jangan lakukan `getServicesStatus()`, backup, disk, `INFO`, atau `DBSIZE` dari fast tier.

`refreshSlowTier()` wajib memakai `Promise.allSettled` untuk `getDiskUsage()`, `getServicesStatus()`, `checkBackupStatus()`, dan `getRedisDetail()`. Perbarui hanya bagian slow snapshot, panggil `gateway.pushSlow()`, dan kirim incident hanya dari daftar incident baru yang belum pernah dipancarkan. Simpan `lastEmittedIncidentId: string | null` agar incident tidak duplikat.

Tambahkan scheduler:

```ts
@Interval(FAST_INTERVAL_MS)
async scheduledFastRefresh(): Promise<void> {
    await this.refreshFastTier();
}

@Interval(SLOW_INTERVAL_MS)
async scheduledSlowRefresh(): Promise<void> {
    await this.refreshSlowTier();
}
```

Di `onModuleInit()`, panggil `void this.refreshFastTier()` dan `void this.refreshSlowTier()` dengan `.catch()` yang hanya log error. Jangan menahan startup dan jangan melempar error dari interval.

- [ ] **Step 6: Tambah Redis client persisten dan queue telemetry**

Di sampler, hanya buat client jika `configService.get('REDIS_ENABLED') === 'true'`. Pakai `require('ioredis')`, karena `CacheService` saat ini juga memakai pola itu dan package tidak punya type import eksplisit. Simpan pada field `private redisClient: any = null`.

```ts
private async createRedisClient(): Promise<void> {
    if (this.redisClient || !this.redisEnabled) return;

    const Redis = require('ioredis');
    this.redisClient = new Redis({
        host: this.configService.get<string>('REDIS_HOST', 'localhost'),
        port: this.configService.get<number>('REDIS_PORT', 6379),
        password: this.configService.get<string>('REDIS_PASSWORD') || undefined,
        lazyConnect: false,
        maxRetriesPerRequest: 1,
        connectTimeout: 2_000,
        retryStrategy: (attempt: number) => attempt > 10 ? null : Math.min(attempt * 100, 3_000),
    });
    this.redisClient.on('error', (error: Error) => this.logger.warn(`Redis health client error: ${error.message}`));
    await this.redisClient.ping();
}
```

`getRedisDetail()` memakai satu pipeline agar slow tier tidak mengirim 20 round-trip:

```ts
const pipeline = this.redisClient.pipeline();
pipeline.info('memory');
pipeline.dbsize();
for (const name of MONITORED_QUEUES) {
    pipeline.llen(`bull:${name}:wait`);
    pipeline.llen(`bull:${name}:active`);
    pipeline.scard(`bull:${name}:failed`);
}
const results = await pipeline.exec();
```

Parse `used_memory` dengan regex `/^used_memory:(\d+)$/m`. Untuk setiap response queue, bila error/null gunakan `0`; ini menjamin payload selalu berisi enam queue. `onModuleDestroy()` wajib `await this.redisClient?.quit()` dan tidak boleh memanggil `disconnect()` setelah `quit()`.

- [ ] **Step 7: Jalankan test dan type-check backend**

Run:

```bash
cd apps/backend && npx jest src/modules/health/health-sampler.service.spec.ts --runInBand
npm run build
```

Expected: semua sampler test PASS; build backend exit 0.

- [ ] **Step 8: Commit task sampler**

```bash
git add apps/backend/src/modules/health/dto/health.dto.ts \
  apps/backend/src/modules/health/health.service.ts \
  apps/backend/src/modules/health/health.gateway.ts \
  apps/backend/src/modules/health/health-sampler.service.ts \
  apps/backend/src/modules/health/health-sampler.service.spec.ts
git commit -m "feat(health): add tiered realtime sampler"
```

---

### Task 2: Refactor HealthService menjadi probe non-blocking dan composer snapshot

**Files:**
- Modify: `apps/backend/src/modules/health/health.service.ts`
- Modify: `apps/backend/src/modules/health/health.controller.ts`
- Create: `apps/backend/src/modules/health/health.service.spec.ts`

**Interfaces:**
- Consumes: `HealthSamplerService.getSnapshot(): HealthSnapshot`.
- Produces: public probe methods untuk sampler: `getFastSystemMetrics()`, `getDiskUsage()`, `checkDatabaseHealth()`, `checkBackupStatus()`, `getServicesStatus()`, `getOverallStatus()`; REST `getDetailedHealth(): Promise<DetailedHealthStatus>`. `checkRedisHealth()` dihapus karena Redis ping milik client persisten sampler.

- [ ] **Step 1: Tulis test REST snapshot yang gagal**

Buat `health.service.spec.ts` dengan sampler mock dan `DataSource.query` spy:

```ts
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { HealthService } from './health.service';

describe('HealthService', () => {
    it('returns sampler snapshot without probing database again', async () => {
        const dataSource = { query: jest.fn() } as unknown as DataSource;
        const snapshot = {
            status: 'ok', timestamp: '2026-07-27T00:00:00.000Z', uptime: 10,
            version: '1.5.0', system: {}, infrastructure: {}, services: [],
            recentIncidents: [], serverTime: '2026-07-27T00:00:00.000Z',
            history: { cpu: [], memory: [], dbLatency: [], redisLatency: [] },
            sampledAt: { fast: '', slow: '' },
        };
        const sampler = { getSnapshot: jest.fn().mockReturnValue(snapshot) };
        const service = new HealthService(
            dataSource,
            { get: jest.fn().mockReturnValue('1.5.0') } as unknown as ConfigService,
            sampler as any,
        );

        await expect(service.getDetailedHealth()).resolves.toEqual(expect.objectContaining({
            status: 'ok', uptime: 10, services: [],
        }));
        expect(dataSource.query).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run:

```bash
cd apps/backend && npx jest src/modules/health/health.service.spec.ts --runInBand
```

Expected: FAIL karena constructor belum menerima sampler dan `getDetailedHealth()` masih memanggil semua probe.

- [ ] **Step 3: Ubah HealthService agar membaca snapshot dan hapus probing terjadwal**

- Hapus `implements OnModuleInit`, `onModuleInit()`, import `Cron`/`CronExpression`, dan `performHealthCheck()`.
- Injeksi sampler dengan `@Inject(forwardRef(() => HealthSamplerService)) private readonly sampler: HealthSamplerService`.
- `getDetailedHealth()` mengembalikan snapshot tanpa `serverTime`, `history`, `sampledAt`, atau `redisDetail`; payload REST harus tepat `DetailedHealthStatus` lama:

```ts
async getDetailedHealth(): Promise<DetailedHealthStatus> {
    const { serverTime, history, sampledAt, redisDetail, ...health } = this.sampler.getSnapshot();
    return health;
}
```

- `getBasicHealth()` tetap boleh memanggil `checkDatabaseHealth()` langsung sebagai liveness/readiness probe; ini bukan endpoint detailed dan tidak dipakai dashboard.
- Ubah semua probe yang dipanggil sampler dari `private` menjadi public. Jangan expose field cache internal.
- Tambahkan method tanpa side effect untuk overall status:

```ts
getOverallStatus(
    infrastructure: InfrastructureStatus,
    services: ServiceStatus[],
): 'ok' | 'degraded' | 'error' {
    if (infrastructure.database.status === 'disconnected' || services.some(({ status }) => status === 'down')) return 'error';
    return services.some(({ status }) => status === 'degraded') ? 'degraded' : 'ok';
}
```

- Pertahankan incident cache dan `checkForIncident()`. Tambahkan `getRecentIncidents()` seperti bentuk sekarang.

- [ ] **Step 4: Ganti disk `wmic` dengan `fs.promises.statfs`**

Ganti seluruh implementasi `getDiskUsage()` dengan implementasi async berikut. Gunakan `UPLOAD_PATH` bila path ada; bila tidak, fallback ke root path dari cwd. Ini menangani kenyataan terverifikasi bahwa `./uploads` di root repo tidak ada dan `statfs` memberi `ENOENT`.

```ts
private async getDiskUsage(): Promise<{ usage: number; total: number; free: number }> {
    const configuredPath = this.configService.get<string>('UPLOAD_PATH', './uploads');
    const uploadPath = path.resolve(configuredPath);
    const diskPath = fs.existsSync(uploadPath) ? uploadPath : path.parse(process.cwd()).root;

    try {
        const stats = await fs.promises.statfs(diskPath);
        const total = stats.blocks * stats.bsize;
        const free = stats.bavail * stats.bsize;
        return {
            usage: total === 0 ? 0 : Math.round(((total - free) / total) * 10_000) / 100,
            total,
            free,
        };
    } catch (error) {
        this.logger.warn(`Could not read disk usage for ${diskPath}: ${error.message}`);
        return { usage: 0, total: 0, free: 0 };
    }
}
```

`fs.existsSync` hanya dipakai untuk memilih path dan tidak membaca disk statistics; `statfs` tetap async. Hapus import/require `child_process` sepenuhnya. Pengukuran `fs.statfs` telah diverifikasi bekerja pada drive `F:` dengan Node `v24.14.0`; `wmic` saat ini menghasilkan disk `0` di `/v1/health/detailed`.

- [ ] **Step 5: Pastikan controller dan Swagger memakai endpoint yang sama**

Jangan ubah route decorator controller: versioning URI global di `apps/backend/src/main.ts:49-52` membuat route aktual tetap `/v1/health/*`. `getDetailedHealth()` controller tetap mendelegasikan ke service. Tambahkan test controller hanya bila signature atau decorator harus berubah; tidak diperlukan bila tidak berubah.

- [ ] **Step 6: Jalankan test dan build**

Run:

```bash
cd apps/backend && npx jest src/modules/health/health.service.spec.ts src/modules/health/health-sampler.service.spec.ts --runInBand
npm run build
```

Expected: test PASS; build exit 0; tidak ada referensi `wmic` atau `execSync` pada `apps/backend/src/modules/health`.

- [ ] **Step 7: Commit task service**

```bash
git add apps/backend/src/modules/health/health.service.ts \
  apps/backend/src/modules/health/health.controller.ts \
  apps/backend/src/modules/health/health.service.spec.ts
git commit -m "refactor(health): serve cached probes without wmic"
```

---

### Task 3: Hubungkan sampler ke module dan jadikan gateway relay delta

**Files:**
- Modify: `apps/backend/src/modules/health/health.module.ts`
- Modify: `apps/backend/src/modules/health/health.gateway.ts`
- Modify: `apps/backend/src/modules/health/health-sampler.service.spec.ts`

**Interfaces:**
- Consumes: `HealthSamplerService.getSnapshot()`, `getFastUpdate()`, `getSlowUpdate()`.
- Produces: `HealthGateway.pushFast(update: HealthFastUpdate)`, `pushSlow(update: HealthSlowUpdate)`, `pushIncident(incident: SystemIncident)`.

- [ ] **Step 1: Tambah test incident dan payload gateway pada test sampler**

Tambahkan dua test ke `health-sampler.service.spec.ts`:

```ts
it('emits each new incident only once', async () => {
    healthService.getRecentIncidents
        .mockReturnValueOnce([{ id: 'inc-1', timestamp: new Date().toISOString() }])
        .mockReturnValueOnce([{ id: 'inc-1', timestamp: new Date().toISOString() }]);
    const sampler = new HealthSamplerService(healthService as any, gateway as any, {
        get: jest.fn().mockReturnValue('false'),
    } as unknown as ConfigService);

    await sampler.refreshSlowTier();
    await sampler.refreshSlowTier();

    expect(gateway.pushIncident).toHaveBeenCalledTimes(1);
});

it('includes all six queues with zero fallback when Redis detail is unavailable', async () => {
    const sampler = new HealthSamplerService(healthService as any, gateway as any, {
        get: jest.fn().mockReturnValue('false'),
    } as unknown as ConfigService);

    await sampler.refreshSlowTier();

    expect(sampler.getSlowUpdate().redisDetail).toBeUndefined();
    expect(gateway.pushSlow).toHaveBeenCalledWith(expect.objectContaining({ services: [] }));
});
```

- [ ] **Step 2: Jalankan test untuk memastikan behavior belum lengkap**

Run:

```bash
cd apps/backend && npx jest src/modules/health/health-sampler.service.spec.ts --runInBand
```

Expected: FAIL bila de-dup incident atau slow payload belum diimplementasikan.

- [ ] **Step 3: Daftarkan sampler dan ekspor provider yang diperlukan**

Ubah `health.module.ts` menjadi:

```ts
@Module({
    imports: [ConfigModule, ScheduleModule.forRoot()],
    controllers: [HealthController],
    providers: [HealthService, HealthSamplerService, HealthGateway],
    exports: [HealthService, HealthSamplerService, HealthGateway],
})
export class HealthModule {}
```

Tidak perlu `TypeOrmModule` atau import yang saat ini tidak dipakai. Tambahkan import `HealthSamplerService`.

- [ ] **Step 4: Ganti interval gateway dengan metode relay**

Di `health.gateway.ts`:

1. Hapus import `Interval`.
2. Hapus `lastHealthStatus`, `@Interval(5000) broadcastHealthUpdate()`, `checkAndEmitIncidents()`, dan `forceEmit()` lama.
3. Injeksi sampler dengan `@Inject(forwardRef(() => HealthSamplerService))`.
4. `handleSubscribe()` masuk room, lalu langsung mengirim snapshot saat itu:

```ts
@SubscribeMessage('health:subscribe')
handleSubscribe(@ConnectedSocket() client: Socket): void {
    this.subscribedClients.add(client.id);
    client.join('health-updates');
    client.emit('health:snapshot', this.healthSampler.getSnapshot());
}
```

5. Tambahkan relay yang tidak melakukan probe:

```ts
pushFast(update: HealthFastUpdate): void {
    this.server?.to('health-updates').emit('health:fast', update);
}

pushSlow(update: HealthSlowUpdate): void {
    this.server?.to('health-updates').emit('health:slow', update);
}

pushIncident(incident: SystemIncident): void {
    this.server?.to('health-updates').emit('health:incident', incident);
}
```

6. Pertahankan perhitungan websocket client pada `updateWsClientCount()`. Saat no subscriber, sampler tetap berjalan supaya REST dan client yang baru subscribe mendapat snapshot segar.
7. Perbarui blok komentar event ke `health:snapshot`, `health:fast`, `health:slow`, `health:incident`.

- [ ] **Step 5: Jalankan unit test dan smoke endpoint**

Run:

```bash
cd apps/backend && npx jest src/modules/health/health-sampler.service.spec.ts src/modules/health/health.service.spec.ts --runInBand
npm run build
curl -s http://localhost:5050/v1/health/detailed
```

Expected: test/build PASS; response detailed mengandung `system`, `infrastructure`, `services`, `recentIncidents`; endpoint benar adalah `/v1/health/detailed`, bukan `/health/detailed`.

- [ ] **Step 6: Commit gateway integration**

```bash
git add apps/backend/src/modules/health/health.module.ts \
  apps/backend/src/modules/health/health.gateway.ts \
  apps/backend/src/modules/health/health-sampler.service.spec.ts
git commit -m "feat(health): stream fast and slow health deltas"
```

---

### Task 4: Buat hook Socket.IO menyusun snapshot, realtime uptime, dan stale state

**Files:**
- Modify: `apps/frontend/src/features/admin/hooks/useHealthSocket.ts`
- Create: `apps/frontend/src/features/admin/hooks/__tests__/useHealthSocket.test.tsx`

**Interfaces:**
- Consumes: event backend `health:snapshot: HealthSnapshot`, `health:fast: HealthFastUpdate`, `health:slow: HealthSlowUpdate`, `health:incident: SystemIncident`.
- Produces: `UseHealthSocketReturn.healthData`, `uptime`, `history`, `isStale`, `lastUpdate`, `isConnected`, `isSubscribed`, `incidents`.

- [ ] **Step 1: Tambah tipe payload frontend dan test hook yang gagal**

Tambahkan `RedisQueueDepth`, `RedisDetail`, `HealthHistory`, `HealthFastUpdate`, `HealthSlowUpdate`, `HealthSnapshot` sebagai export di hook, identik dengan kontrak backend. Tambahkan `detail?: RedisDetail` ke `InfrastructureStatus.redis`.

Buat `__tests__/useHealthSocket.test.tsx`. Mock `socket.io-client` dengan emitter minimal:

```tsx
import { act, renderHook } from '@testing-library/react';
import { vi } from 'vitest';
import { useHealthSocket } from '../useHealthSocket';

const handlers = new Map<string, (payload?: any) => void>();
const socket = {
    connected: true,
    on: vi.fn((event, handler) => handlers.set(event, handler)),
    emit: vi.fn(),
    disconnect: vi.fn(),
    removeAllListeners: vi.fn(),
};

vi.mock('socket.io-client', () => ({ io: vi.fn(() => socket) }));

const snapshot = {
    status: 'ok', timestamp: '2026-07-27T00:00:00.000Z', serverTime: '2026-07-27T00:00:00.000Z',
    uptime: 100, version: '1.5.0',
    system: { cpuUsage: 10, memoryUsage: 20, memoryTotal: 100, memoryFree: 80, diskUsage: 0, diskTotal: 0, diskFree: 0, platform: 'win32', arch: 'x64', nodeVersion: 'v24', loadAverage: [0, 0, 0] },
    infrastructure: { database: { status: 'connected', latency: 2 }, redis: { status: 'disabled' }, websocket: { status: 'active', clients: 1 }, backup: { configured: false } },
    services: [], recentIncidents: [],
    history: { cpu: [10], memory: [20], dbLatency: [2], redisLatency: [] },
    sampledAt: { fast: '2026-07-27T00:00:00.000Z', slow: '2026-07-27T00:00:00.000Z' },
};

it('ticks uptime locally and resyncs on a fast update', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useHealthSocket(true));

    act(() => handlers.get('health:snapshot')!(snapshot));
    act(() => vi.advanceTimersByTime(3_000));
    expect(result.current.uptime).toBeCloseTo(103, 0);

    act(() => handlers.get('health:fast')!({
        serverTime: '2026-07-27T00:00:04.000Z', uptime: 200,
        cpuUsage: 11, memoryUsage: 21, memoryFree: 79, loadAverage: [0, 0, 0],
        database: { status: 'connected', latency: 3 }, redis: { status: 'disabled' }, websocket: { status: 'active', clients: 2 },
    }));
    expect(result.current.uptime).toBe(200);
});

it('sets stale after six seconds without a fast update', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useHealthSocket(true));
    act(() => handlers.get('health:snapshot')!(snapshot));
    act(() => vi.advanceTimersByTime(6_001));
    expect(result.current.isStale).toBe(true);
});
```

Tambahkan test ketiga: 61 `health:fast` event membatasi masing-masing history pada 60 dan `health:slow` memperbarui disk/services/backup tanpa menghapus CPU/RAM terbaru.

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run:

```bash
cd apps/frontend && npx vitest run src/features/admin/hooks/__tests__/useHealthSocket.test.tsx --pool=forks
```

Expected: FAIL karena hook masih mendengar `health:update`, tidak mengekspos uptime/history/stale, dan belum memiliki test file.

- [ ] **Step 3: Implementasi state reducer dan event Socket.IO**

Ganti listener `health:update` dengan listener berikut:

```ts
newSocket.on('health:snapshot', (snapshot: HealthSnapshot) => {
    setHealthData(snapshot);
    setHistory(snapshot.history);
    setUptimeBase({ uptime: snapshot.uptime, receivedAt: Date.now() });
    setLastFastUpdate(Date.now());
    setLastUpdate(new Date());
});

newSocket.on('health:fast', (update: HealthFastUpdate) => {
    setHealthData((current) => current ? {
        ...current,
        timestamp: update.serverTime,
        uptime: update.uptime,
        system: { ...current.system, cpuUsage: update.cpuUsage, memoryUsage: update.memoryUsage, memoryFree: update.memoryFree, loadAverage: update.loadAverage },
        infrastructure: { ...current.infrastructure, database: update.database, redis: update.redis, websocket: update.websocket },
    } : current);
    setHistory((current) => appendFastSample(current, update));
    setUptimeBase({ uptime: update.uptime, receivedAt: Date.now() });
    setLastFastUpdate(Date.now());
    setLastUpdate(new Date());
});
```

`appendFastSample()` harus immutable dan membatasi tiap array dengan `.slice(-60)`. Pastikan payload pertama yang fast tanpa snapshot tidak crash; biarkan `healthData` null hingga snapshot datang, tetapi tetap simpan baseline uptime/history.

Listener slow wajib menggabungkan, bukan replace:

```ts
newSocket.on('health:slow', (update: HealthSlowUpdate) => {
    setHealthData((current) => current ? {
        ...current,
        status: update.status,
        timestamp: update.serverTime,
        system: { ...current.system, diskUsage: update.disk.diskUsage, diskTotal: update.disk.diskTotal, diskFree: update.disk.diskFree },
        infrastructure: {
            ...current.infrastructure,
            backup: update.backup,
            redis: { ...current.infrastructure.redis, detail: update.redisDetail },
        },
        services: update.services,
    } : current);
    setLastUpdate(new Date());
});
```

- [ ] **Step 4: Tambah clock uptime dan stale state yang cleanup-safe**

Gunakan `setInterval` tunggal setelah mount, cleanup pada unmount:

```ts
const STALE_THRESHOLD_MS = 6_000;
const [uptime, setUptime] = useState(0);
const [uptimeBase, setUptimeBase] = useState<{ uptime: number; receivedAt: number } | null>(null);
const [lastFastUpdate, setLastFastUpdate] = useState<number | null>(null);

useEffect(() => {
    const timer = window.setInterval(() => {
        const now = Date.now();
        if (uptimeBase) setUptime(uptimeBase.uptime + (now - uptimeBase.receivedAt) / 1_000);
    }, 1_000);
    return () => window.clearInterval(timer);
}, [uptimeBase]);

const isStale = Boolean(lastFastUpdate && Date.now() - lastFastUpdate > STALE_THRESHOLD_MS);
```

Agar perubahan stale memicu render tanpa event baru, simpan `now` dari interval sebagai state kecil (`setClockNow(Date.now())`) dan hitung `isStale` dari `clockNow`. Reset `lastFastUpdate` ke `null` pada disconnect. Jangan `console.log` atau `console.error` dari hook production; hapus log yang sekarang ada.

- [ ] **Step 5: Jalankan hook tests dan build frontend**

Run:

```bash
cd apps/frontend && npx vitest run src/features/admin/hooks/__tests__/useHealthSocket.test.tsx --pool=forks
npm run build
```

Expected: semua test PASS; build exit 0.

- [ ] **Step 6: Commit hook realtime**

```bash
git add apps/frontend/src/features/admin/hooks/useHealthSocket.ts \
  apps/frontend/src/features/admin/hooks/__tests__/useHealthSocket.test.tsx
git commit -m "feat(health): merge realtime health socket deltas"
```

---

### Task 5: Tampilkan uptime realtime, sparklines, Redis detail, dan data basi

**Files:**
- Modify: `apps/frontend/src/features/admin/pages/SystemHealthPage.tsx`

**Interfaces:**
- Consumes: `useHealthSocket(true)` dengan `healthData`, `uptime`, `history`, `isStale`, `lastUpdate`, `isConnected`, `isSubscribed`, `incidents`.
- Consumes: existing `Sparkline` dari `@/components/ui/Sparkline`.
- Produces: System Health UI yang membedakan data live, stale, disabled Redis, error Redis, dan queue failed.

- [ ] **Step 1: Tambah test UI kecil atau render check yang gagal**

Karena halaman belum memiliki test dan perubahan ini terutama presentasi, buat test render minimal di `apps/frontend/src/features/admin/pages/__tests__/SystemHealthPage.test.tsx`. Mock `useHealthSocket` dan API queries; assert uptime realtime dan Redis queue data tampak:

```tsx
vi.mock('../../hooks/useHealthSocket', () => ({
    useHealthSocket: () => ({
        healthData: healthSnapshotWithRedis,
        uptime: 93788,
        history: { cpu: [1, 2], memory: [3, 4], dbLatency: [5, 6], redisLatency: [7, 8] },
        isStale: false, isConnected: true, isSubscribed: true,
        lastUpdate: new Date('2026-07-27T00:00:00.000Z'), incidents: [],
        connect: vi.fn(), disconnect: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn(),
    }),
}));

it('shows ticking uptime and Redis queue depth', async () => {
    render(<SystemHealthPage />);
    expect(await screen.findByText('1d 2h 3m 8s')).toBeInTheDocument();
    expect(screen.getByText('google-sync')).toBeInTheDocument();
    expect(screen.getByText(/Waiting: 2/)).toBeInTheDocument();
});
```

Mock `api.get` for `/backup/status` and React Query with the same wrapper pattern as existing frontend hook tests.

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run:

```bash
cd apps/frontend && npx vitest run src/features/admin/pages/__tests__/SystemHealthPage.test.tsx --pool=forks
```

Expected: FAIL karena halaman tidak menerima `uptime`/`history`/`isStale`, belum menampilkan queue, dan `formatUptime()` belum menampilkan detik.

- [ ] **Step 3: Hubungkan nilai hook baru dan data-basi badge**

Destructure nilai baru:

```ts
const {
    healthData, isConnected, isSubscribed, lastUpdate, incidents,
    uptime, history, isStale,
} = useHealthSocket(true);
```

Ganti `LivePulse` dengan props `{ isConnected, isSubscribed, isStale, lastUpdate }`. Urutan status:

```tsx
if (isStale) return <span className="text-xs text-amber-600 dark:text-amber-400">Stale {elapsedSeconds}s</span>;
if (isConnected && isSubscribed) return <span className="text-xs text-slate-500 dark:text-slate-400">Live</span>;
return <span className="text-xs text-red-600 dark:text-red-400">Disconnected</span>;
```

Sertakan titik amber untuk stale. `elapsedSeconds` dihitung dari `lastUpdate` dan clock yang sudah berubah setiap detik dari hook; jangan tambah interval kedua pada halaman.

Ubah `formatUptime()` agar selalu menyertakan detik dengan padding dua digit:

```ts
const secondsPart = Math.floor(seconds % 60).toString().padStart(2, '0');
return days > 0 ? `${days}d ${hours}h ${minutes}m ${secondsPart}s`
    : hours > 0 ? `${hours}h ${minutes}m ${secondsPart}s`
    : `${minutes}m ${secondsPart}s`;
```

Tampilan uptime harus memakai `formatUptime(uptime || health.uptime)`.

- [ ] **Step 4: Tambah Sparkline tanpa membuat komponen baru**

Import:

```ts
import { Sparkline } from '@/components/ui/Sparkline';
```

Tempatkan sparkline sesudah subteks CPU/RAM dan Database latency. Gunakan komponen existing:

```tsx
<Sparkline data={history.cpu} width={80} height={28} filled color={
    health.system.cpuUsage > 80 ? 'danger' : health.system.cpuUsage > 60 ? 'warning' : 'success'
} />
```

CPU memakai `history.cpu`, RAM memakai `history.memory`, Database memakai `history.dbLatency` dengan `color="info"`. Jangan buat chart library atau SVG baru. `Sparkline` sudah menangani kurang dari dua titik dengan teks `No data`.

- [ ] **Step 5: Perluas kartu Redis dan koreksi kartu WebSocket**

Untuk Redis connected, tampilkan:

```tsx
const redisDetail = health?.infrastructure?.redis?.detail;

{redisDetail ? (
    <>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {health.infrastructure.redis.latency ?? 0}ms · {formatBytes(redisDetail.usedMemory)} · {redisDetail.keys} keys
        </p>
        <div className="mt-3 space-y-1.5">
            {redisDetail.queues.map((queue) => (
                <div key={queue.name} className="flex justify-between gap-2 text-xs">
                    <span className="truncate">{queue.name}</span>
                    <span className={cn(queue.failed > 0 && 'text-red-600 dark:text-red-400')}>
                        Waiting: {queue.waiting} · Active: {queue.active} · Failed: {queue.failed}
                    </span>
                </div>
            ))}
        </div>
    </>
) : health?.infrastructure?.redis?.status === 'disabled' ? (
    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Set REDIS_ENABLED=true</p>
) : (
    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{health?.infrastructure?.redis?.latency ?? 0}ms</p>
)}
```

Jangan buat tombol untuk mengubah `.env`.

Kartu WebSocket harus memakai `health?.infrastructure?.websocket?.status === 'active' ? 'operational' : 'down'`, bukan `isConnected`. `isConnected` hanya menunjukkan browser ini terhubung.

- [ ] **Step 6: Jalankan frontend test, lint/build, dan visual smoke**

Run:

```bash
cd apps/frontend && npx vitest run src/features/admin/hooks/__tests__/useHealthSocket.test.tsx src/features/admin/pages/__tests__/SystemHealthPage.test.tsx --pool=forks
npm run build
```

Expected: PASS dan build exit 0.

Kemudian buka System Health pada dev app dan pastikan:

1. Uptime berubah tiap detik.
2. CPU, RAM, DB sparkline bertambah setelah dua fast update.
3. Status stale muncul bila backend dimatikan atau Socket.IO berhenti lebih dari 6 detik.
4. WebSocket card tetap berdasarkan status server, bukan socket browser saja.

- [ ] **Step 7: Commit UI**

```bash
git add apps/frontend/src/features/admin/pages/SystemHealthPage.tsx \
  apps/frontend/src/features/admin/pages/__tests__/SystemHealthPage.test.tsx
git commit -m "feat(health): show live metrics and redis telemetry"
```

---

### Task 6: Aktifkan Redis dev dan lakukan verifikasi integrasi failure/recovery

**Files:**
- Modify locally only: `apps/backend/.env:46`
- No commit: `.env` harus tetap lokal dan tidak masuk commit.

**Interfaces:**
- Consumes: `REDIS_ENABLED`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` dari `apps/backend/.env`.
- Produces: backend memakai Redis untuk CacheService, Bull root queues, dan health sampler telemetry.

- [ ] **Step 1: Periksa nilai konfigurasi sebelum mengubah**

Run:

```bash
cd apps/backend
grep -nE '^REDIS_(ENABLED|HOST|PORT|PASSWORD)=' .env
docker ps --format '{{.Names}} {{.Status}}' | grep idesk-redis
```

Expected: `REDIS_ENABLED=false`; `idesk-redis` menunjukkan `healthy`; host `localhost`; port `6379`.

- [ ] **Step 2: Aktifkan Redis hanya untuk lingkungan dev**

Ubah tepat satu baris di `apps/backend/.env`:

```dotenv
REDIS_ENABLED=true
```

Jangan ubah password. Jangan tambah secret ke git. Jangan edit `.env.example` karena template sudah menjelaskan flag dan tidak harus menyalakan Redis untuk setiap environment baru.

- [ ] **Step 3: Restart backend dan verifikasi Redis yang benar-benar dipakai**

Restart memakai mekanisme dev repo yang sedang dipakai, lalu jalankan:

```bash
curl -s http://localhost:5050/v1/health/detailed
```

Expected pada JSON:

```json
{
  "infrastructure": {
    "redis": {
      "status": "connected",
      "latency": 0
    }
  }
}
```

Latency dapat bernilai non-nol. Verifikasi log backend berisi koneksi Redis berhasil dan tidak ada retry loop. Verifikasi live Redis tetap bisa memberi telemetry:

```bash
docker exec idesk-redis redis-cli PING
docker exec idesk-redis redis-cli INFO memory
docker exec idesk-redis redis-cli DBSIZE
```

Expected: `PONG`, satu line `used_memory:*`, dan integer DBSIZE.

- [ ] **Step 4: Uji recovery Redis tanpa restart backend**

Run berurutan:

```bash
docker stop idesk-redis
# Tunggu satu fast cycle (lebih dari 2 detik), lalu cek panel /v1/health/detailed
docker start idesk-redis
# Tunggu satu fast cycle (lebih dari 2 detik), lalu cek lagi
```

Expected:

1. Saat stopped, Redis status menjadi `error`, incident muncul sekali, CPU/RAM/DB dan halaman tetap hidup.
2. Setelah started, status kembali `connected` tanpa restart backend.
3. `health:slow` berikutnya memuat `redisDetail` dengan enam nama queue dan angka depth valid.

- [ ] **Step 5: Jalankan regression suite yang relevan**

Run:

```bash
cd apps/backend && npx jest src/modules/health/health-sampler.service.spec.ts src/modules/health/health.service.spec.ts --runInBand && npm run build
cd ../frontend && npx vitest run src/features/admin/hooks/__tests__/useHealthSocket.test.tsx src/features/admin/pages/__tests__/SystemHealthPage.test.tsx --pool=forks && npm run build
```

Expected: semua command exit 0.

- [ ] **Step 6: Catat risiko CacheService yang tidak dikerjakan**

Jangan ubah kode `apps/backend/src/shared/core/cache/cache.service.ts:117-134`. Konfirmasi di laporan akhir bahwa `CacheService.get()` sinkron mengembalikan `null` saat Redis aktif dan perlu audit terpisah terhadap seluruh pemanggil `get()` sebelum aktivasi production. Ini tidak memblokir telemetry health dev, tetapi memblokir klaim Redis cache production-ready.

---

## Cakupan Self-Review

| Requirement spec | Task |
|---|---|
| Fast 2s, slow 30s | Task 1 |
| Central sampler + snapshot + 60 ring buffer | Task 1 |
| Redis client persistent, memory/keys/queue depth | Task 1 |
| Error isolation `Promise.allSettled` | Task 1 |
| Hapus cron + Redis connect/quit setiap check | Task 2 |
| `statfs` menggantikan `wmic` | Task 2 |
| REST detailed kompatibel, tanpa re-probe | Task 2 |
| Gateway snapshot/fast/slow/incident, tanpa polling penuh | Task 3 |
| Uptime local tick, merge delta, stale state | Task 4 |
| Sparkline, Redis panel, WebSocket server status | Task 5 |
| Redis dev enabled, failure/recovery manual | Task 6 |
| CacheService sync-get risk tetap di luar scope | Global constraints + Task 6 |

Placeholder scan: tidak ada `TBD`, `TODO`, atau langkah tanpa command/test/kontrak. Type names payload dan method sampler dipusatkan pada bagian Kontrak Antar Komponen.
