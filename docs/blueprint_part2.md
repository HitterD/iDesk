
---

## 6. MANAJEMEN PENGGUNA

### 6.1 User Entity

| Field | Keterangan |
|-------|------------|
| id | UUID primary key |
| email | Unique, login identifier |
| password | bcrypt hashed |
| fullName | Nama lengkap |
| role | ADMIN/AGENT/MANAGER/USER |
| employeeId | ID karyawan |
| jobTitle | Jabatan |
| phoneNumber | Nomor telepon |
| departmentId | FK ke Department |
| avatarUrl | URL foto profil |
| telegramId | Linked Telegram account |
| telegramChatId | Chat ID Telegram |
| telegramNotifications | Toggle notif Telegram |
| isActive | Status aktif |
| lastActiveAt | Timestamp aktivitas terakhir |
| siteId | FK ke Site (multi-site) |
| appliedPresetId | Permission preset aktif |
| appraisalPoints | Poin kinerja agent |
| createdAt / updatedAt | Timestamps |

### 6.2 Fitur User Management

| Fitur | Deskripsi |
|-------|-----------|
| CRUD Users | Create, Read, Update, Delete user |
| CSV Import | Bulk import user dari file CSV |
| Avatar Upload | Upload foto profil |
| Department Management | Kelola departemen |
| Telegram Linking | Hubungkan akun Telegram |
| Role Management | Atur role & izin |
| Permission Preset | Template izin per tipe user |
| Activity Indicator | Status online terakhir |
| Soft Delete | Deaktivasi user tanpa hapus data |
| Password Reset | Admin reset password |

---

## 7. SLA MANAGEMENT

### 7.1 Konsep SLA

SLA (Service Level Agreement) mendefinisikan tenggat waktu penyelesaian tiket berdasarkan prioritas.

### 7.2 SLA Config Entity

| Field | Keterangan |
|-------|------------|
| id | UUID |
| priority | LOW/MEDIUM/HIGH/CRITICAL |
| responseTimeMinutes | Target waktu respons pertama |
| resolutionTimeMinutes | Target waktu resolusi |
| isActive | Status aktif |

### 7.3 Business Hours

| Field | Keterangan |
|-------|------------|
| dayOfWeek | 0-6 (Minggu-Sabtu) |
| startTime | Jam mulai kerja (HH:mm) |
| endTime | Jam selesai kerja (HH:mm) |
| isWorkingDay | Hari kerja atau tidak |
| holidays | Daftar hari libur nasional Indonesia (2025-2026) |

### 7.4 Cara Kerja SLA

```
1. Tiket dibuat → slaStartedAt = now
2. Hitung slaTarget berdasarkan priority + business hours
3. Cron job tiap 5 menit → cek semua tiket aktif
4. Jika slaTarget - now < threshold → kirim SLA warning
5. Jika now > slaTarget → isOverdue = true + kirim breach alert
6. Status WAITING_VENDOR → clock di-pause (totalWaitingVendorMinutes++)
7. SLA resume ketika status kembali ke IN_PROGRESS
```

### 7.5 SLA Alerts

- Warning email ke assignee & admin saat mendekati deadline
- Telegram notification untuk agen
- Dashboard indicator merah pada tiket overdue
- Auto-reassign jika dikonfigurasi di workflow rules

---

## 8. KNOWLEDGE BASE

### 8.1 Article Entity

| Field | Keterangan |
|-------|------------|
| id | UUID |
| title | Judul artikel |
| content | Isi artikel (rich text/HTML) |
| summary | Ringkasan singkat |
| category | Kategori artikel |
| tags | Array tags |
| authorId | Penulis |
| visibility | PUBLIC/INTERNAL/PRIVATE |
| isPublished | Status publikasi |
| viewCount | Jumlah tampilan |
| helpfulCount | Jumlah "artikel ini membantu" |
| notHelpfulCount | Jumlah "tidak membantu" |
| createdAt / updatedAt | Timestamps |

### 8.2 Fitur Knowledge Base

