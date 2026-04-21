# Rangkuman Perubahan: Redesign & Integrasi Hardware Installation (7 April 2026)

Dokumen ini merangkum seluruh modifikasi yang dilakukan pada sistem iDesk untuk meningkatkan UI/UX halaman Hardware Request dan mengintegrasikan alur kerja Hardware Installation.

## 1. Redesign Halaman Hardware Request Create
Meningkatkan pengalaman pengguna dalam membuat permintaan pengadaan baru melalui perubahan visual yang signifikan.

- **Layout Baru:** Migrasi dari layout 2-kolom yang sempit ke **Single-Column (Satu Kolom)** yang terpusat dan lega.
- **Hirarki Visual:** Penambahan **nomor seksi besar (①, ②, ③)** untuk memandu pengguna langkah demi langkah.
- **Kartu Tipe Permintaan:** Implementasi kartu horizontal interaktif dengan ikon (`ShoppingCart`, `RefreshCw`, `KeyRound`) dan warna aksen khusus (Biru, Amber, Teal).
- **Peningkatan Kontras:** Mengubah background input field menjadi putih bersih (`bg-white`) dengan border yang lebih tegas untuk keterbacaan maksimal.
- **Pembaruan Stepper:** Memperbesar indikator langkah pada `RequestWizard` dan mempertebal garis progres aktif.

## 2. Integrasi Hardware Installation (End-to-End)
Menghubungkan tiket instalasi perangkat keras secara langsung dengan permintaan pengadaan asalnya.

### Backend (NestJS)
- **DTO Baru:** Membuat `InstallationQueryDto` untuk menangani filter dan paginasi daftar instalasi.
- **IctBudgetService:**
    - Menambahkan metode `findAllInstallations` (lintas permintaan) dan `findRequestInstallations` (per ID permintaan).
    - Memperluas metode `findAll` untuk mengembalikan `installationSummary` (total, terpasang, sedang jalan, dijadwalkan).
- **IctBudgetController:** Menambahkan endpoint `GET /ict-budget/installations` dan `GET /ict-budget/:id/installations`.
- **TicketQueryService:** Memastikan tiket *Hardware Installation* membawa referensi `ictBudgetRequestId` dalam respon paginasi.

### Frontend (React & React Query)
- **API & Hooks:** Menambahkan interface `InstallationTicket` dan `InstallationSummary`, serta custom hooks `useIctBudgetInstallations` dan `useIctBudgetRequestInstallations`.
- **Komponen Baru:**
    - `InstallationTab.tsx`: Tabel manajemen semua tiket instalasi.
    - `InstallationProgressSection.tsx`: Tampilan progres instalasi per-item pada halaman detail.
- **Hardware Request Page:** Menambahkan tab **"Installation"** dengan aksen warna ungu sebagai pusat kontrol instalasi.
- **Detail Page:** Integrasi `InstallationProgressSection` di atas log aktivitas.
- **Status Indicator:** Menampilkan indikator progres (contoh: 🔧 1/2 installed) pada kartu permintaan dan daftar list.

### Ticket Board (General)
- **Visibility:** Mengaktifkan kembali tiket *Hardware Installation* di daftar tiket umum.
- **Visual Highlight:** Memberikan warna baris ungu muda dan border ungu tegas pada tiket instalasi.
- **Deep Linking:** Menambahkan tombol pintas "🔧 Lihat di Hardware Requests →" pada baris tiket untuk memudahkan navigasi balik ke permintaan pengadaan asal.

## 3. Perbaikan Bug & Stabilisasi
- Memperbaiki kesalahan sintaksis pada `HardwareRequestPage.tsx` dan `ict-budget.api.ts`.
- Memulihkan impor komponen dan ikon yang hilang selama proses integrasi.
- Memastikan tipe data TypeScript sinkron antara frontend dan backend.

---
*Dikerjakan oleh Gemini CLI - 7 April 2026*
