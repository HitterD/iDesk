# System Health Realtime — Design

**Tanggal:** 2026-07-27
**Status:** Disetujui (menunggu review spec)

## Ringkasan

Halaman System Health saat ini melakukan polling penuh tiap 5 detik: 10 query DB, sampling CPU 100ms, `wmic` lewat `execSync` yang memblokir event loop, dan satu koneksi Redis baru dibuat-lalu-ditutup setiap siklus. Uptime melompat 5 detik sekali karena hanya angka dari payload.

Desain ini memisahkan sampling menjadi dua tier (2s / 30s) di satu service khusus, mengaktifkan Redis, dan menambahkan sparkline serta jam uptime yang berjalan per detik. Traffic WebSocket turun ~85% walau frekuensi update naik 2,5×.

## Kondisi Sekarang

| Lokasi | Masalah |
|---|---|
| `apps/backend/src/modules/health/health.gateway.ts:99` | `@Interval(5000)` memanggil `getDetailedHealth()` penuh setiap siklus |
| `apps/backend/src/modules/health/health.service.ts:251-267` | Koneksi ioredis baru tiap health check: `connect` → `ping` → `quit` |
| `apps/backend/src/modules/health/health.service.ts:466-493` | `execSync('wmic ...')` memblokir event loop, khusus Windows |
| `apps/backend/src/modules/health/health.service.ts:206` | `@Cron(EVERY_30_SECONDS)` berjalan paralel dengan interval gateway — probing ganda |
| `apps/backend/src/modules/health/health.gateway.ts:117-121` | `health:metrics` menduplikasi isi `health:update` |
| `apps/backend/src/modules/health/health.gateway.ts:132-138` | Deteksi incident memfilter berdasarkan window 10 detik — rapuh |
| `apps/frontend/src/features/admin/pages/SystemHealthPage.tsx:369` | Uptime dari payload, melompat 5 detik sekali |
| `apps/frontend/src/features/admin/pages/SystemHealthPage.tsx:429` | Kartu WebSocket melaporkan koneksi browser ini, bukan kesehatan server |
| `apps/backend/.env:46` | `REDIS_ENABLED=false` walau container `idesk-redis` sudah jalan dan healthy |

## Keputusan Desain

Diputuskan bersama user sebelum implementasi:

1. **Cadence tiered** — sensor ringan 2 detik, sensor berat 30 detik. Bukan semuanya 1 detik (10 query DB per detik) dan bukan tetap 5 detik.
2. **Uptime tick lokal** — frontend menerima `uptime` + `serverTime`, lalu tick per detik secara lokal dan resync tiap payload fast. Bukan uptime persisten lintas restart.
3. **Redis diaktifkan penuh** — cache dan queue, di dev dulu, lalu diverifikasi.
4. **Panel Redis menampilkan** latency, used memory, jumlah keys, dan kedalaman tiap Bull queue.
5. **Sparkline dari ring buffer backend** 60 titik in-memory, dikirim saat subscribe.
6. **Pendekatan A** — sampler terpusat. Ditolak: perbaikan di tempat (gateway jadi pemegang state, sulit ditest) dan sensor registry (abstraksi belum dibutuhkan untuk 8 sensor).

## Arsitektur

```
┌─ HealthSamplerService (baru) ──────────┐
│  @Interval(FAST_INTERVAL_MS = 2000)    │
│    cpu, mem, uptime, dbPing,           │
│    redisPing, wsClients                │
│  @Interval(SLOW_INTERVAL_MS = 30000)   │
│    disk, 10 service check,             │
│    queueDepth, redisInfo, backup       │
│                                         │
│  state: fastSnapshot, slowSnapshot      │
│  history: ring buffer HISTORY_SIZE=60   │
│  ioredis client persisten               │
└───────┬────────────────────────────────┘
        │ getSnapshot() / getFast() / getHistory()
        ├──────────────┬──────────────────┐
   HealthGateway   HealthService     HealthController
   (relay saja)    (compose DTO)     (REST, baca cache)
```