| Fitur | Deskripsi |
|-------|-----------|
| Create/Edit Article | Editor WYSIWYG lengkap |
| Categories & Tags | Organisasi konten |
| Visibility Control | PUBLIC/INTERNAL/PRIVATE |
| Full-text Search | Cari artikel berdasarkan kata kunci |
| View Tracking | Hitung popularitas artikel |
| Helpful/Not Helpful | Feedback rating |
| Article Management | Daftar kelola untuk admin/agent |
| Client Access | User dapat mengakses KB publik |

---

## 9. NOTIFICATION SYSTEM

### 9.1 Notification Channels

| Channel | Deskripsi |
|---------|-----------|
| In-App | Notifikasi dalam aplikasi (real-time via WebSocket) |
| Email | SMTP email dengan template HTML Handlebars |
| Telegram | Pesan langsung ke akun Telegram user |
| Push | Browser push notification (PWA) |

### 9.2 Notification Entities

| Entity | Keterangan |
|--------|------------|
| Notification | Notifikasi per user |
| NotificationPreference | Preferensi channel per user |
| NotificationLog | Log pengiriman (success/fail) |
| PushSubscription | Data push subscription browser |

### 9.3 Event yang Memicu Notifikasi

| Event | Penerima |
|-------|---------|
| Tiket baru dibuat | Assignee + Admin |
| Tiket di-assign | Agent ditugaskan |
| Status tiket berubah | Pembuat tiket |
| Pesan baru di tiket | Semua partisipan |
| SLA mendekati deadline | Assignee + Admin |
| SLA breach | Assignee + Admin |
| Tiket resolved | Pembuat tiket |
| Renewal kontrak mendekati expired | Admin |
| Zoom booking dikonfirmasi/dibatalkan | Peserta |
| Hardware installation reminder H-1 & H-0 | User & Agent |

---

## 10. AUTOMATION ENGINE (WORKFLOW)

### 10.1 Konsep

Engine otomasi berbasis rule: **Trigger → Conditions → Actions**. Setiap rule mendengarkan event tertentu dan menjalankan aksi jika kondisi terpenuhi.

### 10.2 WorkflowRule Entity

| Field | Keterangan |
|-------|------------|
| id | UUID |
| name | Nama rule |
| isActive | On/Off toggle |
| priority | Urutan eksekusi (angka lebih kecil = prioritas lebih tinggi) |
| trigger | JSON: { type, event } |
| conditions | JSON Array: [{ field, operator, value }] |
| actions | JSON Array: [{ type, params }] |

### 10.3 Trigger Types (9 Jenis)

| Trigger | Keterangan |
|---------|------------|
| TICKET_CREATED | Tiket baru dibuat |
| TICKET_STATUS_CHANGED | Status tiket berubah |
| TICKET_PRIORITY_CHANGED | Prioritas berubah |
| TICKET_ASSIGNED | Tiket di-assign ke agent |
| MESSAGE_RECEIVED | Pesan baru masuk |
| SLA_WARNING | SLA mendekati deadline |
| SLA_BREACHED | SLA sudah terlampaui |
| TICKET_IDLE | Tiket tidak ada aktivitas selama X jam |
| SCHEDULED | Berbasis jadwal/waktu |

### 10.4 Condition Operators (14 Jenis)

EQUALS, NOT_EQUALS, CONTAINS, NOT_CONTAINS, STARTS_WITH, ENDS_WITH, IN, NOT_IN, GREATER_THAN, LESS_THAN, IS_NULL, IS_NOT_NULL, MATCHES_REGEX, NOT_MATCHES_REGEX

### 10.5 Action Types (7 Jenis)

| Aksi | Keterangan |
|------|------------|
| CHANGE_STATUS | Ubah status tiket |
| CHANGE_PRIORITY | Ubah prioritas tiket |
| ASSIGN_TO | Assign ke agent spesifik |
| SEND_NOTIFICATION | Kirim notifikasi ke user/group |
| SEND_EMAIL | Kirim email |
| SEND_WEBHOOK | HTTP callback ke URL eksternal |
| ADD_TAG | Tambah tag/label tiket |

