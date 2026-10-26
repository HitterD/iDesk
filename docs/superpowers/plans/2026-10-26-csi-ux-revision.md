# CSI UX Revision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ganti alur admin CSI dengan wizard "Buat Survei" 6 langkah berstatus Draft/Terbit, dan ganti form responden satu halaman dengan form bertahap satu orang per layar.

**Architecture:** Backend menambah kolom `status` (`DRAFT`/`PUBLISHED`) pada `csi_periods`, endpoint `publish` / `unpublish`, readiness checklist, dan gating responden berdasarkan status. Frontend menambah `features/csi/components/wizard/*` (stepper + 6 langkah yang memakai ulang komponen admin yang ada) dan `features/csi/components/respond/*` (layar pembuka, layar per orang, tinjau) dengan state draft di `localStorage`.

**Tech Stack:** NestJS 11, TypeORM 0.3, PostgreSQL, React 19, react-router 7, TanStack Query 5, Tailwind 4, Radix UI, framer-motion, Jest, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-26-csi-ux-revision.md` (melengkapi `docs/superpowers/specs/2026-10-25-csi-design.md`)

## Global Constraints

- Status periode: `DRAFT` | `PUBLISHED`. Periode lama → `PUBLISHED` (default migration). Periode baru → `DRAFT`.
- Responden hanya melihat periode `PUBLISHED` dan `computeStatus === 'ACTIVE'`.
- Syarat terbit (backend authority): ≥1 orang dinilai; setiap orang ≥1 dimensi; ≥1 departemen aktif di scope; mode `LISTED` → ≥1 penilai periode.
- Survei terbit tanpa jawaban tetap bisa diubah penuh; setelah ada jawaban, aturan kunci lama berlaku (teks & tanggal saja). `unpublish` ditolak 409 bila sudah ada jawaban.
- Perkiraan waktu responden: `CSI_SECONDS_PER_RATING = 10`, menit = `Math.max(1, Math.ceil(total*10/60))`.
- Draft responden di `localStorage` key `csi-draft:<userId>:<periodId>`; dihapus setelah submit sukses atau saat server bilang sudah submit (409 / `submitted: true`).
- Copy UI persis: "Buat Survei", "Mulai kosong", "Salin dari survei sebelumnya", "Lanjut", "Kembali", "Simpan & keluar", "Terbitkan", "Pratinjau", "Tarik ke draft", "Ubah", "Draft", "Terbit", "Anda akan menilai {n} orang · sekitar {m} menit", "Tersedia sampai {tanggal}", "Orang {i} dari {n}", "Beri bintang untuk {k} penilaian lagi", "Mulai mengisi", "Tinjau jawaban", "Kirim".
- Langkah wizard (urutan, label): 1 "Info survei", 2 "Dimensi", 3 "Orang yang dinilai", 4 "Penilai" (hanya LISTED), 5 "Departemen", 6 "Tinjau & terbitkan".
- Jangan pernah `@PageAccess` untuk route admin CSI; tetap `JwtAuthGuard + CsiAdminGuard`.
- Test serial: backend `npx jest --runInBand <file>` satu file; frontend `npx vitest run <file>` satu file. Tidak pernah full suite.
- Teks UI Bahasa Indonesia; ikuti `DESIGN.md`; dark mode via token; hormati reduced motion.

## Review Focus

1. Admin menerbitkan lalu menghapus semua orang dinilai sebelum ada jawaban → survei hilang dari user (eligibility butuh ≥1 ratee) tanpa error; detail survei menampilkan checklist merah. (Task 1 test `published period with no ratees is not listed`)
2. Responden membuka form di dua tab lalu submit dari tab A → tab B saat submit mendapat 409 dan draft lokal dibersihkan. (Task 5 test `clears local draft on 409`)
3. Draft lokal berisi dimensi yang sudah tidak ada (admin ubah penugasan sebelum ada jawaban) → nilai asing diabaikan, tidak ikut terkirim. (Task 4 test `drops scores for unknown dimensions`)
4. Wizard "Salin dari survei sebelumnya" lalu "Lanjut" tanpa tanggal → tombol Lanjut nonaktif dengan pesan tanggal wajib; tidak membuat periode. (Task 3 test `copy requires dates before continue`)
5. Admin ICT memanggil `publish` untuk periode HC → 404 (scope isolation). (Task 1 test `publish rejects period of other scope`)

---

### Task 1: Backend — status Draft/Terbit, readiness, publish/unpublish, gating responden

**Files:**
- Create: `apps/backend/src/migrations/1793990000000-AddCsiPeriodStatus.ts` (+ `.spec.ts` mock QueryRunner seperti `1793980000000-AddCsiModule.spec.ts`)
- Modify: `apps/backend/src/modules/csi/csi.constants.ts` (enum `CsiPeriodPublishStatus { DRAFT = 'DRAFT', PUBLISHED = 'PUBLISHED' }`)
- Modify: `apps/backend/src/modules/csi/entities/csi-period.entity.ts` (kolom `status varchar(10) NOT NULL DEFAULT 'PUBLISHED'`)
- Modify: `apps/backend/src/modules/csi/services/csi-period.service.ts`
- Modify: `apps/backend/src/modules/csi/presentation/csi-admin-period.controller.ts`
- Modify: `apps/backend/src/modules/csi/services/csi-respondent.service.ts`
- Test: `csi-period.service.spec.ts`, `csi-respondent.service.spec.ts`

**Interfaces:**
- Produces: `computeReadiness(input: { ratees: Array<{ dimensions: unknown[] }>; raterCount: number; respondentMode: CsiRespondentMode; activeDepartmentCount: number }): { ready: boolean; checks: Array<{ key: 'ratees' | 'dimensions' | 'departments' | 'raters'; ok: boolean; label: string }> }` exported pure function in `csi-period.service.ts`. Labels: ratees "Minimal 1 orang dinilai", dimensions "Setiap orang punya minimal 1 dimensi", departments "Minimal 1 departemen aktif", raters "Minimal 1 penilai (mode terdaftar)". `raters` check hanya disertakan bila mode `LISTED`.
- Produces: `get()` dan `list()` menyertakan `publishStatus: 'DRAFT'|'PUBLISHED'` (nama field JSON `publishStatus`, kolom DB `status`) dan `get()` menyertakan `readiness`.
- Produces: `CsiPeriodService.publish(scope, id)` → 400 `'Survei belum lengkap'` bila `!ready`, else set `PUBLISHED`, return `get()`. `CsiPeriodService.unpublish(scope, id)` → di transaksi dengan `lockUnlockedPeriod` (409 bila ada jawaban), set `DRAFT`, return `get()`.
- Produces: routes `POST /csi/admin/:scope/periods/:id/publish`, `POST /csi/admin/:scope/periods/:id/unpublish`.
- `create()` menyimpan `status: DRAFT`.
- Respondent: `listActive`, `getForm`, `submit` memperlakukan periode non-`PUBLISHED` sebagai tidak ada (404 / tidak terdaftar). `getForm` menambah `endDate`, dan per ratee `avatarUrl: string | null` (dari user saat ini, join `users`), per dimensi `description: string | null` (dari `csi_dimensions` master saat ini via `dimensionId`).

- [ ] **Step 1: Failing tests (period spec):** `create stores DRAFT`; `computeReadiness flags missing ratees, empty dimensions, no departments, no raters for LISTED only`; `publish rejects incomplete with 400`; `publish sets PUBLISHED`; `publish rejects period of other scope (404)`; `unpublish rejects when answers exist (409)`; `unpublish sets DRAFT`.
- [ ] **Step 2: Failing tests (respondent spec):** `draft period is not listed and getForm 404`; `published period with no ratees is not listed`; `getForm includes endDate, avatarUrl and dimension description`; `submit to draft period 404`.
- [ ] **Step 3: Run** both spec files serially → FAIL.
- [ ] **Step 4: Implement** migration (`ALTER TABLE "csi_periods" ADD COLUMN IF NOT EXISTS "status" varchar(10) NOT NULL DEFAULT 'PUBLISHED'`; down drops it), entity, constants, service, controller, respondent changes.
- [ ] **Step 5: Run** migration spec, period spec, respondent spec serially + `npx tsc --noEmit -p tsconfig.json` → PASS.
- [ ] **Step 6: Commit** `feat(csi): draft/publish status with readiness checklist`

---

### Task 2: Frontend data layer — types, API, hooks, readiness helpers

**Files:**
- Modify: `apps/frontend/src/features/csi/types.ts`, `api/csi.api.ts`, `hooks/useCsi.ts`
- Create: `apps/frontend/src/features/csi/lib/wizard.ts`
- Test: `apps/frontend/src/features/csi/lib/__tests__/wizard.test.ts`

**Interfaces:**
- Consumes: Task 1 backend shapes.
- Produces types: `CsiPublishStatus = 'DRAFT'|'PUBLISHED'`; `publishStatus` on `CsiPeriodListItem`/`CsiPeriodDetail`; `CsiReadiness = { ready: boolean; checks: Array<{ key: 'ratees'|'dimensions'|'departments'|'raters'; ok: boolean; label: string }> }` on `CsiPeriodDetail.readiness`; `CsiOpenForm.endDate: string`; ratee `avatarUrl: string | null`; dimension `description: string | null`.
- Produces API/hooks: `CsiApi.publishPeriod(scope,id)`, `CsiApi.unpublishPeriod(scope,id)`; `usePublishCsiPeriod(scope,id)`, `useUnpublishCsiPeriod(scope,id)` invalidating period detail + periods list + `csi.me.active`.
- Produces `lib/wizard.ts`:
  - `type WizardStepKey = 'info'|'dimensions'|'ratees'|'raters'|'departments'|'review'`
  - `WIZARD_STEPS: ReadonlyArray<{ key: WizardStepKey; label: string }>` with labels from Global Constraints.
  - `visibleSteps(mode: CsiRespondentMode): WizardStepKey[]` (drops `raters` for `OPEN`).
  - `nextStep(mode, current): WizardStepKey | null`, `previousStep(mode, current): WizardStepKey | null`.
  - `stepComplete(key: WizardStepKey, period: CsiPeriodDetail): boolean` — maps steps to `period.readiness.checks`: `ratees` → checks `ratees` AND `dimensions` ok; `raters` → check `raters` ok; `departments` → check `departments` ok; `info`, `dimensions`, `review` → `true`.
  - `estimateMinutes(totalRatings: number): number` per Global Constraints.

- [ ] **Step 1: Failing tests:** `visibleSteps hides raters for OPEN`; `nextStep/previousStep walk visible steps and return null at ends`; `stepComplete maps to readiness checks`; `estimateMinutes(1)=1, (6)=1, (7)=2, (18)=3`.
- [ ] **Step 2: Run** `cd apps/frontend && npx vitest run src/features/csi/lib/__tests__/wizard.test.ts` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS; `npx tsc --noEmit -p tsconfig.app.json` → 0 errors (existing usages updated for new required fields in test fixtures).
- [ ] **Step 5: Commit** `feat(csi): wizard helpers and publish API`

---

### Task 3: Admin wizard "Buat Survei"

**Files:**
- Create: `apps/frontend/src/features/csi/components/wizard/SurveyWizard.tsx` (shell: stepper + body + footer), `WizardStepper.tsx`, `StepInfo.tsx`, `StepDimensions.tsx`, `StepRatees.tsx`, `StepRaters.tsx`, `StepDepartments.tsx`, `StepReview.tsx`, `SurveyPreview.tsx`
- Modify: `apps/frontend/src/features/csi/pages/CsiAdminPage.tsx` (route state via query `?wizard=<periodId|new>&step=<key>`; `?period=<id>` stays for detail)
- Modify: `apps/frontend/src/features/csi/components/admin/PeriodEditor.tsx` (reuse inside `StepInfo`: copy-from mode clears dates; "Mulai kosong"/"Salin dari survei sebelumnya" choice; submit label "Lanjut")
- Reuse (embed unchanged where possible): `RateeAssignment`, `PeriodRaters`, `MasterList` (via `DimensionsTab`/`DepartmentsTab` with `compact` prop if needed)
- Test: `apps/frontend/src/features/csi/components/wizard/__tests__/SurveyWizard.test.tsx`

**Interfaces:**
- Consumes: Task 2 helpers/hooks; existing `useCreateCsiPeriod`, `useUpdateCsiPeriod`, `useCsiPeriod`.
- Produces: `<SurveyWizard scope periodId={string|null} step={WizardStepKey} onStepChange(step) onClose() onCreated(id) />`.
- Behaviour:
  - `periodId=null` → only step `info`; "Lanjut" creates the period (DRAFT) then `onCreated(id)` and moves to `dimensions`.
  - Existing period: "Lanjut" on `info` saves via update when dirty, then advances. On steps `ratees`/`raters`, `RateeAssignment`/`PeriodRaters` get an optional `onDirtyChange(dirty: boolean)` prop; while dirty, "Lanjut" and stepper jumps are blocked with inline message "Simpan perubahan dulu" (their own "Simpan" buttons remain).
  - Stepper items clickable (only when period exists), show check when `stepComplete`.
  - Footer: "Kembali" (hidden on first), "Simpan & keluar" (closes to list), "Lanjut" (not on review).
  - `StepDimensions`: list active dimensions + inline add (name, description) using existing create hook; note "Dimensi dipasang ke orang di langkah berikutnya".
  - `StepDepartments`: list active departments + inline add.
  - `StepReview`: readiness checks list (✓/✗ with label and "Ubah" link to the owning step), summary (judul, site, tanggal, mode, N orang, M penilai), buttons "Pratinjau" (opens `SurveyPreview` sheet) and "Terbitkan" (disabled unless `readiness.ready`; on success closes wizard to the detail view with toast "Survei diterbitkan").
  - `SurveyPreview`: renders the Task 4 respondent flow components in `preview` mode with data mapped from the period (no submit; banner "Pratinjau — jawaban tidak dikirim").
- Detail page (`PeriodDetail.tsx`): header shows `Draft`/`Terbit` pill next to time status; settings tab replaced by a compact checklist card (readiness + "Ubah" buttons that open the wizard at a step) plus "Tarik ke draft" (when PUBLISHED and not locked) / "Terbitkan" (when DRAFT); report tab unchanged.
- List (`PeriodsTab.tsx`): primary button "Buat Survei" opens wizard `new`; rows show `Draft`/`Terbit` pill; clicking a DRAFT row opens the wizard at its first incomplete step, PUBLISHED opens detail.
- Master data: `CsiAdminPage` top-level segmented control becomes `Survei` · `Master data`; Master data shows the existing Dimensi/Departemen/Penilai tabs.

- [ ] **Step 1: Failing tests:** `new wizard shows only info step and creates draft on Lanjut`; `copy requires dates before continue` (choosing "Salin dari survei sebelumnya" clears dates and disables Lanjut with "Tanggal mulai dan selesai wajib diisi"); `raters step hidden for OPEN mode`; `review disables Terbitkan when not ready and lists failing checks`; `Terbitkan calls publish and closes to detail`; `Lanjut blocked with 'Simpan perubahan dulu' when ratee draft is dirty`.
- [ ] **Step 2: Run** `npx vitest run src/features/csi/components/wizard/__tests__/SurveyWizard.test.tsx` → FAIL.
- [ ] **Step 3: Implement.** Keep each file < 200 lines, functions < 50 lines.
- [ ] **Step 4: Run** wizard test + existing `CsiAdminPage.test.tsx`, `PeriodDetail.test.tsx`, `RateeAssignment.test.tsx` (update for new structure) serially → PASS; `npx tsc --noEmit -p tsconfig.app.json`; `npx eslint` on touched files.
- [ ] **Step 5: Commit** `feat(csi): guided survey wizard with draft and publish`

---

### Task 4: Respondent stepped form

**Files:**
- Create: `apps/frontend/src/features/csi/components/respond/SurveyFlow.tsx` (state machine: `intro` → `ratee[i]` → `review`), `IntroScreen.tsx`, `RateeScreen.tsx`, `ReviewScreen.tsx`, `RateeChips.tsx`, `RateeAvatar.tsx`
- Create: `apps/frontend/src/features/csi/lib/surveyDraft.ts`
- Modify: `apps/frontend/src/features/csi/pages/CsiSurveyPage.tsx` (render `SurveyFlow`)
- Modify/remove: `CsiSurveyParts.tsx` — keep `CsiStatusScreen`, `FadeIn`, `BackLink`, `CSI_CARD`; remove `IdentityCard`/`RateeCard`/`CsiProgress`/`ConfirmSheet` once unused.
- Test: `apps/frontend/src/features/csi/lib/__tests__/surveyDraft.test.ts`, `apps/frontend/src/features/csi/components/respond/__tests__/SurveyFlow.test.tsx`; update `pages/__tests__/CsiSurveyPage.test.tsx`

**Interfaces:**
- Consumes: Task 2 `CsiOpenForm` (endDate, avatarUrl, description), `estimateMinutes`; existing `buildSubmitPayload`, `countDimensions`, `rateeAverage`, `StarRating`.
- Produces `lib/surveyDraft.ts`: `type SurveyDraft = { departmentId: string; scores: CsiScores; comments: CsiComments; position: number }`; `draftKey(userId, periodId)`; `loadDraft(key, form): SurveyDraft | null` (drops unknown dimension/ratee ids and departmentId not in form; clamps position); `saveDraft(key, draft)`; `clearDraft(key)`. Errors from `localStorage` (quota/private mode) are caught and ignored silently except a `logger.warn` (use `apps/frontend/src/lib/logger.ts`).
- Produces `<SurveyFlow form userId mode?: 'live'|'preview' onSubmit? />`:
  - Intro: title, intro (pre-line), "Anda akan menilai {n} orang · sekitar {m} menit", "Tersedia sampai {formatDate(endDate)}", name read-only, department select; button "Mulai mengisi" (disabled until department chosen; preview: enabled).
  - Ratee screen: `RateeAvatar` (img `avatarUrl` with `alt=""`, fallback initial on error/null), name, job title, header "Orang {i} dari {n}", `RateeChips` (clickable, ✓ when complete, current highlighted, `aria-current="step"`), per dimension name + description (muted, small) + `StarRating size="lg"`, saran textarea. Footer sticky bottom on mobile (`sticky bottom-0` with safe-area padding, above bottom nav using existing layout padding): "Kembali", "Lanjut" (last ratee → "Tinjau jawaban").
  - "Lanjut" with missing stars: no navigation; missing rows get `data-missing` + red ring; scroll first missing into view (`scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' })`); inline status "Beri bintang untuk {k} penilaian lagi" (`role="status"`).
  - Review: list per ratee (avatar, name, average stars 1 decimal, "Ubah" → jump to that ratee), department shown with "Ubah" → intro; "Kirim" (preview: disabled, banner).
  - Autosave: every change writes draft (debounce 300ms) in live mode only; on mount restore draft (position too) and show subtle note "Melanjutkan isian sebelumnya".
  - On submit success / 409 / form `submitted: true`: `clearDraft`.
  - Screen transitions: framer-motion slide/fade 200ms, disabled under reduced motion; focus moves to the screen heading on change.

