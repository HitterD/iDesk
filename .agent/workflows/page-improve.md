---
description: Improve halaman iDesk — perbaikan UI/UX, performance, code quality, accessibility, dan best practices untuk satu halaman/fitur tertentu
---

# /page-improve — Page Improvement Workflow

> **Tujuan:** Meningkatkan kualitas satu halaman iDesk berdasarkan kategori: UI/UX, Performance, Code Quality, Accessibility, atau Security. Workflow ini TIDAK untuk memperbaiki bug, tapi untuk meningkatkan yang sudah working.

---

## Cara Pakai

```
/page-improve [nama halaman] [kategori opsional]
```

**Contoh:**
- `/page-improve dashboard` — improve semua aspek
- `/page-improve ticket-board ui` — fokus UI/UX saja
- `/page-improve settings performance` — fokus performance saja
- `/page-improve renewal security` — fokus security saja

**Kategori yang tersedia:**
- `ui` — Visual, UX flow, responsive, animations
- `performance` — Load time, re-renders, bundle size, queries
- `code` — Clean code, DRY, patterns, TypeScript strictness
- `accessibility` — WCAG, keyboard nav, screen reader, focus
- `security` — Input sanitization, XSS, auth, data exposure
- *(kosong)* — Review semua kategori

---

## Langkah-Langkah Improvement

### TAHAP 1: Current State Analysis

// turbo-all

1. **Baca halaman target LENGKAP** (page + components + hooks)
   - Gunakan reference dari `/page-review` page map jika ada
   - Frontend: `c:\iDesk\apps\frontend\src\features\[feature]\`
   - Backend: `c:\iDesk\apps\backend\src\modules\[module]\`

2. **Document current state:**
   - Screenshot mental: apa yang user lihat?
   - List fitur-fitur yang ada di halaman
   - Identifikasi pain points yang terlihat dari kode

---

### TAHAP 2: Improvement Analysis per Kategori

#### 🎨 [UI/UX] Visual & Experience Improvements

3. **Review visual consistency:**
   - Apakah menggunakan glassmorphism style sesuai `glassmorphism.css`?
   - Apakah konsisten dengan design system di `index.css` & `consistency.css`?
   - Apakah micro-animations digunakan sesuai `micro-animations.css`?
   - Apakah dark mode support sudah benar?

4. **Review UX flow:**
   - Loading states: skeleton loaders vs spinner?
   - Empty states: ada ilustrasi atau pesan yang membantu?
   - Error states: ada retry button? Pesan yang jelas?
   - Confirmation dialogs: menggunakan `useConfirm` hook?
   - Form UX: inline validation? Unsaved changes warning (`useUnsavedChanges`)?
   - Mobile responsiveness: touch targets, swipe gestures?

5. **Review component patterns:**
   - Apakah menggunakan Radix UI primitives secara benar?
   - Apakah Framer Motion animations smooth?
   - Apakah icons konsisten (Lucide React)?

#### ⚡ [PERFORMANCE] Speed & Efficiency Improvements

6. **Frontend performance:**
   - Re-render analysis: apakah state management optimal?
   - Memoization: `React.memo`, `useMemo`, `useCallback` di tempat yang tepat?
   - TanStack Query: `staleTime`, `gcTime`, query key structure?
   - List rendering: VirtualizedList untuk list besar?
   - Code splitting: lazy loaded? Bundle size concern?
   - Image optimization: proper sizing, lazy loading?

7. **Backend performance:**
   - Query analysis: N+1? Unnecessary JOINs?
   - Pagination: cursor vs offset? Proper limit?
   - Caching: Redis caching di tempat yang tepat?
   - Indexing: database indices untuk query yang sering dipakai?
   - Response payload: kirim data yang dibutuhkan saja?

#### 🧹 [CODE] Code Quality Improvements

8. **Clean code review:**
   - DRY violations: duplikasi logik antar components?
   - Single Responsibility: satu component terlalu besar?
   - Naming: variabel, function, component names deskriptif?
   - TypeScript: `any` usage? Proper interface definitions?
   - Dead code: unused imports, commented-out code, unreachable logic?

9. **Pattern consistency:**
   - Apakah mengikuti pattern feature-feature lain di project?
   - Hooks pattern: custom hooks untuk reusable logic?
   - API pattern: konsisten dengan `c:\iDesk\apps\frontend\src\lib\api.ts`?
   - Error handling pattern: konsisten antar file?

#### ♿ [ACCESSIBILITY] WCAG Compliance Improvements

10. **Accessibility review:**
    - `aria-label` / `aria-labelledby` pada interactive elements?
    - Keyboard navigation: Tab order logis? Focus visible?
    - Screen reader: `ScreenReaderAnnounce` digunakan untuk dynamic content?
    - Color contrast: memenuhi WCAG AA?
    - Alt text pada images?
    - Menggunakan utilitas dari `c:\iDesk\apps\frontend\src\lib\accessibility.ts`?

#### 🔐 [SECURITY] Security Hardening

11. **Security review:**
    - Input sanitization: XSS prevention?
    - Auth checks: proper guards di frontend DAN backend?
    - Data exposure: response payload tidak berisi sensitive data?
    - CSRF: menggunakan `useCsrf` hook di state-changing operations?
    - File upload: validation magic bytes? (`file-validation.ts`)
    - API rate limiting pada endpoint yang vulnerable?

---

### TAHAP 3: Prioritasi & Implementasi

12. **Prioritisasi findings:**

    | Priority | Criteria |
    |----------|----------|
    | 🔴 P0 | Security vulnerability, crash potential |
    | 🟠 P1 | Significant UX/performance issue |
    | 🟡 P2 | Code quality, minor UX improvements |
    | 🟢 P3 | Nice-to-have polish |

13. **Implementasi improvements:**
    - Satu perubahan pada satu waktu
    - Verify setiap perubahan tidak break existing functionality
    - Follow existing codebase patterns (KONSISTENSI > PREFERENSI)

14. **Post-improvement verification:**
    - Build check: `npm run build` di frontend
    - Type check: no TypeScript errors
    - Visual check: buka di browser, pastikan tampilan correct
    - Function check: test fitur-fitur utama halaman

---

### TAHAP 4: Output — Improvement Report

15. **Buat laporan improvement:**

```markdown
# ✨ Page Improvement: [Nama Halaman]

