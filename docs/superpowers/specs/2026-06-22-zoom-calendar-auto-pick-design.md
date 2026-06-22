# Zoom Calendar Auto-Pick Design

Tanggal: 2026-06-22

## Tujuan

Halaman Zoom Calendar harus stabil untuk 10 akun Zoom. Default kalender dan form booking memilih akun paling kosong, tanpa menghapus mode Gabungan untuk melihat semua akun.

## Scope

Masuk scope:
- Default account di day/week/month memakai akun paling kosong.
- Booking form/modal memakai akun paling kosong sebagai default.
- Manual selection user tidak dioverride.
- Mode Gabungan tetap ada sebagai explicit mode untuk melihat semua akun.
- Performa tetap memakai batch calendar endpoint untuk load 10 akun.
- Test minimal untuk auto-pick dan manual override.

Tidak masuk scope:
- Dashboard operasi baru.
- Heatmap kapasitas penuh.
- Redesign besar kalender.
- Limit baru di atas 20 akun.

## Current Evidence

- Load semua akun sudah memakai `/zoom-booking/calendar/batch` dalam satu request di `apps/frontend/src/features/zoom-booking/hooks/useAccountLoadSummary.ts`.
- Batch DTO backend menerima `accountIds` dengan batas 1 sampai 20 akun di `apps/backend/src/modules/zoom-booking/dto/booking.dto.ts`.
- Day view sudah dipaksa single-account ketika user berada di mode Gabungan di `apps/frontend/src/features/zoom-booking/pages/ZoomCalendarPage.tsx`.
- Socket Gabungan subscribe ke semua account id di `apps/frontend/src/features/zoom-booking/hooks/useZoomSocket.ts`.

## Recommended Approach: Smart Default, Manual Override

Gunakan akun paling kosong sebagai default di semua view dan booking form. Jika user memilih akun manual, pilihan tersebut tetap dipakai sampai user mengganti mode atau reset eksplisit.

Rationale:
- 10 akun masih optimal dengan batch endpoint 1 request.
- Single-account default membuat UI kalender lebih jelas.
- Gabungan tetap tersedia saat user perlu audit semua akun.
- Diff kecil dan risiko lebih rendah daripada dashboard baru.

## UX Behavior

### Calendar View

1. Saat halaman dibuka dan user belum memilih akun:
   - Hitung akun paling kosong dari meeting count/load summary.
   - Set active account ke akun tersebut.
   - Render day/week/month sebagai single-account calendar.

2. Saat user memilih akun manual:
   - Simpan manual selection.
   - Jangan auto-pick ulang walau load summary berubah.

3. Saat user memilih Gabungan:
   - Render semua akun di mode Gabungan.
   - Label mode harus jelas: “Gabungan — semua akun”.

4. Saat user keluar dari Gabungan ke single-account:
   - Jika belum ada manual selection, gunakan akun paling kosong.
   - Jika ada manual selection, gunakan pilihan user.

### Booking Form / Modal

1. Default account = akun paling kosong.
2. User bisa memilih akun lain.
3. Time dropdown tetap menandai slot unavailable.
4. Submit tetap validasi konflik slot dan limit booking harian.

## Data Flow

1. `safeAccounts` menyediakan daftar akun aktif.
2. `useAccountLoadSummary` fetch load semua akun via `/calendar/batch`.
3. `useMostFreeAccount` memilih kandidat akun dengan meeting paling sedikit.
4. Calendar page memakai kandidat ini sebagai default hanya jika belum ada manual selection.
5. Booking form/modal menerima default account yang sama.

## Error Handling

- Jika batch load gagal, fallback ke akun aktif pertama agar halaman tetap bisa dipakai.
- Jika akun paling kosong tidak tersedia lagi, fallback ke akun aktif pertama.
- Jika tidak ada akun aktif, tampilkan empty state yang jelas.
- Error API tetap ditampilkan lewat mekanisme error existing, bukan disembunyikan.

## Performance

Untuk 10 akun:
- Batch calendar: 1 HTTP request untuk load summary.
- Limit backend saat ini 20 akun, jadi 10 akun aman.
- Tidak perlu pagination atau virtualized account list.
- Tidak perlu dashboard tambahan.

## Testing

Minimal checks:
- Auto-pick memilih akun dengan meeting paling sedikit.
- Manual selection tidak dioverride setelah load summary berubah.
- Booking form default ke akun paling kosong.
- Gabungan tetap bisa dipilih dan menampilkan semua akun.

## Implementation Notes

- Prioritaskan perubahan kecil di `ZoomCalendarPage.tsx`, `ZoomBookingForm.tsx`, dan hook existing.
- Reuse `useMostFreeAccount`; jangan buat service/abstraction baru.
- Reuse `/calendar/batch`; jangan tambah endpoint baru.
- Hindari state global baru kecuali state existing tidak cukup.
