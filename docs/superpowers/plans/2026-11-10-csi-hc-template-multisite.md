# CSI HC Template Multi-site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Template penugasan HC dipakai untuk 4 lokasi dan 2 format Excel, penilai bisa diperbaiki/dikonfirmasi dengan saran akun, tim custom (anggota + foto), Orang & foto dan Penilai bersumber dari template, survei HC multi-site.

**Architecture:** Template (`csi_assignment_template*`) tetap satu sumber kebenaran. Parser Excel menghasilkan `CsiTemplateDraft` netral-format; service impor melakukan klasifikasi identitas → diff → commit dengan resolusi. Tim custom memperluas `csi_teams` (kind SITE/CUSTOM + anggota). Apply mengubah template → ratee PERSON (PIC) / TEAM (tim custom) dan mendukung banyak template per survei.

**Tech Stack:** NestJS + TypeORM (Postgres), exceljs, Jest (`--runInBand`); React + TanStack Query + Vitest; `fflate` (baru, frontend) untuk ZIP foto.

**Spec:** `docs/superpowers/specs/2026-11-10-csi-hc-template-multisite-design.md`

## Global Constraints

- Lokasi: `SMG`, `KRW`, `SPJ`, `JTB` saja (`LOCATION_NAMES` backend + frontend dari satu konstanta per sisi).
- Layanan: `HCD`, `HCC`, `HCS`; grup header matriks `HC Services`→HCS, `Comben`→HCC, `HC Development`→HCD.
- Pemisah fungsi pelayanan gabungan: `" · "`. Teks DB maks 150 karakter (potong + problem bila lebih).
- NIK dinormalisasi lewat `normalizeNik` yang sudah ada (`org/csi-org.constants.ts`).
- Status penilai (string persis): `confirmed`, `ok`, `ambiguous`, `no-account`. Label UI: "Terkonfirmasi", "Cocok otomatis", "Nama ganda", "Belum punya akun".
- Hasil diri/tim tampil hanya bila penilai ≥ `CSI_SELF_RESULT_MIN_RATERS` (3).
- Migrasi additive + `IF NOT EXISTS`; timestamp migrasi `1794210000000`.
- Semua copy UI Bahasa Indonesia. Tes SERIAL: backend `npx jest --runInBand <file>`, frontend `npx vitest run --pool=forks <file>`, satu file per perintah.
- Jangan seed ke prod; dummy hanya DB lokal.
- Template/teams endpoints HC-only (`assertHcScope`).

## Review Focus

1. Excel Comben dengan NIK ganda / baris kosong bernilai `0` di semua kolom → penilai digabung, baris kosong dilewati (Task 4 test `merges duplicate NIK` & `skips zero rows`).
2. Impor ulang file satu layanan (HCC) dengan prune aktif tidak menghapus PIC HCD/HCS (Task 6 test `prune limited to services in file`).
3. Penilai yang sudah dikonfirmasi lalu akunnya dinonaktifkan → status kembali dihitung dari NIK/nama, bukan tetap `confirmed` (Task 2 test `inactive pinned account falls back`).
4. PIC tim custom yang anggotanya juga penilai tim itu → tidak menilai timnya sendiri (Task 9 test `member never rates own team`).
5. Unggah foto massal dengan nama file beda kapitalisasi/ekstensi/spasi ganda (`rara  kurnia.JPG`) → tetap cocok; nama ambigu tidak dipasang otomatis (Task 15 test `matches normalised file names`).

---

### Task 1: Skema — penilai (NIK, konfirmasi), PIC template (NIK, tim), tim custom + anggota

**Files:**
- Create: `apps/backend/src/migrations/1794210000000-CsiHcTemplateMultisite.ts` (+ `.spec.ts`, pola `1794200000000-CsiIctServiceFunction.spec.ts`)
- Create: `apps/backend/src/modules/csi/entities/csi-team-member.entity.ts`
- Modify: `entities/csi-assignment-template-rater.entity.ts`, `entities/csi-assignment-template-pic.entity.ts`, `entities/csi-team.entity.ts`, `entities/csi-period-ratee.entity.ts`, `csi.constants.ts`, modul CSI (daftarkan entity)

