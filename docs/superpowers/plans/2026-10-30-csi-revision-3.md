# CSI Revisi 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Foto + tagline subjek, satu tim per site, pemetaan penilai→subjek, label singkat pertanyaan, pengingat, serta UI baru (form responden foto-kiri, matriks, laporan, status, dashboard) sesuai mockup v3.

**Architecture:** Backend NestJS modul `csi` mendapat 4 tabel baru (`csi_teams`, `csi_subject_profiles`, `csi_rater_assignments`, `csi_period_rater_ratees`) + kolom baru di `csi_period_ratees` dan pertanyaan, satu migrasi. Kelayakan responden memfilter subjek lewat pemetaan bila ada (fallback perilaku lama). Frontend `features/csi` mengganti layar responden dan menambah tab admin "Subjek" dan "Dashboard" serta panel "Penilai" (matriks) di detail periode; styling Tailwind + token yang ada.

**Tech Stack:** NestJS 10 + TypeORM (Postgres), Jest (`--runInBand`); React 18 + React Query + Vitest 4 (jsdom); Tailwind.

**Spec:** `docs/superpowers/specs/2026-10-30-csi-revision-3.md` · **Mockup acuan:** `mockups/csi-redesign.html` (+ `.css`, `.js`)

## Global Constraints

- Test **serial, satu file per kali** (memori user: jest paralel bikin mesin hang). Backend: `cd apps/backend && npx jest --runInBand <file>`. Frontend: `cd apps/frontend && npx vitest run --pool=forks <file>`.
- Semua copy UI dalam Bahasa Indonesia, persis seperti mockup.
- Emoji **hanya** di reaksi bintang: `['','😞','😕','😐','😊','🤩']`; label `['','Sangat kurang','Kurang','Cukup','Puas','Luar biasa!']`. Tempat lain pakai ikon `lucide-react`.
- Warna skor: `>= 4.5` green, `>= 4.0` amber, `< 4.0` red. Warna site: SPJ teal, KRW brown, SMG green, JKT sky; site lain → neutral. Tanpa ungu/indigo.
- Sapphire hanya untuk tombol primary/fokus (DESIGN.md). Satu `primary` per permukaan.
- Tagline maks **90** karakter; `shortLabel` maks **40**; foto JPG/PNG/WebP ≤ **5 MB**, disimpan di `./uploads/csi/`, URL `/uploads/csi/<file>`.
- Pengingat: maks satu per penilai per periode per **24 jam** (dedup `NotificationService.create` lewat `referenceId = "<periodId>:<userId>"`).
- Default mode responden ICT = `LISTED` (HC tetap `LISTED`).
- Satu scroll halaman di form responden: kolom foto `position: sticky`, kolom form tanpa `overflow`/`max-height` sendiri.
- Class animasi diberi prefix (`csi-star-pop`, dst.) — jangan bentrok dengan class komponen lain.
- Semua animasi baru dimatikan oleh blok `prefers-reduced-motion` yang ada di `index.css`.
- Migrasi baru: timestamp `1794050000000`, nama `CsiRevision3`.

## Review Focus

1. **Periode lama tanpa pemetaan** — responden tetap melihat semua subjek (bukan nol). → test di Task 3.
2. **Pemetaan menunjuk penilai/ subjek yang kemudian dihapus dari periode** — tidak error; baris pemetaan ikut terhapus (cascade) dan responden tidak melihat subjek yatim. → test di Task 2.
3. **Penilai dipetakan ke dirinya sendiri** lewat API langsung — ditolak 400. → test di Task 2.
4. **Subjek tanpa foto / tanpa tagline** — form memakai avatar user atau inisial dengan warna site, caption tanpa baris tagline (tidak ada tanda kutip kosong). → test di Task 7.
5. **Responden dengan 15+ subjek di layar 360 px** — rail tidak membuat scroll horizontal halaman; tombol "Semua" tetap bisa dibuka. → test di Task 7 (assert rail `overflow-x-auto` + popover) dan cek manual Task 12.

---

## File Structure

**Backend — `apps/backend/src/`**
- `migrations/1794050000000-CsiRevision3.ts` (+ `.spec.ts`) — semua DDL + backfill tim dari periode lama.
- `modules/csi/entities/csi-team.entity.ts` — master tim per (scope, site).
- `modules/csi/entities/csi-subject-profile.entity.ts` — foto/tagline/jabatan orang per scope.
- `modules/csi/entities/csi-rater-assignment.entity.ts` — template pemetaan per scope.
- `modules/csi/entities/csi-period-rater-ratee.entity.ts` — pemetaan per periode.
- `modules/csi/entities/csi-period-ratee.entity.ts` — + `siteId`, `teamId`, `photoUrl`, `tagline`; index tim per site.
- `modules/csi/entities/csi-dimension.entity.ts`, `csi-period-ratee-dimension.entity.ts` — + `shortLabel`.
- `modules/csi/services/csi-subject.service.ts` (+ spec) — CRUD tim & profil, upload foto, resolusi tampilan subjek.
- `modules/csi/services/csi-assignment.service.ts` (+ spec) — matriks periode, auto sama-site, template simpan/salin.
- `modules/csi/services/csi-reminder.service.ts` (+ spec) — kirim pengingat.
- `modules/csi/services/csi-dashboard.service.ts` (+ spec) — agregat periode aktif + tren.
- `modules/csi/services/csi-respondent.service.ts` — filter pemetaan, foto/tagline/site di form.
- `modules/csi/services/csi-period.service.ts` — tim per site, default ICT LISTED, salin profil & pemetaan.
- `modules/csi/services/csi-report.calc.ts` — + `siteId`, `photoUrl`, `shortLabel`, `distribution` bintang.
- `modules/csi/presentation/csi-admin-subject.controller.ts`, `csi-admin-assignment.controller.ts`, `csi-admin-dashboard.controller.ts`.
- `modules/csi/presentation/csi-admin-report.controller.ts` — + `POST reminders`.
- `modules/csi/dto/subject.dto.ts`, `dto/assignment.dto.ts`.
- `modules/notifications/entities/notification.entity.ts` — + `NotificationType.CSI_REMINDER`.
- `shared/core/config/upload.config.ts` — + preset `csiPhoto`.

