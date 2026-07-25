# TV Board Custom Ringtone — Design Spec

**Tanggal:** 2026-07-26
**Status:** Disetujui untuk implementasi

## Tujuan

Halaman TV Board (`/tv/:token`) membunyikan ringtone kustom saat tiket masuk, saat tiket pindah ke In Progress, dan pada jam pulang. Ringtone diatur per site melalui halaman Settings.

## Keputusan Desain

| Aspek | Keputusan |
|---|---|
| Scope | Per-site. Tiap site punya set ringtone sendiri. |
| Sumber audio | Upload sendiri saja. Tanpa preset bawaan. Belum diupload = diam. |
| Jam pulang | Bisa diatur per site (default kosong), berlaku setiap hari termasuk akhir pekan. |
| Autoplay | Tanpa overlay konfirmasi. Mengandalkan flag browser di mini PC + indikator kecil bila diblokir. |
| Pemicu bunyi | Dibandingkan di sisi TV dari snapshot papan. Backend tidak mengirim event suara. |
| Tumpang tindih | Satu bunyi per jenis per update. Jika kedua jenis muncul pada update sama, antrekan memutar Tiket Masuk lalu In Progress; tidak tumpang tindih. |
| Penyimpanan | Kolom pada entity `Site`. Bukan tabel baru, bukan `system_settings`. |

## Batasan Browser (penting untuk operasional)

Chrome/Edge memblokir pemutaran audio sampai halaman pernah menerima interaksi pengguna. Tidak ada kode di dalam halaman yang bisa menembus ini. Solusinya di sisi perangkat.

**Mini PC Windows** — jalankan browser dengan flag:

```
chrome.exe --kiosk --autoplay-policy=no-user-gesture-required http://<server>/tv/<token>
```

Alternatif via Group Policy: `AutoplayAllowed = Enabled`.

**Smart TV (browser bawaan)** — tidak bisa diberi flag; perilakunya bergantung vendor. Bila TV terhubung ke mini PC lewat HDMI, batasan ini tidak berlaku karena yang berjalan adalah browser mini PC.

Halaman tetap memasang listener sekali-pakai pada `pointerdown` dan `keydown`: bila kebetulan ada sentuhan layar atau tombol remote, audio terbuka kuncinya. Ini pelengkap, bukan pengganti flag.

---

## Arsitektur

### 1. Skema Data

Empat kolom baru pada entity `Site` (`apps/backend/src/modules/sites/entities/site.entity.ts`, setelah `tvToken` di baris 39). Semua nullable — `null` berarti event tersebut tidak berbunyi.

```ts
@Column({ type: 'varchar', nullable: true })
ringtoneNewTicket: string | null;      // contoh: /uploads/sounds/ab12cd34.mp3

@Column({ type: 'varchar', nullable: true })
ringtoneInProgress: string | null;

@Column({ type: 'varchar', nullable: true })
ringtoneClosing: string | null;

@Column({ type: 'varchar', length: 5, nullable: true })
closingTime: string | null;            // format "HH:mm", contoh "17:00"
```

Satu migrasi TypeORM menambahkan keempat kolom.

**Alasan memilih kolom pada `Site`:** jumlah event tetap tiga dan tidak akan bertambah. `TvBoardService.getBoardData` sudah memuat baris `Site` (`tv-board.service.ts:48`), jadi data ringtone ikut tanpa query tambahan. Entity terpisah menambah repository, join, dan CRUD untuk tiga baris data per site. `system_settings` tidak punya tipe maupun foreign key, dan controller settings tidak menyediakan route generik sehingga route baru tetap harus ditulis.

### 2. Upload File

Route baru pada `apps/backend/src/modules/sites/sites.controller.ts`, mengikuti pola `sound.controller.ts:76`:

```
POST   /sites/:id/tv-ringtone         @Roles(ADMIN)
DELETE /sites/:id/tv-ringtone/:slot   @Roles(ADMIN)
```

Konfigurasi multer identik dengan modul sound yang sudah ada:
- `diskStorage` tujuan `./uploads/sounds`
- Nama file acak 32 karakter hex + ekstensi asli
- `fileFilter`: `file.mimetype.startsWith('audio/')`
- `limits.fileSize`: `5 * 1024 * 1024`

Body `POST` berisi `file` (multipart) dan `slot` (string). Kedua route mengembalikan baris `Site` yang sudah diperbarui, sehingga frontend dapat langsung mengganti state tanpa memuat ulang daftar site.

**Validasi slot.** `slot` divalidasi terhadap daftar tetap sebelum menyentuh database:

```ts
const RINGTONE_SLOTS = {
    newTicket: 'ringtoneNewTicket',
    inProgress: 'ringtoneInProgress',
    closing: 'ringtoneClosing',
} as const;
```

Slot di luar daftar melempar `BadRequestException`. Ini mencegah nilai slot dari klien memetakan ke kolom `Site` sembarang.

File audio disajikan melalui static asset yang sudah ada (`main.ts:190`, prefix `/uploads/`), sehingga halaman TV tanpa autentikasi dapat mengambilnya.