## Scope
- **Kategori:** [UI/Performance/Code/Accessibility/Security/All]
- **Files Modified:** X files
- **Changes Made:** X improvements

## Changes Applied

### [Kategori]
| # | Improvement | Before | After | Impact |
|---|-------------|--------|-------|--------|
| 1 | ... | ... | ... | ... |

## Verification
- [ ] Build passes
- [ ] No TypeScript errors
- [ ] Visual check OK
- [ ] Functionality intact
```

---

## Quick Reference: iDesk CSS Systems

| CSS File | Purpose |
|----------|---------|
| `index.css` | Base styles, Tailwind directives |
| `glassmorphism.css` | Glass effect classes |
| `consistency.css` | Component consistency utilities |
| `micro-animations.css` | Subtle animation classes |
| `select-styles.css` | Custom select styling |
| `styles/` folder | Additional theme styles |

## Quick Reference: iDesk Custom Hooks

| Hook | Purpose |
|------|---------|
| `useConfirm` | Confirmation dialogs |
| `useOptimisticMutation` | Optimistic UI updates |
| `useFilters` | Advanced filtering |
| `useSavedFilters` | Persist user filters |
| `useApiError` | API error handling |
| `useDebounce` | Input debouncing |
| `usePermissions` | Role/permission checks |
| `usePresence` | User online status |
| `usePushNotifications` | Browser push notifications |
| `useSoundNotification` | Sound alerts |
| `useTicketSocket` | Ticket real-time updates |
| `useSocketListener` | Generic socket events |
| `useKeyboardShortcuts` | Keyboard shortcut binding |
| `useTicketShortcuts` | Ticket-specific shortcuts |
| `useFocusTrap` | Modal focus trapping |
| `useUnsavedChanges` | Unsaved changes warning |
| `useCsrf` | CSRF token management |
