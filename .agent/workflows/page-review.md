---
description: Review lengkap struktur halaman iDesk — analisis full-stack (frontend page + backend endpoint + hooks + types) untuk satu halaman/fitur tertentu
---

# /page-review — Full-Stack Page Structure Review

> **Tujuan:** Meng-audit satu halaman/fitur iDesk secara menyeluruh — dari frontend component tree, backend API endpoints, data flow, error handling, sampai security & performance.

---

## Cara Pakai

```
/page-review [nama halaman]
```

**Contoh:**
- `/page-review dashboard`
- `/page-review ticket-board`
- `/page-review renewal`
- `/page-review knowledge-base`
- `/page-review settings`
- `/page-review zoom-booking`

---

## Langkah-Langkah Review

### TAHAP 1: Identifikasi File Scope (Breadth-First)

1. **Cari entry point halaman di `App.tsx`:**
   - Identifikasi route path dan component yang di-render
   - Catat role restriction (`allowedRoles`, `requiredPageAccess`)
   - File: `c:\iDesk\apps\frontend\src\App.tsx`

2. **Scan semua file di folder feature terkait:**
   ```
   c:\iDesk\apps\frontend\src\features\[feature-name]\
   ```
   - List semua file: pages, components, hooks, types, services/api
   - Catat struktur folder dan naming convention

3. **Identifikasi backend module terkait:**
   ```
   c:\iDesk\apps\backend\src\modules\[module-name]\
   ```
   - List: controller, service, entity, dto, module file
   - Catat hubungan antar module (imports)

4. **Catat shared dependencies:**
   - Hooks: `c:\iDesk\apps\frontend\src\hooks\`
   - UI Components: `c:\iDesk\apps\frontend\src\components\ui\`
   - Lib/Utils: `c:\iDesk\apps\frontend\src\lib\`
   - Types: `c:\iDesk\apps\frontend\src\types\`
   - Backend Shared: `c:\iDesk\apps\backend\src\shared\`

---

### TAHAP 2: Analisis Frontend (Depth-First)

5. **Baca LENGKAP page component utama:**
   - Pahami component tree (parent → child hierarchy)
   - Identifikasi state management (useState, Zustand stores)
   - Identifikasi data fetching (TanStack Query hooks: useQuery, useMutation)
   - Catat semua API calls (endpoint, method, params)

6. **Analisis sub-components:**
   - Baca setiap sub-component yang dipakai
   - Cek props interface & type safety
   - Cek re-render patterns (memo, useMemo, useCallback usage)

7. **Review styling & UI patterns:**
   - Konsistensi TailwindCSS class usage
   - Responsive design (sm, md, lg breakpoints)
   - Dark mode support (jika ada)
   - Accessibility: aria labels, keyboard navigation, focus management
   - Animasi: Framer Motion usage

8. **Review error handling frontend:**
   - FeatureErrorBoundary wrapping
   - API error states (loading, error, empty)
   - Toast notifications (sonner)
   - Form validation (React Hook Form + Zod)

---

### TAHAP 3: Analisis Backend (Depth-First)

9. **Baca LENGKAP controller:**
    - List semua endpoints (method, path, decorators)
    - Cek auth guards (@UseGuards, @Roles)
    - Cek input validation (DTOs, class-validator decorators)
    - Cek response format & status codes

10. **Baca LENGKAP service:**
    - Pahami business logic flow
    - Cek database queries (TypeORM: find, createQueryBuilder)
    - Cek error handling (exceptions: NotFoundException, BadRequestException, etc.)
    - Cek transaction usage (jika multi-table operations)

11. **Review entity/model:**
    - Cek column definitions & constraints
    - Cek relations (ManyToOne, OneToMany, etc.)
    - Cek indices
    - Cek cascade behaviors

12. **Review DTOs:**
    - Cek validation decorators (IsString, IsNotEmpty, IsOptional, etc.)
    - Cek transform decorators
    - Cek documentation decorators (@ApiProperty)

---

### TAHAP 4: Cross-Cutting Concerns

13. **Data Flow Audit:**
    ```
    User Action → React Component → API Hook (TanStack Query)
    → Axios Request → NestJS Controller → Service → TypeORM → PostgreSQL
    → Response → TanStack Cache Update → UI Re-render
    ```
    - Trace minimal 1 happy path end-to-end
    - Trace minimal 1 error path end-to-end

14. **Real-time / WebSocket check:**
    - Apakah halaman ini menggunakan Socket.IO?
    - Cek `useTicketSocket`, `useSocketListener`, atau custom socket hooks
    - Cek backend gateway integration

15. **Permission & Security check:**
    - Frontend: ProtectedRoute, usePermissions
    - Backend: Guards, Role decorators
    - Apakah ada data leaking (user A bisa lihat data user B)?

16. **Performance check:**
    - Query complexity (N+1 risk?)
    - Pagination implemented?
    - Caching (TanStack staleTime, Redis backend)
    - Bundle size (lazy loaded?)

---

### TAHAP 5: Output — Review Report

17. **Buat laporan review dengan format berikut:**

```markdown
# 🔍 Page Review: [Nama Halaman]

