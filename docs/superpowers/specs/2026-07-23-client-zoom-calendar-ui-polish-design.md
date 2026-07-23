# Client Zoom Calendar UI Polish — Design Spec

**Tanggal:** 2026-07-23  
**Status:** Draft — menunggu review pengguna  
**Scope:** `apps/frontend/src/features/zoom-booking/` untuk route `/client/zoom-calendar`.

## Tujuan

Hilangkan kesan UI generik/berisik tanpa redesign struktur atau mengubah perilaku booking. Halaman tetap memiliki header, form booking kiri, dan daftar meeting kanan.

## Batas Scope

Masuk scope:

- Polish visual pada `ClientZoomBookingPage`, `SimpleBookingForm`, dan `ZoomMyBookingsView`.
- Palet blue/slate, dark mode, dan token existing tetap dipakai.
- Hierarki tipografi, spacing, surface, status, loading, empty state, dan motion diperjelas.
- Test smoke halaman disesuaikan bila semantic markup berubah.

Tidak masuk scope:

- Perubahan layout dua kolom atau urutan konten.
- Endpoint/API, hook, model data, state global, atau dependency baru.
- Perubahan alur validasi, booking, join, copy, reschedule, atau pembatalan.
- Dashboard, kalender baru, atau fitur booking baru.

## Struktur dan Visual

### Header

Header diubah dari blok dengan ikon kotak dan divider menjadi title area tenang:

- Eyebrow `ZOOM`.
- H1 `Booking meeting`.
- Deskripsi singkat: buat dan kelola jadwal.
- Tanpa ikon dekoratif, tanpa garis pembatas full-width.

### Surface halaman

- Container tetap `grid-cols-1 lg:grid-cols-12` dengan form `lg:col-span-5` dan daftar `lg:col-span-7`.
- Kedua panel memakai `bg-card`, radius konsisten, dan satu ambient elevation tipis.
- Hilangkan border abu-abu dan shadow bertumpuk pada panel utama.
- Border hanya boleh muncul sebagai pemisah internal yang memiliki fungsi navigasi atau status.
- Mobile tetap stack satu kolom dengan spacing minimal 16px.

### Form booking

- Pertahankan field, urutan, validation, availability check, recurrence, dan submit existing.
- Jadikan label sebagai penanda kelompok konten yang konsisten; hilangkan ikon dekoratif dari label bila tidak menambah makna.
- Date/time menjadi satu kelompok waktu; preview rentang jam dan ketersediaan menjadi feedback ringkas dengan warna status.
- CTA submit tetap satu aksi primer penuh, berbentuk pill dengan icon island kecil bila icon dipakai.
- State loading/disabled tetap memakai state mutation dan availability existing.

### Daftar meeting

- Toolbar dipadatkan secara visual tanpa mengurangi tab atau search.
- Tab memakai selected state jelas tanpa kotak/border tambahan yang bersaing dengan konten.
- Search menyatu dengan toolbar.
- Kartu booking menjadi baris mudah dipindai: accent warna akun, waktu, judul, akun, status, lalu aksi.
- Status memakai warna semantic existing; warna akun dipakai hanya sebagai accent kiri.
- Tombol aksi tetap ada dan perilaku tidak berubah.

### Motion dan aksesibilitas

- Gunakan transform/opacity dengan `var(--ease-out)` bila transisi diperlukan.
- Jangan tambah blur scrolling, animasi dekoratif, atau motion yang mengubah layout.
- `prefers-reduced-motion` existing tetap berlaku.
- Heading, label, button, input, dan action target tetap memiliki nama aksesibel.

## Data Flow dan Error Handling

Tidak ada perubahan data flow:

- `SimpleBookingForm` tetap memakai `useCheckAvailability`, `useCreateBooking`, `useDurationOptions`, dan `usePublicZoomSettings`.
- `ZoomMyBookingsView` tetap memakai `useMyBookings` dan `useCancelOwnBooking` serta modal existing.
- Validasi field, konflik slot, API error fallback, toast, dan cancel confirmation tidak diubah.

## File

Modifikasi:

- `apps/frontend/src/features/zoom-booking/pages/ClientZoomBookingPage.tsx`
- `apps/frontend/src/features/zoom-booking/components/SimpleBookingForm.tsx`
- `apps/frontend/src/features/zoom-booking/components/ZoomMyBookingsView.tsx`
- `apps/frontend/src/features/zoom-booking/pages/__tests__/ClientZoomBookingPage.test.tsx` bila markup heading berubah.

Tidak ada file atau dependency baru.

## Verifikasi

1. Render test `ClientZoomBookingPage` tetap memastikan header, form, dan list tampil.
2. Jalankan Vitest target halaman.
3. Jalankan TypeScript/build frontend sesuai script workspace.
4. Review ulang visual dark mode dan mobile breakpoint; struktur dua kolom harus tetap berubah menjadi stack pada `lg` ke bawah.

## Kriteria Sukses

- Form dan daftar meeting tetap berfungsi tanpa perubahan kontrak.
- Halaman tetap memakai struktur dua kolom existing pada desktop.
- UI tidak memakai panel dengan border/shadow berlapis atau ikon dekoratif di header/label.
- Palet blue/slate dan dark mode existing tetap konsisten.
- Loading, empty, success, availability, status, dan destructive action tetap terbaca jelas.