**Interfaces — Produces:**
- `CsiAssignmentTemplateRater` + `raterNik: string | null` (varchar 20), `confirmedAt: Date | null`, `confirmedById: uuid | null`.
- `CsiAssignmentTemplatePic` + `picNik: string | null`, `teamId: uuid | null` (FK `csi_teams`, ON DELETE SET NULL). PIC baris tim: `teamId` terisi, `picId` null.
- `enum CsiTeamKind { SITE = 'SITE', CUSTOM = 'CUSTOM' }`; `CsiTeam` + `kind` (default SITE), `serviceCode varchar(10) null`. Unique lama `UQ_csi_teams_scope_site` diganti partial unique `(scope, siteId) WHERE kind='SITE'`.
- `CsiTeamMember { id, teamId (CASCADE), userId uuid|null (SET NULL), name varchar(150), nik varchar(20)|null, sortOrder int }`, unique `(teamId, name)`.
- `CsiPic` + `tagline varchar(90) null`.
- Index ratee `UQ_csi_period_ratees_team_site` diganti `UQ_csi_period_ratees_team` `(periodId, teamId) WHERE kind='TEAM'`.

- [ ] **Step 1:** Tulis spec migrasi: `up` berisi `ADD COLUMN IF NOT EXISTS "raterNik"`, `"confirmedAt"`, `"confirmedById"`, `"picNik"`, `"teamId"`, `"kind" varchar(10) NOT NULL DEFAULT 'SITE'`, `CREATE TABLE IF NOT EXISTS "csi_team_members"`, `DROP CONSTRAINT IF EXISTS "UQ_csi_teams_scope_site"`, `CREATE UNIQUE INDEX ... "UQ_csi_teams_site_kind" ... WHERE "kind" = 'SITE'`, `DROP INDEX IF EXISTS "UQ_csi_period_ratees_team_site"`, `CREATE UNIQUE INDEX "UQ_csi_period_ratees_team" ON "csi_period_ratees" ("periodId","teamId") WHERE "kind" = 'TEAM'`; `down` membalik semuanya.
- [ ] **Step 2:** `npx jest --runInBand src/migrations/1794210000000-CsiHcTemplateMultisite.spec.ts` → FAIL (file belum ada).
- [ ] **Step 3:** Implement migrasi + entity.
- [ ] **Step 4:** Spec lulus; `npx tsc --noEmit -p apps/backend` bersih; jalankan migrasi di DB lokal (`npm run migration:run` di backend) sukses.
- [ ] **Step 5:** Commit `feat(csi): schema for template rater confirmation, NIK and custom teams`.

### Task 2: Status penilai 4 nilai + pencocokan NIK

**Files:** Modify `org/csi-template-view.ts`, `org/csi-template-view.spec.ts`, `services/csi-assignment-template.service.ts` (`activeAccounts` ikut `employeeId`, `siteId`).

**Interfaces:**
- Produces: `type CsiTemplateRaterStatus = 'confirmed' | 'ok' | 'ambiguous' | 'no-account'`; `CsiAccountRef = { id; fullName; employeeId: string | null }`; `CsiTemplateRaterView` + `raterNik`, `confirmed: boolean`; `summary` + `ratersConfirmed`.
- `resolveRater(rater: { raterName; raterNik; userId; confirmedAt }, lookup)`: (1) `userId` aktif & `confirmedAt` → confirmed; (2) `raterNik` cocok `employeeId` aktif → confirmed (userId = akun itu); (3) `userId` aktif tanpa konfirmasi → ok; (4) nama → ok / ambiguous / no-account.
- [ ] **Step 1:** Tes `csi-template-view.spec.ts`: `confirmed when pinned and confirmedAt`, `NIK match beats ambiguous name` (dua akun nama sama, NIK cocok salah satu → `confirmed` + userId itu), `inactive pinned account falls back` (pinned+confirmed tapi akun tak aktif → status dari nama), `summary counts confirmed separately`.
- [ ] **Step 2:** Jalankan → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Jalankan spec ini + `csi-template-apply.service.spec.ts` (apply harus menerima `confirmed` setara `ok`: filter jadi `status === 'ok' || status === 'confirmed'`) → PASS.
- [ ] **Step 5:** Commit.

### Task 3: Saran akun + konfirmasi/ganti akun massal

**Files:**
- Create: `org/csi-account-suggest.ts` (+ spec)
- Modify: `services/csi-assignment-template.service.ts`, `presentation/csi-admin-template.controller.ts`, `dto/template.dto.ts`