**Frontend — `apps/frontend/src/features/csi/`**
- `types.ts`, `api/csi.api.ts`, `hooks/useCsi.ts`, `../../lib/queryKeys.ts` — tipe, API, hook baru.
- `lib/csiTone.ts` (+ test) — warna site/skor/pertanyaan, label & emoji bintang.
- `components/respond/SubjectPhoto.tsx` — foto sticky + caption.
- `components/respond/SubjectRail.tsx` (+ test) — rail avatar + popover "Semua".
- `components/respond/StarReaction.tsx` (+ test) — bintang + emoji + label.
- `components/respond/RateeScreen.tsx`, `QuestionField.tsx`, `SurveyFlow.tsx`, `ReviewScreen.tsx` — susun ulang layout.
- `components/admin/subjects/SubjectsTab.tsx`, `SubjectCard.tsx`, `SubjectEditSheet.tsx` (+ test).
- `components/admin/assignment/AssignmentMatrix.tsx` (+ test), `matrixModel.ts` (+ test).
- `components/admin/PeriodReport.tsx`, `ReportSummary.tsx` → `report/ReportHero.tsx`, `report/SubjectScoreCard.tsx`, `report/SubjectDetailSheet.tsx`, `report/ScoreHeatmap.tsx`.
- `components/admin/RespondentStatus.tsx` — tampilan baru + pengingat.
- `components/admin/dashboard/CsiDashboard.tsx` (+ test).
- `pages/CsiAdminPage.tsx` — area `subjects` dan `dashboard`; `components/admin/PeriodDetail.tsx` — tab `raters`.
- `components/admin/questions/QuestionCard.tsx` — field label singkat.

---

### Task 1: Migrasi + entity revisi 3

**Files:**
- Create: `apps/backend/src/migrations/1794050000000-CsiRevision3.ts`, `.spec.ts`
- Create: `modules/csi/entities/csi-team.entity.ts`, `csi-subject-profile.entity.ts`, `csi-rater-assignment.entity.ts`, `csi-period-rater-ratee.entity.ts`
- Modify: `modules/csi/entities/csi-period-ratee.entity.ts:6-45`, `csi-dimension.entity.ts`, `csi-period-ratee-dimension.entity.ts`, `modules/csi/csi.module.ts` (TypeOrmModule.forFeature), `modules/notifications/entities/notification.entity.ts:13` (+ `CSI_REMINDER = 'CSI_REMINDER'`)

**Interfaces:**
- Produces:
  - `CsiTeam { id; scope: ServiceScope; siteId: string; name: string; photoUrl: string|null; tagline: string|null; jobTitle: string|null; isActive: boolean }` — unik `(scope, siteId)`.
  - `CsiSubjectProfile { id; scope; userId; photoUrl: string|null; tagline: string|null; jobTitle: string|null }` — unik `(scope, userId)`.
  - `CsiRaterAssignment { id; scope; raterUserId: string; subjectKey: string }` — unik `(scope, raterUserId, subjectKey)`; `subjectKey` = `user:<uuid>` | `team:<uuid>`.
  - `CsiPeriodRaterRatee { id; periodId; periodRaterId; periodRateeId }` — unik `(periodRaterId, periodRateeId)`, FK cascade ke `csi_period_raters`, `csi_period_ratees`, `csi_periods`.
  - `CsiPeriodRatee` + `siteId: string|null`, `teamId: string|null`, `photoUrl: string|null`, `tagline: string|null`. Index `UQ_csi_period_ratees_team` diganti `UQ_csi_period_ratees_team_site` unik `(periodId, siteId)` where `kind = 'TEAM'`.
  - `CsiDimension.shortLabel`, `CsiPeriodRateeDimension.shortLabel`: `varchar(40) null`.

