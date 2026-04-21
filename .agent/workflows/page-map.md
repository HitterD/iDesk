---
description: Tampilkan peta lengkap semua halaman iDesk beserta file-file terkait (frontend page, components, backend module, routes, dan role access)
---

# /page-map — iDesk Page Structure Map

> **Tujuan:** Menampilkan pemetaan lengkap semua halaman yang ada di project iDesk, termasuk route, role access, file frontend, dan backend module terkait. Berguna sebagai referensi sebelum melakukan review, improve, atau debug.

---

## Cara Pakai

```
/page-map
/page-map [portal]
```

**Contoh:**
- `/page-map` — tampilkan semua halaman
- `/page-map admin` — hanya halaman Admin/Agent portal
- `/page-map client` — hanya halaman Client portal
- `/page-map manager` — hanya halaman Manager portal

---

## Langkah-Langkah

// turbo-all

### STEP 1: Baca Route Configuration

1. **Baca `App.tsx` untuk mendapatkan semua routes:**
   ```
   c:\iDesk\apps\frontend\src\App.tsx
   ```

2. **Baca `pageDefinitions.ts` untuk mendapatkan page access definitions:**
   ```
   c:\iDesk\apps\frontend\src\lib\pageDefinitions.ts
   ```

### STEP 2: Scan Feature Folders

3. **List semua folder di features:**
   ```
   c:\iDesk\apps\frontend\src\features\
   ```
   Untuk setiap feature folder, list isinya:
   - `pages/` — Page-level components
   - `components/` — Feature-specific components
   - `hooks/` — Feature-specific hooks
   - `types/` — Feature-specific types

4. **List semua backend modules:**
   ```
   c:\iDesk\apps\backend\src\modules\
   ```
   Untuk setiap module folder, identifikasi:
   - `*.controller.ts` — API endpoints
   - `*.service.ts` — Business logic
   - `*.entity.ts` — Database entities
   - `*.module.ts` — Module config
   - `dto/` — Data transfer objects

### STEP 3: Generate Page Map

5. **Tampilkan output dalam format tabel komprehensif:**

```markdown
# 🗺️ iDesk Page Structure Map

## 📊 Summary
- Total Pages: [count]
- Admin/Agent Portal: [count] pages
- Manager Portal: [count] pages  
- Client Portal: [count] pages
- Public Pages: [count] pages

## Admin/Agent Portal (ADMIN + AGENT roles)

| # | Page Name | Route | Component | Feature Folder | Backend Module(s) | Access Control |
|---|-----------|-------|-----------|----------------|-------------------|----------------|
| ... | ... | ... | ... | ... | ... | ... |

## Manager Portal (MANAGER role)

| # | Page Name | Route | Component | Feature Folder | Backend Module(s) | Access Control |
|---|-----------|-------|-----------|----------------|-------------------|----------------|
| ... | ... | ... | ... | ... | ... | ... |

## Client Portal (USER role)

| # | Page Name | Route | Component | Feature Folder | Backend Module(s) | Access Control |
|---|-----------|-------|-----------|----------------|-------------------|----------------|
| ... | ... | ... | ... | ... | ... | ... |

## Public Pages (No auth)

| # | Page Name | Route | Component | Feature Folder | Backend Module(s) |
|---|-----------|-------|-----------|----------------|-------------------|
| ... | ... | ... | ... | ... | ... |
```

6. **Untuk setiap halaman, tampilkan file tree detail:**

```markdown
### [Page Name] — `/route`

#### Frontend Files
├── pages/
│   └── PageComponent.tsx (entry point)
├── components/
│   ├── SubComponent1.tsx
│   ├── SubComponent2.tsx
│   └── ...
├── hooks/
│   └── useFeatureHook.ts
└── types/
    └── types.ts

#### Backend Files  
├── feature.controller.ts (X endpoints)
├── feature.service.ts
├── feature.entity.ts
├── feature.module.ts
└── dto/
    ├── create-feature.dto.ts
    └── update-feature.dto.ts

#### Shared Dependencies
├── hooks: [list shared hooks used]
├── components: [list shared UI components used]
├── stores: [list Zustand stores used]
└── lib: [list utilities used]
```

### STEP 4: Generate Dependency Graph (Optional)

7. **Jika diminta, buat dependency graph antar halaman:**
   - Halaman mana yang share backend module yang sama?
   - Component mana yang dipakai di multiple halaman?
   - Hook mana yang cross-feature?

---

## Quick Reference: Project File Structure