**Interfaces — Produces:**
- `suggestAccounts(name: string, accounts: SuggestCandidate[], opts: { siteId?: string | null; limit?: number }): AccountSuggestion[]`; `SuggestCandidate = { id; fullName; email; employeeId; siteId; siteCode; department }`; `AccountSuggestion = SuggestCandidate & { score: number }`. Skor = Jaccard token nama ter-normalisasi (`normalizeName`) + 0.5 × kemiripan prefiks token terpanjang (Dice bigram) ; +0.15 bila `siteId` sama; buang skor < 0.35; urut skor desc; default limit 8.
- `GET csi/admin/:scope/templates/:id/account-suggestions?name=` → `AccountSuggestion[]` (site = site lokasi template).
- `PUT templates/raters/account` body `{ raterIds: uuid[]; userId: uuid | null }` → pin + `confirmedAt=now` (null = lepas pin & konfirmasi). Mengganti endpoint lama per-baris (tetap dipertahankan, mendelegasikan).
- `PUT templates/raters/confirm` body `{ raterIds: uuid[]; confirmed: boolean }` → set/clear `confirmedAt`, `confirmedById`; konfirmasi menyimpan `userId` hasil resolve; baris `ambiguous`/`no-account` ditolak 400 "Pilih akun dulu untuk: <nama>".
- `addRater` dengan `userId` → langsung `confirmedAt=now`.
- Semua raterIds harus milik template scope yang sama, maks 2000 per request.
- [ ] **Step 1:** Tes `csi-account-suggest.spec.ts`: `ranks typo above unrelated` ("ERNAWATI" vs "ERNA WATI", "ERNAWATI SARI", "BUDI"), `same site boosts`, `drops weak matches`, `limit respected`. Tes service: `confirm rejects ambiguous`, `bulk account pins and confirms all ids`, `addRater by account is confirmed`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS. **Step 5:** Commit.

### Task 4: Parser Excel dua format + sheet Karyawan/Tim + NIK

**Files:**
- Modify: `org/csi-template-excel.ts` (layout daftar), `org/csi-template-excel.spec.ts`
- Create: `org/csi-template-matrix.ts` (+ spec); fixture builder di spec memakai exceljs (bukan file biner)

**Interfaces — Produces:**
- `CsiTemplateSeedRater = { name; jobTitle; nik: string | null }`; `CsiTemplateSeedPic` + `nik: string | null`.
- `CsiTemplateDraft = { format: 'list' | 'matrix'; pics: CsiTemplateSeedPic[]; teams: Array<{ name: string; members: Array<{ name: string; nik: string | null }> }>; problems }`.
- `parseTemplateWorkbook(buffer)` mendeteksi: ada sheet `List PIC` & `List Penilai` → `parseMatrixWorkbook`; selain itu layout daftar.
- Layout daftar: sheet data = pertama yang namanya tidak diawali `Karyawan`, bukan `Tim`, bukan `Petunjuk`; kolom NIK penilai opsional (`nik hris (dikosongkan saja)` atau `nik penilai`); sheet `Karyawan*` kolom 3 opsional NIK.
- Sheet `Tim` (kedua format): header `Nama Tim | Anggota | NIK`, nama tim carry-down.
- [ ] **Step 1:** Tes: daftar — `reads NIK column when present`, `employee sheet any Karyawan suffix`, `reads Tim sheet`; matriks — `maps groups to services`, `service function joins checked columns with " · "`, `pairs by shared service once`, `no self pair by NIK`, `merges duplicate NIK`, `skips zero rows` (baris NIK/NAMA kosong & Sum 0), `ignores other sheets`. Nilai dari file Comben: PIC `KISWANA EKA JUWITA` fungsi `Pelayanan Perjalanan Dinas · Pelayanan Uang Makan Uang Transport Uang Lembur`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS + tes lama parser tetap PASS. Smoke: skrip `ts-node` lokal parse `Downloads/CSI HC Comben.xlsx` → 3 PIC, total 271 rater-entries; parse Semarang → 19 PIC.
- [ ] **Step 5:** Commit.

### Task 5: Klasifikasi identitas kolom PIC

**Files:** Create `org/csi-template-identity.ts` (+ spec).