- [ ] **Step 1: Tulis spec migrasi** (pola `1794030000000-CsiMemoSettings.spec.ts`): `up` memanggil `CREATE TABLE "csi_teams"`, `"csi_subject_profiles"`, `"csi_rater_assignments"`, `"csi_period_rater_ratees"`; `DROP INDEX "UQ_csi_period_ratees_team"`; `CREATE UNIQUE INDEX "UQ_csi_period_ratees_team_site"`; `ADD "shortLabel"` di kedua tabel pertanyaan; backfill `UPDATE "csi_period_ratees" r SET "siteId" = u."siteId" FROM "users" u WHERE r."userId" = u.id`; backfill tim: untuk setiap TEAM ratee lama set `siteId` ke site pertama periode (`csi_period_sites` urut `siteId`) dan sisipkan `csi_teams` (`ON CONFLICT DO NOTHING`, nama = `teamLabel`). `down` membalik urutan.
- [ ] **Step 2:** `npx jest --runInBand src/migrations/1794050000000-CsiRevision3.spec.ts` → FAIL (modul tidak ada).
- [ ] **Step 3:** Tulis migrasi + 4 entity + perubahan kolom; daftarkan entity di `csi.module.ts`.
- [ ] **Step 4:** Spec → PASS. Lalu `npm run migration:run` di dev DB → `Migration CsiRevision31794050000000 has been executed successfully`. `npm run migration:revert` lalu `migration:run` lagi → keduanya sukses.
- [ ] **Step 5:** `npx tsc --noEmit -p tsconfig.json` → exit 0. Commit `feat(csi): schema for subject photos, team per site and rater mapping`.

### Task 2: Subjek (foto, tagline, tim per site) + pemetaan — service & API

**Files:**
- Create: `services/csi-subject.service.ts` (+ spec), `services/csi-assignment.service.ts` (+ spec), `dto/subject.dto.ts`, `dto/assignment.dto.ts`, `presentation/csi-admin-subject.controller.ts`, `presentation/csi-admin-assignment.controller.ts`
- Modify: `shared/core/config/upload.config.ts:94` (preset `csiPhoto`: `createStorage('./uploads/csi')`, `createFileFilter('AVATAR')`, limit 5 MB), `csi.module.ts`

**Interfaces:**
- Consumes: entity Task 1; guard `CsiAdminGuard` + `parseCsiScope` yang ada.
- Produces (routes di bawah `csi/admin/:scope`, semua lewat `CsiAdminGuard`):
  - `GET subjects` → `CsiSubjectGroup[]` = `{ siteId; siteCode; siteName; team: CsiSubjectView|null; people: CsiSubjectView[] }[]` (people = user aktif ber-role agent ICT/HC sesuai scope, dikelompokkan per `User.siteId`).
  - `CsiSubjectView { key: string /* user:<id> | team:<id> */; kind: 'PERSON'|'TEAM'; userId: string|null; teamId: string|null; siteId: string; name: string; jobTitle: string|null; photoUrl: string|null; tagline: string|null }` — `photoUrl` orang = `profile.photoUrl ?? user.avatarUrl`.
  - `PUT subjects/:key` body `{ tagline?: string|null (≤90); jobTitle?: string|null (≤150); name?: string (tim saja, ≤100) }` → `CsiSubjectView`.
  - `POST subjects/:key/photo` multipart `file` (`MULTER_OPTIONS.csiPhoto`) → `CsiSubjectView`; hapus file lama bila diawali `/uploads/csi/` (pola `user-crud.service.ts:309`).
  - `POST subjects/teams` body `{ siteId }` → buat tim bila belum ada (nama default `Tim <site.name>`).
  - `GET periods/:id/assignments` → `{ raters: { periodRaterId; userId; fullName; department: string|null; siteId: string|null }[]; ratees: { periodRateeId; kind; name; siteId; photoUrl }[]; pairs: { periodRaterId; periodRateeId }[] }`.
  - `PUT periods/:id/assignments` body `{ pairs: { periodRaterId; periodRateeId }[] }` → sama dengan GET. Ganti total dalam satu transaksi + `lockUnlockedPeriod`.
  - `POST periods/:id/assignments/auto-same-site` → pasangan semua penilai × ratee dengan `rater.user.siteId === ratee.siteId`, kecuali diri sendiri.
  - `POST periods/:id/assignments/save-template` → tulis ulang `csi_rater_assignments` scope ini dari pasangan periode.
  - `POST periods/:id/assignments/apply-template` → isi pasangan periode dari template (hanya yang penilai & subjeknya ada di periode).
  - `CsiAssignmentService.pairsFor(periodId: string, raterUserId: string): Promise<Set<string> | null>` — `null` bila periode tidak punya pasangan sama sekali; selain itu set `periodRateeId`.

- [ ] **Step 1: Test `csi-assignment.service.spec.ts`:**
  - `rejects a pair where the rater is the ratee` → `BadRequestException` dengan pesan `'Penilai tidak bisa menilai dirinya sendiri'`.
  - `rejects a pair whose rater or ratee belongs to another period` → `BadRequestException`.
  - `autoSameSite pairs only same-site raters and ratees and skips self` → dengan 2 penilai SPJ, 1 KRW, ratee SPJ tim + 2 orang (salah satunya penilai) + KRW tim: hasil 5 pasangan (SPJ1→3, SPJ2-yang-juga-ratee→2, KRW→1).
  - `pairsFor returns null when the period has no pairs` dan `returns the ratee ids for the rater`.
  - `applyTemplate skips template rows whose subject is not in the period`.
  - (Review Focus 2) `deleting a period ratee removes its pairs` → setelah `setRatees` tanpa ratee X, `pairsFor` tidak memuat X.
