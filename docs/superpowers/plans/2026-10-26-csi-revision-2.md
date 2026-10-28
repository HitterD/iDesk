# CSI Revision 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Jenis pertanyaan ala Google Form, bagian penilaian tim + per orang, survei multi-site, nama responden bisa diubah, inline edit + drag & drop, dan report Excel/PDF memo berformat CSI 2025 dengan SLA dari data tiket iDesk.

**Architecture:** Backend memperluas `csi_dimensions` menjadi bank pertanyaan (`type`, `required`, `options` jsonb), memodelkan penilaian tim sebagai baris `csi_period_ratees` ber-`kind = 'TEAM'` (semua mesin snapshot/jawaban/report per ratee dipakai ulang), mengganti `csi_periods.siteId` dengan tabel `csi_period_sites`, dan menambah `respondentName` di jawaban. Frontend menambah komponen `SortableList` (@dnd-kit) yang dipakai semua daftar berurutan, editor pertanyaan inline, langkah wizard "Penilaian tim", renderer jenis pertanyaan di form responden, dan dialog memo PDF.

**Tech Stack:** NestJS 11, TypeORM 0.3, PostgreSQL, exceljs, pdfkit, React 19, TanStack Query 5, Tailwind 4, Radix UI, @dnd-kit/core + @dnd-kit/sortable, Jest, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-26-csi-revision-2.md` (+ `2026-10-26-csi-ux-revision.md`, `2026-10-25-csi-design.md`)

## Global Constraints

- Jenis pertanyaan: `STAR` | `SCALE` | `CHOICE` | `TEXT`. Option = `{ label: string; points: number | null }`. `SCALE`: 2–10 opsi, `points` integer 1–5. `CHOICE`: 2–10 opsi, `points` null. `STAR`/`TEXT`: `options = []`. Label 1–200 karakter.
- Nilai hanya dari `STAR` dan `SCALE`, skala 1–5 (`CSI_SCORE_MIN`/`CSI_SCORE_MAX`).
- Rata-rata satu jawaban responden = mean semua item ber-`score` non-null (dibatasi ke satu ratee bila dihitung per ratee). Average ratee/survei = mean dari rata-rata jawaban responden. Bulat 2 desimal. Tampil `4,52` (id-ID), tanpa %.
- Item baru di master selalu `sortOrder = max + 1`. Reorder = kirim seluruh id scope dalam urutan baru; `sortOrder = index`.
- Ratee `kind`: `PERSON` | `TEAM`. Maks satu `TEAM` per periode. `TEAM.userId = null`, `displayName = period.teamLabel` (default `'Tim IT Support'`).
- `teamEnabled` default false, `individualEnabled` default true; minimal satu true (400 `'Aktifkan minimal satu bagian penilaian'`).
- `slaTargetPct` default 80 (1–100). Target = `Math.ceil(basis × pct / 100)`. % Pengisi = `basis ? Math.min(100, Math.round(responses / target × 100)) : null`.
- Basis SLA: `LISTED` → penilai periode aktif yang site-nya termasuk site survei. `OPEN` → user unik pembuat tiket (`tickets.userId`) dengan `tickets.siteId` ∈ site survei dan `createdAt` ∈ [mulai survei − 12 bulan, mulai survei) WIB.
- Satu jawaban per (periode, akun, `lower(trim(respondentName))`). Nama 2–150 karakter.
- Draft responden key baru `csi-draft:v2:<userId>:<periodId>` (draft lama diabaikan).
- Copy UI persis: "Pertanyaan", "Tambah pertanyaan", "Gunakan template CSI 2025", "Wajib diisi", "Bintang 1–5", "Pilihan berskala", "Pilihan tanpa nilai", "Jawaban teks", "Tambah pilihan", "Penilaian tim", "Penilaian per orang", "Isi lagi atas nama orang lain", "Export memo PDF", "Nama ini sudah mengisi survei ini".
- Langkah wizard (urutan): `info` "Info survei", `questions` "Pertanyaan", `team` "Penilaian tim" (bila teamEnabled), `ratees` "Orang yang dinilai" (bila individualEnabled), `raters` "Penilai" (bila LISTED), `departments` "Departemen", `review` "Tinjau & terbitkan".
- Route admin CSI tetap `JwtAuthGuard + CsiAdminGuard`, tidak pernah `@PageAccess`.
- Test serial: backend `npx jest --runInBand <file>` satu file; frontend `npx vitest run <file>` satu file. Tidak pernah full suite.
- features/csi: fungsi < 50 baris, file < 200 baris, copy di modul copy. Ikuti DESIGN.md, dark mode, reduced motion.

## Review Focus

1. Survei lama (sebelum migration) masih bisa dibuka, dilaporkan, dan diekspor: dimensi lama = `STAR`, jawaban lama punya `score`, site lama ada di `csi_period_sites`. (Task 1 test `migration backfills period sites and STAR type`; Task 4 test `report reads legacy STAR answers`)
2. Pertanyaan opsional dikosongkan → submit diterima, tidak dihitung ke rata-rata; pertanyaan wajib kosong → 400. (Task 3 test `optional question may be omitted; required may not`)
3. Akun bersama mengisi dua kali dengan nama berbeda → keduanya tersimpan; nama sama dengan beda huruf besar/spasi → 409 "Nama ini sudah mengisi survei ini". (Task 3 test `one response per normalised name`)
4. Site yang sama ada di dua survei multi-site dengan tanggal bertabrakan → 409; site berbeda → boleh. (Task 2 test `overlap is checked per site`)
5. Drag & drop dengan keyboard (Space, panah, Space) mengubah urutan dan tersimpan. (Task 6 test `keyboard reorder calls onReorder`)

---

### Task 1: Backend — bank pertanyaan, reorder, multi-site, tim (schema + master)

**Files:**
- Create: `apps/backend/src/migrations/1794010000000-CsiRevision2.ts` (+ `.spec.ts` mock QueryRunner)
- Modify: `apps/backend/src/modules/csi/csi.constants.ts` (`CsiQuestionType`, `CsiRateeKind`, `CSI_OPTIONS_MAX = 10`, `CSI_OPTION_LABEL_MAX = 200`, `CSI_TEAM_LABEL_DEFAULT = 'Tim IT Support'`, `CSI_SLA_TARGET_DEFAULT = 80`)
- Modify entities: `csi-dimension.entity.ts` (`type varchar(10) default 'STAR'`, `required bool default true`, `options jsonb default '[]'`), `csi-period.entity.ts` (drop `siteId`/`site`; add `teamEnabled`, `teamLabel varchar(100)`, `individualEnabled`, `slaTargetPct smallint`; relation `sites` via new entity), create `csi-period-site.entity.ts` (`periodId` CASCADE, `siteId`, unique(periodId, siteId)), `csi-period-ratee.entity.ts` (`kind varchar(10) default 'PERSON'`, `userId` nullable), `csi-period-ratee-dimension.entity.ts` (snapshot `type`, `required`, `options jsonb`)
- Modify: `dto/master.dto.ts`, `services/csi-master.service.ts`, `presentation/csi-admin-master.controller.ts`
- Test: `csi-master.service.spec.ts`, `dto/master.dto.spec.ts`

**Interfaces:**
- Migration `up`: add columns above; `CREATE TABLE csi_period_sites`; `INSERT INTO csi_period_sites ("periodId","siteId") SELECT id, "siteId" FROM csi_periods`; drop index `IDX_csi_periods_scope_site_start`, drop column `siteId`; create index `IDX_csi_periods_scope_start (scope, startDate)`; `csi_period_ratees.userId DROP NOT NULL`; partial unique index `UQ_csi_period_ratees_team ON csi_period_ratees ("periodId") WHERE kind = 'TEAM'`; snapshot columns on ratee dimensions (`type` default 'STAR', `required` default true, `options` default '[]'). Response columns belong to Task 3's migration. `down` reverses (re-adds `siteId` from the first `csi_period_sites` row).
- Produces master DTO: `CreateDimensionDto { name; description?; type: CsiQuestionType; required?: boolean; options?: CsiOptionDto[] }` with class-validator rules from Global Constraints (custom validator for per-type option rules → 400 `'Pilihan tidak valid untuk jenis pertanyaan ini'`). `sortOrder` removed from create/update DTOs (server-assigned).
- Produces endpoints: `PUT /csi/admin/:scope/dimensions/order` and `PUT /csi/admin/:scope/departments/order`, body `{ ids: string[] }` → 400 `'Urutan tidak lengkap'` unless ids equal the full set of that scope's rows; returns the reordered list.
- Produces endpoint: `POST /csi/admin/:scope/dimensions/template` → creates the 9 CSI 2025 questions from the spec verbatim (appended at the end), returns the created list.
- `CsiMasterService.createDimension/createDepartment` assign `sortOrder = (max in scope) + 1`.

- [ ] **Step 1: Failing tests:** `migration backfills period sites and STAR type` (mock QueryRunner asserts SQL order: create sites table, INSERT…SELECT, then drop siteId); `create appends sortOrder at the end`; `reorder rejects incomplete id set (400)`; `reorder assigns index order`; `SCALE requires 2-10 options with points 1-5`; `CHOICE options must have null points`; `template creates 9 questions in order with E-Services replaced by iDesk`.
- [ ] **Step 2: Run** each spec file serially → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** specs serially → PASS; `npx tsc --noEmit -p tsconfig.json` (expect compile errors in period/respondent/report services that reference `siteId` — fix them minimally in this task to read `sites`, full behaviour lands in Task 2–4; keep their existing tests passing).
- [ ] **Step 5: Commit** `feat(csi): question bank types, ordering and multi-site schema`

---

### Task 2: Backend — periode multi-site, bagian tim, readiness

**Files:**
- Modify: `dto/period.dto.ts`, `services/csi-period.service.ts`, `presentation/csi-admin-period.controller.ts`
- Test: `csi-period.service.spec.ts`

**Interfaces:**
- Consumes: Task 1 entities/constants.
- DTO: create `siteIds: string[]` (1–20 UUIDs, unique) replaces `siteId`; update may change `siteIds` only while not locked (409 `LOCKED_MESSAGE` if locked and changed); new fields `teamEnabled?`, `teamLabel?` (1–100), `individualEnabled?`, `slaTargetPct?` (1–100).
- Period JSON: `sites: Array<{ id; code; name }>` replaces `site`/`siteId`; plus `teamEnabled`, `teamLabel`, `individualEnabled`, `slaTargetPct`. `list(scope, siteId?)` filters periods containing that site. Ratees in `get()` include `kind`; TEAM ratee listed first; `ratees` dimension rows include `type`, `required`, `options`.
- `assertNoOverlap(scope, siteIds, start, end, excludeId?)`: 409 if any other period of the scope shares any site and intersects the dates.
- `setTeamQuestions(scope, id, questionIds: string[])` → `PUT /periods/:id/team` `{ questionIds }`: under `lockUnlockedPeriod`; upserts the single TEAM ratee (`displayName = teamLabel`, `sortOrder = -1`) and replaces its dimension snapshots (copying type/required/options/name); empty list removes the TEAM ratee. Questions must be active and in scope (400).
- `setRatees` now replaces only `kind = 'PERSON'` rows and snapshots type/required/options.
- `update()` with a new `teamLabel` also updates the TEAM ratee's `displayName`.
- `computeReadiness` input adds `teamEnabled`, `individualEnabled`, `teamQuestionCount`; checks: `team` "Penilaian tim punya minimal 1 pertanyaan" (only when teamEnabled), `ratees`/`dimensions` (only when individualEnabled), `departments`, `raters` (LISTED; active raters whose site ∈ period sites).
- Copy-from copies sites, team settings, TEAM questions (re-snapshotted, skipping inactive) and PERSON ratees.

- [ ] **Step 1: Failing tests:** `create with multiple sites stores csi_period_sites`; `overlap is checked per site` (shared site → 409, disjoint → ok); `update siteIds rejected when locked`; `setTeamQuestions creates one TEAM ratee with snapshots`; `setTeamQuestions [] removes TEAM ratee`; `setRatees keeps TEAM ratee`; `teamLabel update renames TEAM ratee`; `both sections disabled → 400`; `readiness includes team check only when enabled and skips ratees when individual disabled`; `raters readiness counts raters of any survey site`; `copy-from copies sites and team`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** spec + tsc → PASS.
- [ ] **Step 5: Commit** `feat(csi): multi-site periods and team section`

---

### Task 3: Backend — jawaban berjenis, nama responden, eligibility multi-site

**Files:**
- Create: `apps/backend/src/migrations/1794020000000-CsiResponseAnswers.ts` (+ spec)
- Modify: `entities/csi-response.entity.ts` (`respondentName varchar(150) NOT NULL`), `entities/csi-response-item.entity.ts` (`score` nullable, `answerLabel varchar(200) null`, `answerText varchar(1000) null`), `dto/submit.dto.ts`, `services/csi-respondent.service.ts`, `presentation/csi-me.controller.ts`
- Test: `csi-respondent.service.spec.ts`

**Interfaces:**
- Migration: add `respondentName` (backfill `UPDATE csi_responses r SET "respondentName" = u."fullName" FROM users u WHERE u.id = r."respondentId"`, then NOT NULL); drop `UQ_csi_responses_period_respondent`; create unique `UQ_csi_responses_period_respondent_name ON csi_responses ("periodId","respondentId", lower(btrim("respondentName")))`; `score DROP NOT NULL`; add `answerLabel`, `answerText`. The existing CHECK on score stays (NULL passes).
- Submit DTO: `respondentName` (trim, 2–150); items `{ periodRateeDimensionId; score?: number; optionIndex?: number; text?: string }`.
- Resolution per snapshot type: `STAR` → `score` int 1–5; `SCALE` → `optionIndex` valid → `score = option.points`, `answerLabel = option.label`; `CHOICE` → `optionIndex` → `answerLabel`, `score = null`; `TEXT` → trimmed `text` 1–1000 → `answerText`. Wrong field for type → 400 `'Jawaban tidak sesuai jenis pertanyaan'`.
- `validateItems`: unknown/duplicate → 400 (as now); every `required` snapshot present → else 400 `'Semua pertanyaan wajib harus dijawab'`; optional may be omitted.
- Duplicate name: in-txn check `lower(trim)` + unique violation → 409 `'Nama ini sudah mengisi survei ini'` (replaces "Anda sudah mengisi survei ini" for this case).
- Eligibility: respondent `siteId` ∈ period sites (join `csi_period_sites`); TEAM ratee is never self-excluded; PERSON self-exclusion as now; audience requires ≥1 visible ratee (TEAM counts).
- `getForm` always returns the open form (no `submitted: true` variant) with `respondent: { fullName }` (default name), `submittedNames: string[]` (this account's names for the period), `teamLabel`, and ratees ordered TEAM first, each with `kind`; each dimension `{ periodRateeDimensionId; name; description; type; required; options }`.
- `listActive` items: `{ id, scope, title, submitted: submittedNames.length > 0 }`.
- `submit` returns `{ submitted: true, thankYou }`.

- [ ] **Step 1: Failing tests:** `STAR/SCALE/CHOICE/TEXT answers resolve to score/label/text`; `wrong answer field for type 400`; `optional question may be omitted; required may not`; `one response per normalised name` (" Rina " vs "rina" → 409; "Budi" ok); `respondent of second survey site is eligible`; `TEAM ratee visible to its own team members`; `getForm returns submittedNames and TEAM first`; migration spec `backfills respondentName and swaps unique index`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** specs + tsc → PASS.
- [ ] **Step 5: Commit** `feat(csi): typed answers and per-name responses`

---

### Task 4: Backend — perhitungan report + Excel format 2025

**Files:**
- Modify: `services/csi-report.service.ts`, `services/csi-export.service.ts`
- Create: `services/csi-score.util.ts` (pure scoring), `services/csi-sla.service.ts`
- Test: `csi-report.service.spec.ts`, `csi-export.service.spec.ts`, `csi-score.util.spec.ts`, `csi-sla.service.spec.ts`

**Interfaces:**
- `csi-score.util.ts`: `responseAverage(scores: Array<number | null>): number | null` (mean of non-null); `averageOfAverages(values: Array<number | null>): number | null` (ignores null); `round2(n)`.
- `CsiReportService.getReport(scope, id)` → `{ period, overall: { average, respondentCount }, ratees: [{ periodRateeId, kind, displayName, jobTitle, respondentCount, average, indexPct, questions: [{ name, type, average, count, distribution: Array<{ label; count }> }] }], sla }`. Ratee average = averageOfAverages over responses of responseAverage(that response's scores for the ratee). `overall.average` = averageOfAverages over responses of responseAverage(all scores of the response).
- `CsiSlaService.compute(period, sites, respondentsCount): { mode, basis: number, targetPct, target: number, responses: number, pengisiPct: number | null, reporters: Array<{ email; department: string | null; fullName }> }`. OPEN: distinct `tickets.userId` per Global Constraints joined to users + departments; LISTED: active period raters in period sites. Date window computed with WIB helpers.
- Respondents endpoint (`getRespondents`) adds `respondentName` per submitted row (display name), keeps account `fullName` as `accountName`.
- Excel (`buildWorkbook`): sheets
  - "Rekap": Lokasi (site names joined `' & '`), Nama (PERSON ratees, one per row; TEAM shows `teamLabel`), Average (per ratee), Average survei, % Pengisi (SLA).
  - "Penilaian Tim" (only when a TEAM ratee exists) and "Penilaian Per Orang" (PERSON; extra column "Dinilai" after Departemen): Timestamp (`YYYY/MM/DD h:mm:ss A` WIB + `" GMT+7"`), Nama (respondentName), Area Kerja (respondent's site name uppercased), Departemen, then per question in snapshot order: answer column (label/text/score) and, for STAR/SCALE, a "Point n" column (n = running index of scored questions); Average (per row = responseAverage).
  - Styling: header fill `FF4BC0C8`, bold, wrap text, vertical middle, row height 120 for the header; thin borders on all cells; data rows alternate fill `FFDDF2F4`; Average with 2 decimals; freeze header row; column widths: Timestamp 26, Nama 24, Area Kerja 18, Departemen 18, question 18, Point 8, Average 10. All user text through `sanitizeCell` (extend to leading `\t`/`\r`).

- [ ] **Step 1: Failing tests:** `responseAverage ignores null`; `report reads legacy STAR answers`; `ratee average is mean of response averages` (fixture: response A scores 4,5 → 4.5; B 3 → 3; average 3.75); `overall average uses all scored items` (titi yusliyanti fixture 4,5,4,4,4,5,4,4 → 4.25); `SLA OPEN counts distinct ticket reporters in window and sites`; `SLA target ceil and pengisi capped at 100` (81 reporters, 80% → target 65, 216 responses → 100); `SLA LISTED uses active site raters`; `excel has Rekap/Penilaian Tim/Penilaian Per Orang with Point columns only for scored questions`; `excel header style teal and wrapped`.
- [ ] **Step 2: Run** each → FAIL. **Step 3: Implement.** **Step 4: Run** serially → PASS; tsc.
- [ ] **Step 5: Commit** `feat(csi): overall scoring, SLA from iDesk tickets and 2025-style Excel`

---

### Task 5: Backend — PDF memo + pengaturan memo

**Files:**
- Create: `entities/csi-memo-setting.entity.ts` (`scope` PK varchar(10), `data jsonb`, `updatedAt`) + migration `1794030000000-CsiMemoSettings.ts` (+ spec)
- Create: `services/csi-memo.service.ts`, `services/csi-memo-pdf.ts` (pdfkit drawing), `dto/memo.dto.ts`, `presentation/csi-admin-memo.controller.ts`
- Test: `csi-memo.service.spec.ts`, `csi-memo-pdf.spec.ts`

**Interfaces:**
- `MemoHeaderDto { to; cc; number; from; subject; date (YYYY-MM-DD); opening; closing; signerLeft: { name; title }; signerRight: { name; title } }` (strings ≤ 300, opening/closing ≤ 2000).
- `GET /csi/admin/:scope/memo-settings` → saved header or defaults (`opening` default built from the selected surveys on the client; server default `''`). `PUT` same path saves.
- `POST /csi/admin/:scope/reports/memo` body `{ periodIds: string[] (1–20, all in scope → else 404), header: MemoHeaderDto }` → `application/pdf` attachment `csi-memo-<scope>-<YYYY-MM-DD>.pdf`; also saves the header as settings.
- PDF (A4, Helvetica, margins 56):
  - Page 1: title "Interoffice Memo" (24pt) with a rule; label/value rows Kepada, CC, Nomor, Dari, Perihal, Tanggal (Indonesian long date); "Dengan hormat,"; opening paragraph; table columns Lokasi | Nama | Average | % Pengisi (SLA) — one block per selected survey, Lokasi and Average and % Pengisi vertically merged over that survey's PERSON names (if no PERSON ratees, the Nama cell shows the team label); Average = report `overall.average` formatted `4,52`; % Pengisi `100%` or `—`; closing paragraph(s); two signature columns "Hormat kami," / "Mengetahui," with 60pt blank space then bold underlined name and title.
  - Then per survey (landscape A4): heading "<Lokasi> — <title>", answer table in the same column structure as the Excel "Penilaian Tim" sheet (or "Penilaian Per Orang" if no team), font 6.5pt, header teal fill, page breaks repeat header.
  - Then per survey: "Lampiran SLA — <Lokasi>" with a summary box (Total pelapor iDesk / Total penilai terdaftar, Target <pct>%, Total responden CSI, % Pengisi (SLA)) and a reporter table Email | Departemen | Nama.
- Reuse patterns from `apps/backend/src/modules/reports/generators/report-pdf-canvas.ts` (page break `ensure`, table drawing) without importing report-specific styling.

- [ ] **Step 1: Failing tests:** `memo rejects period of other scope (404)`; `memo saves header as settings`; `memo pdf contains header labels, location names and 4,52-style averages` (render to buffer, extract text with `pdf-parse`, assert strings "Interoffice Memo", "Kepada", "% Pengisi (SLA)", a location, "4,25"); `memo pdf has answer and SLA appendix pages` (page count ≥ 1 + 2×surveys).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; tsc.
- [ ] **Step 5: Commit** `feat(csi): interoffice memo PDF in the 2025 format`

---

### Task 6: Frontend — SortableList, editor pertanyaan inline, departemen inline

**Files:**
- Create: `apps/frontend/src/features/csi/components/common/SortableList.tsx` (+ test)
- Create: `components/admin/questions/QuestionList.tsx`, `QuestionCard.tsx`, `OptionsEditor.tsx`, `questionPresets.ts` (+ tests)
- Create: `components/admin/InlineMasterList.tsx` (departments) (+ test)
- Modify: `components/admin/DimensionsTab.tsx` → renders `QuestionList` (tab label "Pertanyaan"), `DepartmentsTab.tsx` → `InlineMasterList`; remove `MasterList.tsx` + its dialog once unused
- Modify: `types.ts`, `api/csi.api.ts`, `hooks/useCsi.ts` (question fields, reorder, template, new period/form/report shapes from Tasks 2–5)

**Interfaces:**
- `<SortableList<T> items: T[] getId(item): string; onReorder(ids: string[]): void; renderItem(item, handle: ReactNode): ReactNode; disabled?: boolean; label: string />` — @dnd-kit `DndContext` with Pointer + Keyboard sensors (`sortableKeyboardCoordinates`), `SortableContext` vertical strategy, drag handle button `GripVertical` with `aria-label="Ubah urutan {label}"`; optimistic local order; reduced motion disables drop animation.
- Question card (inline, autosave on blur / Enter, Escape reverts): title input, description textarea, type select (4 labels), "Wajib diisi" switch, `OptionsEditor` for SCALE/CHOICE (rows: label input + points select 1–5 for SCALE; sortable; "Tambah pilihan"; delete; preset menu "Kepuasan" / "Kualitas" / "Frekuensi"), deactivate/activate action. New card "Tambah pertanyaan" appends at the bottom. Header action "Gunakan template CSI 2025" (confirm dialog, calls template endpoint).
- Departments: rows with inline name input (autosave), add row at the bottom, sortable, deactivate toggle; no dialog.
- Hooks: `useReorderCsiDimensions(scope)`, `useReorderCsiDepartments(scope)`, `useApplyCsiTemplate(scope)`.

- [ ] **Step 1: Failing tests:** `keyboard reorder calls onReorder` (SortableList: focus handle, Space, ArrowDown, Space → new id order); `new question appended and saved on blur`; `SCALE preset Kepuasan fills 5 options with points 5..1`; `switching to TEXT hides options`; `template button calls API after confirm`; `department added inline at the bottom without a dialog`; `Escape reverts an inline edit`.
- [ ] **Step 2: Run** each → FAIL. **Step 3: Implement.** **Step 4: Run** serially + tsc + eslint → PASS.
- [ ] **Step 5: Visual check** (mocked API, Playwright): question list with 3 types, options editor, departments inline — desktop light + dark; save to `.superpowers/sdd/<workspace>/t6-*.png`.
- [ ] **Step 6: Commit** `feat(csi): inline question editor with drag and drop ordering`

---

### Task 7: Frontend — wizard: multi-site, bagian tim, urutan orang

**Files:**
- Modify: `lib/wizard.ts` (step keys + `visibleSteps(period)`), `components/wizard/StepInfo.tsx` / `PeriodEditor.tsx` (multi-site picker, sections toggles, team label, SLA target), create `components/wizard/StepQuestions.tsx` (embeds `QuestionList`), `StepTeam.tsx`, modify `StepRatees.tsx` / `RateeAssignment.tsx` (question picker filtered to all types, drag & drop order of ratees via `SortableList`, kind PERSON only), `StepReview.tsx` (summary shows sites, sections, SLA target)
- Modify: `components/admin/PeriodsTab.tsx`, `PeriodDetail.tsx`, `PeriodChecklist.tsx` (sites instead of site)
- Test: `wizard.test.ts`, `SurveyWizard.test.tsx`, new `StepTeam.test.tsx`

**Interfaces:**
- `visibleSteps(period: Pick<CsiPeriodDetail, 'respondentMode' | 'teamEnabled' | 'individualEnabled'> | null): WizardStepKey[]` per Global Constraints order; `stepComplete` adds `team` → readiness `team`; `questions` → ≥1 active question.
- StepTeam: checklist of active questions + `SortableList` of chosen ones; save → `PUT /periods/:id/team`; dirty blocking like other steps.
- Multi-site: `SearchablePicker` multi-select of sites (chips), at least one; read-only when locked.
- Sections: two switches "Penilaian tim" / "Penilaian per orang" with inline error when both off; team label input shown when team enabled; SLA target number input (1–100, suffix %).

- [ ] **Step 1: Failing tests:** `visibleSteps hides team when disabled and ratees when individual disabled`; `cannot turn off both sections`; `team step saves selected questions in dragged order`; `info step requires at least one site`; `ratee order can be changed by drag and is sent in setRatees order`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** serially + tsc + eslint → PASS.
- [ ] **Step 5: Commit** `feat(csi): wizard with team section, multi-site and ordering`

---

### Task 8: Frontend — form responden: jenis pertanyaan, nama, tim, layout lega

**Files:**
- Create: `components/respond/QuestionField.tsx` (renders by type), `ChoiceList.tsx`
- Modify: `components/respond/*` (IntroScreen editable name, RateeScreen uses QuestionField, ReviewScreen shows answers per type, RateeChips wrap), `lib/surveyDraft.ts` (v2 key, answer shape), `lib/csiForm.ts` (`buildSubmitPayload` v2), `pages/CsiSurveyPage.tsx` (max width `max-w-5xl`, thank-you with "Isi lagi atas nama orang lain")
- Test: `SurveyFlow.test.tsx`, `surveyDraft.test.ts`, `CsiSurveyPage.test.tsx`, new `QuestionField.test.tsx`

**Interfaces:**
- Answer state: `Record<periodRateeDimensionId, { score?: number; optionIndex?: number; text?: string }>`.
- `QuestionField`: title (17px semibold) → description (muted) → control below: STAR → `StarRating size="lg"`; SCALE/CHOICE → vertical radio cards (`role="radiogroup"`, each option a full-width 48px-high card with radio dot + label; SCALE shows no points to the respondent); TEXT → textarea (max 1000). Required marker "*" with sr-only "wajib". Missing-required highlight reuses Task-4 styling.
- Complete = all `required` answered; optional skipped allowed.
- Intro: name input (prefilled with `respondent.fullName`, required 2–150) + department; if `submittedNames` non-empty show note "Akun ini sudah mengisi atas nama: …".
- Order: TEAM screen first (chip label = teamLabel), then PERSON screens.
- Layout: page container `max-w-5xl`, card padding `p-6 sm:p-10`, question spacing `space-y-8`; chips `flex-wrap` with full names (no truncation, wrap long names).
- 409 duplicate name → stay on review/intro with inline error "Nama ini sudah mengisi survei ini" on the name field (do not clear the draft).
- Thank-you: "Isi lagi atas nama orang lain" resets answers and name, returns to intro.

- [ ] **Step 1: Failing tests:** `renders star, scale, choice and text questions`; `scale answer submits optionIndex`; `optional question can be skipped; required blocks Lanjut`; `name is editable and submitted`; `duplicate name shows inline error and keeps draft`; `team screen comes first`; `fill again for another name resets the form`; `chips wrap full names`; `v1 drafts are ignored`.
- [ ] **Step 2: Run** each → FAIL. **Step 3: Implement.** **Step 4: Run** serially + tsc + eslint → PASS.
- [ ] **Step 5: Visual check** (mocked API): desktop 1440 + mobile 390, light + dark: intro, team screen with SCALE radio cards, person screen with STAR + TEXT, review. Save `t8-*.png`.
- [ ] **Step 6: Commit** `feat(csi): google-form style question types and roomier respondent layout`

---

### Task 9: Frontend — laporan, export Excel, dialog memo PDF

**Files:**
- Modify: `components/admin/PeriodReport.tsx` (overall average card, TEAM row first, per-question distribution for SCALE/CHOICE as compact bars, TEXT answers list), `RespondentStatus.tsx` (respondentName + accountName, SLA card: basis, target, responses, % Pengisi)
- Create: `components/admin/MemoExportDialog.tsx`, `lib/memo.ts` (`defaultOpening(periods): string`)
- Modify: `components/admin/PeriodsTab.tsx` (header action "Export memo PDF" with survey multi-select), `api/csi.api.ts`/`hooks/useCsi.ts` (memo settings + export)
- Test: `MemoExportDialog.test.tsx`, `PeriodReport` test

**Interfaces:**
- `defaultOpening(periods)` → "Sehubungan dengan telah berakhirnya penilaian Customer Satisfaction Index (CSI) yang dilakukan secara online pada bulan <Bulan YYYY dari tanggal selesai terakhir>, maka berikut adalah Nilai CSI <YYYY> untuk masing-masing personil <teamLabel survei pertama> dari site <daftar nama site unik dipisah ', '>."
- Dialog: survey checklist (published surveys of the scope, newest first) → header form prefilled from `GET memo-settings` (opening prefilled by `defaultOpening` when saved opening empty) → "Buat PDF" downloads via the existing blob download helper; error toast once (blob error parsing as in Task-3 UX export).

- [ ] **Step 1: Failing tests:** `defaultOpening lists months, year and unique sites`; `memo dialog prefills saved header and posts selected periodIds`; `report shows overall average and team row first`; `respondent status shows SLA target and percentage`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** serially + tsc + eslint → PASS.
- [ ] **Step 5: Commit** `feat(csi): memo PDF export dialog and richer report`

(E2E on the dev DB — migrations 1794010000000..1794030000000 + manual walkthrough — is a controller step after Task 9.)