```
c:\iDesk\
├── apps\
│   ├── frontend\                    # React 18 + Vite + TailwindCSS
│   │   ├── src\
│   │   │   ├── App.tsx              # Routes definition
│   │   │   ├── main.tsx             # App entry
│   │   │   ├── features\            # 17 feature modules
│   │   │   │   ├── admin\           # Agent Management, SLA, Audit, System Health
│   │   │   │   ├── auth\            # Login, Unauthorized
│   │   │   │   ├── automation\      # Automation Rules
│   │   │   │   ├── client\          # Client portal pages (My Tickets, Create, Detail, KB, Profile, Notifications)
│   │   │   │   ├── dashboard\       # Dashboard page
│   │   │   │   ├── google-sync\     # Google Sync (in Renewal Hub)
│   │   │   │   ├── knowledge-base\  # KB list, detail, create, edit, manage
│   │   │   │   ├── manager\         # Manager portal (Dashboard, Reports, Tickets)
│   │   │   │   ├── notifications\   # Notification Center
│   │   │   │   ├── public\          # Public Feedback page
│   │   │   │   ├── renewal\         # Renewal Hub
│   │   │   │   ├── reports\         # Reports page
│   │   │   │   ├── search\          # Global search
│   │   │   │   ├── settings\        # Settings page
│   │   │   │   ├── ticket-board\    # Kanban, List, Detail
│   │   │   │   ├── vpn-access\      # VPN Access (in Renewal Hub)
│   │   │   │   └── zoom-booking\    # Zoom Calendar, Settings
│   │   │   ├── components\          # Shared components (layout, ui, auth, etc.)
│   │   │   ├── hooks\               # 19 shared custom hooks
│   │   │   ├── lib\                 # API client, utils, constants
│   │   │   ├── stores\              # Zustand state stores
│   │   │   ├── styles\              # Additional style files
│   │   │   └── types\               # Shared TypeScript types
│   │   └── package.json
│   │
│   ├── backend\                     # NestJS 10 + TypeORM + PostgreSQL
│   │   ├── src\
│   │   │   ├── main.ts              # App bootstrap
│   │   │   ├── app.module.ts        # Root module
│   │   │   ├── modules\             # 28 feature modules
│   │   │   │   ├── access-request\
│   │   │   │   ├── audit\
│   │   │   │   ├── auth\
│   │   │   │   ├── automation\
│   │   │   │   ├── google-sync\
│   │   │   │   ├── health\
│   │   │   │   ├── ict-budget\
│   │   │   │   ├── ip-whitelist\
│   │   │   │   ├── knowledge-base\
│   │   │   │   ├── lost-item\
│   │   │   │   ├── manager\
│   │   │   │   ├── notifications\
│   │   │   │   ├── permissions\
│   │   │   │   ├── renewal\
│   │   │   │   ├── reports\
│   │   │   │   ├── search\
│   │   │   │   ├── settings\
│   │   │   │   ├── sites\
│   │   │   │   ├── sla-config\
│   │   │   │   ├── sound\
│   │   │   │   ├── synology\
│   │   │   │   ├── telegram\
│   │   │   │   ├── ticketing\
│   │   │   │   ├── uploads\
│   │   │   │   ├── users\
│   │   │   │   ├── vpn-access\
│   │   │   │   ├── workload\
│   │   │   │   └── zoom-booking\
│   │   │   ├── shared\              # Guards, filters, gateways, interceptors
│   │   │   ├── migrations\          # TypeORM migrations
│   │   │   └── seeds\               # Database seeders
│   │   └── package.json
│   │
│   └── desktop-notifier\            # Desktop notification helper
│
├── .env                             # Environment configuration
├── docker-compose.db.yml            # Database Docker setup
├── startup.bat                      # Windows quick start
└── dev.bat                          # Development utilities
```

## Tech Stack Quick Reference

| Layer | Technology | Config File |
|-------|-----------|-------------|
| Frontend Framework | React 18 + TypeScript | `apps/frontend/tsconfig.json` |
| Frontend Build | Vite | `apps/frontend/vite.config.ts` |
| Frontend Styling | TailwindCSS | `apps/frontend/tailwind.config.js` |
| Frontend State (Server) | TanStack Query | Configured in `App.tsx` |
| Frontend State (Client) | Zustand | `apps/frontend/src/stores/` |
| Frontend Forms | React Hook Form + Zod | Per-component |
| Frontend Routing | React Router v6 | `App.tsx` |
| Frontend Animation | Framer Motion | Per-component |
| Frontend Components | Radix UI | `apps/frontend/src/components/ui/` |
| Backend Framework | NestJS 10 | `apps/backend/nest-cli.json` |
| Backend ORM | TypeORM | `apps/backend/src/data-source.ts` |
| Backend Auth | Passport + JWT | `apps/backend/src/modules/auth/` |
| Backend Real-time | Socket.IO | `apps/backend/src/shared/gateways/` |
| Backend Jobs | Bull (Redis) | Module-level config |
| Database | PostgreSQL | `.env` (DB_*) |
| Cache | Redis | `.env` (REDIS_*) |
| Bot | Telegraf | `.env` (TELEGRAM_*) |
