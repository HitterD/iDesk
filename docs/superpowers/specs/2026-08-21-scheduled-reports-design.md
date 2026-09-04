# iDesk — Scheduled Reports (Automated Email Delivery) Design Spec

**Tanggal:** 2026-08-21  
**Tipe:** Feature Design (Architectural)  
**Status:** Design complete — awaiting user approval before implementation plan  
**Scope:** Backend (entity, API, dynamic scheduler) + Frontend (UI in Reports page) + Email delivery

---

## 1. Tujuan

Memberikan kemampuan **scheduled / recurring reports** yang:

- Otomatis di-generate dan dikirim via email pada jadwal yang ditentukan user (harian/mingguan/bulanan)
- **Site-scoped** (data hanya dari site yang dikonfigurasi)
- **Recipients terbatas** pada agents di site yang sama (bukan external email, bukan semua admin global)
- Mendukung pemisahan **AGENT_ORACLE** vs regular agents untuk laporan Agent Performance
- Waktu kirim (**send time**) bisa diatur per konfigurasi (bukan fixed jam)
- Memiliki **execution audit log** untuk visibility sukses/gagal
- Menggantikan implementasi hardcoded yang ada saat ini (`ScheduledReportsService` dengan cron tetap ke semua ADMIN)

---

## 2. Requirements (Terverifikasi dari Diskusi)

| Aspek                    | Requirement |
|--------------------------|-------------|
| **Pengelola**            | ADMIN + MANAGER (via page access `reports`) |
| **Site Scoping**         | Wajib. Setiap config terikat 1 site. Data report = data site tersebut saja |
| **Recipients**           | Hanya agents (termasuk varian agent) di site yang sama. Tidak boleh external email |
| **Report Types**         | Semua 3 tipe boleh dipilih: `MONTHLY_SUMMARY`, `AGENT_PERFORMANCE`, `TICKET_VOLUME` |
| **Schedule**             | 1 config = tepat 1 schedule (`DAILY` / `WEEKLY` / `MONTHLY`) |
| **Send Time**            | Custom per config (format `HH:mm`). Bukan fixed 7/8/9 AM lagi |
| **AGENT_ORACLE Separation** | Untuk `AGENT_PERFORMANCE`, harus bisa pilih hanya regular agents atau hanya oracle agents (tidak dicampur) |
| **Execution Logging**    | Ya. Tabel terpisah untuk mencatat setiap run (success/failed/partial, jumlah recipient, error) |
| **Manual Trigger**       | Hanya ADMIN & MANAGER boleh trigger manual |
| **Existing Hardcoded**   | Akan diganti / dinonaktifkan. Logic pindah ke dynamic config |

---

## 3. Current State & Gap Analysis

### Yang Sudah Ada

- `apps/backend/src/modules/reports/generators/scheduled-reports.service.ts` — 3 cron tetap:
  - Daily (07:00) → Ticket Volume → semua ADMIN
  - Weekly (Senin 08:00) → Volume + Performance → ADMIN
  - Monthly (tgl 1, 09:00) → Volume + Performance → ADMIN
- Sudah pakai `MailDispatchService`
- Sudah ada generator: `TicketVolumeReport`, `AgentPerformanceReport`, monthly stats via `ReportsService`
- `@nestjs/schedule` + `ScheduleModule` sudah aktif
- Pola site isolation matang (`SiteActor`, `resolveSiteScope`, `assertSiteAccess` di `site-scope.util.ts`)
- Page access guard untuk `reports`

### Gap Kritis

1. **Tidak ada persistence konfigurasi** — semua hardcoded
2. **Tidak ada site scoping** di scheduled report
3. **Recipients global** (semua ADMIN) — melanggar requirement
4. **Tidak ada pemisahan AGENT_ORACLE**
5. **Tidak ada custom send time**
6. **Tidak ada execution log**
7. **Report generators belum support `siteId` filter** (prerequisite utama)