### 10.6 Auto-Assignment

| Mode | Deskripsi |
|------|-----------|
| ROUND_ROBIN | Distribusi merata bergiliran antar agent |
| LEAST_BUSY | Assign ke agent dengan tiket aktif paling sedikit |

### 10.7 Pre-built Templates

5 template bawaan tersedia:
1. High Priority Escalation — eskalasi tiket HIGH/CRITICAL
2. SLA Warning Notification — ingatkan sebelum breach
3. Auto-assign New Tickets — round-robin assignment
4. Close Resolved Tickets — auto-close setelah X hari resolved
5. Routing by Category — arahkan tiket berdasarkan kategori

---

## 11. LAPORAN & ANALITIK

### 11.1 Jenis Laporan

| Laporan | Format | Keterangan |
|---------|--------|------------|
| Monthly Summary | PDF + Excel | Ringkasan tiket bulanan |
| Agent Performance | PDF | Metrik per agent |
| SLA Compliance | PDF | Tingkat kepatuhan SLA |
| Ticket by Category | Excel | Distribusi per kategori |
| Resolution Time | Excel | Rata-rata waktu penyelesaian |
| Trend Analysis | Chart | Grafik tren tiket |

### 11.2 Dashboard Analytics (Real-time)

Widget di BentoDashboard:
- Total tiket (hari ini / bulan ini / all-time)
- Tiket by status (TODO, IN_PROGRESS, WAITING, RESOLVED, CANCELLED)
- Tiket overdue
- Average response time
- SLA compliance rate
- Agent performance comparison
- Ticket volume trend (chart line)
- Category distribution (pie chart)
- Top performing agents

### 11.3 Manager Dashboard

Khusus role MANAGER:
- Team workload overview
- Per-agent ticket count
- Resolution rate comparison
- SLA performance heatmap
- Reports download

---

## 12. INTEGRASI TELEGRAM BOT

### 12.1 Fitur Bot

| Fitur | Deskripsi |
|-------|-----------|
| Create ticket | Buat tiket baru via chat |
| View ticket status | Cek status tiket aktif |
| Receive notifications | Notifikasi real-time |
| Two-way messaging | Balas tiket via Telegram |
| Role-based menus | Menu berbeda per role |
| Account linking | Hubungkan akun iDesk dengan Telegram |

### 12.2 Role-based Menu

| Role | Menu yang Tersedia |
|------|-------------------|
| USER | Buat tiket, lihat tiket saya, KB |
| AGENT | Lihat tiket assigned, update status, kirim pesan |
| ADMIN | Semua menu + statistik singkat |

### 12.3 Mode Operasi

- **Polling**: Untuk development (terus-menerus tanya API Telegram)
- **Webhook**: Untuk production (Telegram push ke server)

### 12.4 TelegramSession Entity

| Field | Keterangan |
|-------|------------|
| id | UUID |
| telegramId | Telegram user ID |
| chatId | Telegram chat ID |
| userId | Linked iDesk user ID |
| state | State machine percakapan |
| context | Data konteks sementara |
| lastActiveAt | Aktivitas terakhir |

---

## 13. CONTRACT RENEWAL (RENEWAL HUB)

### 13.1 RenewalContract Entity

| Field | Keterangan |
|-------|------------|
| id | UUID |
| contractName | Nama kontrak |
| vendorName | Nama vendor |
| contractNumber | Nomor kontrak |
| startDate | Tanggal mulai |
| expiryDate | Tanggal kadaluarsa |
| value | Nilai kontrak |
| currency | Mata uang |
| category | Kategori (SOFTWARE/HARDWARE/SERVICE) |
| status | ACTIVE/EXPIRING/EXPIRED/RENEWED |
| documentUrl | URL file kontrak (PDF) |
| notes | Catatan tambahan |
| acknowledgedBy | User yang konfirmasi |
| acknowledgedAt | Waktu konfirmasi |

### 13.2 Fitur Renewal

