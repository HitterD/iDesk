# BLUEPRINT APLIKASI WEB iDesk
## Enterprise IT Helpdesk System — Dokumentasi Teknis Lengkap

| Field | Detail |
|---|---|
| **Nama Aplikasi** | iDesk — Enterprise IT Helpdesk System |
| **Versi Dokumen** | 1.0 |
| **Tanggal** | 24 Februari 2026 |
| **Status** | Production Active |
| **Frontend URL** | http://localhost:4050 |
| **Backend API** | http://localhost:5050 |
| **Swagger Docs** | http://localhost:5050/api |

---

## 1. EXECUTIVE SUMMARY

**iDesk** adalah sistem helpdesk dan ticketing enterprise full-stack (NestJS + React). Mengelola seluruh siklus hidup permintaan IT support dengan integrasi multi-channel dan otomasi.

**Tiga Portal:**

| Portal | Pengguna | Fungsi |
|--------|----------|--------|
| Admin/Agent Portal | ADMIN & AGENT | Kelola tiket, laporan, konfigurasi |
| Manager Portal | MANAGER | Monitoring, laporan eksekutif |
| Client Portal | USER | Buat tiket, pantau, knowledge base |

**Statistik:** 28 Backend Modules, 17 Frontend Feature Areas, 44+ UI Components, 40+ DB Entities

---

## 2. ARSITEKTUR SISTEM

### 2.1 Stack Overview

- **Backend**: NestJS 10 + TypeORM + PostgreSQL — Port 5050
- **Frontend**: React 18 + Vite + TailwindCSS — Port 4050
- **Real-time**: Socket.IO WebSocket bidirectional
- **Queue/Cache**: Redis (Bull queues, optional)
- **Bot**: Telegram via Telegraf (polling/webhook)
- **Container**: Docker + Docker Compose

### 2.2 Frontend Routing

```
PUBLIC:
  /login                   → Login page
  /feedback/:token         → Survey page
  /unauthorized            → Access denied

ADMIN/AGENT PORTAL (/):
  /dashboard               → Analytics dashboard
  /kanban                  → Kanban board
  /tickets/list            → Ticket list + filter
  /tickets/:id             → Ticket detail + chat
  /tickets/create          → New ticket
  /agents                  → User management [ADMIN]
  /reports                 → Reports PDF/Excel
  /sla                     → SLA config [ADMIN]
  /renewal                 → Contract management
  /kb, /kb/manage          → Knowledge base
  /settings                → System settings
  /notifications           → Notification center
  /automation              → Workflow rules [ADMIN]
  /workloads               → Agent workload [ADMIN]
  /audit-logs              → Audit trail [ADMIN]
  /system-health           → Health dashboard [ADMIN]
  /zoom-calendar           → Zoom booking
  /zoom-settings           → Zoom config [ADMIN]

MANAGER PORTAL (/manager):
  /manager/dashboard       → Manager overview
  /manager/workloads       → Team workloads
  /manager/tickets         → All tickets view
  /manager/reports         → Executive reports
  /manager/kb              → Knowledge base
  /manager/zoom-calendar   → Zoom calendar
  /manager/renewal         → Contract renewal

CLIENT PORTAL (/client):
  /client/my-tickets       → My tickets
  /client/create           → Submit ticket
  /client/tickets/:id      → Ticket detail
  /client/notifications    → Notifications
  /client/zoom-calendar    → Zoom calendar
  /client/kb               → Knowledge base
  /client/profile          → User profile
```

---

## 3. TECHNOLOGY STACK

### Backend
| Teknologi | Kegunaan |
|-----------|----------|
| NestJS 10 | Framework modular |
| TypeORM | ORM PostgreSQL |
| Socket.IO | Real-time WebSocket |
| Passport JWT | Auth + RBAC |
| Telegraf | Telegram Bot |
| Bull | Redis job queues |
| PDFKit + ExcelJS | Report generation |
| Nodemailer + Handlebars | Email SMTP + template |
| @nestjs/schedule | Cron jobs |
| @nestjs/event-emitter | Event-driven automation |
| Multer | File upload |
| Swagger | API documentation |
| Helmet + Throttler | Security + rate limiting |
| bcrypt | Password hashing |
| Google APIs | Spreadsheet sync |

### Frontend
| Teknologi | Kegunaan |
|-----------|----------|
| React 18 | UI library |
| Vite | Build tool |
| TailwindCSS 3 | Styling |
| Radix UI | Accessible components |
| TanStack Query | Server state |
| Zustand | Client state |
| React Router DOM v6 | Routing |
| Framer Motion | Animations |
| Recharts | Charts |
| Socket.IO Client | WebSocket |
| React Hook Form + Zod | Form + validation |
| Tiptap | Rich text editor |
| Sonner | Toast notifications |