- [ ] **Step 2:** jalankan → FAIL.
- [ ] **Step 3:** implementasi service + DTO (`class-validator`: `IsUUID`, `ArrayMaxSize(5000)`).
- [ ] **Step 4:** jalankan → PASS.
- [ ] **Step 5: Test `csi-subject.service.spec.ts`:** `groups people by user site and attaches the site team`; `falls back to user avatar when profile has no photo`; `rejects tagline longer than 90 characters`; `replacing a photo unlinks the previous /uploads/csi file` (mock `fs.promises.unlink`); `does not unlink an avatar outside /uploads/csi`.
- [ ] **Step 6:** FAIL → implementasi → PASS (serial, satu file).
- [ ] **Step 7:** Controller + daftar di module; `npx tsc --noEmit` → 0. Commit `feat(csi): subject photos, taglines and rater mapping API`.

### Task 3: Periode & responden memakai tim per site, profil, dan pemetaan

**Files:**
- Modify: `services/csi-period.service.ts` (`:22-25` default ICT → `LISTED`; `setTeamQuestions` → per site; `toSnapshot`/`teamSnapshot` isi `siteId`, `teamId`, `photoUrl: null`, `tagline: null`; create-from-source menyalin pasangan via `CsiAssignmentService.applyTemplate` bila tidak ada sumber), `services/csi-respondent.service.ts:179-193, 202-206, 254-257`, `dto/period.dto.ts`, `presentation/csi-admin-period.controller.ts`, frontend `lib/csiAdmin.ts:18` (`CSI_DEFAULT_MODE.ict = 'LISTED'`)
- Test: `services/csi-period.service.spec.ts`, `services/csi-respondent.service.spec.ts`

**Interfaces:**
- Consumes: `CsiAssignmentService.pairsFor`, `CsiSubjectService.viewFor(ratee: CsiPeriodRatee): Promise<{ photoUrl: string|null; tagline: string|null; jobTitle: string|null; siteId: string|null }>` (tambahkan di Task 3 ke service Task 2: override periode → master → avatar user).
- Produces:
  - `PUT csi/admin/:scope/periods/:id/team` body berubah menjadi `{ siteId: string; questionIds: string[] }` (satu tim per site; `questionIds` kosong menghapus tim site itu). Tim baru mengambil nama/foto dari `csi_teams` (buat otomatis bila belum ada).
  - `PATCH .../periods/:id/ratees/:periodRateeId` body `{ siteId?; photoUrl?: null; tagline?: string|null }` — override per periode ("Hanya untuk periode ini").
  - `CsiFormRatee` (respons `GET csi/me/periods/:id`) + `siteId: string|null; siteCode: string|null; tagline: string|null; photoUrl: string|null` (`avatarUrl` tetap untuk kompatibilitas = `photoUrl`).

- [ ] **Step 1: Test di `csi-respondent.service.spec.ts`:**
  - (Review Focus 1) `without any mapping the respondent sees every visible ratee` — sama dengan perilaku lama.
  - `with a mapping the respondent sees only mapped ratees` — 3 ratee, 1 dipetakan → form berisi 1.
  - `a listed rater with zero pairs in a mapped period is not eligible` → `listActive` tidak memuat periode.
  - `teams come first, the respondent's own site team before other sites`.
  - `form ratee exposes tagline and photo with period override winning over master`.
- [ ] **Step 2:** FAIL. **Step 3:** implementasi di `audienceFor` (filter `pairs` setelah `isRateeVisible`; `teamFirst` → sort `[isTeam desc, siteId === respondent.siteId desc, sortOrder]`). **Step 4:** PASS.
- [ ] **Step 5: Test di `csi-period.service.spec.ts`:** `new ICT period defaults to LISTED`; `setTeamQuestions creates one team ratee per site and keeps the other site's team`; `two teams of the same site are rejected` (unik index → `ConflictException`); `ratee override stores tagline only for the period`.
- [ ] **Step 6:** FAIL → implementasi → PASS. Jalankan juga spec controller yang ada untuk `period` dan `respondent` (satu per satu) → PASS.
- [ ] **Step 7:** Commit `feat(csi): team per site, period overrides and mapped respondents`.

### Task 4: Laporan, pengingat, dashboard — backend

**Files:**
- Modify: `services/csi-report.calc.ts:47-67`, `services/csi-report.service.ts:86-91`, `dto/report.dto.ts`, `presentation/csi-admin-report.controller.ts`, `services/csi-master.service.ts` + `dto/master.dto.ts` (`shortLabel` di create/update pertanyaan; disalin ke snapshot periode)
- Create: `services/csi-reminder.service.ts` (+ spec), `services/csi-dashboard.service.ts` (+ spec), `presentation/csi-admin-dashboard.controller.ts`