| Fitur | Deskripsi |
|-------|-----------|
| PDF Parsing | Auto-ekstrak data dari kontrak PDF |
| Manual Entry | Input manual jika PDF tidak bisa diparse |
| Expiry Alerts | Notifikasi 30/60/90 hari sebelum expired |
| Acknowledgment | Tracking konfirmasi renewal |
| Dashboard | Overview status semua kontrak |
| VPN Access Tracking | Pantau akses VPN per user |
| Google Sync | Sinkronisasi ke Google Spreadsheet |

---

## 14. ZOOM BOOKING CALENDAR

### 14.1 Entities

| Entity | Keterangan |
|--------|------------|
| ZoomAccount | Akun Zoom terdaftar (S2S OAuth) |
| ZoomBooking | Reservasi meeting |
| ZoomMeeting | Data meeting Zoom aktual |
| ZoomParticipant | Peserta meeting |
| ZoomSettings | Pengaturan global |
| ZoomAuditLog | Log perubahan booking |

### 14.2 ZoomBooking Fields

| Field | Keterangan |
|-------|------------|
| title | Judul meeting |
| description | Deskripsi |
| bookingDate | Tanggal meeting |
| startTime / endTime | Jam mulai & selesai (HH:mm) |
| durationMinutes | Durasi dalam menit |
| status | PENDING/CONFIRMED/CANCELLED |
| bookedByUserId | User yang booking |
| zoomAccountId | Akun Zoom yang digunakan |
| cancellationReason | Alasan pembatalan |
| participants | Daftar peserta |

### 14.3 Fitur Zoom Calendar

| Fitur | Deskripsi |
|-------|-----------|
| Visual Calendar | Tampilan kalender bulanan |
| Slot Availability | Cek ketersediaan slot |
| Booking | Reservasi meeting Zoom |
| Cancellation | Batalkan dengan alasan |
| participants | Tambah peserta |
| Auto-create Zoom meeting | Otomatis buat meeting di Zoom |
| Notifikasi | Email & in-app ke semua peserta |
| Audit trail | Log semua perubahan |
| Multi-account | Kelola beberapa akun Zoom |
| All roles access | Admin/Agent/Manager/User bisa akses |

---

## 15. SISTEM IZIN AKSES (PERMISSIONS)

### 15.1 Entities

| Entity | Keterangan |
|--------|------------|
| FeatureDefinition | Definisi fitur yang dikontrol |
| UserFeaturePermission | Izin per user per fitur |
| PermissionPreset | Template izin yang bisa diterapkan ke banyak user |

### 15.2 Cara Kerja

```
1. Admin buat FeatureDefinition (e.g., "zoom_calendar")
2. Admin buat PermissionPreset (e.g., "IT Staff Preset")
3. Preset berisi konfigurasi izin per fitur
4. Admin terapkan preset ke user/group
5. Saat user akses halaman → PageAccessGuard cek UserFeaturePermission
6. Jika tidak ada permission → redirect ke /unauthorized
```

### 15.3 Fitur yang Dikontrol Permission

- zoom_calendar
- knowledge_base
- reports
- renewal
- notifications
- settings
- Dan dapat ditambah fitur baru

---

## 16. GOOGLE SPREADSHEET SYNC

### 16.1 Entities

| Entity | Keterangan |
|--------|------------|
| SpreadsheetConfig | Konfigurasi spreadsheet tujuan |
| SpreadsheetSheet | Sheet dalam spreadsheet |
| SyncLog | Log sinkronisasi |

### 16.2 Fitur

| Fitur | Deskripsi |
|-------|-----------|
| Auto-sync | Sync data secara berkala ke Google Sheets |
| Manual sync | Trigger sync manual |
| Multiple sheets | Sinkronisasi ke beberapa sheet |
| Sync log | Riwayat sync berhasil/gagal |
| Kolom mapping | Peta kolom data ke spreadsheet |
| Service Account auth | Auth via Google Service Account JSON |

### 16.3 Use Cases

- Export data tiket ke Google Sheets (monitoring)
- Renewal contract tracking di Sheets
- VPN access log di Sheets
- Custom data sync sesuai kebutuhan

---