### Infrastructure
| Komponen | Teknologi |
|----------|-----------|
| Database | PostgreSQL 15+ |
| Cache/Queue | Redis 7+ |
| Container | Docker Compose |
| Storage | Local ./uploads |

---

## 4. AUTENTIKASI & OTORISASI

### 4.1 Credential & Token

- JWT Bearer Token (stateless)
- Token disimpan di localStorage `auth-storage`
- bcrypt password hashing
- Role-based expiry: Admin/Agent = 3h, User = 1h

### 4.2 Roles

| Role | Deskripsi | Default Password (seed) |
|------|-----------|------------------------|
| ADMIN | Administrator penuh | admin123 |
| AGENT | IT Support staff | agent123 |
| MANAGER | IT Manager | - |
| USER | End user/karyawan | user123 |

### 4.3 Guards & Middleware

| Guard | Fungsi |
|-------|--------|
| JwtAuthGuard | Verifikasi JWT token |
| RolesGuard | Cek role pada endpoint |
| PageAccessGuard | Cek izin per halaman |
| FeatureAccessGuard | Cek izin per fitur |
| CustomThrottlerGuard | Rate limiting global |

### 4.4 Security Features

- Rate limiting: 100 req/60s per IP
- IP Whitelist: blokir IP tidak diizinkan
- Page lockout: max 10 denial → lockout 15 menit
- Helmet security headers
- Input validation via class-validator pada DTO
- Magic bytes check untuk upload file
- CORS protection

---

## 5. CORE TICKETING SYSTEM

### 5.1 Tiket — Field Lengkap

| Field | Tipe | Keterangan |
|-------|------|------------|
| id | UUID | Primary key |
| ticketNumber | String unique | Auto-generated nomor tiket |
| title | String | Judul masalah |
| description | Text | Deskripsi lengkap |
| category | String | Kategori (GENERAL, dll) |
| device | String | Nama perangkat |
| software | String | Software terkait |
| status | Enum | TODO/IN_PROGRESS/WAITING_VENDOR/RESOLVED/CANCELLED |
| priority | String | LOW/MEDIUM/HIGH/CRITICAL |
| ticketType | Enum | SERVICE/ICT_BUDGET/LOST_ITEM/ACCESS_REQUEST/HARDWARE_INSTALLATION/ORACLE_REQUEST |
| source | Enum | WEB/TELEGRAM/EMAIL |
| userId | UUID | Pembuat |
| assignedToId | UUID | Agent ditugaskan |
| siteId | UUID | Site/cabang |
| slaTarget | Date | Deadline SLA |
| firstResponseTarget | Date | Target respons pertama |
| isOverdue | Boolean | Sudah terlambat |
| isFirstResponseBreached | Boolean | Respons pertama terlambat |
| criticalReason | Text | Alasan prioritas CRITICAL |
| isHardwareInstallation | Boolean | Flag instalasi hardware |
| scheduledDate | Date | Jadwal instalasi |
| scheduledTime | String | Jam jadwal HH:mm |
| hardwareType | String | PC/IP_PHONE/PRINTER |
| version | Int | Optimistic locking |

### 5.2 Status Flow

```
TODO → IN_PROGRESS ↔ WAITING_VENDOR → RESOLVED
                                    → CANCELLED
```

### 5.3 Fitur Ticketing

| Fitur | Deskripsi |
|-------|-----------|
| Multi-source | Buat tiket via Web, Telegram, Email |
| Rich text messages | Editor WYSIWYG + attachment |
| Internal notes | Pesan private agent-only |
| @mention | Tag agent dalam percakapan |
| File attachment | Gambar, PDF, dokumen |
| Canned responses | Template jawaban cepat |
| Ticket templates | Form pre-filled |
| Bulk operations | Mass update status/priority/assignee |
| Ticket surveys | Rating kepuasan post-resolve |
| Custom attributes | Field tambahan per kategori |
| SLA tracking | Countdown + breach alert |
| Time entries | Log waktu pengerjaan |
| Hardware scheduling | Jadwal instalasi + reminder otomatis |
| Kanban view | Drag-drop per kolom status |
| List view | Tabel dengan sort + filter + search |

### 5.4 Ticket Message Entity

| Field | Keterangan |
|-------|------------|
| id | UUID |
| ticketId | Referensi tiket |
| senderId | User pengirim |
| content | Isi pesan (rich text) |
| isInternal | Flag internal note |
| attachments | Array file attachment |
| readBy | Array user yang sudah baca |
| createdAt | Timestamp |