**Interfaces:**
- Produces:
  - `CsiReportRatee` + `siteId: string|null; photoUrl: string|null; starDistribution: [n1,n2,n3,n4,n5]` (hitungan semua jawaban bernilai dibulatkan ke 1–5); `CsiQuestionStat` + `shortLabel: string|null`.
  - `CsiReport` + `previousAverage: number|null` (rata-rata periode `PUBLISHED` sebelumnya dengan scope sama yang `endDate` < `startDate` ini dan berbagi ≥1 site).
  - `GET csi/admin/:scope/periods/:id/report?siteId=` — filter ratee & respons ke site itu (respons dihitung bila responden ber-site itu).
  - `POST csi/admin/:scope/periods/:id/reminders` body `{ userIds?: string[] }` (kosong = semua penilai yang belum mengisi) → `{ sent: number; skipped: number }`. Memakai `NotificationService.create({ userId, type: CSI_REMINDER, title: 'Pengingat survei CSI', message: 'Mohon isi "<judul>" sebelum <endDate format "d MMM yyyy">.', referenceId: '<periodId>:<userId>', link: '/csi/<periodId>' })`; `skipped` = yang kena dedup 24 jam atau sudah mengisi.
  - `GET csi/admin/:scope/dashboard` → `{ active: { periodId; title; siteId; siteCode; siteName; responses; basis; target; targetPct; average: number|null; endDate }[]; trend: { siteId; siteCode; points: { periodId; label: string /* "Q4 26" dari endDate */; average: number|null }[] }[] /* 5 periode terakhir per site */; peopleDelta: { name; photoUrl; siteId; delta: number }[] /* periode aktif vs sebelumnya, urut delta desc */; pending: { userId; fullName; department; siteId; periodId }[] /* maks 10 */; comments: { text; subjectName; siteId; createdAt }[] /* 5 terbaru */ }`. Periode multi-site dipecah per site.
- [ ] **Step 1: Test:** `report.calc`: `star distribution counts scored answers per rounded value`; `shortLabel falls back to null`. `csi-reminder.service.spec`: `sends to listed raters who have not answered`; `skips raters who already answered`; `counts deduplicated notifications as skipped` (mock `create` mengembalikan `null`/existing sesuai implementasi dedup yang ada — baca `notification.service.ts:54-136` dulu); `rejects reminders for a draft or ended period`. `csi-dashboard.service.spec`: `splits a multi-site period into one row per site`; `trend keeps the last 5 periods per site in date order`; `people delta compares with the previous period of the same site`.
- [ ] **Step 2:** FAIL (satu file per kali). **Step 3:** implementasi. **Step 4:** PASS.
- [ ] **Step 5:** `npx tsc --noEmit` → 0. Commit `feat(csi): report site filter, reminders and dashboard API`.

### Task 5: Frontend data layer + warna

**Files:**
- Modify: `features/csi/types.ts`, `api/csi.api.ts`, `hooks/useCsi.ts`, `src/lib/queryKeys.ts:58-77`
- Create: `features/csi/lib/csiTone.ts`, `lib/__tests__/csiTone.test.ts`

**Interfaces:**
- Consumes: semua route Task 2–4.
- Produces:
  - Tipe: `CsiSubjectView`, `CsiSubjectGroup`, `CsiAssignments`, `CsiPair`, `CsiDashboard` (bentuk persis Task 2/4); `CsiFormRatee` & `CsiReportRatee` + field baru.
  - Query keys: `queryKeys.csi.subjects(scope)`, `assignments(scope, periodId)`, `dashboard(scope)`; `report(scope, id, siteId?)`.
  - Hooks: `useCsiSubjects(scope)`, `useUpdateCsiSubject(scope)`, `useUploadCsiSubjectPhoto(scope)`, `useCsiAssignments(scope, periodId)`, `useSaveCsiAssignments(scope, periodId)`, `useAutoCsiAssignments`, `useSaveCsiTemplate`, `useApplyCsiTemplate`, `useSendCsiReminders(scope, periodId)`, `useCsiDashboard(scope)`, `useCsiReport(scope, id, siteId?)` (ubah). Invalidate: subjek → `subjects` + `period`; pemetaan → `assignments` + `respondents`; pengingat → `respondents`.
  - `csiTone.ts`: `type CsiTone = 'green'|'amber'|'red'|'teal'|'sky'|'brown'|'navy'|'neutral'`; `siteTone(code: string|null): CsiTone`; `scoreTone(avg: number|null): CsiTone` (null → neutral); `questionTone(index: number): CsiTone` (siklus `['sky','teal','brown','amber']`); `toneClasses(t: CsiTone): { fill: string; ink: string; soft: string; ring: string }` (Tailwind memakai `hsl(var(--ticket-<t>-hue))` dkk — cek nama var di `tokens.css` dulu); `STAR_LABELS`, `STAR_EMOJI`, `scoreWord(avg)` → `'Sangat puas'|'Puas'|'Perlu perbaikan'`.
- [ ] **Step 1: Test `csiTone.test.ts`:** `scoreTone(4.5)==='green'`, `scoreTone(4.49)==='amber'`, `scoreTone(3.99)==='red'`, `scoreTone(null)==='neutral'`; `siteTone('SPJ')==='teal'`, `siteTone('KRW')==='brown'`, `siteTone('XYZ')==='neutral'`; `questionTone(5)==='teal'`; `STAR_EMOJI[5]==='🤩'`.
- [ ] **Step 2:** FAIL → **Step 3:** implementasi → **Step 4:** PASS.
- [ ] **Step 5:** `npx tsc --noEmit -p tsconfig.app.json` (atau tsconfig yang dipakai `npm run build`; cek `package.json`) → 0. Commit `feat(csi): frontend data layer and tone helpers for revision 3`.

### Task 6: Form responden — foto sticky + reaksi bintang