## 17. MODUL TAMBAHAN

### 17.1 ICT Budget Request

Form permintaan anggaran untuk pembelian IT:
- Judul & deskripsi kebutuhan
- Estimasi biaya
- Justifikasi
- Status approval
- Integrasi dengan ticket type ICT_BUDGET

### 17.2 Lost Item Report

Laporan kehilangan barang milik perusahaan:
- Deskripsi barang
- Lokasi terakhir diketahui
- Tanggal kehilangan
- Status investigasi

### 17.3 Access Request

Permintaan akses ke sistem/aplikasi/jaringan:
- Jenis akses yang diminta (AccessType entity)
- Alasan kebutuhan akses
- Durasi akses
- Status approve/reject

### 17.4 VPN Access Tracking

Pantau dan kelola akses VPN per user:
- Request akses VPN
- Approval workflow
- Log akses
- Revoke akses

### 17.5 IP Whitelist Management

Kelola IP yang diizinkan mengakses sistem:
- CRUD IP address/range
- Enable/disable per IP
- Deskripsi/alasan whitelist

### 17.6 Agent Workload & Appraisal

| Fitur | Deskripsi |
|-------|-----------|
| PriorityWeight | Bobot poin per prioritas tiket |
| AgentDailyWorkload | Tracking beban kerja harian |
| Appraisal points | Akumulasi poin kinerja per agent |
| Workload dashboard | Visualisasi distribusi beban kerja |

### 17.7 Synology Backup Integration

| Fitur | Deskripsi |
|-------|-----------|
| BackupConfiguration | Konfigurasi backup ke Synology NAS |
| BackupHistory | Riwayat backup berhasil/gagal |
| Scheduled backup | Backup otomatis terjadwal |
| Status monitoring | Monitor status backup |

### 17.8 Sound Notifications

Kustomisasi suara notifikasi:
- NotificationSound entity
- Upload custom sound file
- Assign sound per event type
- Toggle per user

### 17.9 Multi-Site Support

| Fitur | Deskripsi |
|-------|-----------|
| Site entity | Kelola multiple cabang/lokasi |
| Site isolation | Tiket & user ter-isolasi per site |
| Site-based reporting | Laporan per site |
| Cross-site admin | Admin bisa akses semua site |

### 17.10 System Health

| Fitur | Deskripsi |
|-------|-----------|
| Health check endpoint | GET /health |
| Database connectivity | Cek koneksi PostgreSQL |
| Redis connectivity | Cek koneksi Redis |
| Memory usage | Monitor penggunaan RAM |
| System info | Versi, uptime, environment |

### 17.11 Audit Log

| Field | Keterangan |
|-------|------------|
| id | UUID |
| userId | User yang melakukan aksi |
| action | Jenis aksi (CREATE/UPDATE/DELETE) |
| entityType | Tipe entitas (Ticket, User, dll) |
| entityId | ID entitas yang terpengaruh |
| oldValues | Nilai sebelum perubahan (JSON) |
| newValues | Nilai setelah perubahan (JSON) |
| ipAddress | IP address user |
| createdAt | Timestamp |

---

## 18. SEARCH SYSTEM

### 18.1 Global Search

- Unified search across: Tiket, Artikel KB, User
- Command palette (shortcut Ctrl+K / Cmd+K)
- Real-time autocomplete
- Filter by type

### 18.2 Saved Search

| Field | Keterangan |
|-------|------------|
| id | UUID |
| userId | Pemilik |
| name | Nama pencarian |
| query | String pencarian |
| filters | JSON filter kriteria |
| createdAt | Timestamp |

---

## 19. FILE UPLOAD

| Fitur | Deskripsi |
|-------|-----------|
| Upload endpoint | POST /uploads |
| Supported types | Image (jpg/png/gif/webp), PDF, Office docs |
| Size limit | Konfigurasi via env |
| Magic bytes check | Validasi tipe file sebenarnya |
| Static serving | GET /uploads/:filename |
| Drag & drop UI | React Dropzone di frontend |

---

## 20. API ENDPOINTS UTAMA

