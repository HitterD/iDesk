# Simplifikasi Booking Zoom untuk Client Portal

**Tanggal:** 2026-07-22
**Status:** Disetujui, menunggu implementation plan

## Latar Belakang

Halaman `/client/zoom-calendar`, `/zoom-calendar` (admin/agent), dan `/manager/zoom-calendar` saat ini semuanya me-render komponen yang sama persis (`ZoomCalendarPage` + `ZoomBookingForm`), dibedakan hanya oleh layout pembungkusnya. Flow booking penuh (kalender grid month/week/day, pilih akun Zoom secara eksplisit atau via mode "Gabungan" auto-pick, form recurring lengkap) yang cocok untuk agent/admin/manager mengontrol jadwal, ternyata terlalu rumit untuk end-user (`role USER`) yang cuma ingin booking 1 slot Zoom cepat.

Tujuan: sederhanakan flow booking di sisi client (`/client/zoom-calendar`) tanpa mengubah apa pun di sisi admin/agent/manager.

## Lingkup

**Berlaku untuk:** siapa pun yang mengakses lewat `ClientLayout` (route `/client/*`), bukan berdasarkan role secara terpisah. Saat ini route ini sudah di-guard `allowedRoles={['USER']}` (`AppRoutes.tsx:275`).

**Tidak berubah:** `ZoomCalendarPage`, `ZoomBookingForm`, `ZoomAdminController`, seluruh service backend (`ZoomBookingService.createBooking/rescheduleBooking/cancelBooking`, cascade account fallback, rrule expansion, conflict-check), route `/zoom-calendar` dan `/manager/zoom-calendar`.

## Arsitektur

Route `/client/zoom-calendar` (`AppRoutes.tsx:286`) diarahkan ke komponen baru `ClientZoomBookingPage`, menggantikan `ZoomCalendarPage` untuk route ini saja.

File baru (tidak ada file existing yang dimodifikasi struktural, kecuali 1 DTO field):
```
apps/frontend/src/features/zoom-booking/
├── pages/ClientZoomBookingPage.tsx
├── components/SimpleBookingForm.tsx
├── components/SimpleRecurringField.tsx
├── hooks/useCheckAvailability.ts
```
Reuse tanpa perubahan: `ZoomMyBookingsView.tsx`, `CancelBookingModal.tsx`, `RescheduleModal.tsx`, hooks `useMyBookings`, `useCancelOwnBooking`, `useCreateBooking`.

Backend — 1 endpoint baru di `ZoomBookingController` (controller user-facing existing, guard `PageAccess('zoom_calendar')` yang sama, tidak perlu guard baru):
```
GET /zoom-booking/availability?date=YYYY-MM-DD&startTime=HH:mm&durationMinutes=60
→ { available: boolean, reason?: string }
```
Implementasi: fungsi baru di `ZoomBookingService` yang me-reuse logic cascade existing (loop akun aktif, cek overlap waktu, working days, blocked dates, advance booking days — `zoom-booking.service.ts:485-544`) sebagai **dry-run** — tidak menulis ke DB, tidak reserve akun, hanya mengembalikan hasil evaluasi. Ini murni pembacaan, jadi race condition dengan booking lain tetap mungkin terjadi di window kecil antara check dan submit — ditangani lewat error handling submit (lihat di bawah), bukan dengan locking.

Penyesuaian DTO: `CreateBookingDto.zoomAccountId` (`dto/booking.dto.ts:18-72`) diubah dari required jadi optional. `ZoomBookingService.createBooking` disesuaikan: kalau `zoomAccountId` kosong, langsung pakai seluruh akun aktif sebagai `accountsToTry` (skip logika "requested account first") — cascade fallback yang sudah ada tetap dipakai apa adanya.

## Form Booking (SimpleBookingForm)

Field, urutan:
1. **Judul** — required, 5-100 karakter (validasi sama seperti form existing)
2. **Tanggal** — `ModernDatePicker`, dibatasi `advanceBookingDays` dari `GET /zoom-booking/settings`
3. **Jam mulai** — `<input type="time">`, bukan grid slot
4. **Durasi** — dropdown dari `GET /zoom-booking/settings/durations`
5. **Deskripsi** — opsional, ≤500 karakter
6. **Peserta** — opsional, comma-separated emails
7. **Berulang?** — toggle. Kalau ON, tampil `SimpleRecurringField`: satu baris compact `[Setiap] [N] [Hari/Minggu/Bulan ▾] [sampai] [tanggal]`, membangun RRule string sama seperti `ZoomRecurringOptions` existing.

Tidak ada field pilih akun Zoom. User tidak pernah melihat nama/identitas akun Zoom yang dipakai, baik sebelum maupun sesudah booking sukses — hanya link Join Meeting yang ditampilkan.

### Real-time availability check

Begitu tanggal + jam + durasi terisi lengkap, `useCheckAvailability` (debounce ~400ms) memanggil endpoint availability di atas. Badge status di bawah field jam:
- Loading → "Mengecek ketersediaan..."
- Available → "✓ Jam ini tersedia"
- Tidak available → "✗ {reason dari backend}", tombol submit di-disable

### Submit

`POST /zoom-booking` (endpoint & flow existing, tidak berubah selain `zoomAccountId` kini optional). Sukses → toast + tombol Join Meeting, form direset. Gagal karena race (semua akun keburu penuh di antara check dan submit) → toast error pakai message dari backend apa adanya, form TIDAK direset, user tinggal ubah jam dan submit ulang.

## Layout Halaman

`ClientZoomBookingPage`: satu halaman scroll vertikal, bukan panel/modal —
1. Header singkat "Booking Zoom"
2. `SimpleBookingForm` (card)
3. `ZoomMyBookingsView` di bawahnya, reuse 100% apa adanya (tabs upcoming/past/all, search, cancel, reschedule tetap berfungsi karena endpoint-endpoint itu sudah role-agnostic terhadap pemilik booking)

## Testing

- Smoke: render `ClientZoomBookingPage`, submit booking sukses tanpa memilih akun, cek link Join Meeting muncul.
- Functional: availability check menunjukkan status benar untuk slot penuh vs kosong; recurring compact field menghasilkan RRule string yang sama seperti form lama untuk kombinasi freq/interval/until yang sama.
- Regression: `ZoomCalendarPage`/`ZoomBookingForm` (route admin & manager) tidak berubah perilaku — booking dengan `zoomAccountId` eksplisit tetap bekerja seperti sebelumnya setelah DTO field dibuat optional.
- Race-condition path: simulasikan semua akun penuh setelah availability check positif (mis. race), pastikan error dari `createBooking` ditampilkan dengan jelas dan form tidak reset.