---

## 4. Architecture

**Approach:** Entity + Dynamic Cron Registration (Approach A yang direkomendasikan)

- Entity `ScheduledReportConfig` menyimpan semua parameter
- Entity `ScheduledReportExecution` untuk audit
- `DynamicScheduledReportsService`:
  - Load config aktif saat startup
  - Register cron job dinamis via `SchedulerRegistry`
  - Saat create/update/toggle/delete → tambah/ubah/hapus job runtime
  - Job handler: generate → filter site → validate recipients → kirim email per agent → log execution
- Reuse generator yang ada (dengan modifikasi untuk site + oracle category)

**Alasan:**
- Fleksibel (tambah/hapus schedule tanpa redeploy)
- Align dengan pola `WorkflowRule`
- Site isolation jelas di level data
- Auditability tinggi

---

## 5. Data Model

### 5.1 `ScheduledReportConfig`

```ts
@Entity('scheduled_report_configs')
@Index(['siteId', 'isActive'])
@Index(['schedule', 'isActive'])
export class ScheduledReportConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'enum', enum: ['MONTHLY_SUMMARY', 'AGENT_PERFORMANCE', 'TICKET_VOLUME'] })
  reportType: 'MONTHLY_SUMMARY' | 'AGENT_PERFORMANCE' | 'TICKET_VOLUME';

  @Column({ type: 'enum', enum: ['DAILY', 'WEEKLY', 'MONTHLY'] })
  schedule: 'DAILY' | 'WEEKLY' | 'MONTHLY';

  // Custom send time (NEW)
  @Column({ type: 'varchar', length: 5, default: '07:00' })
  sendTime: string; // "HH:mm"

  @Column({ type: 'varchar', length: 36 })
  siteId: string;

  @ManyToOne(() => Site)
  @JoinColumn({ name: 'siteId' })
  site: Site;

  @Column({ type: 'simple-array' })
  recipientUserIds: string[];

  // Oracle separation (NEW)
  @Column({ 
    type: 'enum', 
    enum: ['ALL', 'REGULAR', 'ORACLE'], 
    nullable: true 
  })
  targetAgentCategory: 'ALL' | 'REGULAR' | 'ORACLE' | null;

  @Column({ default: true })
  isActive: boolean;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET_NULL' })
  createdBy: User | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  createdById: string | null;

  @Column({ type: 'timestamp', nullable: true })
  lastRunAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  deletedAt: Date | null;
}
```

### 5.2 `ScheduledReportExecution` (BARU)

```ts
@Entity('scheduled_report_executions')
@Index(['configId', 'executedAt'])
export class ScheduledReportExecution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  configId: string;

  @ManyToOne(() => ScheduledReportConfig, { onDelete: 'CASCADE' })
  config: ScheduledReportConfig;

  @Column({ type: 'timestamp' })
  executedAt: Date;

  @Column({ type: 'enum', enum: ['SUCCESS', 'FAILED', 'PARTIAL'] })
  status: 'SUCCESS' | 'FAILED' | 'PARTIAL';

  @Column({ type: 'int', default: 0 })
  recipientsCount: number;

  @Column({ type: 'int', default: 0 })
  emailsSent: number;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;
}
```

---

## 6. API Surface

**Base:** `/reports/scheduled`

Controller: `ScheduledReportsController` (dilindungi `@PageAccess('reports')`)

### Endpoints

| Method | Path                        | Deskripsi                          | Allowed |
|--------|-----------------------------|------------------------------------|---------|
| GET    | `/reports/scheduled`        | List config (site-scoped)          | ADMIN, MANAGER |
| POST   | `/reports/scheduled`        | Create config                      | ADMIN, MANAGER |
| GET    | `/reports/scheduled/:id`    | Get one                            | ADMIN, MANAGER |
| PATCH  | `/reports/scheduled/:id`    | Update                             | ADMIN, MANAGER |
| PATCH  | `/reports/scheduled/:id/toggle` | Enable/disable                  | ADMIN, MANAGER |
| DELETE | `/reports/scheduled/:id`    | Soft delete                        | ADMIN, MANAGER |
| POST   | `/reports/scheduled/:id/trigger` | Manual trigger (hanya ADMIN+MANAGER) | ADMIN, MANAGER |