### Tanggung jawab

**`HealthSamplerService`** (file baru, `apps/backend/src/modules/health/health-sampler.service.ts`, target <300 baris) — satu-satunya yang melakukan probing. Memegang jadwal, state snapshot, ring buffer, dan koneksi Redis persisten. Dapat ditest tanpa socket.io.

**`HealthService`** — turun jadi ~200 baris. Menyisakan probe primitif (`checkDatabaseHealth`, `checkRedisHealth`, `getCpuUsage`, `getDiskUsage`, `checkServiceHealth`), incident tracking, dan penyusunan DTO dari snapshot sampler. Tidak lagi menjadwalkan apa pun — `@Cron` pada `health.service.ts:206` dihapus.

**`HealthGateway`** — hanya relay. `@Interval(5000)` pada `health.gateway.ts:99` dihapus; sampler memanggil `gateway.pushFast()` / `pushSlow()` / `pushIncident()`.

### Arah dependency

Sampler → HealthService (probe primitif). Gateway ↔ Sampler dengan `forwardRef`, mengikuti pola yang sudah dipakai di `health.gateway.ts:41`. Sampler butuh gateway untuk push; gateway butuh sampler untuk snapshot saat client subscribe.

### Perbaikan yang ikut masuk

Menyentuh kode yang sama, jadi dikerjakan sekalian:

1. `wmic` `execSync` (`health.service.ts:466-493`) → `fs.promises.statfs`. Node v24 (terverifikasi: `typeof fs.statfs === 'function'`), cross-platform, non-blocking. Import `child_process` dihapus.
2. Redis check (`health.service.ts:251-267`) → satu client persisten di sampler, bukan connect/quit tiap siklus.
3. Magic number cadence → konstanta bernama `FAST_INTERVAL_MS`, `SLOW_INTERVAL_MS`, `HISTORY_SIZE`, `STALE_THRESHOLD_MS`.

## Protokol Event

Tiga event menggantikan dua event sekarang. `health:metrics` dibuang karena isinya duplikat `health:update`.

### `health:snapshot`

Dikirim sekali saat client subscribe.

```ts
{
  ...DetailedHealthStatus,      // bentuk lama, kompatibel
  serverTime: string,           // ISO, untuk kalibrasi jam uptime
  history: {
    cpu: number[],
    memory: number[],
    dbLatency: number[],
    redisLatency: number[],
  },                            // maks 60 titik, urut lama→baru
  sampledAt: { fast: string, slow: string },
}
```

### `health:fast` — tiap 2 detik, ~300 byte

```ts
{
  serverTime: string,
  uptime: number,
  cpuUsage: number,
  memoryUsage: number,
  memoryFree: number,
  loadAverage: number[],
  database: { status: 'connected' | 'disconnected', latency: number },
  redis: { status: 'connected' | 'disabled' | 'error', latency?: number },
  websocket: { clients: number },
}
```

### `health:slow` — tiap 30 detik

```ts
{
  serverTime: string,
  status: 'ok' | 'degraded' | 'error',   // overall, dihitung di slow tier
  disk: { usage: number, total: number, free: number },
  services: ServiceStatus[],
  redisDetail?: {
    usedMemory: number,
    keys: number,
    queues: { name: string, waiting: number, active: number, failed: number }[],
  },
  backup: { configured: boolean, connected?: boolean, lastBackup?: string },
}
```

### `health:incident`

Bentuk tetap seperti sekarang (`health.gateway.ts:142`). Perbedaannya: dipancarkan langsung saat sampler mendeteksi perubahan status, bukan hasil filter window 10 detik (`health.gateway.ts:132-138`). Sampler tahu persis kapan status berubah.

### Dampak traffic

Sekarang: ~4 KB × 2 event / 5 s ≈ 1,6 KB/s.
Setelah: 300 B/2 s + 3 KB/30 s ≈ 250 B/s. Turun ~85 % walau frekuensi naik 2,5×.