**Interfaces — Produces:**
`classifyPics(draft, ctx: { picIndex(name|nik); directoryIndex(name|nik); teamsOfSite: Array<{ id; name }>; resolutions: Record<string, PicResolution> }): { pics: ClassifiedPic[]; unresolved: Array<{ name: string; suggestions: string[] }> }`
- `PicResolution = { as: 'team' } | { as: 'pic' } | { as: 'rename'; picName: string }`.
- `ClassifiedPic = CsiTemplateSeedPic & { kind: 'pic' | 'team'; existingTeamId: string | null; newMasterPic: boolean }`.
- Urutan spec: NIK/nama cocok master atau direktori → pic; nama cocok tim site → team (existing); awalan `TIM `/`TEAM ` → team baru; resolusi admin; sisanya unresolved dengan ≤5 saran (pakai `suggestAccounts`-style skor atas nama PIC master + direktori).
- [ ] **Step 1:** Tes satu per aturan + `resolution rename maps to existing pic` + `unresolved lists suggestions`.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit.

### Task 6: Impor: pratinjau diff, resolusi, prune per layanan, tim & PIC master baru

**Files:** Modify `services/csi-assignment-template.service.ts` (pecah: Create `services/csi-template-import.service.ts` untuk impor agar file <800 baris), controller, `dto/template.dto.ts`, spec.

**Interfaces — Produces:**
- `POST templates/import/:location` multipart `file` + field `options` (JSON string) `{ commit: boolean; resolutions?: Record<string, PicResolution>; prune?: boolean; pruneConfirmed?: boolean }` (query `commit` lama tetap diterima).
- `CsiTemplateImportReport = { format; committed; services: string[]; pics: { added: string[]; changed: string[]; removed: string[] }; raters: { added: number; removed: number }; teams: { added: string[] }; newMasterPics: string[]; unresolved: Array<{ name; suggestions }>; problems }`.
- Commit ditolak 400 bila `unresolved.length` > 0 ("Tentukan dulu: <nama>").
- Prune hanya pada PIC/tim dengan `serviceCode ∈ services` file; rater `confirmedAt != null` hanya dihapus bila `pruneConfirmed`.
- Tim baru dibuat `CsiTeam{kind: CUSTOM, siteId: site lokasi, serviceCode, name}` + anggota dari sheet `Tim` (dicocokkan NIK → nama ke akun aktif; `userId` null bila tak cocok). PIC baris tim: `teamId` diisi.
- PIC master baru: alur `ensurePicMaster` yang ada + fallback bila tak ada di direktori: buat `CsiPic` dengan `nik` dari file, atau `nik = 'TPL-' + 8 hex` bila kosong; `siteId` site lokasi.
- Rater dari file dengan NIK disimpan `raterNik`.
- Lokasi baru (template belum ada) dibuat dengan nama `CSI HC – <Nama lokasi>`.
- [ ] **Step 1:** Tes: `dry run reports diff without writing`, `commit blocked while unresolved`, `prune limited to services in file`, `prune keeps confirmed unless pruneConfirmed`, `creates custom team with members`, `creates master pic without directory row`, `import into empty KRW creates template`.
- [ ] **Step 2–4:** FAIL → implement → PASS (juga spec template lama). **Step 5:** Commit.

### Task 7: Unduh template kosong

**Files:** Create `org/csi-template-blank.ts` (+ spec); controller `GET templates/blank/:location` → xlsx (`Content-Disposition: attachment; filename="CSI HC <Lokasi> - template.xlsx"`).

**Interfaces:** `buildBlankTemplate(location: { code; name }, employees: Array<{ fullName; jobTitle; employeeId }>): Promise<Buffer>` — sheet `List Penilai 2026` (header layout daftar + `NIK Penilai`), `Tim` (header), `Karyawan <KODE>` (user aktif site, urut nama), `Petunjuk` (≤10 baris: isi Area dengan HC Development/HC Comben/HC Services, satu baris per penilai, salin nama dari sheet Karyawan, tim custom diawali "Tim", format matriks juga diterima).
- [ ] **Step 1:** Tes: workbook hasil dibaca ulang `parseTemplateWorkbook` → 0 PIC, 0 problem; sheet Karyawan berisi employee yang diberikan.
- [ ] **Step 2–4.** **Step 5:** Commit.

### Task 8: Tim custom & Orang & foto HC dari template

**Files:** Modify `services/csi-subject.service.ts` (Create `services/csi-team.service.ts` untuk CRUD tim+anggota), `presentation/csi-admin-subject.controller.ts`, DTO, spec; `org/csi-org.service.ts` bila perlu.

