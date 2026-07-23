# Zoom Meeting Detail UI Polish — Design Spec

**Tanggal:** 2026-07-23  
**Status:** Draft — menunggu review pengguna  
**Scope:** detail meeting Zoom pada modal list/client dan modal kalender.

## Tujuan

Hilangkan kesan UI generik/berisik dari detail meeting tanpa mengubah alur, data, permission, atau aksi. Kedua detail view memakai pola visual yang sama: **Quiet Record**.

## Batas Scope

Masuk scope:

- Polish `BookingDetailsModal.tsx` dan `ZoomBookingDetailView.tsx`.
- Palet blue/slate dan dark mode existing tetap dipakai.
- Perjelas hierarchy header, metadata, join information, notices, loading, dan action footer.
- Tambah atau perluas test render/aksi detail bila coverage existing belum cukup.

Tidak masuk scope:

- Perubahan API, hook, DTO, state global, dependency, atau permission backend.
- Perubahan urutan data atau perilaku join, copy, reschedule, cancel, dan close.
- Perubahan desain form reschedule/cancel atau layout halaman kalender/client.

## Komponen Target

- `apps/frontend/src/features/zoom-booking/components/BookingDetailsModal.tsx`
- `apps/frontend/src/features/zoom-booking/components/ZoomBookingDetailView.tsx`

Kedua komponen harus memakai struktur dan token visual setara, meski satu dibungkus `Dialog` dan satu dirender di dalam `ZoomBookingModal`.

## Struktur dan Visual

### Header

Hapus gradient banner, blob blur, status overlap, icon-square dekoratif, dan card border bertumpuk.

Header mengikuti urutan:

1. Eyebrow `DETAIL MEETING`.
2. Judul meeting sebagai heading utama.
3. Account label tipis bila akun tersedia.
4. Status semantic sebagai text/badge kecil, bukan elemen floating.
5. Description bila tersedia.

### Metadata

Tampilkan definition list dalam grid dua kolom pada desktop dan satu kolom pada mobile:

- Tanggal.
- Waktu.
- Durasi.
- Dibooking oleh.

Label memakai uppercase kecil dan muted; value memakai text lebih tegas. Metadata tidak memakai ikon kotak atau container individual ber-border.

### Join Information

Jika `booking.meeting` tersedia:

- Gunakan satu soft-blue surface tanpa gradient dan tanpa nested card border.
- Tampilkan join URL read-only dengan aksi salin dan buka link.
- Tampilkan Meeting ID dan passcode sebagai pasangan data ringkas dengan salin per value.
- `Salin Full Invitation` tetap tersedia sebagai aksi setara.

Jika link belum tersedia, tampilkan notice pending atau conflict existing secara ringkas dengan warna semantic. Copy failure tetap ditangani helper `copyToClipboard` existing.

### Notices

- External meeting: notice netral yang menjelaskan perubahan harus dilakukan lewat Zoom Web Portal.
- Cancelled meeting: notice destructive dengan cancellation reason.
- Pending link: notice amber existing tanpa dekorasi tambahan.

### Action Footer

Aksi setara, wrapping pada mobile:

- Join meeting bila URL tersedia.
- Salin full invitation bila URL tersedia.
- Reschedule bila `canManage` dan callback/modal tersedia.
- Batalkan bila `canManage`.
- Tutup.

`Batalkan` tetap destructive dan selalu membuka `CancelBookingModal`. Aksi tidak dihapus berdasarkan visual state selain kondisi permission/status existing.

## Data Flow dan Permission

Tidak ada perubahan pada:

- `useBookingDetails` dan `useAuth`.
- `STAFF_ROLES`, owner/staff check, `canManage`, external meeting restriction, atau cancelled meeting restriction.
- `copyToClipboard`, `generateInvitationText`, `window.open`, `RescheduleModal`, dan `CancelBookingModal`.

## Motion dan Aksesibilitas

- Transisi hanya transform/opacity dengan `var(--ease-out)` jika diperlukan.
- Tidak ada blur pada scrolling content atau elemen dekoratif animasi.
- Heading, URL input, button copy/open, action footer, dan close target tetap memiliki accessible name.
- Grid metadata dan action footer harus collapse/wrap di bawah `md` tanpa clipping.

## Error dan State

- Loading memakai skeleton/spinner ringkas.
- Jika booking tidak ditemukan, dialog/panel tetap tidak merender detail seperti behavior existing.
- API error dan copy error tetap memakai handling existing; tidak disembunyikan.

## Test dan Verifikasi

1. Test render kedua detail view untuk title, metadata, meeting link/no-link notice, dan status.
2. Test permission action owner/staff versus external/cancelled booking.
3. Test copy/join/reschedule/cancel wiring tetap memakai callback/helper/modal existing.
4. Jalankan Vitest target, suite frontend, dan `npm run build` dari `apps/frontend`.
5. Review mobile dan dark mode secara manual bila browser automation tersedia.

## Kriteria Sukses

- Dua detail view memiliki hierarchy Quiet Record yang konsisten.
- Tidak ada gradient banner, blob blur, status overlap, card border berlapis, atau icon-square dekoratif.
- Data, permission, copy, join, reschedule, cancel, dan close tetap berfungsi dengan kontrak sama.
- Palet blue/slate dan dark mode existing tetap terbaca.
- Metadata dan action footer tidak terpotong pada mobile.
