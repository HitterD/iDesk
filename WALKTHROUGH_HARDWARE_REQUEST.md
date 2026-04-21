# Walkthrough: Implementasi Hardware Request & ICT Budget Overhaul

Dokumen ini merangkum seluruh perubahan sistem yang dilakukan untuk mengubah modul **Hardware Request** dari mockup menjadi sistem fungsional yang utuh (End-to-End).

---

## 1. Arsitektur Backend (Database & Logic)

### Pencatatan Aktivitas (Activity Log)
Kami menambahkan sistem audit trail untuk melacak setiap perubahan status pada permintaan anggaran.
- **Entity Baru:** `IctBudgetActivity` menyimpan riwayat siapa, kapan, dan apa yang berubah (beserta catatan/notes).
- **Service Update:** `IctBudgetService` sekarang secara otomatis mencatat log setiap kali terjadi operasi `CREATE`, `APPROVE`, `REJECT`, `PURCHASING`, dan `REALIZED`.

### Validasi Hak Akses (Role & Permissions)
- **Approval Multi-Role:** Sekarang, selain `ADMIN` dan `MANAGER`, user dengan role `AGENT` juga dapat memberikan persetujuan jika diperlukan (sesuai instruksi preset).
- **Endpoint Baru:** `GET /ict-budget/:id/activities` untuk menyajikan riwayat aktivitas ke frontend.

---

## 2. Lapisan API & Integrasi (Frontend)

- **Mutation Hooks Baru:** Penambahan hooks pada `ict-budget.api.ts` untuk mendukung aksi alur kerja:
    - `useApproveIctBudget`
    - `useStartPurchasing`
    - `useRealizeIctBudget`
- **Activity API:** Membuat `hardware-request.api.ts` khusus untuk mengambil data timeline aktivitas.

---

## 3. Komponen UI Baru (Modular & Reusable)

Kami membangun 7 komponen UI baru dengan desain **Industrial/Utilitarian** (Slate & Amber theme):
1.  **`StatusPipeline`**: Stepper horizontal untuk melihat posisi request dalam workflow.
2.  **`RequestWizard`**: Kontainer navigasi multi-langkah untuk pengisian form yang lebih terarah.
3.  **`HardwareInstallForm`**: Form khusus penjadwalan instalasi hardware dengan integrasi slot waktu.
4.  **`IctBudgetRequestForm`**: Form detail pengajuan anggaran ICT.
5.  **`ApprovalPanel`**: UI khusus Manager/Admin untuk menyetujui atau menolak permintaan.
6.  **`PurchasingPanel`**: UI khusus Agent untuk memasukkan nomor PO/Invoice.
7.  **`ActivityTimeline`**: Tampilan kronologis riwayat aktivitas permintaan.

---

## 4. Perubahan Halaman (Pages & Routing)

### Alur Pembuatan Baru (`/hardware-requests/new`)
User tidak lagi menggunakan drawer/modal kecil. Sekarang menggunakan **HardwareRequestCreatePage** berbasis Wizard yang memandu user memilih antara:
- **Hardware Installation:** Fokus pada jadwal dan lokasi.
- **ICT Budget:** Fokus pada vendor, item, dan estimasi biaya.

### Halaman Detail Baru (`/hardware-requests/:id`)
**HardwareRequestDetailPage** menjadi pusat koordinasi:
- Menampilkan **Pipeline** status.
- Menampilkan detail item dan justifikasi.
- Menyediakan **Aksi Dinamis** (Tombol Approve muncul hanya jika status PENDING, tombol Purchasing muncul hanya jika status APPROVED, dst).
- Menampilkan **Timeline** transparan bagi semua pihak.

### Pembaruan Halaman Daftar
- **`HardwareRequestPage`**: Dirombak total untuk menampilkan statistik (Total, Pending, Completed) dan tabel daftar yang lebih informatif.
- **`BentoCreateTicketPage`**: Kartu navigasi diperbarui untuk mengarah ke Wizard yang baru.

---

## 5. Alur Kerja (Workflow) Akhir

1.  **User** mengisi Wizard → Status menjadi `PENDING`.
2.  **Manager/Admin** menerima notifikasi → Melakukan Review di Detail Page → Klik **APPROVE** → Status menjadi `APPROVED`.
3.  **Agent (IT)** melihat daftar request `APPROVED` → Klik **START PURCHASING** → Status menjadi `PURCHASING`.
4.  **Agent (IT)** menerima barang → Masukkan nomor PO & Invoice → Klik **COMPLETE REALIZATION** → Status menjadi `REALIZED`.
5.  **Sistem** (Opsional) otomatis membuat tiket instalasi jika user mencentang "Requires Installation".

---
*Status Implementasi: Selesai & Terverifikasi (Build Success)*