**Site scoping logic (di controller/service):**
- Cross-site role (ADMIN/MANAGER) boleh tentukan `siteId`
- Non-cross-site dipaksa ke `req.user.siteId`
- Fail-closed jika tidak punya site

### DTOs (ringkas)

- `CreateScheduledReportConfigDto`: `name`, `reportType`, `schedule`, `sendTime`, `siteId`, `recipientUserIds[]`
- `UpdateScheduledReportConfigDto`: partial dari create
- Validasi tambahan di service: recipients harus agents di site yang sama + sesuai `targetAgentCategory` jika AGENT_PERFORMANCE

---

## 7. Scheduler & Execution

**Service:** `DynamicScheduledReportsService`

### Lifecycle
- `onModuleInit()` → load semua `isActive=true` → register cron job
- `onModuleDestroy()` → stop semua job
- Public methods: `registerConfig(config)`, `unregisterJob(configId)`

### Cron Expression Builder
```ts
private getCronExpression(schedule: ScheduleType, sendTime: string): string {
  const [hour, minute] = sendTime.split(':').map(Number);
  if (schedule === 'DAILY')   return `${minute} ${hour} * * *`;
  if (schedule === 'WEEKLY')  return `${minute} ${hour} * * 1`;
  if (schedule === 'MONTHLY') return `${minute} ${hour} 1 * *`;
}
```

### Job Execution Flow
1. Ambil config (pastikan masih aktif)
2. Hitung date range berdasarkan `schedule`
3. Generate report buffer (panggil generator + site filter + category filter)
4. Load + validate recipients (site + role + active + category)
5. Generate Excel in-memory
6. Kirim email **satu per agent** via `MailDispatchService`
7. Buat `ScheduledReportExecution` record
8. Update `lastRunAt` di config (jika sukses/partial)

### Report Generation (Prerequisite)
Generator yang dipanggil **harus** sudah dimodifikasi untuk menerima:
- `siteId`
- `agentCategory` (untuk AGENT_PERFORMANCE)

Saat ini generator **belum** support ini (lihat Section 11).

---

## 8. Frontend UI

**Lokasi:** Tab baru "Scheduled Reports" di `BentoReportsPage.tsx` (atau route terpisah jika diinginkan)

### Tab List
- Menampilkan daftar config dengan: name, type, schedule + sendTime, site, jumlah recipient, last run, status (active/inactive)
- Tombol: Edit, Toggle, Delete, Trigger (hanya ADMIN/MANAGER), View History

### Form Create/Edit (modal/drawer)
Fields:
- Name
- Report Type (select)
- Schedule (select)
- Send Time (time input `HH:mm`)
- Site (select, locked untuk non-cross-site)
- Target Agent Category (hanya jika type = AGENT_PERFORMANCE; opsi: Regular / Oracle)
- Recipients: grouped list (Regular Agents vs Oracle Agents) berdasarkan site yang dipilih. Multi-select / checkbox
- Active toggle

### Data Fetching
- `GET /reports/scheduled?siteId=...`
- `GET /users?siteId=...&role=AGENT*` untuk recipient options (filter di frontend per kategori)

### Execution History
Modal yang fetch `GET /reports/scheduled/:id/executions`

### Permission
- Tab muncul jika punya page access `reports`
- Action create/edit/delete/trigger dibatasi di backend (role ADMIN/MANAGER)

---

## 9. Security & Site Isolation