### Auth
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | /auth/login | Login + get JWT |
| GET | /auth/profile | Data user aktif |
| POST | /auth/refresh | Refresh token |

### Tickets
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | /tickets | List tiket + filter |
| POST | /tickets | Buat tiket baru |
| GET | /tickets/:id | Detail tiket |
| PATCH | /tickets/:id | Update tiket |
| DELETE | /tickets/:id | Hapus tiket |
| GET | /tickets/:id/messages | Pesan tiket |
| POST | /tickets/:id/messages | Kirim pesan |
| PATCH | /tickets/bulk | Bulk update |

### Users
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | /users | List user |
| POST | /users | Buat user |
| PATCH | /users/:id | Update user |
| DELETE | /users/:id | Hapus user |
| POST | /users/import-csv | Import CSV |
| GET | /departments | List departemen |

### Knowledge Base
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | /kb/articles | List artikel |
| POST | /kb/articles | Buat artikel |
| GET | /kb/articles/:id | Detail artikel |
| PATCH | /kb/articles/:id | Edit artikel |
| DELETE | /kb/articles/:id | Hapus artikel |

### Notifications
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | /notifications | List notifikasi |
| PATCH | /notifications/read-all | Tandai semua dibaca |
| GET | /notifications/preferences | Preferensi notif |
| PATCH | /notifications/preferences | Update preferensi |

### Reports
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | /reports/monthly | Laporan bulanan |
| GET | /reports/agent-performance | Kinerja agent |
| GET | /reports/export/pdf | Export PDF |
| GET | /reports/export/excel | Export Excel |

### Zoom Booking
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | /zoom-booking/accounts | List akun Zoom |
| GET | /zoom-booking/bookings | List booking |
| POST | /zoom-booking/bookings | Buat booking |
| PATCH | /zoom-booking/bookings/:id | Update booking |
| DELETE | /zoom-booking/bookings/:id | Cancel booking |

### Automation
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | /automation/rules | List workflow rules |
| POST | /automation/rules | Buat rule |
| PATCH | /automation/rules/:id | Update rule |
| DELETE | /automation/rules/:id | Hapus rule |

---

## 21. REAL-TIME SYSTEM (WEBSOCKET)

### 21.1 Events yang Di-emit Backend → Frontend

| Event | Payload | Keterangan |
|-------|---------|------------|
| ticket:created | Ticket data | Tiket baru dibuat |
| ticket:updated | Ticket data | Tiket diupdate |
| ticket:status-changed | { id, status } | Status berubah |
| ticket:message | Message data | Pesan baru masuk |
| notification:new | Notification | Notifikasi untuk user |
| agent:online | { userId } | Agent aktif |
| zoom:booking-updated | Booking data | Booking Zoom berubah |

### 21.2 Rooms & Namespaces

- User masuk room berdasarkan role dan ticket ID
- Notifikasi dikirim hanya ke room yang relevan
- Heartbeat connection management

---

## 22. KONFIGURASI ENVIRONMENT

```env
# Database PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your-secure-password
DB_DATABASE=idesk_db
DB_POOL_MIN=2
DB_POOL_MAX=10

# JWT Authentication
JWT_SECRET=generate-a-strong-64-char-secret
JWT_EXPIRES_IN=60m

# Telegram Bot
TELEGRAM_BOT_TOKEN=your-telegram-token
TELEGRAM_USE_WEBHOOK=false  # true for production
TELEGRAM_WEBHOOK_DOMAIN=https://api.yourapp.com

# Redis (optional)
REDIS_ENABLED=false
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Email SMTP
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-pass
SMTP_FROM='iDesk Support <noreply@idesk.com>'

# Zoom API (Server-to-Server OAuth)
ZOOM_ACCOUNT_ID=your-zoom-account-id
ZOOM_CLIENT_ID=your-zoom-client-id
ZOOM_CLIENT_SECRET=your-zoom-client-secret

# Google API
GOOGLE_CREDENTIALS_PATH=path/to/service-account.json

# Application
PORT=5050
NODE_ENV=development
FRONTEND_URL=http://localhost:4050
UPLOAD_DIR=./uploads

# Rate Limiting
THROTTLE_TTL=60000
THROTTLE_LIMIT=100
PAGE_ACCESS_CACHE_TTL=300
PAGE_ACCESS_MAX_DENIALS=10
PAGE_ACCESS_LOCKOUT_MINUTES=15
```

