# Report: Hardware Request (ICT Budget) Module

Dokumen ini berisi detail teknis dan operasional untuk modul **Hardware Request** (ICT Budget) di sistem iDesk. Modul ini menangani pengadaan perangkat keras (Hardware) dan lisensi (License) mulai dari pengajuan hingga instalasi dan realisasi.

---

## 1. Arsitektur Backend (BE)

### 📂 Lokasi File Utama
- **Service:** `apps/backend/src/modules/ict-budget/ict-budget.service.ts`
- **Controller:** `apps/backend/src/modules/ict-budget/ict-budget.controller.ts`
- **Entity:** `apps/backend/src/modules/ict-budget/entities/ict-budget-request.entity.ts`
- **Installation Service:** `apps/backend/src/modules/ticketing/services/installation-schedule.service.ts`
- **Installation Controller:** `apps/backend/src/modules/ticketing/presentation/installation-schedule.controller.ts`

### 🛠️ Struktur Data (Entity: IctBudgetRequest)
| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | UUID | Primary Key |
| `ticketId` | UUID | Relasi ke Ticket induk (Type: `ICT_BUDGET`) |
| `requestType` | Enum | `PURCHASE`, `RENEWAL`, `LICENSE` | 
| `budgetCategory` | String | `HARDWARE` atau `LICENSE` |
| `items` | JsonB (Array) | List item yang diminta: `[{ id, name, isArrived, arrivedAt, hasInstallationTicket }]` |
| `vendor` | String | Rekomendasi vendor |
| `realizationStatus`| Enum | `PENDING`, `APPROVED`, `REJECTED`, `PURCHASING`, `PARTIALLY_ARRIVED`, `ARRIVED`, `REALIZED` |
| `requiresInstallation`| Boolean| Flag apakah butuh bantuan instalasi dari tim IT | 

### 🛤️ API Endpoints Utama
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `POST` | `/ict-budget` | Membuat request baru |
| `PATCH`| `/ict-budget/:id/approve` | Approval oleh Manager/Admin |
| `PATCH`| `/ict-budget/:id/purchasing`| Memulai proses pembelian |
| `PATCH`| `/ict-budget/:id/arrived` | Menandai satu atau lebih item telah tiba (Partial Arrival) |
| `PATCH`| `/ict-budget/:id/item/:itemId/install` | User meminta jadwal instalasi untuk item tertentu |
| `PATCH`| `/ict-budget/:id/realize` | Finalisasi dengan input nomor PO & Invoice |

---

## 2. Arsitektur Frontend (FE)

### 🖥️ Halaman Utama
1. **HardwareRequestPage:** Dashboard monitoring request dengan statistik (Total, Pending, Completed).
2. **HardwareRequestCreatePage:** Form Wizard 2 langkah (Pilih Tipe & Detail Barang).
3. **HardwareRequestDetailPage:** Pusat kontrol alur kerja (Pipeline status, Timeline, Panel Aksi).

### 🧩 Komponen UI
- **StatusPipeline:** Visualisasi tahapan dari PENDING hingga REALIZED.
- **ActivityTimeline:** Log riwayat perubahan status dan catatan dari `ict-budget-activity.entity.ts`.
- **InstallationScheduleModal:** Kalender untuk memilih slot waktu instalasi (08:00-12:00 atau 13:00-17:00).

---

## 3. Alur Kerja & Workflow (Detailed)

1. **Submission:** User membuat request melalui Wizard. Sistem membuat `Ticket` (parent) dan `IctBudgetRequest`.
2. **Approval:** Manager/Admin menyetujui. Status tiket berubah menjadi `IN_PROGRESS` jika disetujui, atau `CANCELLED` jika ditolak.
3. **Purchasing:** Agent IT memproses pembelian. Status: `PURCHASING`.
4. **Arrival (Partial/Full):** Agent menandai barang yang tiba. Jika belum semua tiba, status menjadi `PARTIALLY_ARRIVED`. Jika sudah semua, status menjadi `ARRIVED`.
5. **Installation Request:** Untuk item yang sudah `isArrived`, user dapat mengajukan **Minta Pemasangan**.
   - Sistem akan membuat tiket baru bertipe `HARDWARE_INSTALLATION`.
   - Membuat record di `InstallationSchedule`.
6. **Installation Workflow:** 
   - **Agent** mengonfirmasi jadwal (`APPROVED`) atau mengatur ulang (`RESCHEDULED`).
   - Setelah selesai, Agent menekan "Mark Done" -> Status Jadwal: `COMPLETED`.
7. **Realization:** Agent memasukkan detail PO & Invoice untuk menutup pengajuan. Status akhir: `REALIZED`.

---

## 4. Status Integrasi Notifikasi (✅ TERHUBUNG)

Integrasi notifikasi untuk modul Hardware Request dan Installation kini telah aktif sepenuhnya:

- **Listeners Aktif:** 
  - `IctBudgetNotificationListener` menangani event `ict-budget.*` (Created, Approved, Arrived, Realized).
  - `InstallationNotificationListener` menangani event `installation.*` (Requested, Approved, Rescheduled, Completed).
- **Channel Notifikasi:** Mendukung In-App Notification (In-App Dashboard) dan sistem integrasi Telegram.
- **Fitur Khusus:** Notifikasi `RESCHEDULED` menggunakan flag `requiresAcknowledge` yang mewajibkan user melihat jadwal baru yang diusulkan oleh tim IT.

### 🚀 Alur Notifikasi:
1. **User Submit:** Admin/Manager mendapat notifikasi pengajuan baru.
2. **Manager Approve:** User mendapat notifikasi status disetujui.
3. **Barang Tiba:** User mendapat notifikasi bahwa barang siap dipasang/diambil.
4. **Reschedule Jadwal:** User mendapat notifikasi kritis yang muncul sebagai modal untuk konfirmasi jadwal baru.

---
*Update Terakhir: 3 April 2026*