**Files:**
- Create: `components/respond/SubjectPhoto.tsx`, `components/respond/StarReaction.tsx`, `components/respond/__tests__/StarReaction.test.tsx`
- Modify: `components/respond/RateeScreen.tsx`, `components/respond/QuestionField.tsx`, `components/StarRating.tsx` (dipakai di tempat lain? — `Grep` dulu; bila ya, biarkan dan buat `StarReaction` terpisah), `src/index.css` (keyframes `csi-star-pop`, `csi-emo-pop`, `csi-ripple`, `csi-kenburns`, `csi-photo-in`, `csi-cap-in` + masuk blok reduced-motion)

**Interfaces:**
- Consumes: `CsiFormRatee` (Task 5), `csiTone`.
- Produces:
  - `SubjectPhoto({ ratee: CsiFormRatee; index: number; total: number })` — kolom kiri `sticky top-[var(--csi-stick,64px)] h-[calc(100dvh-var(--csi-stick,64px)-16px)] min-h-[480px] max-h-[820px]`; di bawah `@container (max-width:780px)` menjadi statis rasio 4/3.8, maks 64vh. Isi: badge "x / n", chip kind+site (warna site), nama (`text-balance`), jabatan, tagline dengan garis aksen 28×2 px amber di atasnya (tidak dirender bila null). Foto kosong → latar warna site + inisial besar.
  - `StarReaction({ value?: number; onChange(n: number): void; label: string })` — 5 tombol `aria-label="<n> bintang"`, hover = pratinjau (emoji opacity .6 + label), klik = pop berurutan 40 ms, ripple, emoji bounce; `role="radiogroup"`, panah kiri/kanan mengubah nilai.
  - `RateeScreen` merender `grid grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] items-start` (container-type inline-size), kolom kanan **tanpa** overflow/max-height. Kartu pertanyaan diberi `data-v` → latar merah/amber/hijau. Tombol lanjut: `Lanjut · <nama berikutnya>` (nama `hidden` di container < 780 px); hint `"<n> pertanyaan wajib belum dijawab"`.
- [ ] **Step 1: Test `StarReaction.test.tsx`:** `shows the empty prompt before a value` ("Pilih bintang"); `clicking the 5th star calls onChange(5) and shows 🤩 and "Luar biasa!"`; `hover previews without calling onChange`; `ArrowLeft lowers the value`.
- [ ] **Step 2:** FAIL → **Step 3:** implementasi → **Step 4:** PASS.
- [ ] **Step 5:** Perbarui test `RateeScreen`/`SurveyFlow` yang ada bila selector berubah; jalankan masing-masing → PASS.
- [ ] **Step 6:** Commit `feat(csi): photo-led respondent screen with star reactions`.

### Task 7: Rail subjek + ringkasan selesai

**Files:**
- Create: `components/respond/SubjectRail.tsx`, `components/respond/__tests__/SubjectRail.test.tsx`
- Modify: `components/respond/SurveyFlow.tsx`, `components/respond/RateeChips.tsx` (hapus; ganti import), `components/respond/ReviewScreen.tsx`

**Interfaces:**
- Consumes: `useSurveyNavigation`, `useSurveyAnswers` yang ada.
- Produces: `SubjectRail({ ratees: CsiFormRatee[]; current: number; answeredCount(i: number): number; questionCount(i: number): number; onSelect(i: number): void })`. Avatar 42 px dengan cincin `conic-gradient` (amber parsial, hijau selesai + badge centang), nomor; hanya item aktif menampilkan nama (clamp 2 baris) + status (`Selesai` / `x/y dijawab` / `Tim`/`Individu`); pemisah setelah tim terakhir; rail `overflow-x-auto` dengan panah (`aria-label="Geser kiri|kanan"`) yang hanya tampil saat overflow; auto-center item aktif; tombol `Semua <n>` membuka popover grid (Escape/klik luar menutup). Baris atas: `Subjek <i> dari <n> · <k> selesai`, progress hijau+amber, `Tersimpan otomatis`.
- `ReviewScreen` sesudah submit: centang tergambar, "Terima kasih, <nama>!", grid subjek dengan bintang mini rata-rata, konfeti (dimatikan reduced-motion).
- [ ] **Step 1: Test `SubjectRail.test.tsx`:** `renders one button per ratee with its number`; `only the current ratee shows its name`; `a fully answered ratee shows the check badge and "Selesai"`; `"Semua 15" opens a list of all 15 and selecting one calls onSelect`; `Escape closes the popover`. (Review Focus 5) `the rail container is horizontally scrollable` → class `overflow-x-auto` pada rail.
- [ ] **Step 2:** FAIL → **Step 3:** implementasi → **Step 4:** PASS.
- [ ] **Step 5:** (Review Focus 4) Test di `SubjectPhoto`/`RateeScreen` test: `a ratee without tagline renders no quote line` dan `a ratee without photo renders initials`. FAIL → implementasi → PASS.
- [ ] **Step 6:** Commit `feat(csi): subject rail for long surveys and richer thank-you screen`.

### Task 8: Admin — tab Subjek & foto

**Files:**
- Create: `components/admin/subjects/SubjectsTab.tsx`, `SubjectCard.tsx`, `SubjectEditSheet.tsx`, `components/admin/subjects/__tests__/SubjectsTab.test.tsx`
- Modify: `pages/CsiAdminPage.tsx:18-22,49-57` (`AdminArea = 'dashboard'|'surveys'|'subjects'|'master'`, label `Dashboard`, `Survei`, `Subjek & foto`, `Master data`; default `dashboard`)