**Interfaces — Produces:**
- `CsiSubjectView` + `kind: 'PERSON' | 'TEAM'`, `teamKind: 'SITE' | 'CUSTOM' | null`, `serviceCode`, `picId`, `hasAccount: boolean`, `members?: Array<{ id; name; userId }>`.
- `list(scope)` untuk HC: per site → `teams` (array: SITE + CUSTOM) dan `people` = PIC template lokasi site itu (dari `csi_pics` yang ter-link di template + `isMember` manual lama). Key PIC: `pic:<picId>` (tambahkan ke `csi-subject-key.util.ts`); foto PIC disimpan di `csi_pics.photoUrl`; tagline PIC disimpan di kolom baru `csi_pics.tagline varchar(90) null` (tambahkan ke migrasi Task 1) agar PIC tanpa akun tetap bisa punya tagline.
- `POST subjects/teams` body `{ siteId; kind: 'SITE' | 'CUSTOM'; name?; serviceCode? }` (CUSTOM wajib name+serviceCode); `PATCH subjects/teams/:id` `{ name?; serviceCode? }`; `DELETE subjects/teams/:id` (CUSTOM saja; tolak bila dipakai ratee survei aktif); `PUT subjects/teams/:id/members` `{ members: Array<{ userId?: uuid; name?: string }> }`.
- `viewsFor`: ratee PERSON dengan `picId` → foto/tagline `csi_pics` → avatar user (perbaikan: PIC tanpa akun sekarang bisa tampil fotonya).
- [ ] **Step 1:** Tes: `HC list groups template PICs by site`, `PIC without account listed with hasAccount false`, `custom team requires service`, `site team stays unique per site`, `members replaced`, `pic photo used for ratee view`.
- [ ] **Step 2–4.** **Step 5:** Commit.

### Task 9: Apply: tim sebagai ratee, multi-lokasi, sync menambah site

**Files:** Modify `services/csi-template-apply.service.ts` (+ spec), controller, DTO.

**Interfaces — Produces:**
- `POST templates/create-period` body `{ title; startDate; endDate; templateIds: uuid[] (1..4) }` → `{ periodId; report: CsiTemplateApplyReport }`; `siteIds` = site semua lokasi; apply berurutan dalam satu transaksi; gagal → draft dihapus. Endpoint lama `:id/create-period` mendelegasi dengan `[id]`.
- `POST templates/preview-period` body `{ templateIds }` → `CsiTemplateApplyReport` gabungan (dry run tanpa period).
- `CsiTemplateApplyReport` + `teamsAdded: number`, `ratersUnconfirmed: number`.
- Baris PIC dengan `teamId` → ratee `kind TEAM, teamId, siteId, serviceCode, displayName = team.name, serviceFunction`; anggota tim (userId) tidak dipasangkan menilai tim itu.
- `applyToPeriod`: bila site lokasi belum ada di survei → tambahkan `CsiPeriodSite` (bukan blokir); blokir lain (OPEN/picks/unmapped/cancelled) tetap.
- Penilai lintas lokasi: satu `CsiPeriodRater` per user (sudah dijamin map `raterOfUser`) — tambahkan tes.
- [ ] **Step 1:** Tes: `creates one survey for SMG+KRW`, `rater in two locations counted once`, `custom team becomes TEAM ratee`, `member never rates own team`, `sync adds missing site`, `report counts unconfirmed`.
- [ ] **Step 2–4.** **Step 5:** Commit.

### Task 10: Hasil penilaian saya untuk anggota tim

**Files:** Modify `services/csi-self-result.service.ts` (+ spec), tipe FE `CsiSelfResult` bila perlu.

**Interfaces:** `CsiSelfResult` + `teamName: string | null`. `list(userId)` juga mengambil ratee `kind TEAM` dengan `teamId ∈` tim custom yang punya anggota `userId`.
- [ ] **Step 1:** Tes: `team result listed for member with team label`, `hidden below 3 raters`, `non-member not listed`.
- [ ] **Step 2–4.** **Step 5:** Commit.

### Task 11: Frontend API, tipe, hooks

**Files:** Modify `apps/frontend/src/features/csi/api/csiHc.api.ts`, `hcTypes.ts`, `hooks/useCsiHc.ts`, `api` subjek terkait; `apps/frontend/package.json` (+ `fflate`).

