---
description: Debug halaman iDesk secara sistematis — trace error, diagnosa root cause, dan fix masalah pada satu halaman/fitur tertentu
---

# /page-debug — Systematic Page Debugging Workflow

> **Tujuan:** Mendiagnosa dan memperbaiki masalah pada halaman iDesk secara sistematis. Mengikuti protokol: Reproduce → Isolate → Root Cause → Fix → Verify.

---

## Cara Pakai

```
/page-debug [nama halaman] [deskripsi masalah]
```

**Contoh:**
- `/page-debug dashboard data tidak muncul`
- `/page-debug ticket-board drag drop tidak work`
- `/page-debug settings form submit error 500`
- `/page-debug renewal PDF upload gagal`

---

## Langkah-Langkah Debugging

### TAHAP 1: REPRODUCE — Pahami Masalahnya

1. **Klarifikasi gejala secara spesifik:**
   - APA yang terjadi? (actual behavior)
   - APA yang seharusnya terjadi? (expected behavior)
   - KAPAN itu terjadi? (selalu? kadang-kadang? setelah action tertentu?)
   - SIAPA yang terkena? (semua role? specific user?)
   - ADA error message? (console error, toast, network error?)

2. **Identifikasi affected layer:**
   ```
   ┌─ BROWSER LAYER ─────────────────────────┐
   │  Console errors? UI rendering issue?     │
   │  React component error boundary?         │
   ├─ NETWORK LAYER ─────────────────────────┤
   │  API request gagal? Status code?         │
   │  Payload benar? Headers benar?           │
   ├─ BACKEND LAYER ──────────────────────────┤
   │  Controller error? Service error?        │
   │  Database query error?                   │
   ├─ DATABASE LAYER ─────────────────────────┤
   │  Data inconsistent? Missing relations?   │
   │  Schema mismatch?                        │
   ├─ WEBSOCKET LAYER ────────────────────────┤
   │  Socket disconnected? Event not firing?  │
   │  Wrong event name?                       │
   └──────────────────────────────────────────┘
   ```

---

### TAHAP 2: ISOLATE — Narrow Down Lokasi Bug

3. **Frontend debugging checklist:**
   - [ ] Cek browser console untuk errors
   - [ ] Cek Network tab: API request & response
   - [ ] Cek React DevTools: component state & props
   - [ ] Cek TanStack Query DevTools: query cache status

   **File-file yang perlu dicek:**
   ```
   Frontend:
   ├── apps/frontend/src/features/[feature]/pages/     → Page component
   ├── apps/frontend/src/features/[feature]/components/ → Sub-components
   ├── apps/frontend/src/features/[feature]/hooks/      → Data fetching hooks
   ├── apps/frontend/src/hooks/                         → Shared hooks
   ├── apps/frontend/src/lib/api.ts                     → Axios instance config
   ├── apps/frontend/src/lib/errorMessages.ts           → Error message mapping
   └── apps/frontend/src/stores/                        → Zustand stores
   ```

4. **Backend debugging checklist:**
   - [ ] Cek NestJS console output untuk errors/exceptions
   - [ ] Cek request body/params yang diterima controller
   - [ ] Cek database queries yang dijalankan (TypeORM logging)
   - [ ] Cek guard/middleware yang jalan sebelum controller

   **File-file yang perlu dicek:**
   ```
   Backend:
   ├── apps/backend/src/modules/[module]/*.controller.ts → Endpoint handlers
   ├── apps/backend/src/modules/[module]/*.service.ts    → Business logic
   ├── apps/backend/src/modules/[module]/*.entity.ts     → DB schema
   ├── apps/backend/src/modules/[module]/dto/            → Input validation
   ├── apps/backend/src/shared/guards/                   → Auth guards
   ├── apps/backend/src/shared/filters/                  → Exception filters
   └── apps/backend/src/main.ts                          → App bootstrap config
   ```

5. **WebSocket debugging (jika real-time related):**
   - [ ] Cek Socket.IO connection status
   - [ ] Cek event names (emitted vs listened)
   - [ ] Cek rooms/namespaces
   ```
   Files:
   ├── apps/frontend/src/lib/socket.ts              → Socket client config
   ├── apps/frontend/src/hooks/useTicketSocket.ts    → Ticket socket hook
   ├── apps/frontend/src/hooks/useSocketListener.ts  → Generic listener
   └── apps/backend/src/shared/gateways/             → Socket gateways
   ```

---

### TAHAP 3: ROOT CAUSE — Temukan Akar Masalah

6. **Trace data flow end-to-end:**
   ```
   [User Action]
     ↓
   [React Event Handler] → Cek handler function di component
     ↓
   [TanStack Query Mutation/Query] → Cek mutationFn / queryFn
     ↓
   [Axios Request] → Cek URL, method, headers, body
     ↓
   [NestJS Controller] → Cek route matching, guards, decorators
     ↓
   [NestJS Service] → Cek business logic, conditions, queries
     ↓
   [TypeORM Query] → Cek entity relations, query params
     ↓
   [PostgreSQL] → Cek data existence, constraints
     ↓
   [Response] → Cek response format, status code
     ↓
   [TanStack Cache] → Cek cache invalidation, key matching
     ↓
   [UI Update] → Cek conditional rendering, state mapping
   ```