**Interfaces:**
- Consumes: `useCsiSubjects`, `useUpdateCsiSubject`, `useUploadCsiSubjectPhoto`, `csiTone`, sheet/drawer komponen yang sudah dipakai `ResponseDetailSheet`.
- Produces: grup per site (header warna site: kode, `ICT <site>`, `<n> subjek · 1 tim · <m> individu`, pill amber `<k> belum ada tagline` bila k>0, tombol `Tambah tim` bila site belum punya tim). Kartu: foto 4:3, pill Tim/Individu, nama clamp 2, jabatan, tagline atau `Tambah tagline` (amber). Klik → sheet: pratinjau memakai `SubjectPhoto` (live), dropzone (klik/drag, tolak > 5 MB dengan pesan `Ukuran foto maksimal 5 MB`), textarea tagline (counter `n/90`), input jabatan, nama (tim saja), `Batal`/`Simpan`.
- [ ] **Step 1: Test:** `groups subjects by site with a missing-tagline warning`; `typing a tagline updates the preview live`; `rejects a 6 MB file with the size message`; `saving calls the update hook with the tagline`.
- [ ] **Step 2:** FAIL → **Step 3:** implementasi → **Step 4:** PASS (+ test `CsiAdminPage` yang ada diperbarui → PASS).
- [ ] **Step 5:** Commit `feat(csi): admin tab for subject photos and taglines`.

### Task 9: Admin — matriks "Siapa menilai siapa"

**Files:**
- Create: `components/admin/assignment/matrixModel.ts`, `__tests__/matrixModel.test.ts`, `AssignmentMatrix.tsx`, `__tests__/AssignmentMatrix.test.tsx`
- Modify: `components/admin/PeriodDetail.tsx:17-32` (tab ketiga `raters` = "Penilai"), `components/admin/PeriodRaters.tsx` (pencarian user menambah penilai — pakai ulang `useCsiUserSearch`)

**Interfaces:**
- Consumes: `useCsiAssignments`, `useSaveCsiAssignments`, `useAutoCsiAssignments`, `useSaveCsiTemplate`, `useApplyCsiTemplate`, `useSetCsiRaters`.
- Produces (`matrixModel.ts`, fungsi murni):
  - `type PairKey = \`${string}|${string}\`` (`periodRaterId|periodRateeId`).
  - `toggleCells(pairs: Set<PairKey>, cells: PairKey[]): Set<PairKey>` — bila semua sel sudah ada → hapus semua; selain itu tambah semua.
  - `rowCells(a: CsiAssignments, raterId): PairKey[]`, `colCells(a, rateeId)`, `siteCells(a, siteId)` — semuanya membuang diri sendiri (`rater.userId === ratee.userId`).
  - `stats(a, pairs) → { raters: number; subjects: number; teams: number; people: number; pairs: number; cross: number }`.
- UI: stat 4 kartu (sky/teal/green/amber), toolbar (cari penilai = nama/dept, filter site, legenda), aksi `Isi otomatis: sama site`, `Kosongkan`, `Salin dari template`, `Simpan sebagai template`, `Simpan` (primary, aktif bila ada perubahan). Tabel: kolom dikelompokkan per site ICT (header warna site + `✓ Penilai <site>`), baris dikelompokkan per site penilai, header & kolom nama sticky; sel hijau = sama site, amber = lintas site, abu terkunci = diri sendiri (`title="Tidak bisa menilai diri sendiri"`); `role="checkbox"` + `aria-checked` + `aria-label="<penilai> menilai <subjek>"`.
- [ ] **Step 1: Test `matrixModel.test.ts`:** `toggleCells adds all when any is missing and removes all when all present`; `rowCells skips self`; `siteCells pairs raters of the site with subjects of the site only`; `stats counts cross-site pairs`.
- [ ] **Step 2:** FAIL → **Step 3:** implementasi → **Step 4:** PASS.
- [ ] **Step 5: Test `AssignmentMatrix.test.tsx`:** `self cell is not clickable`; `clicking a rater name toggles the whole row`; `Simpan sends the pairs`; `search filters raters by department`.
- [ ] **Step 6:** FAIL → implementasi → PASS; test `PeriodDetail` yang ada → PASS.
- [ ] **Step 7:** Commit `feat(csi): rater-to-subject matrix grouped by ICT site`.

### Task 10: Admin — laporan & status responden

**Files:**
- Create: `components/admin/report/ReportHero.tsx`, `SubjectScoreCard.tsx`, `SubjectDetailSheet.tsx`, `ScoreHeatmap.tsx`, `report/__tests__/ReportHero.test.tsx`
- Modify: `components/admin/PeriodReport.tsx` (susun ulang; hapus chip per dimensi), `ReportSummary.tsx` (hapus bila tak terpakai), `components/admin/RespondentStatus.tsx`, `components/admin/questions/QuestionCard.tsx` (input `Label singkat (untuk laporan)`, maks 40, placeholder teks lengkap)
- Test: `components/admin/__tests__/PeriodReport.test.tsx`, `RespondentStatus.test.tsx` (perbarui)