**Interfaces — Produces (hooks):** `useTemplateImport(location)` (mutation, opsi), `useAccountSuggestions(templateId, name)` (query, enabled bila name ≥2 char, debounce di komponen), `useSetRaterAccount()`, `useConfirmRaters()`, `useBlankTemplateDownload()`, `useCreatePeriodFromTemplates()`, `usePreviewPeriod(templateIds)`, `useCustomTeam*` (create/update/delete/setMembers). Konstanta `CSI_TEMPLATE_LOCATIONS = [{code:'SMG',name:'Semarang'},{code:'KRW',name:'Karawang'},{code:'SPJ',name:'Sepanjang'},{code:'JTB',name:'Jakarta'}]` di `hcFormat.ts`.
- [ ] **Step 1–4:** `npx tsc --noEmit -p apps/frontend` bersih (tidak ada tes perilaku di task ini; diuji lewat task UI). **Step 5:** Commit.

### Task 12: Tab Template — 4 lokasi, impor dengan pratinjau diff & resolusi

**Files:** Modify `components/admin/hc/templates/TemplatesTab.tsx`; Create `templates/TemplateImportDialog.tsx`, `templates/TemplateEmptyState.tsx`; tes di `templates/__tests__/`.

- Tab selalu 4 lokasi (badge jumlah PIC / "kosong"). Kosong → `TemplateEmptyState` (Impor Excel, Unduh template kosong, "Muat template bawaan" bila tersedia).
- Dialog impor: pilih file → dry run → ringkasan format terdeteksi ("Format matriks (Comben)"), layanan, `+/−/~`, PIC master baru, tim baru; daftar unresolved dengan radio Tim baru / PIC baru / Salah ketik → select saran; checkbox "Hapus yang tidak ada di Excel (layanan: HCC)" + sub-checkbox "termasuk yang sudah dikonfirmasi"; tombol Simpan nonaktif selama unresolved.
- [ ] **Step 1:** Tes: `shows four location tabs`, `empty location offers import and blank download`, `import preview disables save until unresolved resolved`, `prune checkbox lists services`.
- [ ] **Step 2–4.** **Step 5:** Commit.

### Task 13: Penilai di template — status, saran akun, konfirmasi, panel "perlu dicek", tambah manual

**Files:** Modify `templates/TemplatePicCard.tsx`; Create `templates/RaterAccountPicker.tsx` (popover saran: nama, departemen, site, email, NIK), `templates/TemplateIssuesPanel.tsx`; tes.

- Badge 4 status (warna: hijau/abu/merah/kuning); klik badge non-confirmed → picker; aksi baris: Konfirmasi (hanya `ok`), Ganti akun, Hapus. Header kartu: "Konfirmasi semua di kartu ini" (hanya baris `ok`). Kartu tim bertanda "Tim".
- Input tambah penilai: ketik → saran akun (debounce 250ms); Enter tanpa pilih = simpan sebagai nama (status dihitung).
- Panel header template "N perlu dicek" (ambiguous + no-account), daftar per nama unik dengan saran teratas + Terima / Pilih lain / Biarkan; tidak ada "terima semua".
- [ ] **Step 1:** Tes: `ambiguous badge opens picker and pins account`, `confirm all only touches ok rows`, `issues panel has no accept-all`, `manual add via account sends userId`.
- [ ] **Step 2–4.** **Step 5:** Commit.

### Task 14: Tampilan "Per penilai"

**Files:** Create `templates/RaterTableView.tsx`, `templates/raterRows.ts` (agregasi murni + tes); toggle di `TemplatesTab.tsx`.

**Interfaces:** `groupRaters(view: CsiTemplate): RaterRow[]`, `RaterRow = { key; name; nik; userId; status; raterIds: string[]; pics: string[] }` — key = userId ?? `name:<raterName>`; status baris = status terburuk (no-account > ambiguous > ok > confirmed).
- Tabel: Nama | Akun iDesk | Status | Menilai N PIC (expand daftar); filter status (default "Perlu dicek" bila ada), cari; aksi Konfirmasi / Ganti akun memanggil endpoint massal dengan semua `raterIds` orang itu.
- [ ] **Step 1:** Tes `groupRaters` (worst status, merge by userId) + tes UI `confirm applies to all raterIds`.
- [ ] **Step 2–4.** **Step 5:** Commit.

### Task 15: Orang & foto HC — dari template, tim custom, unggah foto massal

**Files:** Modify `components/admin/subjects/SubjectsTab.tsx`, `SubjectCard.tsx`, `SubjectEditSheet.tsx`; Create `subjects/CustomTeamSheet.tsx`, `subjects/BulkPhotoDialog.tsx`, `subjects/photoMatch.ts` (+ tes).