---

## 23. INFRASTRUKTUR & DEPLOYMENT

### 23.1 Development Setup

```bash
# 1. Clone repository
git clone https://github.com/HitterD/iDesk.git
cd iDesk

# 2. Setup environment
cp .env.example .env
# Edit .env sesuai kebutuhan

# 3. Start database (Docker)
docker-compose -f docker-compose.db.yml up -d
# Atau: deploy_database_docker.bat (Windows)

# 4. Install dependencies
npm run install:all

# 5. Run migrations
cd apps/backend && npm run migration:run

# 6. Seed database
npm run seed

# 7. Start all services
npm start
# Atau: startup.bat (Windows)
```

### 23.2 Default Login Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@idesk.com | admin123 |
| Agent | agent@idesk.com | agent123 |
| User | user@idesk.com | user123 |

### 23.3 Ports

| Service | Port |
|---------|------|
| Frontend (Vite dev) | 4050 |
| Backend (NestJS) | 5050 |
| PostgreSQL | 5432 |
| Redis | 6379 |
| Swagger UI | 5050/api |

### 23.4 Docker Services (docker-compose.yml)

| Service | Image | Keterangan |
|---------|-------|------------|
| postgres | postgres:15 | Database utama |
| redis | redis:7 | Cache + queue (optional) |
| backend | Custom Dockerfile | NestJS app |
| frontend | Custom Dockerfile | React app |

### 23.5 Database Scripts

```bash
# Backup database
backup_db.bat

# Run migrations
npm run migration:run

# Generate migration
npm run migration:generate -- -n MigrationName

# Revert migration
npm run migration:revert
```

---

## 24. STRUKTUR KOMPONEN FRONTEND (44+ Components)

### 24.1 Layout Components
- `BentoLayout` — Admin/Agent portal shell (sidebar + topbar)
- `ClientLayout` — Client portal shell
- `ManagerLayout` — Manager portal shell
- `Sidebar` — Navigation sidebar dengan collapsible
- `TopBar` — Header dengan search, notif, user menu

### 24.2 Core UI Components
- `Button`, `Input`, `Select`, `Checkbox`, `RadioGroup`
- `Dialog/Modal`, `Popover`, `Dropdown`
- `Card`, `Badge`, `Avatar`
- `Table`, `DataGrid`
- `Progress`, `Slider`, `Switch`
- `Tabs`, `Accordion`
- `Toast`/Sonner notifications
- `LoadingScreen`, `Skeleton` loaders

### 24.3 Advanced Feature Components
- `CommandPalette` — Global search (Ctrl+K)
- `RichTextEditor` — Tiptap WYSIWYG
- `VirtualizedList` — Performance list untuk data besar
- `ActivityFeed` — Real-time activity stream
- `CannedResponses` — Quick reply picker
- `ArticleSearchAutocomplete` — KB search inline
- `BulkActionsToolbar` — Mass operations UI
- `PDFPreviewModal` — Preview PDF in-browser
- `ErrorBoundary` + `FeatureErrorBoundary` — Error isolation
- `ScreenReaderAnnounce` — Accessibility

### 24.4 Custom Hooks (19 hooks)
- `useAuth` — Auth state & actions
- `useTickets` — Ticket CRUD + realtime
- `useNotifications` — Notification center
- `useSocket` — WebSocket management
- `usePermissions` — Permission checks
- `useDebounce` — Search input debounce
- `useLocalStorage` — Typed localStorage
- Dan lainnya...

---

## 25. KEAMANAN SISTEM

