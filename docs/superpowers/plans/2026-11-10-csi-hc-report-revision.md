# CSI HC Report Revision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Report PDF CSI HC ringkas, anonim, peringkat adil per layanan, status SLA, batas warna per survei, plus report simulasi SMG+SPJ.

**Architecture:** Batas warna menjadi data period (`scoreFairMin`, `scoreGoodMin`) yang dibawa model report → semua renderer (PDF/Excel/memo) dan payload frontend. Model report mendapat bagian baru (SLA, partisipasi departemen teranonimkan, peringkat per layanan) dan renderer HC disusun ulang; ICT hanya menerima perubahan lintas-scope. Script simulasi memakai service yang ada.

**Tech Stack:** NestJS + TypeORM, pdfkit (ReportCanvas), exceljs, React + Vitest.

**Spec:** `docs/superpowers/specs/2026-11-10-csi-hc-report-revision-design.md`

## Global Constraints

- Default batas warna 4.0 / 4.5; validasi 1 ≤ fair < good ≤ 5, kelipatan 0.1.
- `CSI_RANK_MIN_RATERS = 5`; `CSI_ANON_MIN_GROUP = 3`; `CSI_SLA_TARGET_DEFAULT_HC = 90` (ICT tetap `CSI_SLA_TARGET_DEFAULT = 80`).
- Predikat: "Sangat puas" ≥ good, "Puas" ≥ fair, "Perlu perbaikan" lainnya.
- Teks banner simulasi persis: "SIMULASI — data jawaban fiktif, bukan hasil survei sebenarnya"; prefix judul survei simulasi `SIMULASI – `.
- PDF tidak pernah memuat nama/email penilai. Tanpa kotak "3 tertinggi"/"Perlu perhatian"; kalimat sorotan tanpa nama orang (semua scope).
- Migrasi additive `IF NOT EXISTS`, timestamp `1794220000000`.
- Copy Bahasa Indonesia. Tes SERIAL satu file per perintah (`npx jest --runInBand <file>`, `npx vitest run --pool=forks <file>`).
- Simulasi hanya DB `idesk_csi_demo`.

## Review Focus

1. Survei lama tanpa kolom baru → warna/predikat identik dengan sebelumnya (Task 1 test `legacy period keeps 4.0/4.5`).
2. Seri skor (4,23 vs 4,23) dan pembulatan 2 desimal → peringkat sama (Task 3 test `ties share rank`).
3. Departemen tepat 3 penilai tidak digabung, 2 digabung (Task 3 test `anon boundary`).
4. Survei tanpa periode lalu → kolom Lalu/Δ tidak muncul sama sekali (Task 4 test `no previous hides delta columns`).
5. Batas warna custom (mis. 3.5/4.2) mengubah warna dan predikat di PDF, Excel, memo, dan frontend (Task 2 + Task 6 tests `custom bands`).

---

### Task 1: Batas warna & default SLA HC di period (backend)

**Files:** Create migration `apps/backend/src/migrations/1794220000000-CsiScoreBands.ts` (+spec); Modify `entities/csi-period.entity.ts`, `dto/period.dto.ts`, `services/csi-period.service.ts` (create/copy/update + detail payload), `csi.constants.ts`, Create `services/csi-score-bands.ts` (+spec).

**Interfaces — Produces:**
- `CsiPeriod.scoreFairMin: number` (numeric(2,1) NOT NULL DEFAULT 4.0, transformer → number), `scoreGoodMin: number` (DEFAULT 4.5).
- `type CsiScoreBands = { fairMin: number; goodMin: number }`; `CSI_SCORE_BANDS_DEFAULT`; `bandsOf(period): CsiScoreBands`; `scoreBand(avg: number | null, bands): 'good' | 'fair' | 'poor' | null`; `scoreWordFor(avg, bands): 'Sangat puas' | 'Puas' | 'Perlu perbaikan' | null`.
- DTO `scoreFairMin?`, `scoreGoodMin?` (IsNumber maxDecimalPlaces 1, Min 1, Max 5) + cross-field validation fair < good (400 'Batas oranye harus lebih kecil dari batas hijau').
- `CSI_SLA_TARGET_DEFAULT_HC = 90`; create uses it when scope HC and no dto/source value.
- Period detail/list payload exposes `scoreFairMin`, `scoreGoodMin`.
- [ ] Tests: migration spec; `csi-score-bands.spec.ts` (`legacy period keeps 4.0/4.5`, `custom bands 3.5/4.2`, boundaries inclusive); period spec (`HC default SLA 90`, `ICT default SLA 80`, `copy carries bands`, `fair >= good rejected`). RED → implement → GREEN; tsc; commit.

### Task 2: Pakai batas per survei di semua renderer backend

**Files:** Modify `services/csi-report-model.ts` (replace CSI_SCORE_GOOD/FAIR usage; model gets `bands`), `services/csi-report-pdf.ts`, `org/csi-hc-report.render.ts`, `services/csi-export.service.ts`/`csi-export.executive.ts`, memo (`csi-memo-*.ts`), `services/csi-service-report.service.ts`, `services/csi-self-result.service.ts` (payload `scoreBands`), dashboard payload service (find), specs.

**Interfaces:** every report/result/dashboard payload consumed by FE includes `scoreBands: CsiScoreBands`. Remove `CSI_SCORE_GOOD/FAIR` constants from backend (single source = csi-score-bands.ts).
- [ ] Tests: `custom bands` cases in report-model spec (predikat + colour token), export spec (cell fill), memo spec, self-result spec (payload). RED → GREEN; full CSI backend specs serial for touched files; tsc; commit.

