# CSI HC — Fungsi Pelayanan, Viewer Anonim, Report per Layanan, Template Penugasan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambah fungsi pelayanan per PIC HC, header kartu penilaian yang ringkas, report per layanan untuk penanggung jawab layanan, viewer hasil anonim untuk orang yang dinilai, statistik belum-menilai per departemen, dan template penugasan per lokasi (Semarang dari Excel).

**Architecture:** NestJS + TypeORM (`apps/backend/src/modules/csi`), React + React Query (`apps/frontend/src/features/csi`). Semua perubahan skema lewat migrasi additive. Data periode tetap snapshot (fungsi pelayanan disalin ke `csi_period_ratees`). Akses baru (penanggung jawab layanan, orang yang dinilai) lewat endpoint `csi/me/...` dengan cek di service, bukan `CsiAdminGuard`.

**Tech Stack:** NestJS 10, TypeORM/Postgres, ExcelJS, jest (`--runInBand`), React 18, vitest, Tailwind.

**Spec:** memory `csi-hc-service-function-decisions.md` (grilling 2026-11-09) + Excel `C:\Users\IT12\Downloads\CSI HC 2026 (semarang).xlsx`.

## Global Constraints

- Tes SERIAL: backend `npx jest --runInBand <file>`, frontend `npx vitest run --pool=forks <file>`; satu file per satu.
- Migrasi hanya additive (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`); tidak ada DROP/UPDATE/DELETE di `up`.
- ICT tidak disentuh. Data/periode lama tidak berubah.
- Viewer orang dinilai: tampil hanya jika jumlah penilai ≥ `CSI_SELF_RESULT_MIN_RATERS = 3`; live (tanpa menunggu periode tutup); komentar acak tanpa tanggal & tanpa nama/departemen.
- Nama penilai: admin HC semua; penanggung jawab layanan hanya layanannya (layar + Excel), baris dirinya sendiri anonim; PDF tidak pernah memuat nama.
- Statistik belum menilai: default rekap per departemen; daftar nama hanya untuk admin HC (`canAdminCsiScope`).
- Fungsi pelayanan: teks bebas, hanya di-trim, maks 150 karakter.
- Template: Sinkronkan hanya MENAMBAH (PIC/penilai); PIC tanpa penilai dilewati; penilai dicocokkan by nama (case/whitespace-insensitive), ambigu = tidak dicocokkan; duplikat penilai per PIC dihitung sekali.
- Copy UI Bahasa Indonesia. Fungsi < 50 baris, file < 800 baris.
- Dummy data hanya DB lokal (`idesk_csi_demo`), tidak pernah prod.

## Review Focus

1. Penanggung jawab layanan yang juga PIC dinilai membuka report layanannya → baris dirinya tanpa nama penilai, juga di Excel (test di Task 4).
2. Orang dinilai dengan 2 penilai membuka viewer → tidak ada skor/komentar, hanya pesan menunggu (test di Task 5).
3. Nama penilai di Excel cocok ke 2 akun dengan nama sama → ditandai ambigu, tidak dipasangkan (test di Task 6).
4. Sinkronkan template ke periode yang sudah ada jawaban → tidak menghapus penilai/pasangan, tidak error lock (test di Task 7).
5. User biasa (bukan penanggung jawab, bukan admin) memanggil endpoint report layanan → 403 (test di Task 4).

---

### Task 1: Fungsi pelayanan di data PIC + snapshot periode

**Files:**
- Create: `apps/backend/src/migrations/1794190000000-CsiServiceFunctionAndTemplates.ts` (+ `.spec.ts`) — dipakai juga oleh Task 3 & 6 (tabel ditambahkan di task itu ke file yang sama).
- Modify: `entities/csi-pic.entity.ts`, `entities/csi-period-ratee.entity.ts`, `org/csi-org.service.ts` (`CsiPicView`, `picView`, `updatePic`), `presentation/csi-admin-org.controller.ts` (`PATCH pics/:id`), `dto/pic.dto.ts`, `services/csi-period.service.ts` (`picSnapshot`, `setPics`, `RateeSnapshot`), `services/csi-respondent.service.ts` (`formProfile`), `services/csi-report.service.ts` (`getHcRecap` pics), `org/csi-hc-report.calc.ts` (`CsiHcPic`, `CsiRecapRow`), `services/csi-export.answers.ts` / hc sheet (kolom "Fungsi Pelayanan").
- Frontend: `types.ts` (`CsiFormRatee.serviceFunction`), `hcTypes.ts`, `components/admin/hc/PicsTab.tsx` (kolom + edit inline).

**Interfaces:**
- Produces: kolom `serviceFunction varchar(150) NULL` di `csi_pics` & `csi_period_ratees`; `CsiPicView.serviceFunction: string | null`; form ratee `serviceFunction: string | null`; `CsiHcPic.serviceFunction`, `CsiRecapRow.serviceFunction` (level `pic`).
- `CsiOrgService.updatePic(scope, id, { isActive?: boolean; serviceFunction?: string | null }): Promise<CsiPicView>` (menggantikan `setPicActive`, controller memanggil ini).

- [ ] Tes migrasi: `up` mengandung `ADD COLUMN IF NOT EXISTS "serviceFunction" varchar(150) NULL` untuk kedua tabel dan tidak cocok `/DROP|DELETE FROM|^\s*UPDATE/m`. Jalankan → FAIL.
- [ ] Tulis migrasi + kolom entity. Tes → PASS.
- [ ] Tes `csi-period.service.spec.ts`: `setPics` dengan PIC `serviceFunction: 'People & Organization Development'` menyimpan ratee dengan nilai sama; edit PIC sesudahnya tidak mengubah ratee. FAIL → implement di `picSnapshot` + mapping save → PASS.
- [ ] Tes `csi-respondent.service.spec.ts`: `getForm` mengembalikan `serviceFunction` ratee PIC. FAIL → tambah di `formProfile` → PASS.
- [ ] Tes `updatePic` trim (`'  X  '` → `'X'`, `''` → `null`, >150 → 400). Implement → PASS.
- [ ] Frontend PicsTab: kolom "Fungsi pelayanan" bisa diedit (vitest render + submit memanggil `CsiHcApi.updatePic` dengan `serviceFunction`).
- [ ] `npx tsc --noEmit` backend & frontend bersih. Commit `feat(csi): service function on HC PICs, snapshotted per period`.

### Task 2: Header kartu penilaian ringkas

**Files:**
- Create: `apps/frontend/src/features/csi/components/respond/SubjectHeader.tsx`
- Modify: `components/respond/RateeScreen.tsx` (ganti `SubjectPhoto` + grid dua kolom dengan `SubjectHeader` di atas form, satu kolom), `components/respond/__tests__/SubjectPhoto.test.tsx` → `SubjectHeader.test.tsx`. `SubjectPhoto.tsx` dihapus jika tidak ada pemakai lain (cek `Grep SubjectPhoto|PHOTO_STACKED|PHOTO_STICKY`).

**Interfaces:**
- `SubjectHeader({ ratee, index, total, scrollTarget }: SubjectPhotoProps)`; `kindText` dipindah ke sini (tetap diekspor).

Layout: baris flex — avatar bulat 96px (foto atau inisial berwarna `siteTone`), di sebelahnya badge `kindText` + `n / total`, nama (`ScreenHeading`, 20–26px), jabatan, chip fungsi pelayanan (jika ada), tagline. Di HP avatar 72px. Form di bawahnya lebar penuh, `max-w-3xl mx-auto`.

- [ ] Tes: render ratee dengan `serviceFunction` → teks tampil; tanpa `serviceFunction` → chip tidak ada; tanpa foto → inisial. FAIL → implement → PASS.
- [ ] Jalankan `SurveyFlow.test.tsx`, `SurveyFlowSubmit.test.tsx` (serial) → PASS (perbaiki selector `csi-subject-photo` → `csi-subject-header`).
- [ ] Commit `feat(csi): compact subject header with service function on the rating card`.

### Task 3: Penanggung jawab report per layanan

**Files:**
- Create: `entities/csi-service-report-owner.entity.ts` (`csi_service_report_owners`: id, scope, serviceCode, userId, createdAt; unique `(scope, serviceCode, userId)`), `services/csi-report-access.service.ts` (+ spec), `presentation/csi-admin-report-owner.controller.ts`.
- Modify: migrasi Task 1 (tambah tabel), `csi.module.ts`, frontend `api/csiHc.api.ts`, `hooks/useCsiHc.ts`, `components/admin/SettingsPanel.tsx` (+ `hc/ReportOwnersTab.tsx` baru).

**Interfaces:**
- `CsiReportAccessService.servicesFor(userId: string, scope: ServiceScope): Promise<{ admin: boolean; services: string[] }>` — admin (`canAdminCsiScope`) → `{ admin: true, services: ['HCC','HCD','HCS'] }`; selain itu kode layanan dari tabel owner.
- `assertService(userId, scope, serviceCode): Promise<{ admin: boolean }>` → 403 `'Anda bukan penanggung jawab report layanan ini'`.
- Admin endpoints (`CsiAdminGuard`): `GET csi/admin/:scope/report-owners`, `PUT csi/admin/:scope/report-owners/:serviceCode` body `{ userIds: string[] }`.
- `GET csi/me/report-access?scope=HC` → `{ admin, services }` (frontend memakai untuk menampilkan menu).

- [ ] Tes `servicesFor`: HC_ADMIN → admin; user owner HCD → `['HCD']`; user lain → `[]`. `assertService` user lain → ForbiddenException. FAIL → implement → PASS.
- [ ] Tes controller PUT mengganti set owner layanan (idempoten). → PASS.
- [ ] Frontend: tab "Penanggung jawab report" (pilih user per layanan, pencarian user existing). Vitest render + simpan.
- [ ] Commit `feat(csi): HC service report owners`.

### Task 4: Report layanan untuk penanggung jawab (+ statistik per departemen)

**Files:**
- Create: `services/csi-service-report.service.ts` (+ spec), `presentation/csi-me-report.controller.ts`, frontend `pages/CsiServiceReportPage.tsx`, route `csi/report/:serviceCode` di `routes/AppRoutes.tsx` (semua layout yang punya `csi`).
- Modify: `services/csi-report.service.ts` (`getRespondents` + `pendingByDepartment`), `org/csi-hc-report.calc.ts` (filter layanan), `components/admin/RespondentStatus.tsx` (rekap departemen default, tombol "Tampilkan nama" admin), `csi.module.ts`.

**Interfaces:**
- `CsiServiceReportService.get(userId, periodId, serviceCode): Promise<CsiServiceReport>` dengan `CsiServiceReport = CsiHcRecap & { period; serviceCode; pending: Array<{ department: string; pending: number; total: number }> }`; `services` hanya baris layanan itu; `respondents` hanya rating ke PIC layanan itu; untuk PIC yang `userId === viewer` (bukan admin) field `name/division/department/bagian` responden dihapus (`name: 'Anonim'`).
- `exportWorkbook(userId, periodId, serviceCode): Promise<{ filename; buffer }>` — sheet rekap + jawaban, aturan anonim sama.
- Endpoints: `GET csi/me/hc/periods` (periode HC yang bisa dilihat), `GET csi/me/hc/periods/:id/services/:serviceCode/report`, `.../export`.
- `getRespondents` menambah `pendingByDepartment: Array<{ department: string; pending: number; total: number }>` (department dari `orgDepartment` direktori, fallback departemen akun, fallback `'Tanpa departemen'`).

- [ ] Tes: owner HCD minta HCC → 403; user non-owner → 403.
- [ ] Tes: owner HCD yang juga PIC dinilai → baris respondents untuk rating ke dirinya `name === 'Anonim'` dan tanpa division/department; rating ke PIC lain tetap bernama. Admin → semua bernama.
- [ ] Tes: report hanya berisi PIC layanan diminta, semua lokasi.
- [ ] Tes `pendingByDepartment` mengelompokkan dan menghitung total per departemen; tidak ada `fullName` di objek.
- [ ] Implement → PASS (serial per file).
- [ ] Frontend halaman report layanan: kartu ringkas, tabel PIC (fungsi pelayanan, rata-rata per lokasi, dimensi), tabel jawaban per penilai, rekap "belum menilai per departemen", tombol Excel. Menu "Report CSI layanan" di header user muncul jika `report-access.services.length`.
- [ ] RespondentStatus admin: default tabel departemen; toggle "Tampilkan nama" memperlihatkan daftar lama.
- [ ] Commit `feat(csi): per-service HC report for service owners with anonymous self rows`.

### Task 5: Viewer hasil untuk orang yang dinilai

**Files:**
- Create: `services/csi-self-result.service.ts` (+ spec), frontend `pages/CsiMyResultsPage.tsx`, route `csi/hasil-saya`.
- Modify: `presentation/csi-me.controller.ts` (`GET csi/me/results`), `csi.constants.ts` (`CSI_SELF_RESULT_MIN_RATERS = 3`), `pages/CsiSurveyListPage.tsx` (kartu tautan "Hasil penilaian saya" jika ada).

**Interfaces:**
- `CsiSelfResultService.list(userId): Promise<CsiSelfResult[]>`; `CsiSelfResult = { periodId; title; startDate; endDate; status; serviceFunction: string|null; raters: number; ready: boolean; average: number|null; dimensions: Array<{ label: string; average: number }>; comments: string[] }`. Ratee milik user: `csi_period_ratees.userId = userId` (PIC tertaut atau person), periode PUBLISHED, kind PERSON. `ready = raters >= 3`; jika tidak ready → `average null`, `dimensions []`, `comments []`. Komentar diacak (Fisher–Yates, `Math.random` diinjeksi untuk tes).

- [ ] Tes: 2 penilai → `ready false`, tanpa skor/komentar. 3 penilai → rata-rata benar (mis. 4,5,3 → 4.00), komentar teks saja tanpa nama/tanggal.
- [ ] Tes: respons tidak pernah membawa `respondentName` (cek `JSON.stringify(result)` tidak mengandung nama penilai fixture).
- [ ] Implement → PASS.
- [ ] Frontend halaman: per periode kartu skor + bar per dimensi + komentar; state menunggu "Hasil tampil setelah minimal 3 penilai mengisi (saat ini N)". Vitest kedua state.
- [ ] Commit `feat(csi): anonymous self results for rated people`.

### Task 6: Template penugasan per lokasi (model, impor Excel, seed Semarang)

**Files:**
- Create: `entities/csi-assignment-template.entity.ts` (`csi_assignment_templates`: id, scope, locationCode, name, timestamps; unique `(scope, locationCode)`), `entities/csi-assignment-template-pic.entity.ts` (id, templateId FK cascade, area, picName, jobTitle, serviceCode, serviceFunction, picId nullable FK csi_pics SET NULL, sortOrder), `entities/csi-assignment-template-rater.entity.ts` (id, templatePicId FK cascade, raterName, raterJobTitle, userId nullable, unique `(templatePicId, raterName)`), `org/csi-template-excel.ts` (parser), `org/csi-name-match.ts` (+ spec), `services/csi-assignment-template.service.ts` (+ spec), `presentation/csi-admin-template.controller.ts`, `org/templates/hc-smg-2026.json` (hasil konversi Excel, dibuat sekali lewat script `scripts/csi-template-from-xlsx.ts`).
- Modify: migrasi Task 1, `csi.module.ts`.

**Interfaces:**
- `parseTemplateWorkbook(buffer): Promise<TemplateDraft>`; `TemplateDraft = { pics: Array<{ area: string; picName: string; jobTitle: string|null; serviceFunction: string|null; raters: Array<{ name: string; jobTitle: string|null }> }> }`. Header baris 1: `Area`, `Nama Lengkap Karyawan (HC)`, `Jabatan`, `FUNGSI PELAYANAN`, `Nama Lengkap Penilai`, `Jabatan (akan terisi otomatis)`. Baris lanjutan (nama PIC kosong) milik PIC terakhir; area terisi mewarisi; `#N/A` = null; fungsi pelayanan di-trim; penilai duplikat per PIC dibuang.
- Area → serviceCode: `HC Development`→HCD, `HC Comben`→HCC, `HC Services`→HCS (konstanta `CSI_TEMPLATE_AREA_SERVICE`).
- `normalizeName(s) = collapse(s).toUpperCase().replace(/[.,]/g,'')`; `matchByName(name, candidates): { id } | 'ambiguous' | null`.
- Service: `list(scope)`, `get(scope, id): TemplateView` (PIC + penilai + status cocok: `picMatched`, `raterStatus: 'ok'|'no-account'|'ambiguous'|'not-found'`), `importExcel(scope, locationCode, buffer, commit)` (dry-run report dulu; commit = upsert merge: tambah PIC/penilai baru, update fungsi pelayanan/jabatan, tidak menghapus), `loadBundled(scope, 'SMG')` (idempoten), CRUD: `addPic`, `updatePic`, `removePic`, `addRater`, `removeRater`. PIC dicocokkan ke `csi_pics` by nama; saat cocok, `csi_pics.serviceFunction` ikut diisi jika kosong.
- Endpoints `csi/admin/:scope/templates` (`GET`, `GET :id`, `POST bundled/:location`, `POST :location/import?commit=`, `POST :id/pics`, `PATCH pics/:picId`, `DELETE pics/:picId`, `POST pics/:picId/raters`, `DELETE raters/:raterId`).

- [ ] Tes parser dengan workbook buatan ExcelJS kecil (meniru struktur Semarang: area hanya di baris pertama, `#N/A`, penilai ganda, PIC tanpa penilai) → hasil sesuai.
- [ ] Tes `matchByName`: beda kapital/spasi/titik cocok; dua kandidat → `'ambiguous'`.
- [ ] Tes `loadBundled` dua kali → jumlah PIC 19 tetap, tidak duplikat; RARA → serviceFunction `People & Organization Development`, serviceCode HCD; 4 PIC (JINGGA, KUSMANTO, AGUS SULISTYONO, WAHYU) tanpa penilai; CHANDRA jabatan `HSE OFFICER` (jabatan penilai diambil dari sheet `Karyawan SMG` saat konversi).
- [ ] Generate `hc-smg-2026.json` via script dari file Excel user; commit JSON (tanpa file Excel).
- [ ] Implement → PASS.
- [ ] Commit `feat(csi): per-location HC assignment templates with Semarang bundled`.

### Task 7: Terapkan template ke periode (buat baru / masukkan / sinkron)

**Files:**
- Modify: `services/csi-assignment-template.service.ts` (+ spec), `presentation/csi-admin-template.controller.ts`, `services/csi-period.service.ts` (helper add-only untuk pasangan, reuse `setPics` hanya untuk periode baru).

**Interfaces:**
- `applyToPeriod(scope, templateId, periodId, commit): Promise<ApplyReport>`; `ApplyReport = { picsAdded; picsSkippedNoRaters: string[]; picsUnmatched: string[]; ratersAdded; pairsAdded; ratersNoAccount: string[]; ratersAmbiguous: string[]; ratersNotFound: string[]; committed }`. Add-only: PIC belum ada di periode → ratee baru (snapshot, dimensi = dimensi HC template aktif); penilai → `csi_period_raters` + `csi_period_rater_ratees` jika belum ada. Tidak memakai `lockUnlockedPeriod` (boleh saat ada jawaban) tapi `lockPeriodRow`. Set `respondentMode LISTED`, `pairMode CUSTOM` hanya jika periode belum punya pasangan.
- `createPeriodFromTemplate(scope, templateId, { title, startDate, endDate }, actorId)` → membuat periode HC draft untuk site lokasi template (via `CsiPeriodService.create`), lalu `applyToPeriod(commit=true)`. Return `{ periodId, report }`.
- Endpoints: `POST templates/:id/apply/:periodId?commit=`, `POST templates/:id/create-period`.

- [ ] Tes: apply ke periode kosong → pasangan sesuai template; PIC tanpa penilai di `picsSkippedNoRaters`; penilai tanpa akun di `ratersNoAccount`.
- [ ] Tes: apply kedua kali → `pairsAdded 0` (idempoten); periode dengan jawaban & pasangan existing → pasangan lama tetap ada.
- [ ] Tes: penilai tanpa akun kemudian dibuat akun (userId cocok by nama/NIK) → apply ulang menambahkannya.
- [ ] Implement → PASS. Commit `feat(csi): apply assignment template to a period (create or add-only sync)`.

### Task 8: UI editor template

**Files:**
- Create: `components/admin/hc/templates/TemplatesTab.tsx`, `TemplateEditor.tsx`, `TemplateApplyDialog.tsx`, `TemplateImportDialog.tsx` (+ tes vitest).
- Modify: `components/admin/SettingsPanel.tsx` (tab "Template penugasan" HC), `api/csiHc.api.ts`, `hooks/useCsiHc.ts`, `hcTypes.ts`.

Isi: daftar template per lokasi + tombol "Muat template Semarang" (jika belum ada); editor: grup per layanan → PIC (nama, jabatan, fungsi pelayanan editable) → daftar penilai dengan badge status (Cocok / Belum punya akun / Ambigu / Tidak ditemukan), tambah penilai via pencarian user, hapus; tambah PIC; impor Excel (dry run → konfirmasi). Dialog "Gunakan": buat survei baru (judul + tanggal) atau pilih survei HC yang ada → pratinjau `ApplyReport` → Terapkan.

- [ ] Vitest: editor menampilkan badge status; dialog apply menampilkan pratinjau lalu memanggil commit.
- [ ] Commit `feat(csi): assignment template editor UI`.

### Task 9: Verifikasi, demo lokal, PDF

- [ ] Jalankan seluruh spec CSI backend satu per satu (`ls src/modules/csi/**/*.spec.ts` → loop serial) dan tes frontend CSI satu per satu; `npx tsc --noEmit` dua app; lint file yang disentuh.
- [ ] DB lokal `idesk_csi_demo` (backend :5150, vite :4150): jalankan migrasi, muat template Semarang, buat periode dari template, isi dummy (≥40 jawaban, responden rekaan, label DATA DUMMY), tunjuk penanggung jawab HCD.
- [ ] Screenshot Playwright: kartu penilaian baru, viewer hasil (state <3 & ≥3), report layanan (owner + baris diri anonim), statistik per departemen, editor template + dialog apply.
- [ ] Gabung jadi PDF `C:\Users\IT12\Downloads\(DUMMY) CSI HC fungsi pelayanan.pdf`.
- [ ] Tidak commit dummy/screenshot. Laporan ke user dengan bukti.