- **Fail-closed**: `siteId` wajib di entity dan validasi
- Semua query di scheduler & service **harus** filter by `siteId`
- Recipient validation ketat di runtime (bukan hanya UI)
- Hanya ADMIN/MANAGER boleh trigger manual
- Soft delete untuk audit
- Error message tidak bocorkan data sensitif
- Tidak ada hardcoded credentials

Lihat detail lengkap di Section 5 design discussion.

---

## 10. Error Handling & Resilience

- Setiap cron job di-wrap try/catch
- Partial success (beberapa email gagal) → status `PARTIAL`
- Log execution selalu dibuat (bahkan saat gagal)
- Jika tidak ada valid recipient → skip send, tetap catat execution
- Restart aplikasi → re-register semua active config
- Double-send prevention sederhana: cek `lastRunAt` dalam window kecil (opsional advance pakai lock)

---

## 11. Prerequisites & Dependencies (PENTING)

Sebelum dynamic scheduler bisa berfungsi benar, **harus** diselesaikan:

1. **Site filtering di report generators**
   - `TicketVolumeReport.generate()` harus support filter `siteId`
   - `AgentPerformanceReport.generate()` harus support `siteId`
   - Monthly stats di `ReportsService` (jika digunakan untuk scheduled monthly)

2. **Agent category separation di AgentPerformanceReport**
   - Tambah parameter `agentCategory?: 'REGULAR' | 'ORACLE'`
   - Filter berdasarkan `user.role` (REGULAR = AGENT / AGENT_ADMIN / AGENT_OPERATIONAL_SUPPORT; ORACLE = AGENT_ORACLE)

3. **Update query di generator** untuk join/filter `ticket.siteId` dan `user.siteId` / `user.role`

Tanpa ini, scheduled report akan mengirim data **cross-site** atau **campur oracle**, melanggar requirement.

---

## 12. Migration & Rollout Notes

- Existing hardcoded `ScheduledReportsService` bisa:
  - Dinonaktifkan (comment out cron), atau
  - Dibiarkan sementara sebagai fallback (tidak direkomendasikan)
- Buat migration untuk tabel baru `scheduled_report_configs` dan `scheduled_report_executions`
- Seed awal: boleh kosong (user yang buat)
- Setelah fitur stabil, hapus atau deprecate file lama

---

## 13. Open Items / Keputusan yang Sudah Diambil

| Item | Keputusan |
|------|-----------|
| Endpoint base | `/reports/scheduled` (disetujui) |
| Recipient picker | Filter by site, kirim email ke masing-masing |
| Manual trigger | Hanya ADMIN + MANAGER |
| Send time | Bisa di-set per config |
| Oracle separation | Ya, explicit `targetAgentCategory` |
| Execution log | Ya, tabel terpisah |
| UI lokasi | Tab di dalam Reports page (bisa berubah ke route terpisah) |
| Time default | "07:00" (bisa diubah user) |

---

## 14. Ringkasan File yang Akan Dibuat/Dimodifikasi (Estimasi)

**Baru:**
- `modules/reports/entities/scheduled-report-config.entity.ts`
- `modules/reports/entities/scheduled-report-execution.entity.ts`
- `modules/reports/dto/scheduled-report-config.dto.ts`
- `modules/reports/presentation/scheduled-reports.controller.ts`
- `modules/reports/services/scheduled-reports.service.ts` (CRUD + validation)
- `modules/reports/generators/dynamic-scheduled-reports.service.ts`
- Migration file

**Modifikasi:**
- `reports.module.ts` — daftarkan entity, controller, service baru
- `agent-performance.report.ts` + `ticket-volume.report.ts` — tambah site + category filter (prerequisite)
- `BentoReportsPage.tsx` — tambah tab + form
- Mungkin `reports.controller.ts` existing (opsional, jika ingin expose execution history endpoint terpisah)

---

**Dokumen ini adalah desain lengkap.**  
Setelah user menyetujui, langkah berikutnya adalah memanggil `writing-plans` untuk menghasilkan implementation plan detail.

**Siap untuk review user.**