### Kompatibilitas

`GET /health/detailed` tetap mengembalikan `DetailedHealthStatus` utuh, dibaca dari cache sampler tanpa re-probe. Frontend menyusun ulang `health:fast` + `health:slow` menjadi satu objek berbentuk `DetailedHealthStatus`, sehingga struktur yang dikonsumsi `SystemHealthPage.tsx` tidak berubah.

### Uptime tick lokal

```ts
// useHealthSocket: simpan baseline setiap payload masuk
uptimeBase = { uptime, receivedAt: Date.now() }
// setInterval(1000): uptime = uptimeBase.uptime + (Date.now() - receivedAt) / 1000
```

Resync tiap `health:fast` → drift maksimum 2 detik dan tidak akumulatif.

## Aktivasi Redis

### Langkah

1. `apps/backend/.env:46` — ubah `REDIS_ENABLED=false` menjadi `REDIS_ENABLED=true`
2. Restart backend

Tidak ada perubahan kode. Terverifikasi: container `idesk-redis` sudah berjalan (healthy), `ioredis@^5.3.2` dan `@nestjs/bull@^11.0.4` sudah terpasang di `apps/backend/package.json`.

### Yang berubah setelah aktif

- `CacheService` (`cache.service.ts:39-95`) beralih ke Redis, dengan fallback in-memory bila koneksi gagal (`cache.service.ts:90-94`).
- `QueueModule.forRoot()` (`queue.module.ts:42`) meregistrasi queue via Bull.

### Temuan: queue tanpa producer

Verifikasi grep atas `apps/backend/src`:

- `notifications`, `emails`, `zoom-meetings`, `file-processing`, `reports` — **tidak ada producer aktif**. `ZoomQueueService` terdaftar di `zoom-booking.module.ts:30` tetapi tidak dipanggil dari mana pun.
- `google-sync` — satu-satunya producer nyata (`sync-scheduler.service.ts:99`), processor-nya sudah terdaftar benar di `google-sync.module.ts:20`.
- `NotificationProcessor`, `EmailProcessor`, `ZoomMeetingProcessor` hanya di-export dari `shared/queue/index.ts`, tidak pernah menjadi provider di module mana pun.

Konsekuensi: aktivasi Redis rendah risiko dari sisi queue — tidak akan ada job menumpuk karena tidak ada yang mengirim job. Panel queue depth akan menampilkan nol untuk kelima queue tersebut, yang justru membuat kondisi ini terlihat.

### Risiko di luar scope: `CacheService.get()` selalu miss

`cache.service.ts:117-134` mengembalikan `null` tanpa syarat ketika Redis aktif:

```ts
if (this.useRedis && this.redisClient) {
    // Return null here, use getAsync for Redis
    return null;
}
```

Semua pemanggil sinkron `get()` akan selalu cache-miss setelah `REDIS_ENABLED=true`. Ini bug nyata yang hanya muncul saat Redis dinyalakan. **Tidak diperbaiki dalam spec ini** — di luar scope halaman system-health. Perlu diaudit sebelum aktivasi produksi: cari semua pemanggil `get()` sinkron dan pindahkan ke `getAsync()`, atau hapus jalur sinkron.

### Sumber data panel Redis

Satu ioredis client persisten di sampler, `lazyConnect: false`, `retryStrategy` mengikuti pola `cache.service.ts:51-60`.

| Data | Perintah | Tier |
|---|---|---|
| Latency | `PING` | fast (2s) |
| Used memory | `INFO memory` → parse `used_memory` | slow (30s) |
| Jumlah keys | `DBSIZE` | slow (30s) |
| Queue depth | `LLEN bull:<name>:wait`, `LLEN bull:<name>:active`, `SCARD bull:<name>:failed` | slow (30s) |

Queue depth dibaca dari key Bull mentah, **tanpa inject `BullModule`**. Alasan: bila `REDIS_ENABLED=false`, `QueueModule` mengembalikan module kosong (`queue.module.ts:34-38`), sehingga HealthModule tidak boleh bergantung padanya.

