# CSI HC Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the HC survey wizard (PIC picker + "Ambil dari template"), ensure every PIC appears in the report, make numbers/SLA consistent, audit the whole CSI module, and ship a restyled, anonymous Excel with a separate confidential raw-data file.

**Architecture:** Frontend wizard steps reuse existing PicAssignment + template apply endpoints; backend apply gains master creation and zero-rater ratees; report model gets "no answers" groups and TEAM rows in the HC recap; Excel moves to a dedicated CSI style module and two workbooks.

**Tech Stack:** NestJS + TypeORM, exceljs, pdfkit, React + TanStack Query + Vitest.

**Spec:** `docs/superpowers/specs/2026-11-11-csi-hc-audit-design.md`

## Global Constraints
- Tests SERIAL, one file per command (`npx jest --runInBand <file>`, `npx vitest run --pool=forks <file>`).
- ICT behaviour unchanged unless a task says otherwise. Copy Bahasa Indonesia.
- PDF and main Excel never contain rater names/emails; raw-data workbook is labelled "RAHASIA".
- Colours (Excel): header `FF1F3A5F`, zebra `FFF5F7FA`, border `FFD9DEE7`, total `FFE8EDF5`, good `FFD7F2EC`, fair `FFFFF1CC`, poor `FFFBDDD7`.
- No migrations unless strictly needed (additive, timestamp 1794230000000).
- Local data only in DB idesk_csi_demo.

## Review Focus
1. Sync "Ambil dari template" into a draft that has answers → refused (Task 1 test `refuses when answers exist`).
2. PIC with 0 raters in template → ratee with 0 pairs appears under "Belum ada penilaian" in PDF and Excel (Task 2 test).
3. HC page-1 overall equals Excel Ringkasan and dashboard value (Task 3 test).
4. Raw-data workbook endpoint requires admin (or service owner for own service) (Task 5 test).
5. Excel totals rows excluded from autofilter range (Task 5 test).

---

### Task 1: HC wizard — PIC picker, "Ambil dari template", readiness
**Files:** FE `components/admin/StepRatees.tsx`, `hc/PicAssignment.tsx`, `hc/HcPairsPanel.tsx`, new `hc/templates/TemplatePullDialog.tsx`, `lib/wizard.ts`, `pages/CsiAdminPage.tsx`/`useAdminRoute.ts`; BE `services/csi-period.service.ts` (computeReadiness), `services/csi-template-apply.service.ts` (+ endpoint option `replaceNonPic`), controller/DTO.
- HC always uses PicAssignment in StepRatees; copy per mode.
- TemplatePullDialog: checkbox locations with templates; preview via applyTemplate dry run per template (sum) or new `POST templates/apply-many/:periodId?commit` { templateIds, replaceNonPic } → merged report; confirm replacing N non-PIC ratees; refuse if period has responses ('Survei sudah ada jawaban; ambil template hanya untuk draft/tanpa jawaban').
- Readiness HC: ratees ok iff ≥1 ratee with picId or kind TEAM; publish blocked otherwise.
- `?wizard=new` for HC → HcSurveyWizard.
- Tests: BE apply-many (sums, replaceNonPic deletes non-PIC ratees + pairs, refuses with answers), readiness HC; FE StepRatees HC shows PIC picker, pull dialog flow, HcPairsPanel empty state button.

### Task 2: Every PIC in the report
**Files:** `services/csi-template-apply.service.ts`, `services/csi-assignment-template.service.ts` (master creation reuse), `services/csi-report-ranking.ts`, `csi-report-model.ts`, `org/csi-hc-report.calc.ts`, `csi-report.service.ts` (TEAM in recap), PDF/Excel renderers, wizard preview FE.
- Apply: create missing masters (site = template location); zero-rater active PICs become ratees; report `picsWithoutRaters` as warning list.
- Ranking: groups get `noAnswers: RankRow[]` (raters 0 or average null) separate from `insufficient`; PDF/Excel show "Belum ada penilaian".
- HC recap includes TEAM custom ratees as rows under their service (label "Tim").
- Tests for each.

### Task 3: Number & label consistency
**Files:** report service/model, export executive/service (Rekap sheet), dashboard service + FE dashboard, service-report, PDF summary, org PicsTab FE.
- HC per-rating basis everywhere (dashboard active rows/overall for HC, service report, Excel); ICT unchanged.
- Remove "% Pengisi (SLA)" (÷ target) from PDF/Excel/dashboard; keep one SLA percentage.
- "Tanpa bagian" everywhere; PicsTab warning count of PICs without bagian.
- Page 1 + Excel Ringkasan line for template raters without account (count from templates of the period's locations, status no-account/ambiguous not linked).
- Tests.

### Task 4: Full CSI audit (HC + ICT)
- Read through CSI backend (controllers, guards, services) and frontend flows; run app locally (backend + vite on free ports) and exercise: HC template → wizard → publish → respond → report; ICT survey basic flow. Produce findings list (severity, file:line, repro). Fix Critical/Important with tests in this task (separate commits); list Minor/UX for the user.

### Task 5: Excel restyle + raw-data workbook
**Files:** new `services/csi-excel-style.ts` (palette, helpers: header, zebra, borders, bands, totals, number/percent/date formats, autoWidth, print setup, title block, TOC hyperlinks); refactor `csi-export.sheet.ts` to it; `csi-export.service.ts` (buildWorkbook main + buildRawWorkbook), `csi-export.executive.ts`, `csi-export.matrix.ts`, `csi-export.answers.ts`, `org/csi-hc-report.render.ts`, `csi-service-report.service.ts`, controllers (new raw endpoints), FE buttons ("Unduh Excel" + "Unduh data mentah (rahasia)").
- Sheets per spec E; totals outside autofilter; timestamps as Date; percent as real percent; Ringkasan title + KPI + TOC.
- Raw workbook: header banner "RAHASIA — berisi nama penilai"; filename suffix " - DATA MENTAH (RAHASIA)".
- Update specs; regenerate simulation XLSX (main + raw) to Downloads for user review.

### Task 6: Verify & simulate
- Re-run simulation script; regenerate PDF + both XLSX; render PDF pages and check; run all CSI BE/FE tests serially + tsc.