- [ ] **Step 1: Failing tests (surveyDraft):** `round-trips draft`; `drops scores for unknown dimensions`; `drops department not in form`; `clamps position`; `ignores storage errors`.
- [ ] **Step 2: Failing tests (SurveyFlow):** `intro shows count, minutes and deadline`; `Mulai mengisi disabled until department chosen`; `Lanjut with missing stars shows 'Beri bintang untuk 2 penilaian lagi' and stays`; `chips jump to a ratee and show check when complete`; `review Ubah jumps back`; `restores draft after remount`; `clears local draft on 409`; `preview mode never calls onSubmit`.
- [ ] **Step 3: Run** both test files → FAIL.
- [ ] **Step 4: Implement.** Files < 200 lines; functions < 50 lines.
- [ ] **Step 5: Run** new tests + updated `CsiSurveyPage.test.tsx` serially → PASS; tsc; eslint touched files.
- [ ] **Step 6: Visual check:** Vite dev server with mocked API (Playwright route interception), screenshots desktop + mobile 390px + dark for intro, ratee (with missing highlight), review. Save to `.superpowers/sdd/<workspace>/t4-*.png`. Stop dev server.
- [ ] **Step 7: Commit** `feat(csi): stepped respondent form with autosave`

---

### Task 5: Wire preview, list/card copy, cleanup

**Files:**
- Modify: `SurveyPreview.tsx` (Task 3) to use `SurveyFlow mode="preview"` with a form mapped from `CsiPeriodDetail` + active departments + dimension descriptions (`toPreviewForm(period, departments, dimensions, currentUser): CsiOpenForm` in `lib/wizard.ts`, unit-tested).
- Modify: `CsiSurveyListPage.tsx` / `CsiPendingCard.tsx`: button label "Lanjutkan" instead of "Isi Survei" when a local draft exists (`hasDraft(userId, periodId): boolean` added to `surveyDraft.ts`).
- Test: `lib/__tests__/wizard.test.ts` (add `toPreviewForm` cases), `pages/__tests__/CsiSurveyListPage.test.tsx` (add `shows Lanjutkan when draft exists`).

- [ ] **Step 1: Failing tests:** `toPreviewForm excludes nothing, maps dimension descriptions, uses active departments`; `shows Lanjutkan when draft exists`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; tsc.
- [ ] **Step 5: Commit** `feat(csi): survey preview and resume label`

(E2E against the dev DB is a controller step after Task 5, not part of this task — it requires stopping the user's backend.)