**File lama tidak dihapus dari disk** saat ringtone diganti. File audio berukuran kecil, dan menghapus file yang mungkin masih dirujuk lebih berisiko daripada menyisakan beberapa file yatim. Modul `sound` yang ada berperilaku sama. Ditandai dengan komentar `ponytail:` di kode.

### 3. Pengaturan Jam Pulang

Tanpa route baru. Field ditambahkan ke `UpdateSiteDto`:

```ts
@IsOptional()
@Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'closingTime harus format HH:mm' })
closingTime?: string;
```

Disimpan melalui `PATCH /sites/:id` yang sudah ada.

### 4. Payload TV Board

`TvBoardData` (`tv-board.service.ts:19`) mendapat satu field baru:

```ts
export interface TvBoardRingtones {
    newTicket: string | null;
    inProgress: string | null;
    closing: string | null;
    closingTime: string | null;
}

export interface TvBoardData {
    siteName: string;
    siteCode: string;
    open: TvBoardCard[];
    inProgress: TvBoardCard[];
    waitingVendorCount: number;
    ringtones: TvBoardRingtones;      // BARU
}
```

Diisi dari baris `site` yang sudah dimuat — tanpa query tambahan. Tipe yang sama dicerminkan di `apps/frontend/src/features/public/hooks/useTvBoardSocket.ts`.

Payload ini terkirim baik lewat `GET /tv/board/:token` maupun event socket `tv-board:update`, karena keduanya memanggil `getBoardData`.

---

## Komponen Frontend

### `detectBoardSounds.ts` (fungsi murni)

Lokasi: `apps/frontend/src/features/public/hooks/detectBoardSounds.ts`

```ts
export type BoardSoundEvent = 'newTicket' | 'inProgress';

export interface BoardSnapshot {
    open: string[];         // daftar ticket id
    inProgress: string[];
}

export function detectBoardSounds(
    prev: BoardSnapshot | null,
    next: BoardSnapshot,
): BoardSoundEvent[];
```

Aturan:

1. `prev === null` mengembalikan `[]`. Papan yang sudah berisi tiket tidak boleh berbunyi saat TV baru dinyalakan atau setelah socket tersambung ulang.
2. `newTicket` disertakan bila ada id di `next.open` yang tidak terdapat di `prev.open` maupun `prev.inProgress`.
3. `inProgress` disertakan bila ada id di `next.inProgress` yang sebelumnya berada di `prev.open`.
4. Setiap jenis muncul paling banyak sekali, berapa pun jumlah tiket yang memicunya.
5. Urutan hasil: `newTicket` sebelum `inProgress`.

Tanpa DOM dan tanpa timer, sehingga dapat diuji sebagai tabel input/output.

### `shouldPlayClosing` (fungsi murni)

Lokasi: satu file dengan hook jam pulang.

```ts
export function shouldPlayClosing(
    now: Date,
    closingTime: string | null,
    lastPlayedDate: string | null,   // "YYYY-MM-DD"
): boolean;
```

Mengembalikan `true` hanya bila `closingTime` terisi, jam dan menit `now` sama persis dengan `closingTime`, dan `lastPlayedDate` bukan tanggal `now`. Pemanggil menyimpan tanggal terakhir bunyi di ref, sehingga tidak berulang selama 60 detik dalam menit yang sama dan tidak lebih dari sekali per hari.

Berlaku setiap hari termasuk Sabtu dan Minggu.

### `useRingtone.ts`

Lokasi: `apps/frontend/src/features/public/hooks/useRingtone.ts`

```ts
export function useRingtone(): {
    enqueue: (urls: Array<string | null>) => void;
    blocked: boolean;
};
```

- Satu instance `Audio` disimpan di ref dan dipakai ulang; `src` diganti setiap pemutaran.
- `enqueue()` membuang nilai `null`. Jika dua URL sah dikirim, URL pertama harus selesai (`ended`) atau gagal (`error`) sebelum URL kedua mulai. Urutan untuk satu update papan: Tiket Masuk, lalu In Progress.
- Queue dari update baru ditambahkan setelah queue yang sedang berjalan, jadi tidak memotong ringtone yang sudah dimulai.
- Promise dari `HTMLAudioElement.play()` yang ditolak ditangkap. Kegagalan menyalakan `blocked`, membuang item gagal, lalu lanjut ke item berikutnya tanpa melempar.
- Pemutaran yang berhasil mematikan kembali `blocked`.
- Memasang listener `{ once: true }` pada `pointerdown` dan `keydown` di `window` yang mencoba membuka kunci audio bila ada interaksi.

### `BentoTvBoardPage.tsx`

Perubahan pada `apps/frontend/src/features/public/pages/BentoTvBoardPage.tsx`:

1. Ref menyimpan `BoardSnapshot` sebelumnya. Setiap `data` berubah, panggil `detectBoardSounds`, mainkan URL yang sesuai dari `data.ringtones`, lalu perbarui ref.
2. State `now` yang sudah berdetak tiap detik (`:184`) dipakai untuk memeriksa `shouldPlayClosing`.
3. Ikon `VolumeX` berukuran kecil di header, dirender hanya bila `blocked === true`.

