# Blueprint Path Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Perbarui tabel pemetaan fitur blueprint dengan page, route UI, controller, dan endpoint iDesk yang terverifikasi.

**Architecture:** Satu dokumen Markdown diubah. Tabel bagian 3 menjadi sumber audit ringkas; tiap lokasi menggabungkan path frontend, nama page, route UI, controller backend, dan endpoint `/v1` yang relevan. Tidak ada perubahan runtime atau dependency.

**Tech Stack:** Markdown, React Router, NestJS URI versioning.

## Global Constraints

- Ubah hanya `Development%20Document%20iDesk%20V1%20-%20Sesuai%20Blueprint.md`.
- Ganti judul kolom menjadi `Lokasi Implementasi`.
- Pakai path relatif root repository yang ada.
- Cantumkan nama page dalam tanda kurung setelah path page.
- Endpoint wajib memakai prefix `/v1`.
- Jangan ubah daftar fitur, deskripsi, status, atau bagian bukti screenshot.

---

## Struktur File

- Modify: `Development%20Document%20iDesk%20V1%20-%20Sesuai%20Blueprint.md:61-115` — tabel pemetaan fitur karyawan, agent, administrator, dan manager.
- Verify source: `apps/frontend/src/routes/AppRoutes.tsx:15-85,163-318` — page import dan route UI.
- Verify source: `apps/backend/src/modules/**/**.controller.ts` — controller dan endpoint API.
- Verify source: `apps/backend/src/main.ts:48-52` — prefix URI versioning `/v1`.

### Task 1: Perbarui tabel pemetaan blueprint

**Files:**
- Modify: `Development%20Document%20iDesk%20V1%20-%20Sesuai%20Blueprint.md:61-115`
- Verify: `apps/frontend/src/routes/AppRoutes.tsx:15-85,163-318`
- Verify: `apps/backend/src/main.ts:48-52`

**Interfaces:**
- Consumes: route UI dan import page dari `AppRoutes.tsx`; controller route dari anotasi `@Controller()` backend.
- Produces: tabel bagian 3 dengan referensi implementasi yang dapat ditelusuri.

- [ ] **Step 1: Buat daftar mapping terverifikasi**

Gunakan format satu sel berikut untuk setiap fitur:

```md
`apps/frontend/src/features/admin/pages/AuditLogPage.tsx` (`AuditLogPage`) · `/audit-logs` · `apps/backend/src/modules/audit/audit.controller.ts` · `/v1/audit`
```

Gunakan `AppRoutes.tsx` untuk route UI dan nama page. Gunakan `@Controller()` untuk endpoint dasar. Jika page/controller spesifik tidak ada, tulis lokasi yang benar-benar ada saja.

- [ ] **Step 2: Ganti header empat tabel**

Ubah setiap header berikut:

```md
| Fitur | Halaman / Endpoint Utama | Deskripsi | Status |
```

Menjadi:

```md
| Fitur | Lokasi Implementasi | Deskripsi | Status |
```

- [ ] **Step 3: Ganti 38 referensi lama pada tabel bagian 3**

Ganti nilai seperti `features/dashboard/`, `users.controller.ts`, dan `presentation/ticket-templates.controller.ts` dengan path relatif root repository lengkap, nama page, route UI, controller, serta endpoint `/v1` terverifikasi. Pertahankan satu baris tiap fitur dan delimiter ` · `.

- [ ] **Step 4: Verifikasi path dan referensi usang**

Run:

```bash
grep -nE 'features/|(^|[^/])[a-z-]+\.controller\.ts' 'Development%20Document%20iDesk%20V1%20-%20Sesuai%20Blueprint.md'
```

Expected: Tidak ada hasil dari tabel bagian 3; hasil di luar tabel bila ada harus diperiksa manual.

Run:

```bash
git diff --check -- 'Development%20Document%20iDesk%20V1%20-%20Sesuai%20Blueprint.md'
```

Expected: Exit code `0` tanpa whitespace error.

- [ ] **Step 5: Tinjau diff dokumentasi**

Run:

```bash
git diff -- 'Development%20Document%20iDesk%20V1%20-%20Sesuai%20Blueprint.md'
```

Expected: Hanya kolom kedua dari empat tabel bagian 3 berubah; fitur, deskripsi, status, dan bagian 4 tidak berubah.

- [ ] **Step 6: Commit**

```bash
git add -- 'Development%20Document%20iDesk%20V1%20-%20Sesuai%20Blueprint.md'
git commit -m "docs: align blueprint implementation paths"
```