| Aspek | Implementasi |
|-------|-------------|
| Password | bcrypt hashing dengan salt |
| JWT | Signed tokens, role-based expiry |
| Rate Limiting | 100 req/menit per IP |
| IP Whitelist | Blokir IP tidak diizinkan |
| Page Access | Guard per halaman + lockout |
| File Upload | Magic bytes validation |
| Headers | Helmet (X-XSS, HSTS, CSP) |
| Input | class-validator pada semua DTO |
| CORS | Konfigurasi origin whitelist |
| SQL Injection | TypeORM query builder (parameterized) |
| Slow Query | Log query > 1 detik |
| DB Pool | Min 5, Max 20 connections |

---

## 26. RINGKASAN FITUR A–Z

| Fitur | Deskripsi | Role |
|-------|-----------|------|
| Access Request | Permintaan akses sistem/jaringan | All |
| Agent Management | Kelola user agent & admin | ADMIN |
| Appraisal Points | Poin kinerja agent otomatis | ADMIN |
| Audit Trail | Log semua perubahan sistem | ADMIN |
| Automation Rules | Workflow IF-THEN otomatis | ADMIN |
| Backup Synology | Integrasi backup ke NAS Synology | ADMIN |
| Bulk Operations | Mass update tiket | ADMIN/AGENT |
| Business Hours | Konfigurasi jam kerja SLA | ADMIN |
| Canned Responses | Template jawaban cepat | AGENT |
| Contract Renewal | Manajemen kontrak IT dengan alert | ADMIN/AGENT |
| CSV Import | Bulk import user | ADMIN |
| Dashboard Analytics | Statistik real-time | ADMIN/AGENT |
| Department Management | Struktur organisasi | ADMIN |
| Events & Notifications | Notifikasi multi-channel | All |
| File Attachments | Upload dokumen ke tiket | All |
| Google Sheets Sync | Sinkronisasi data ke Google Sheets | ADMIN |
| Hardware Installation | Request + jadwal instalasi hardware | All |
| Health Monitoring | Status sistem real-time | ADMIN |
| ICT Budget Request | Pengajuan anggaran IT | All |
| Internal Notes | Note private antar agent | AGENT/ADMIN |
| IP Whitelist | Kelola izin akses per IP | ADMIN |
| JWT Authentication | Login aman dengan token | All |
| Kanban Board | Visual drag-drop ticket management | ADMIN/AGENT |
| Knowledge Base | Artikel panduan & FAQ | All |
| Lost Item Report | Laporan kehilangan barang | All |
| Manager Dashboard | Monitoring khusus manajer | MANAGER |
| Multi-site Support | Manajemen multi cabang | ADMIN |
| Notification Center | Pusat semua notifikasi | All |
| Oracle Access Request | Permintaan akses sistem Oracle | All |
| Permission Presets | Template izin per tipe user | ADMIN |
| PDF Reports | Generate laporan PDF | ADMIN/MANAGER |
| Push Notifications | Browser push notification | All |
| Rate Limiting | Proteksi brute-force | System |
| Real-time Updates | WebSocket live updates | All |
| Reports & Analytics | Laporan performa | ADMIN/MANAGER |
| Role-based Access | Akses granular per peran | System |
| Saved Replies | Simpan teks jawaban | AGENT/ADMIN |
| Search Global | Cari tiket/artikel/user | All |
| Settings | Preferensi sistem & profil | All |
| SLA Management | Tracking & alert keterlambatan | System |
| Sound Notifications | Kustomisasi suara notif | All |
| Surveys/Feedback | Rating kepuasan setelah tiket selesai | All |
| Telegram Bot | Buat & pantau tiket via Telegram | All |
| Ticket Templates | Form pre-filled untuk tiket umum | ADMIN/AGENT |
| Time Tracking | Log waktu pengerjaan tiket | AGENT |
| User Management | CRUD pengguna sistem | ADMIN |
| VPN Access Tracking | Kelola & pantau akses VPN | ADMIN/AGENT |
| Workload Dashboard | Distribusi beban kerja agent | ADMIN/MANAGER |
| WYSIWYG Editor | Editor teks kaya untuk tiket & KB | All |
| Zoom Booking | Kalender booking meeting Zoom | All |