Snapshot sebelumnya di-reset ke `null` saat socket terputus, sehingga update pertama setelah tersambung ulang tidak membunyikan semburan suara palsu. `useTvBoardSocket` sudah mengembalikan `isConnected` (`useTvBoardSocket.ts:71`) namun halaman belum memakainya; halaman mulai mengambil nilai itu dan mengosongkan ref snapshot setiap `isConnected` berubah menjadi `false`.

### `TvBoardSettings.tsx`

Perubahan pada `apps/frontend/src/features/settings/components/TvBoardSettings.tsx`. Setiap baris site mendapat:

- Tiga slot ringtone (Tiket Masuk, In Progress, Jam Pulang), masing-masing dengan tombol pilih file, tombol putar untuk uji dengar, dan tombol hapus
- Satu input `type="time"` untuk jam pulang, disimpan lewat `PATCH /sites/:id`

Interface `Site` di komponen ini ditambah keempat field baru.

---

## Penanganan Error

| Kondisi | Perilaku |
|---|---|
| Ringtone belum diupload (`null`) | Diam. Bukan error, tidak dicatat di log. |
| File audio 404 atau rusak | Item queue gagal dibuang. Papan tetap berjalan, lalu queue lanjut ke ringtone berikutnya bila ada. |
| Autoplay diblokir browser | Ikon `VolumeX` muncul di header. Papan tetap berjalan. |
| Socket putus lalu tersambung ulang | Snapshot sebelumnya di-reset ke `null`; update pertama tidak membunyikan apa pun. |
| Upload bukan file audio | Ditolak `fileFilter` backend. Toast merah di halaman settings. |
| `slot` tidak dikenal | `BadRequestException`. Kolom lain tidak dapat ditulis. |
| Upload melebihi 5MB | Ditolak batas multer. |
| Format `closingTime` salah | Ditolak `@Matches` pada DTO. |

---

## Rencana Pengujian

### Backend (Jest)

`tv-board.service.spec.ts`
- Payload memuat `ringtones` yang diambil dari kolom `Site`
- Nilai `null` diteruskan apa adanya, tidak diganti string kosong

`sites.service.spec.ts`
- `setTvRingtone` menulis kolom yang benar untuk setiap slot yang sah
- Slot tidak dikenal melempar `BadRequestException`
- `clearTvRingtone` menulis `null` ke kolom yang bersangkutan

DTO
- `closingTime` menolak `"25:00"`, `"5pm"`, `"7:00"`
- `closingTime` menerima `"17:00"` dan `"09:30"`

### Frontend (Vitest)

`detectBoardSounds.test.ts`
- `prev === null` mengembalikan `[]` walaupun papan berisi tiket
- Id baru di Open menghasilkan `['newTicket']`
- Id yang pindah dari Open ke In Progress menghasilkan `['inProgress']`
- Lima tiket baru sekaligus tetap menghasilkan satu entri `newTicket`
- Papan tidak berubah menghasilkan `[]`
- Tiket yang hilang dari papan tidak menghasilkan event apa pun

`shouldPlayClosing.test.ts`
- `closingTime` null mengembalikan `false`
- Jam cocok dan belum pernah bunyi hari ini mengembalikan `true`
- Jam cocok tetapi sudah bunyi hari ini mengembalikan `false`
- Jam tidak cocok mengembalikan `false`

`useRingtone.test.ts`
- `enqueue([null])` tidak memanggil `HTMLAudioElement.play`
- Dua URL valid diputar berurutan: URL kedua baru mulai setelah event `ended` dari URL pertama
- `play()` yang ditolak menyalakan `blocked`, membuang item gagal, lalu melanjutkan queue tanpa melempar
- Pemutaran valid setelah kegagalan mematikan kembali `blocked`

`BentoTvBoardPage.smoke.test.tsx`
- Indikator `VolumeX` tidak dirender saat audio normal
- Indikator dirender saat `blocked === true`

### Verifikasi Manual (wajib, tidak tercakup test otomatis)

jsdom tidak memiliki perangkat audio. Hal berikut harus dicek langsung di mini PC:

1. Upload tiga ringtone untuk satu site, uji dengar di halaman settings
2. Buka `/tv/<token>` dengan flag `--autoplay-policy=no-user-gesture-required`
3. Buat tiket baru di site tersebut — ringtone tiket masuk berbunyi
4. Pindahkan tiket ke In Progress — ringtone kedua berbunyi
5. Atur `closingTime` ke satu menit ke depan — ringtone jam pulang berbunyi sekali, tidak berulang
6. Muat ulang halaman saat papan sudah berisi tiket — tidak ada bunyi

---

## Di Luar Cakupan

- Pengaturan volume
- Preset ringtone bawaan
- Ringtone untuk event lain (SLA, resolved, waiting vendor)
- Pembersihan otomatis file audio yatim
- Jadwal jam pulang berbeda per hari