## Page Overview
- **Route:** `/path`
- **Role Access:** ADMIN / AGENT / USER
- **Feature Folder:** `apps/frontend/src/features/[name]/`
- **Backend Module:** `apps/backend/src/modules/[name]/`

## File Map
| Layer | File | Lines | Purpose |
|-------|------|-------|---------|
| Page | ... | ... | ... |
| Component | ... | ... | ... |
| Hook | ... | ... | ... |
| API | ... | ... | ... |
| Controller | ... | ... | ... |
| Service | ... | ... | ... |
| Entity | ... | ... | ... |
| DTO | ... | ... | ... |

## Architecture Diagram
[Component tree / data flow diagram]

## Findings

### ✅ Strengths
- [Apa yang sudah baik]

### ⚠️ Issues Found
| Severity | Issue | Location | Recommendation |
|----------|-------|----------|----------------|
| 🔴 Critical | ... | file:line | ... |
| 🟠 High | ... | file:line | ... |
| 🟡 Medium | ... | file:line | ... |
| 🟢 Low | ... | file:line | ... |

### 📊 Metrics
- Total files reviewed: X
- Total lines analyzed: X
- Component depth: X levels
- API endpoints: X
- Test coverage: [if available]

## Action Items
- [ ] Priority fixes
- [ ] Performance improvements
- [ ] UX enhancements
```

---

## Page Reference Map (iDesk Project)

| Halaman | Route | Frontend Feature | Backend Module |
|---------|-------|-----------------|----------------|
| Dashboard | `/dashboard` | `dashboard` | `reports`, `ticketing` |
| Kanban Board | `/kanban` | `ticket-board` | `ticketing` |
| Ticket List | `/tickets/list` | `ticket-board` | `ticketing` |
| Ticket Detail | `/tickets/:id` | `ticket-board` | `ticketing` |
| Settings | `/settings` | `settings` | `settings`, `users`, `permissions` |
| Agent Management | `/agents` | `admin` | `users`, `permissions` |
| Reports | `/reports` | `reports` | `reports` |
| SLA Settings | `/sla` | `admin` | `sla-config` |
| Knowledge Base | `/kb` | `knowledge-base` | `knowledge-base` |
| Article Detail | `/kb/articles/:id` | `knowledge-base` | `knowledge-base` |
| Renewal Hub | `/renewal` | `renewal` | `renewal`, `vpn-access`, `google-sync` |
| Automation | `/automation` | `automation` | `automation` |
| Notifications | `/notifications` | `notifications` | `notifications` |
| Audit Log | `/audit-logs` | `admin` | `audit` |
| System Health | `/system-health` | `admin` | `health` |
| Zoom Calendar | `/zoom-calendar` | `zoom-booking` | `zoom-booking` |
| Zoom Settings | `/zoom-settings` | `zoom-booking` | `zoom-booking` |
| Feedback | `/feedback/:token` | `public` | `ticketing` |
| Login | `/login` | `auth` | `auth` |
| Client - My Tickets | `/client/my-tickets` | `client` | `ticketing` |
| Client - Create Ticket | `/client/create` | `client` | `ticketing` |
| Client - Ticket Detail | `/client/tickets/:id` | `client` | `ticketing` |
| Client - KB | `/client/kb` | `client` | `knowledge-base` |
| Client - Profile | `/client/profile` | `client` | `users` |
| Client - Notifications | `/client/notifications` | `client` | `notifications` |
| Manager - Dashboard | `/manager/dashboard` | `manager` | `reports`, `ticketing`, `workload` |
| Manager - Tickets | `/manager/tickets` | `manager` | `ticketing` |
| Manager - Reports | `/manager/reports` | `manager` | `reports` |
