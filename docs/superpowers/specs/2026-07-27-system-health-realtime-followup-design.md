# System Health Realtime Follow-up — Design

**Tanggal:** 2026-07-27
**Status:** Disetujui, menunggu review spec

## Tujuan

Perbaiki lima temuan verifikasi pada implementasi System Health Realtime yang sudah merged di `main`:

1. `memoryTotal` bernilai `0` pada WebSocket snapshot dan fast update.
2. Redis tidak bisa pulih setelah ioredis berhenti retry karena reference client lama tetap tersimpan.
3. Test queue fallback bernama benar tetapi tidak menguji enam queue atau nilai fallback.
4. `HealthService.checkRedisHealth()` mengembalikan `disabled` bahkan ketika Redis aktif.
5. `clockNow` ditulis tiap detik tetapi tidak dipakai saat menghitung stale state.

## Batasan

- Tidak menambah dependency.
- Tidak membuat Redis adapter atau abstraksi baru.
- Tidak mengubah cadence: fast tier 2 detik, slow tier 30 detik, stale 6 detik.
- Tidak menyentuh `CacheService.get()` sinkron; audit itu tetap pekerjaan terpisah.
- Tidak menambah autentikasi gateway `/health`.
- Perubahan protocol hanya penambahan `memoryTotal` pada fast payload; field itu sudah ada pada `SystemMetrics` dan dibutuhkan UI.

## Desain

### Memory realtime

`HealthFastUpdate` ditambah `memoryTotal: number`.

`HealthSamplerService.refreshFastTier()` mengambil nilai tersebut dari `HealthService.getFastSystemMetrics()`, menyimpannya dalam `fastSnapshot`, dan meneruskannya lewat `getFastUpdate()` serta `getSnapshot()`.

Frontend listener `health:fast` memperbarui `current.system.memoryTotal` bersama `memoryUsage` dan `memoryFree`. UI Memory tetap memakai perhitungan saat ini:

```ts
health.system.memoryTotal - health.system.memoryFree
```

Hasilnya tidak lagi negatif atau invalid saat data berasal dari Socket.IO.

### Redis recovery

Pendekatan dipilih: **buat ulang client pada fast tier berikutnya**.

Redis client memiliki lifecycle minimal:

1. `createRedisClient()` menyimpan client baru dan memasang listener `end`/`close`.
2. Bila client berakhir setelah retry habis, listener hanya set `this.redisClient = null` bila field masih menunjuk client yang sama.
3. Bila `PING` gagal, `refreshFastTier()` juga mengosongkan reference dengan guard identitas sama.
4. Fast refresh berikutnya (maksimum 2 detik) memanggil `createRedisClient()` lalu ping client baru.
5. Saat Redis mati, payload tetap `{ status: 'error' }`; sensor CPU/RAM/DB tetap berjalan.

Guard identitas mencegah event `close` client lama menghapus client baru:

```ts
private clearRedisClient(client: any): void {
    if (this.redisClient === client) this.redisClient = null;
}
```

Retry ioredis tetap dibatasi 10 attempt seperti implementasi sekarang. Tidak ada retry tanpa batas atau timer tambahan.

### Redis health API

`HealthService.checkRedisHealth()` tidak membuka koneksi Redis baru. Method membaca `sampler.getSnapshot().infrastructure.redis`, lalu mengembalikan hanya kontrak lama:

```ts
async checkRedisHealth(): Promise<{ status: 'connected' | 'disabled' | 'error'; latency?: number }> {
    const { status, latency } = this.sampler.getSnapshot().infrastructure.redis;
    return { status, latency };
}
```

`getInfrastructureStatus()` memakai status snapshot Redis ini. Tidak ada lagi Redis aktif yang dilaporkan sebagai `disabled`.

### Stale state

Hook tetap memakai satu interval per detik untuk uptime dan stale state. `clockNow` menjadi sumber waktu tunggal:

```ts
const isStale = Boolean(
    lastFastUpdate && clockNow - lastFastUpdate > STALE_THRESHOLD_MS,
);
const staleSeconds = lastFastUpdate
    ? Math.floor((clockNow - lastFastUpdate) / 1_000)
    : 0;
```

`UseHealthSocketReturn` mengekspos `staleSeconds`. `LivePulse` menerima nilai itu, tidak memanggil `Date.now()` sendiri. Render menjadi deterministik dan dapat diuji dengan fake timer.

### Test coverage

Backend sampler tests ditambah:

- Fast payload dan snapshot meneruskan `memoryTotal` dari sensor fast.
- Redis client yang mengirim `end` atau `PING` gagal dibersihkan; fast refresh berikutnya membuat client baru dan melaporkan `connected`.
- Queue telemetry menggunakan pipeline mock dengan satu response valid dan campuran `null`/`Error`; hasil selalu enam queue (`notifications`, `emails`, `file-processing`, `reports`, `zoom-meetings`, `google-sync`) serta angka `0` untuk command yang gagal.

Backend HealthService test ditambah:

- `checkRedisHealth()` meneruskan `connected` dan latency snapshot sampler.

Frontend hook test ditambah:

- Fast update memperbarui `memoryTotal`.
- Setelah fake timer melewati 6 detik, `isStale` true dan `staleSeconds` bertambah tiap detik.

Frontend page test memakai snapshot WebSocket dengan `memoryTotal > memoryFree`, lalu assert tampilan Memory menunjukkan penggunaan positif dan total yang benar.

## Verifikasi

1. Instal dependencies backend bila `apps/backend/node_modules` belum ada, lalu jalankan health Jest tests dan `npm run build`.
2. Jalankan frontend hook/page Vitest tests dan `npm run build`.
3. Set `REDIS_ENABLED=true` di `.env` dev, restart backend, lalu cek `/v1/health/detailed`: Redis `connected`, `memoryTotal > 0`, disk tetap bernilai nyata.
4. `docker stop idesk-redis`, tunggu satu fast cycle: Redis `error`, sensor lain tetap hidup. `docker start idesk-redis`, tunggu satu fast cycle: Redis kembali `connected` tanpa restart backend.

## Berkas Terdampak

| Berkas | Perubahan |
|---|---|
| `apps/backend/src/modules/health/dto/health.dto.ts` | Tambah `memoryTotal` pada `HealthFastUpdate`. |
| `apps/backend/src/modules/health/health-sampler.service.ts` | Simpan/publish memory total, clear/recreate Redis client aman. |
| `apps/backend/src/modules/health/health-sampler.service.spec.ts` | Test memory, Redis recovery, queue fallback aktual. |
| `apps/backend/src/modules/health/health.service.ts` | Snapshot-backed Redis health. |
| `apps/backend/src/modules/health/health.service.spec.ts` | Test Redis health dari snapshot. |
| `apps/frontend/src/features/admin/hooks/useHealthSocket.ts` | Merge memory total, expose stale seconds, pakai clock state. |
| `apps/frontend/src/features/admin/hooks/__tests__/useHealthSocket.test.tsx` | Test memory dan stale seconds. |
| `apps/frontend/src/features/admin/pages/SystemHealthPage.tsx` | `LivePulse` menerima stale seconds. |
| `apps/frontend/src/features/admin/pages/__tests__/SystemHealthPage.test.tsx` | Assert Memory stat positif. |
