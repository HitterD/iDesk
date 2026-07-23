# Design Spec: Zoom Calendar Client Page Redesign

**Date:** 2026-07-23  
**Target:** `apps/frontend/src/features/zoom-booking` (`/client/zoom-calendar`)

---

## 1. Overview & Objectives

Halaman `/client/zoom-calendar` saat ini menggunakan layout tumpuk tunggal terpusat (`max-w-3xl`) dengan style UI standar ("AI slop") dan membatasi daftar booking Zoom yang ditampilkan (hanya menampilkan meeting mendatang secara default).

Desain baru ini merombak total UI/UX halaman menjadi:
1. **Layout 2 Kolom (Split View 40% : 60%)**: Kolom Kiri untuk Form Booking Zoom dan Kolom Kanan untuk Daftar Zoom Meeting secara lengkap.
2. **Kustomisasi Selection Jam & Durasi**: Menggantikan input jam standar (`type="time"`) dengan dropdown `ZoomTimeSelect` interaktif (menampilkan jam font-mono di kiri & label `Tersedia`/`Terpakai` di kanan) serta gaya pilihan durasi yang membulat (*soft rounded pills*) lengkap dengan tanda centang (*checkmark*).
3. **Menampilkan Semua Daftar Zoom**: Mengubah default tab pada daftar Zoom di sisi kanan dari `upcoming` menjadi `all` (**Semua**) sehingga seluruh riwayat dan jadwal aktif pengguna langsung muncul tanpa tersembunyi.

---

## 2. Architecture & Component Changes

### 2.1. `ClientZoomBookingPage.tsx`
- **Layout Grid**: Mengubah wrapper dari `max-w-3xl space-y-6` menjadi `max-w-7xl mx-auto p-4 lg:p-6`.
- **Responsive Layout**:
  - `grid grid-cols-1 lg:grid-cols-12 gap-6 items-start`
  - **Kiri (`lg:col-span-5` / ~40%)**: Card Form Booking (`SimpleBookingForm`) dengan posisi `sticky top-6`.
  - **Kanan (`lg:col-span-7` / ~60%)**: Card Panel Daftar Zoom (`ZoomMyBookingsView`) dengan area scroll independen.

### 2.2. `SimpleBookingForm.tsx` & Time/Duration Pickers
- **Waktu Mulai (`Jam Mulai`)**:
  - Mengganti `<Input type="time">` dengan komponen `ZoomTimeSelect`.
  - Opsi jam di-generate dari `00:00` hingga `23:30` (interval 30 menit).
  - Tampilan item list: Waktu di sebelah kiri (font-mono) + Tag status `Tersedia` / `Terpakai` di kanan.
- **Durasi Meeting (`Durasi`)**:
  - Menggunakan dropdown dengan opsi `30 menit (0.5 jam)`, `60 menit (1 jam)`, `90 menit (1.5 jam)`, `120 menit (2 jam)`, `180 menit (3 jam)`, `240 menit (4 jam)`.
  - Menambahkan *highlight* dan tanda centang (*checkmark*) pada durasi yang terpilih dengan style *rounded-lg* sesuai desain acuan.

### 2.3. `ZoomMyBookingsView.tsx`
- **Default View State**:
  - Mengubah `const [tab, setTab] = useState<BookingTab>('upcoming')` menjadi `useState<BookingTab>('all')`.
  - Tab navigasi: **Semua** (default) | **Mendatang** | **Selesai**.
- **Visual Polish**:
  - Aksen garis batas kiri card sesuai warna akun Zoom admin (`zoomAccount.colorHex`).
  - Micro-badges status (`Confirmed` / hijau, `Pending` / kuning, `Dibatalkan` / merah).
  - Aksi cepat (*Join*, *Copy Link*, *Reschedule*, *Batal*) yang mudah diakses.

---

## 3. Visual Verification

- **Form Kiri**: Form booking tampil rapi dan ringkas dengan dropdown jam & durasi yang presisi sesuai acuan gambar.
- **Daftar Kanan**: Seluruh meeting Zoom tampil secara utuh, dapat di-scroll secara mandiri, dan dapat dicari secara real-time.