Konstanta di satu tempat:

```ts
const MONITORED_QUEUES = [
  'notifications', 'emails', 'file-processing',
  'reports', 'zoom-meetings', 'google-sync',
] as const;
```

## Error Handling

Prinsip: setiap probe di-wrap `Promise.allSettled`. Satu sensor gagal tidak membatalkan siklus.

| Kondisi | Perilaku |
|---|---|
| `REDIS_ENABLED=false` | Sampler tidak membuat client. Status `disabled`, `redisDetail` undefined. Kartu menampilkan hint cara mengaktifkan. |
| Redis mati saat runtime | `retryStrategy` reconnect di background. Status `error` + latency terakhir. Tidak throw. Log sekali saat transisi, bukan tiap siklus. Incident tercatat. |
| `INFO` / `DBSIZE` gagal | `redisDetail` undefined untuk siklus itu. Status ping tetap dilaporkan apa adanya. |
| DB mati | Semua `services` menjadi `down`, overall `error`. Fast tier tetap jalan — CPU/RAM/uptime tidak bergantung DB. |
| `statfs` gagal | disk `{ usage: 0, total: 0, free: 0 }` seperti sekarang. UI sudah menangani (`SystemHealthPage.tsx:351` → 'N/A'). |
| Satu tier throw | Ditangkap per-tier. Tier lain tidak terpengaruh. `sampledAt` memungkinkan UI menunjukkan data basi. |

## Perubahan UI

Perubahan bertarget pada `apps/frontend/src/features/admin/pages/SystemHealthPage.tsx`, bukan tulis ulang.

1. **Uptime jadi jam berjalan** (`:369`) — nilai dari `useHealthSocket` yang sudah tick per detik. `formatUptime` diperluas ke detik: `2d 5h 13m 08s`, supaya gerakannya terlihat.

2. **Sparkline pada gauge** — memakai komponen yang sudah ada, `apps/frontend/src/components/ui/Sparkline.tsx`, dengan `width={80} height={28} filled`. Ditempatkan di bawah label gauge CPU dan RAM. Warna mengikuti threshold yang sudah dipakai (`:309`, `:326`). Tidak ada komponen baru.

3. **Kartu Redis diperluas** (`:398-418`) — saat `connected`: latency, used memory, jumlah keys, lalu daftar queue dengan depth. Queue dengan `failed > 0` ditandai merah. Saat `disabled`: teks "Not configured" diganti hint statis `Set REDIS_ENABLED=true`. Bukan tombol — menyalakan Redis dari UI berarti menulis `.env` dari proses web.

4. **Indikator kesegaran data** — `LivePulse` (`:160`) ditambah umur sampel. Bila `health:fast` tidak masuk lebih dari `STALE_THRESHOLD_MS` (6 detik), badge menjadi "Stale 8s" berwarna kuning. Alasan: panel sekarang tidak bisa membedakan "sistem sehat" dari "socket mati, data beku" — kegagalan diam yang paling berbahaya di halaman monitoring.

5. **Kartu WebSocket** (`:429`) — `StatusBadge status={isConnected ? ... }` sekarang melaporkan koneksi browser ini, bukan kesehatan server. Diganti dengan `websocket.status` dari server; jumlah client tetap dari payload.

6. **Sparkline DB latency** pada kartu Database (`:394`).

Tidak diubah: layout grid, palet warna, `StatusBadge`, `CircularGauge`, kartu Backup, Services grid, Incident history, System Information.

## Testing

Belum ada test untuk modul health. Backend memakai jest, frontend vitest.

### Backend — `health-sampler.service.spec.ts`

`DataSource` dan `ConfigService` di-mock.

