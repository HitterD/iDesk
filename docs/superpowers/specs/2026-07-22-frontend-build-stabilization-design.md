# Frontend Build Stabilization — Design Spec

**Tanggal:** 2026-07-22  
**Status:** Approved

## Masalah

`apps/frontend` tidak dapat menyelesaikan production build dan full test suite.

- `npm run build` gagal dengan 168 TypeScript error.
- `tsconfig.app.json` meng-include seluruh `src`, termasuk test, tetapi tidak memuat global Vitest. Ini menghasilkan mayoritas error `describe`, `it`, `expect`, dan `vi` tidak ditemukan saat production build.
- Sisa error adalah type drift nyata antara consumer frontend dan tipe domain/hook aktual.
- `npm test` gagal pada 10 test di 5 file. Mayoritas test masih mengharapkan copy UI lama; satu test procurement bertentangan dengan workflow backend.

## Temuan Riset

### Konfigurasi Test

`apps/frontend/tsconfig.app.json:39-41` meng-include `src` tanpa mengecualikan test. `compilerOptions.types` hanya memuat `vite/client` dan `node` (`:23-26`).

### Procurement

`canDecideProcurement()` memberi ICT akses pada `APPROVED` dan `PROCUREMENT` (`apps/frontend/src/features/hardware-request/utils/permission.util.ts:70-73`). Ini benar: backend menerima keputusan pertama saat `APPROVED`, lalu atomik mengubah request menjadi `PROCUREMENT` (`apps/backend/src/modules/hardware-request/services/procurement-decision.service.ts:31-39`).

### Type Drift

Contoh consumer memakai properti yang sudah tidak ada dari tipe domain: `division`, `recipientName`, `qty`, `catalogName`, dan `category`. Kontrak aktual memakai `recipient`, `quantity`, dan `categorySnapshot`.

## Tujuan

`npm run build` dan `npm test` selesai exit `0`, tanpa menyembunyikan type error source aplikasi dan tanpa mengubah workflow bisnis yang sudah dijaga backend.

## Keputusan

1. Production TypeScript build mengecualikan seluruh test frontend. Vitest tetap menjadi runner test terpisah.
2. Consumer aplikasi harus mengikuti tipe domain/hook aktual. Tidak menambah cast `any` atau memperluas tipe hanya untuk menutupi pemakaian field legacy.
3. Test UI mengikuti copy dan struktur komponen aktual bila perilaku produk tidak berubah.
4. Procurement ICT valid pada `APPROVED` dan `PROCUREMENT`; test diselaraskan dengan transition backend.
5. Perbaikan dipecah menjadi cluster kecil dan commit terpisah, agar regressions mudah diisolasi.

## Arsitektur Perbaikan

### Cluster A — Compiler Boundary

- Ubah `apps/frontend/tsconfig.app.json` untuk mengecualikan `src/**/*.test.ts`, `src/**/*.test.tsx`, `src/**/*.spec.ts`, `src/**/*.spec.tsx`, dan `src/**/__tests__/**` dari build aplikasi.
- Jangan menambah Vitest globals ke production tsconfig. Test tetap memakai `vitest.config.ts` dan imports eksplisit seperti test existing.

### Cluster B — Notification dan Shared Type Consumers

- Samakan `ActionCommandCenter` dengan export `SnoozeDuration` dan return hook `useSnoozeActionItem`.
- Samakan `NotificationSettings` dengan `CategorySettings` dan `updateSettings` dari hook existing.
- Gunakan `statusConfig.color` yang sudah berisi class status di ticket client; samakan prop `ConfirmationDialog` dan payload mutation.
- Gunakan `.mutateAsync()` pada object mutation calendar.
- Kirim object untuk `requiredFields` pada catalog payload.
- Ubah status `REVIEW` menjadi `UNDER_REVIEW` dengan array bertipe `RequestStatus[]`.
- Hapus tipe Agent lokal duplikat dan pakai tipe shared existing.
- Ketatkan type Framer Motion dan API Zod sesuai versi dependency terpasang.

### Cluster C — Hardware Request Domain Consumers

- Ganti akses property legacy dengan field `HardwareRequest`/`HardwareRequestItem` aktual.
- `recipient?.fullName` menggantikan `recipientName`.
- `quantity` menggantikan `qty`.
- `categorySnapshot?.name` dan `categorySnapshot?.category` menggantikan `catalogName`/`category` langsung.
- Jangan menampilkan `division` jika tidak disediakan kontrak API. Tidak ada fallback data yang direka.
- Pastikan `EmptyState` yang dipakai menerima `icon` atau hapus prop dari caller, berdasarkan API komponen aktual.

### Cluster D — Test Contract Repair

- Perbaiki path import scheduling test dan import `vi` duplikat.
- Update assertions copy test ke label aktual: `Daftar Request`, `Overview`, `Jadwal Instalasi`, `Tambah Custom Field`, dan `Scheduled`.
- Hilangkan expectation heading bila layout memang tidak mendefinisikan heading; tetap cek outlet dan nav accessible.
- Update procurement test untuk mengizinkan ICT pada `APPROVED` dan `PROCUREMENT`; USER tetap ditolak.

## Error Handling dan Security

- Tidak mengubah backend authorization atau state-machine enforcement.
- Tidak menambah bypass authorization di UI.
- Input DTO/type tetap tervalidasi existing backend dan frontend. Perubahan hanya menyelaraskan payload ke kontrak yang sudah ada.
- `tsconfig` exclude hanya test source, bukan source aplikasi.

## Testing

Setiap cluster menjalankan test fokus yang terkait, lalu:

```bash
cd apps/frontend
npm run build
npm test
```

Target akhir:

- `npm run build` exit `0`.
- `npm test` exit `0`.
- Test notification center tetap lulus:

```bash
npm test -- src/components/notifications/utils/__tests__/notificationRouter.test.ts
```

## Di Luar Scope

- Perombakan workflow hardware request.
- Halaman atau route baru.
- Refactor besar arsitektur types.
- Menambah dependency atau downgrade Zod/Framer Motion.
- Perubahan kode backend di luar klarifikasi kontrak procurement yang sudah terbukti.