**Interfaces:** `matchPhotoFiles(files: Array<{ name: string }>, subjects: Array<{ key; name }>): Array<{ file; key: string | null; candidates: string[] }>` — basename tanpa ekstensi → `normalizeName`-setara FE (uppercase, `[._,-]`→spasi, spasi tunggal); cocok persis 1 subjek → key; >1 → null + candidates; ZIP diekstrak dengan `fflate.unzipSync` (hanya jpg/jpeg/png/webp, abaikan `__MACOSX`).
- HC: header "Impor Excel" (link ke tab Template lokasi) + "+ Tim custom" + "Unggah foto massal"; link kecil "tambah manual". Kartu PIC tanpa akun: badge "Belum punya akun". Kartu tim custom: layanan + jumlah anggota; sheet edit anggota (cari akun atau ketik nama bebas).
- Dialog massal: tabel file → subjek (select untuk yang tidak cocok/ambigu), Simpan mengunggah satu per satu via endpoint foto yang ada (`subjects/:key/photo`, `org/pics/:id/photo` untuk key `pic:`), progres + ringkasan gagal.
- [ ] **Step 1:** Tes `photoMatch`: `matches normalised file names`, `ambiguous not auto-assigned`, `ignores non-images`; UI: `custom team sheet requires service`, `bulk dialog uploads matched files`.
- [ ] **Step 2–4.** **Step 5:** Commit.

### Task 16: Tab Penilai HC hanya-baca + checklist Pengaturan

**Files:** Modify `components/admin/RatersTab.tsx` (cabang HC → Create `hc/TemplateRatersSummary.tsx`), `SettingsPanel.tsx` (status "Penilai" HC dari ringkasan template; "Template penugasan" hint `N lokasi · M perlu dicek`).
- Tabel per lokasi: total unik, Terkonfirmasi, Cocok otomatis, Nama ganda, Belum punya akun; tombol "Perbaiki di template" membuka tab Template lokasi itu dengan filter "Perlu dicek".
- [ ] **Step 1:** Tes `HC raters tab is read-only summary with fix link`; tes ICT RatersTab lama tetap PASS.
- [ ] **Step 2–4.** **Step 5:** Commit.

### Task 17: Buat survei HC multi-lokasi + sinkron

**Files:** Modify `templates/TemplateApplyDialog.tsx` (wizard 4 langkah), titik masuk "Buat survei" HC di `PeriodsTab.tsx` diarahkan ke wizard ini; tes.
- Langkah: Nama & periode → centang lokasi (hanya lokasi berisi template; tiap baris ringkasan "19 PIC · 436 penilai · 3 perlu dicek") → pratinjau (`usePreviewPeriod`: PIC/tim ditambah, penilai unik, dilewati per kategori, peringatan "N penilai belum dikonfirmasi") → Buat. Mode "Masukkan ke survei existing" tetap, menampilkan "Site X akan ditambahkan".
- [ ] **Step 1:** Tes: `wizard sends all checked templateIds`, `preview shows unconfirmed warning`, `sync shows site will be added`.
- [ ] **Step 2–4.** **Step 5:** Commit.

### Task 18: Data dummy lokal, verifikasi menyeluruh, screenshot

**Files:** Create `apps/backend/scripts/csi-dummy-krw.xlsx` generator (`scripts/csi-make-krw-dummy.ts`, tidak di-commit file xlsx-nya ke prod data).
- [ ] **Step 1:** Generate Excel dummy KRW (4 PIC + `Tim Payroll KRW` 3 anggota, ±40 penilai, 2 salah ketik, 1 nama ganda) ke `Downloads/`.
- [ ] **Step 2:** DB lokal: impor SMG (bundled), SPJ (`CSI HC 2026 (sepanjang - comben).xlsx` dan file matriks asli), KRW dummy; perbaiki 1 penilai via saran; buat survei SMG+KRW+SPJ.
- [ ] **Step 3:** Tes backend modul CSI satu per satu (`--runInBand`), tes frontend fitur CSI satu per satu; `tsc` kedua app; lint file yang diubah.
- [ ] **Step 4:** Screenshot (Playwright) alur: tab lokasi kosong, pratinjau impor matriks, picker saran, tampilan per penilai, Orang & foto + unggah massal, Penilai read-only, wizard multi-lokasi → satu PDF di Downloads.
- [ ] **Step 5:** Commit; update memori bila ada keputusan baru.
