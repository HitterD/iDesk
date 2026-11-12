# CSI HC Sukodono & Template Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Sukodono (SKD/SJA 3), location hints, template replace-on-import, responsive template cards, deletable teams, single-source PIC name editing, template-filtered ratee picker, and auto-enabled rating sections.

**Architecture:** One additive migration for the site; location constants centralised per side; import commit switches from merge to replace with pin carry-over; team/PIC services gain delete/rename with draft-survey propagation; FE layout fixes verified in a real browser at 1280/1366/1920.

**Tech Stack:** NestJS + TypeORM, React + Vitest, Playwright for visual checks.

**Spec:** `docs/superpowers/specs/2026-11-12-csi-hc-sukodono-design.md`

## Global Constraints
- Tests SERIAL, one file per command. tsc both apps.
- Migration additive, timestamp `1794240000000`.
- Copy Bahasa Indonesia. Hints exactly: "SJA 1", "SJA 2", "SJA 3", "SJA Semarang", "SJA Jatibaru". Location order SPJ, KRW, SKD, SMG, JTB.
- Local DB writes only idesk_csi_demo.

## Review Focus
1. Re-import keeps confirmations of same-name raters (Task 3 test).
2. Deleting a team used by a published survey with answers → refused with survey name (Task 4).
3. Renaming a PIC updates draft survey ratee but not a published one with answers (Task 5).
4. Template card at 1280px: no horizontal scrollbar, no clipped badge (Task 6 visual).
5. Applying a template with a team turns on teamEnabled (Task 7).

### Task 1: Site SKD + mappings + location hints (BE + FE)
Migration insert site SKD Sukodono; csi-org.constants SJA3↔SKD; auth site mapping; template locations BE (CSI_TEMPLATE_LOCATION_NAMES incl. SKD, order, hint) + FE (CSI_TEMPLATE_LOCATIONS with hint, order); user import VALID_SITES + Excel template; site tones (incl. JTB fix); SubjectsTab group title "HC <name> (<hint>)"; tab labels show hint. Tests.

### Task 2: Template card responsive layout
TemplatesTab grid, TemplatePicCard, RaterRow (no x-scroll, dot badge when narrow, truncate + title), header wrap. Verify with Playwright at 1280×720, 1366×768, 1920×1080 against local servers (login creds in ledger). Tests for compact badge (aria-label).

### Task 3: Import replaces template (pin carry-over)
csi-template-import service + plan: commit = delete template rows then write; carry userId/confirmedAt/confirmedById for same PIC/team key + normalised rater name; report fields replaced counts + keptConfirmations; remove prune options BE/DTO/FE; preview copy. Tests.

### Task 4: Delete teams (SITE + CUSTOM, drafts)
csi-team.service remove: allow SITE; for surveys not started/no answers remove team ratees (+pairs, dims) after confirmation (`dryRun` → list affected surveys); refuse running/answered with survey names; finished → deactivate. Endpoint returns affected list; FE delete button for SITE team sheet + confirmation listing surveys. Tests.

### Task 5: Rename PIC (single source)
Endpoint PATCH org/pics/:id { fullName } (validate 2–150, HC); updates csi_pics.fullName, linked template rows picName, draft/no-answer survey ratees displayName; keeps alias (old normalised name) for import matching (store on template row or master `aliases` — choose minimal: template rows keep `picId` link so re-import matches by picName→row→picId; add alias table only if needed). FE: ✏ on template card name, name field in SubjectEditSheet for pic:, PicsTab edit. Tests.

### Task 6: Ratee picker filtered by template + auto sections
PicAssignment: location filter (multi, default survey sites), "Semua PIC" option, names current; Apply/sync/apply-many/manual setPics set individualEnabled/teamEnabled when ratees of that kind exist; turning a section off with ratees → FE confirm; readiness warning. Tests.

### Task 7: Verify
Run all CSI BE/FE tests serially + tsc; Playwright smoke of changed screens at 1280/1366; regenerate nothing else.