7. **Apply 5 Whys technique:**
   ```
   Problem: [describe the bug]
   Why 1: [immediate cause] — Evidence: [file:line]
   Why 2: [deeper cause] — Evidence: [file:line]  
   Why 3: [root cause] — Evidence: [file:line]
   ```

8. **Common root causes in iDesk project:**

   | Symptom | Common Root Cause | Where to Look |
   |---------|-------------------|---------------|
   | Data not loading | Wrong API endpoint / query key | hooks, api.ts |
   | 401 Unauthorized | JWT expired / wrong role guard | auth guard, ProtectedRoute |
   | 403 Forbidden | Permission/page access denied | usePermissions, permissions module |
   | 500 Internal Error | DB query failure / null reference | service file, entity relations |
   | UI not updating | TanStack cache not invalidated | mutation onSuccess, queryClient |
   | Socket not working | Wrong event name / not connected | socket.ts, gateway files |
   | Form not submitting | Zod validation failure / required field | Form component, DTO |
   | File upload fails | Size/type validation / multer config | file-validation.ts, uploads module |
   | Blank page | Error boundary caught unhandled error | FeatureErrorBoundary wrapping |
   | Slow loading | N+1 query / missing pagination | service queryBuilder |

---

### TAHAP 4: FIX — Perbaiki Root Cause

9. **Buat plan perbaikan:**
   - Apa yang akan diubah?
   - File mana saja yang terpengaruh?
   - Apakah ada risiko breaking change?

10. **Implement fix:**
    - Perbaiki root cause, BUKAN symptom
    - Follow existing code patterns di codebase
    - Minimal perubahan — ubah sesedikit mungkin
    - Satu fix pada satu waktu

11. **Common fix patterns:**

    **API Error:**
    ```typescript
    // Frontend: Pastikan error di-handle
    const { data, error, isLoading } = useQuery({
      queryKey: ['resource', id],
      queryFn: () => api.get(`/endpoint/${id}`),
      retry: 1,
    });
    
    if (error) return <ErrorState message={getErrorMessage(error)} onRetry={refetch} />;
    ```

    **Cache Invalidation:**
    ```typescript
    // Pastikan cache di-invalidate setelah mutation
    const mutation = useMutation({
      mutationFn: (data) => api.post('/endpoint', data),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['resource'] });
        toast.success('Success!');
      },
    });
    ```

    **Backend Guard:**
    ```typescript
    // Pastikan guard dan roles benar
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.AGENT)
    @Get()
    async findAll() { ... }
    ```

    **TypeORM Query:**
    ```typescript
    // Pastikan relations di-load
    const result = await this.repo.findOne({
      where: { id },
      relations: ['assignedAgent', 'createdBy', 'messages'],
    });
    if (!result) throw new NotFoundException('Resource not found');
    ```

---

### TAHAP 5: VERIFY — Pastikan Fix Benar

12. **Verification checklist:**
    - [ ] Bug asli sudah TIDAK bisa di-reproduce
    - [ ] Happy path masih bekerja normal
    - [ ] Edge cases di-test (empty state, permission denied, invalid input)
    - [ ] No regressions pada fungsi lain di halaman yang sama
    - [ ] Build tetap pass (frontend + backend)
    - [ ] No new TypeScript errors
    - [ ] Console bersih dari errors/warnings baru

13. **Cross-check related pages:**
    - Jika fix di shared component → cek halaman lain yang menggunakan
    - Jika fix di backend service → cek endpoint lain yang menggunakan service tersebut
    - Jika fix di entity → cek semua module yang pakai entity tersebut

---

### TAHAP 6: Output — Debug Report

14. **Buat laporan debug:**

```markdown
# 🐛 Debug Report: [Nama Halaman] — [Nama Bug]

## Problem
**Symptom:** [Apa yang terjadi]
**Expected:** [Apa yang seharusnya terjadi]
**Affected:** [Role/user yang terkena]

## Root Cause Analysis
**Layer:** [Frontend/Backend/Database/WebSocket]
**Root Cause:** [Penjelasan teknis]
**Evidence:** [File, line number, error message]

## Fix Applied
| File | Change | Reason |
|------|--------|--------|
| ... | ... | ... |

## Verification
- [x] Bug fixed
- [x] No regressions
- [x] Build passes
- [x] Edge cases tested

## Prevention
[Apa yang bisa dilakukan agar bug serupa tidak terjadi lagi]
```

---

## Quick Debug Commands

```bash
# Frontend dev server (port 4050)
cd apps/frontend && npm run dev

# Backend dev server (port 5050)  
cd apps/backend && npm run start:dev

# Check TypeScript errors frontend
cd apps/frontend && npx tsc --noEmit

# Check TypeScript errors backend
cd apps/backend && npx tsc --noEmit

# Run backend tests
cd apps/backend && npm run test

# Check database connection
# Via backend logs at startup

# Windows startup (both servers)
startup.bat
```