**Interfaces:**
- Consumes: `useCsiReport(scope, id, siteId?)`, `useCsiRespondents`, `useSendCsiReminders`, `csiTone`.
- Produces:
  - `ReportHero({ report: CsiReport })`: cincin skor (warna `scoreTone`, `toFixed(2)` koma), `scoreWord`, indeks, tren vs `previousAverage` (`naik|turun x,xx dari periode lalu`; disembunyikan bila null); kartu Jawaban masuk (`x / y`, `%` dari basis, hijau bila ≥ target); `Paling kuat`/`Perlu perhatian` = pertanyaan dengan rata-rata tertinggi/terendah lintas subjek (pakai `shortLabel ?? name`).
  - Filter site (segmented: `Semua site` + kode site periode).
  - Grid `SubjectScoreCard` urut rata-rata desc (medali #1 emas), badge site, badge skor, indeks, bar `starDistribution`, pill terkuat (+ terlemah bila < 4,5). Klik → `SubjectDetailSheet` (foto, cincin, bar per pertanyaan berwarna `questionTone`, sebaran bintang, komentar). Tab `Kartu | Perbandingan` → `ScoreHeatmap` (header = label singkat, `title` = teks lengkap).
  - `RespondentStatus`: hero cincin `x/y sudah mengisi`, kalimat `Butuh <n> jawaban lagi untuk mencapai target <pct>%` / `Target tercapai`, garis target, kartu per site; daftar tab `Semua|Belum|Sudah` (dengan jumlah), filter site, cari; urut belum dulu; tombol `Ingatkan` per baris → `Pengingat terkirim`; header `Ingatkan semua yang belum` → toast `Pengingat terkirim ke <sent> orang` (+ `, <skipped> dilewati` bila >0). Mode OPEN: tombol pengingat disembunyikan (tak ada daftar penilai).
- [ ] **Step 1: Test `ReportHero.test.tsx`:** `shows 4,65 with "Sangat puas" in green`; `shows the strongest and weakest question by short label`; `hides the trend when there is no previous period`.
- [ ] **Step 2:** FAIL → **Step 3:** implementasi → **Step 4:** PASS.
- [ ] **Step 5:** Perbarui `PeriodReport.test.tsx` (`site filter refetches with siteId`, `clicking a card opens the detail sheet`) dan `RespondentStatus.test.tsx` (`not-yet rows come first`, `Ingatkan sends one user id`, `OPEN mode hides reminders`). FAIL → implementasi → PASS (satu file per kali).
- [ ] **Step 6:** Commit `feat(csi): readable report, respondent status and reminders`.

### Task 11: Admin — Dashboard CSI

**Files:**
- Create: `components/admin/dashboard/CsiDashboard.tsx`, `dashboard/__tests__/CsiDashboard.test.tsx`
- Modify: `pages/CsiAdminPage.tsx` (area `dashboard`)

**Interfaces:**
- Consumes: `useCsiDashboard(scope)`, `useSendCsiReminders`, `csiTone`.
- Produces: tab `Periode aktif | Tren`. Periode aktif: 4 stat (Survei aktif, Jawaban masuk `x / y`, Skor rata-rata + delta, `<n> site` belum capai target — kartu amber), panel `Target per site` (cincin %, `x/y penilai · target 90%`, `Skor`, pill `Tercapai`/`sisa <d> hari`), `Belum mengisi — paling mendesak` (+ ingatkan), `Komentar terbaru`. Tren: grafik garis SVG per site (warna site, sumbu 4,00–5,00 bila semua ≥ 4; selain itu 1–5), legenda, `Perubahan per orang` (pill hijau `+x,xx` / merah `−x,xx`). Kosong → `Belum ada survei aktif.`
- [ ] **Step 1: Test:** `shows one target card per active site`; `flags sites below target in the attention card`; `empty state when there is no active period`; `trend tab draws one line per site`.
- [ ] **Step 2:** FAIL → **Step 3:** implementasi → **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(csi): CSI dashboard with per-site targets and trend`.

### Task 12: Verifikasi menyeluruh

- [ ] **Step 1:** Backend: jalankan setiap spec CSI satu per satu (`ls src/modules/csi/**/*.spec.ts` lalu loop serial) → semua PASS. `npx tsc --noEmit` → 0.
- [ ] **Step 2:** Frontend: jalankan per file di `features/csi/**/__tests__` secara serial → semua PASS. `npm run build` → sukses.
- [ ] **Step 3:** Jalankan app (`npm start` di root; frontend :4050, backend :5050). Dengan Playwright, login admin yang punya `csi_admin_ict`:
  - Subjek: upload foto + tagline untuk 1 orang dan 1 tim.
  - Buat periode SPJ+KRW, `Isi otomatis: sama site`, centang 1 lintas site, `Simpan`, publish.
  - Login sebagai penilai: form menampilkan hanya subjek terpetakan, foto sticky saat scroll (satu scrollbar), rail rapi; isi & kirim.
  - Laporan: filter site, kartu, drawer, heatmap. Status: `Ingatkan` → notifikasi muncul di akun penilai.
  - Dashboard: kartu target per site.
  - Lebar 1440, 820, 390, 360: `document.documentElement.scrollWidth - clientWidth === 0` di semua layar CSI.
- [ ] **Step 4:** Screenshot tiap layar ke `scratch/csi-r3-*.png`, bandingkan dengan mockup; catat selisih yang disengaja.
- [ ] **Step 5:** Commit perbaikan terakhir bila ada.