### Task 3: Model report — SLA, partisipasi per departemen anonim, peringkat per layanan

**Files:** Modify `services/csi-report-model.ts` (split if >300 lines: Create `services/csi-report-ranking.ts`, `services/csi-report-participation.ts`), `services/csi-report.service.ts`, `org/csi-hc-report.calc.ts` (responden rekap gabungan < 3), specs.

**Interfaces — Produces (model):**
- `sla: { basis: number; submitted: number; pct: number; targetPct: number; targetCount: number; met: boolean; missing: number }`.
- `departments: Array<{ name: string; submitted: number; total: number; pct: number; met: boolean }>` with groups total < 3 merged into `{ name: 'Departemen kecil (gabungan)' }` (only if ≥1 merged); sorted by pct asc then name. Remove `basis` person list from model (Lampiran D source) — keep it only where admin screen needs it (check consumers; respondents endpoint unaffected).
- `rankingByService: Array<{ serviceCode: string | null; serviceName: string; ranked: RankRow[]; insufficient: RankRow[] }>` — HC by serviceCode; ICT a single group (serviceCode null, serviceName 'Semua'); `RankRow = { rank: number | null; name; detail: string | null; raters; average; word; previous: number | null; delta: number | null }`; competition ranking on average rounded to 2 decimals; raters < CSI_RANK_MIN_RATERS → insufficient (rank null).
- `serviceHighlight: { best: {code,name,average}; worst: {...} } | null` (HC; ICT null) replaces person-name highlight sentences; remove spotlight data.
- `hasPrevious: boolean`.
- HC recap `respondentGroups` merge < 3 into "Departemen kecil (gabungan)".
- [ ] Tests: `ties share rank`, `below 5 raters listed as insufficient`, `ranking per service`, `anon boundary` (3 kept, 2 merged), `sla met/missing`, `highlight has no person names`, `no previous → hasPrevious false`. RED → GREEN; commit.

### Task 4: Renderer PDF — struktur baru, tanpa Lampiran D, banner simulasi

**Files:** Modify `services/csi-report-pdf.ts` (split sections into `services/csi-report-pdf-sections.ts` if needed), `org/csi-hc-report.render.ts`, `csi-report-pdf.spec.ts`; extend `csi-report-model.fixture.ts` with HC data.

- Sections per spec "Struktur PDF (HC)"; ICT: summary (+SLA block, service highlight null → no sentence about people), site/aspects, team/people ranking via `rankingByService` single group, participation per departemen (angka), appendices without Lampiran D. Every table preceded by a one-line "cara membaca" caption; headers full words (wrap allowed); no Bintang column; Lalu/Δ columns only when `hasPrevious`.
- Simulation banner: when period title starts with `SIMULASI – `, draw the exact banner text at the top of every page (red band) and footer note.
- Tests (pdf text extraction via existing helper or by spying ReportCanvas calls — follow existing spec approach): `no participant names or emails in pdf`, `no previous hides delta columns`, `HC has no Lampiran A2 and no spotlight`, `simulation banner on every page`, `sla block text`, ICT smoke (renders, no Lampiran D).
- [ ] RED → GREEN; commit.

### Task 5: Excel export & memo selaras

**Files:** `services/csi-export.service.ts`, `csi-export.executive.ts`, `csi-memo-*.ts`, specs.
- Excel: ranking sheet per service with min raters/ties; participation per departemen sheet anonymised (no names) — keep the HC sheet with respondent names ONLY if it already exists for admin and was explicitly allowed (it is: `addHcRecapSheets withNames=true` admin-only) — leave as is; add SLA cells to summary sheet.
- Memo: bands from period; no person spotlight.
- [ ] Tests updated; commit.

### Task 6: Frontend — batas warna per survei + SLA HC 90%

**Files:** `lib/csiTone.ts` (`scoreTone(avg, bands?)`, `scoreWord(avg, bands?)`, default bands), all callers (grep CSI_SCORE_GOOD/FAIR, hcFormat 4.5 literals, dashboardModel ticks), period form (`lib/periodForm.ts` + the wizard step that edits slaTargetPct): inputs "Batas oranye" & "Batas hijau" (step 0.1) with 3-colour preview and validation messages; HC default SLA 90 in form when scope hc; types.
- [ ] Tests: csiTone `custom bands`, periodForm validation + HC default 90, one component per surface (dashboard, my results, HC recap panel) using bands from payload. RED → GREEN; tsc; commit.

### Task 7: Simulasi & PDF

**Files:** Create `apps/backend/scripts/csi-simulate-hc-report.ts`.
- Guard: abort unless `DB_DATABASE === 'idesk_csi_demo'`. Deterministic PRNG seed. Create period via template apply service (SMG + SPJ templates), title `SIMULASI – CSI HC 2026 (SMG + SPJ)`, SLA 90, publish, insert responses for ~85% of raters with realistic distributions (most 4–5, two PICs skewed lower), force one PIC to 2–3 raters, ~30 generic comments. Export PDF via CsiExportService to `Downloads/CSI HC 2026 - SIMULASI report.pdf`.
- Run it; check PDF pages visually (render pages to PNG with pdf.js or Playwright) and fix layout issues (commit fixes with tests where behaviour). Run full CSI BE + FE suites serially; tsc both.
- [ ] Commit script (+fixes).
