# TV Board Two-Column Design

## Context

TV Board publik saat ini menampilkan tiga kolom (Open, In Progress, Resolved) dengan lebar sama. Tiga masalah dari penggunaan nyata di layar TV:

1. Kolom Resolved memakan sepertiga layar untuk tiket yang sudah tidak perlu ditindak.
2. Auto-scroll tidak pernah jalan saat tiket banyak — yang scroll justru halamannya.
3. Assignee dan requester terlalu kecil untuk dibaca dari jarak TV, dan department requester tidak ada sama sekali.

Spec ini menghapus kolom Resolved, memperbaiki auto-scroll, mengubah rasio kolom jadi 40:60, dan merombak isi kartu.

## Root cause auto-scroll

`BentoTvBoardPage.tsx:172-173` memakai `min-h-[100dvh]` pada root dan `min-h-[calc(100dvh-2rem)]` pada wrapper. Keduanya tinggi *minimum*, bukan tinggi tetap — jadi saat kartu bertambah, grid ikut memanjang melewati viewport. Kolom tidak pernah overflow, sehingga di `useColumnAutoScroll.ts:69` nilai `element.scrollHeight - element.clientHeight` selalu `0`. `stepAutoScroll` menerima `maxScroll <= 0` dan langsung kembali ke `{ phase: 'pause-top', scrollTop: 0 }` (`:19-21`) tiap frame. Hooknya benar; containernya yang salah.

Perbaikan ada di layout, bukan di hook:

| Elemen | Sebelum | Sesudah |
|---|---|---|
| Root div | `min-h-[100dvh]` | `h-[100dvh] overflow-hidden` |
| Wrapper flex | `min-h-[calc(100dvh-2rem)]` | `h-full` |
| Section kolom | `min-h-[280px]` | dihapus |

`min-h-[280px]` dihapus karena memaksa tinggi minimum yang melawan `min-h-0` pada grid, menahan kolom agar tidak menyusut ke tinggi tersedia.

Gaya scroll tetap seperti sekarang: turun → jeda → naik → jeda, 40px/detik, jeda 2500ms, per kolom independen. `useColumnAutoScroll.ts` tidak diubah.

## Kolom

Hanya **Open** dan **In Progress**. Resolved dihapus dari UI dan backend.

Rasio 40:60 lewat `md:grid-cols-5`: Open `md:col-span-2`, In Progress `md:col-span-3`. Konfigurasi `COLUMNS` dapat field `span`. Di bawah `768px` grid jadi satu kolom bertumpuk seperti sekarang.

Ukuran kartu tetap di semua lebar layar — tidak ada breakpoint `2xl:` untuk memperbesar teks. Sisa ruang kolom saat tiket sedikit dibiarkan kosong.

## Backend

`apps/backend/src/modules/tv-board/tv-board.service.ts`:

- `TvBoardData`: hapus field `resolved`.
- `TvBoardCard`: tambah `requesterDepartment: string | null`.
- Query: hapus klausa `{ siteId, status: TicketStatus.RESOLVED, resolvedAt: Between(weekStart, weekEnd) }` beserta perhitungan `weekStart`/`weekEnd`. Import `Between` dibuang jika tak terpakai lagi.
- Relations: `['user', 'assignedTo']` → `['user', 'user.department', 'assignedTo']`.
- `toCard`: `requesterDepartment: t.user?.department?.code ?? t.user?.department?.name ?? null`.
- Return: hapus baris `resolved:`.

Department memakai `code` (pendek, mis. `IT`, `FIN`) karena lebar kartu terbatas, dengan fallback ke `name` bila `code` kosong.

`waitingVendorCount` tidak berubah.

## Isi kartu

Urutan dari atas:

1. **Baris badge** — tidak berubah: Oracle/K2, priority, overdue/target SLA.
2. **Deskripsi** — tidak berubah: `line-clamp-3`, `text-lg font-bold`.
3. **Blok requester** — dua baris, di atas garis pemisah. Baris pertama nama dengan `truncate` dan atribut `title` berisi nama lengkap. Baris kedua kode department, ukuran lebih kecil dan warna lebih redup. Bila `requesterDepartment` null, baris kedua tidak dirender.
4. **Blok assignee** — di bawah garis pemisah, lebar penuh. Lingkaran inisial berwarna plus nama tebal ukuran `text-sm` (naik dari `text-[11px]`). Bila belum ada assignee: lingkaran border putus-putus abu dan teks amber "Belum ditugaskan".

Inisial diambil dari huruf pertama maksimal dua kata pertama nama, huruf besar. Warna lingkaran dipilih dari palet tetap lewat hash sederhana atas nama, sehingga satu orang selalu dapat warna sama. Keduanya fungsi kecil di dalam `BentoTvBoardPage.tsx`, bukan berkas terpisah.

Nama assignee juga `truncate` dengan `title` — assignee bisa bernama panjang sama seperti requester.

Import `CheckCircle2` dibuang karena hanya dipakai kolom Resolved.

## Files

- `apps/backend/src/modules/tv-board/tv-board.service.ts` — hapus jalur RESOLVED, tambah `requesterDepartment`.
- `apps/backend/src/modules/tv-board/tv-board.service.spec.ts` — sesuaikan assertion `resolved`, tambah test department (`code`, fallback `name`, null).
- `apps/backend/src/modules/tv-board/tv-board.gateway.spec.ts` — sesuaikan payload bila meng-assert `resolved`.
- `apps/frontend/src/features/public/hooks/useTvBoardSocket.ts` — hapus `resolved`, tambah `requesterDepartment`.
- `apps/frontend/src/features/public/pages/BentoTvBoardPage.tsx` — dua kolom 40:60, tinggi terkunci, kartu baru.
- `apps/frontend/src/features/public/pages/__tests__/BentoTvBoardPage.smoke.test.tsx` — sesuaikan mock data, verify department dan assignee.
- `apps/frontend/src/features/public/hooks/__tests__/useColumnAutoScroll.test.ts` — tambah test `maxScroll > 0` masuk fase `down`.

## Testing

- `stepAutoScroll` sudah punya unit test fase; tambah kasus `maxScroll > 0` bergerak turun, dan kasus `maxScroll === 0` tetap diam.
- Smoke test halaman: hanya dua kolom yang dirender, kode department tampil, "Belum ditugaskan" muncul saat `assignedToName` null.
- Backend spec: payload tidak lagi punya `resolved`, `requesterDepartment` terisi dari `code` dan jatuh ke `name` bila `code` kosong.

## Non-goals

- Tidak mengubah `useColumnAutoScroll.ts` — hooknya sudah benar.
- Tidak mengubah kanban internal (`features/ticket-board`) yang terpisah dari TV Board.
- Tidak mengubah endpoint, token, atau kontrol akses TV Board.
- Tidak menampilkan hitungan resolved dalam bentuk apa pun.