- fast tier menghasilkan cpu/mem/uptime tanpa menyentuh service check DB
- satu probe reject → `Promise.allSettled` tetap mengembalikan tier utuh, field yang gagal ber-fallback
- ring buffer berhenti di 60, elemen tertua terbuang, urutan lama→baru
- `REDIS_ENABLED=false` → tidak ada client dibuat, status `disabled`
- Redis ping reject → status `error`, tier lain utuh
- perubahan status service → tepat satu incident, tidak duplikat pada siklus berikutnya

### Backend — `health.service.spec.ts`

- `getDetailedHealth()` membaca cache sampler tanpa re-probe (spy pada probe primitif: nol panggilan)
- bentuk `DetailedHealthStatus` tidak berubah dari versi sekarang — guard kompatibilitas REST

### Frontend — `__tests__/useHealthSocket.test.ts`

`socket.io-client` di-mock.

- `health:snapshot` → history terisi; `health:fast` berikutnya menambah satu titik dan membuang yang tertua pada batas 60
- uptime tick naik ~1/detik dengan fake timers, resync saat fast masuk, tanpa drift akumulatif
- fast tidak masuk lebih dari 6 s → flag `isStale` bernilai true
- `health:slow` menggabung, tidak menimpa field milik fast tier

### Verifikasi manual

Harus dijalankan, bukan diasumsikan:

1. `REDIS_ENABLED=true`, restart backend → log `✅ Redis ready`, kartu Redis `connected`
2. Buka panel, amati 60 detik: uptime bertambah tiap detik, sparkline memanjang, tidak ada error konsol
3. `docker stop idesk-redis` → kartu menjadi `error`, incident muncul, panel lain tetap hidup; `docker start idesk-redis` → pulih tanpa restart backend
4. DevTools Network WS → konfirmasi frame ~300 B tiap 2 detik

## Di Luar Scope

Sengaja dilewati:

- **Ring buffer hilang saat restart.** Cukup untuk panel live 2 menit. Tambahkan tabel riwayat health bila nanti butuh tren lebih panjang.
- **Availability % (mis. 99,8 % / 24 jam).** Perlu penyimpanan persisten. Tambahkan bersama tabel riwayat health kalau ada kebutuhan SLA report.
- **Sensor registry.** Hanya ada ~8 sensor dan tidak ada rencana menambah banyak — abstraksi yang belum dibutuhkan.
- **Perbaikan `CacheService.get()`.** Bug nyata (lihat bagian Risiko), tetapi di luar halaman system-health. Perlu spec sendiri.
- **Autentikasi WebSocket namespace `/health`.** Gateway saat ini tidak memakai guard (`health.gateway.ts:49`), sama seperti `permissions.gateway.ts:45`. Tidak diubah agar konsisten dengan pola yang ada; bila perlu diperketat, terapkan ke semua gateway sekaligus dalam satu perubahan tersendiri.

## Berkas Terdampak

| Berkas | Aksi |
|---|---|
| `apps/backend/src/modules/health/health-sampler.service.ts` | baru |
| `apps/backend/src/modules/health/health.service.ts` | refactor — buang `@Cron`, ganti `wmic` → `statfs`, buang Redis connect per-check |
| `apps/backend/src/modules/health/health.gateway.ts` | refactor — buang `@Interval(5000)`, jadi relay |
| `apps/backend/src/modules/health/health.module.ts` | daftarkan sampler |
| `apps/backend/src/modules/health/dto/health.dto.ts` | tambah tipe payload fast/slow/snapshot |
| `apps/backend/src/modules/health/health.controller.ts` | baca cache sampler |
| `apps/backend/.env:46` | `REDIS_ENABLED=true` |
| `apps/frontend/src/features/admin/hooks/useHealthSocket.ts` | tiga event, uptime tick, history, flag stale |
| `apps/frontend/src/features/admin/pages/SystemHealthPage.tsx` | sparkline, jam uptime, kartu Redis, badge stale, kartu WebSocket |
| `apps/backend/src/modules/health/__tests__/` | test baru |
| `apps/frontend/src/features/admin/hooks/__tests__/useHealthSocket.test.ts` | test baru (konvensi repo: `__tests__/*.test.ts`) |
