# Hardware Scheduling to Ticket Integration Design

Desain untuk memperbaiki workflow penjadwalan instalasi hardware, mengubah representasi teknisi menjadi Agent berdasarkan site, dan mengotomatisasi pembuatan tiket pada Ticket Board setelah jadwal dikonfirmasi.

## Goal Description

1. **Perbaikan Bug Scheduling:** Memastikan tombol "Jadwalkan Instalasi" tidak muncul atau dapat ditekan lagi apabila item hardware sudah memiliki jadwal instalasi aktif (mencegah *double scheduling*).
2. **Perubahan Skema `technicianId` -> `agentId`:** Mengganti label visual dan schema API/DB dari "Teknisi" menjadi "Agent" secara menyeluruh (Frontend & Backend).
3. **Filter Agent Berdasarkan Site:** Di form penjadwalan, daftar agent yang bisa dipilih hanya agent yang terdaftar pada site *Hardware Request* tersebut untuk mencegah *crossover* tugas antar site.
4. **Pembuatan Tiket Otomatis:** Ketika jadwal instalasi **dikonfirmasi oleh user**, sistem secara otomatis membuat tiket baru di Ticket Board yang langsung di-assign ke Agent yang dipilih saat pengusulan jadwal.

## Proposed Changes

---

### 1. Frontend - Hardware Request Component & API

#### [MODIFY] `apps/frontend/src/features/hardware-request/components/delivery/DeliveryBoard.tsx`
- Perbaiki logika `canSchedule` agar mengecek apakah sudah ada `InstallationSchedule` yang aktif (bukan berstatus `CANCELLED` atau `DONE`).
- Jika sudah ada jadwal, sembunyikan tombol "Jadwalkan Instalasi" atau ubah teksnya menjadi "Lihat Jadwal".

#### [MODIFY] `apps/frontend/src/features/hardware-request/utils/permission.util.ts`
- Modifikasi fungsi `canProposeSchedule` agar mereturn `false` apabila request tersebut sudah memiliki `installationSchedule` yang belum selesai/batal.

#### [MODIFY] `apps/frontend/src/features/hardware-request/components/scheduling/ScheduleProposeModal.tsx`
- Ubah semua teks "Teknisi" menjadi "Agent".
- Ganti komponen `<TechnicianFilter>` menjadi `<AgentFilter siteId={request.siteId} />`.

#### [MODIFY] `apps/frontend/src/features/hardware-request/components/calendar/TechnicianFilter.tsx` -> (Rename to `AgentFilter.tsx`)
- Ubah endpoint fetch dari `/users/technicians` menjadi `/users/agents?siteId=${siteId}`.
- Sesuaikan prop dan penamaan state dari `technicianId` menjadi `agentId`.

#### [MODIFY] `apps/frontend/src/features/hardware-request/types/index.ts`
- Ganti `technicianId` menjadi `agentId` di interface `InstallationSchedule` dan DTO terkait (`ScheduleProposeInput`, dll).

---

### 2. Backend - Hardware Request Schema & API

#### [MODIFY] `apps/backend/src/modules/hardware-request/domain/entities/installation-schedule.entity.ts`
- Ganti column name dan property `technicianId` menjadi `agentId`.
- Buat *database migration* (jika diperlukan) atau gunakan `synchronize: true` sesuai setup development.

#### [MODIFY] `apps/backend/src/modules/hardware-request/dto/schedule-propose.dto.ts`
- Ganti `@IsString() technicianId: string;` menjadi `agentId`.

#### [MODIFY] `apps/backend/src/modules/hardware-request/services/mutual-scheduling.service.ts`
- Sesuaikan semua penggunaan variabel `technicianId` menjadi `agentId`.
- Ubah payload `HardwareEvents.ScheduleProposed` dan `HardwareEvents.ScheduleConfirmed` untuk membawa field `agentId` bukan `technicianId`.

#### [MODIFY] `apps/backend/src/modules/hardware-request/domain/events/hardware-request.events.ts`
- Update event payload interface untuk menggunakan `agentId`.

---

### 3. Backend - Ticket Creation Listener

#### [NEW] `apps/backend/src/modules/ticket-board/listeners/hardware-schedule.listener.ts`
- Buat event listener yang me-listen event `HardwareEvents.ScheduleConfirmed`.
- Saat event ter-trigger, jalankan `TicketService.createTicket()` dengan detail:
  - `title`: "Hardware Installation: HR-XXXX-XXXX"
  - `category`: "Hardware" / "Installation"
  - `status`: "TODO"
  - `priority`: "HARDWARE_INSTALLATION"
  - `assignedToId`: `payload.agentId`
  - `scheduledDate`: `payload.scheduledStart`
  - `description`: Menyertakan detail jadwal dan site.

## Verification Plan

### Manual Verification
1. **Bug Check:** Pergi ke halaman detail Hardware Request yang item-nya sudah `ARRIVED`. Lakukan penjadwalan. Pastikan setelah penjadwalan diusulkan, tombol "Jadwalkan Instalasi" hilang/disabled.
2. **Filter Agent:** Buka modal "Jadwalkan Instalasi", pastikan list dropdown "Agent" hanya berisi nama-nama Agent untuk site tempat *Hardware Request* itu berada.
3. **Database Schema:** Cek API request `/hardware-requests/:id/schedule/propose` bahwa payload menggunakan `agentId`.
4. **Ticket Creation:** Bertindak sebagai User, konfirmasi slot jadwal instalasi. Lalu buka halaman Ticket List (berperan sebagai Agent), pastikan ada tiket instalasi baru yang di-*assign* ke Agent bersangkutan.
