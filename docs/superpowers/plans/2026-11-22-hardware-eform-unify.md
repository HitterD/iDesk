# Unifikasi Hardware Request & E-Form ke Tiket — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Setiap Hardware Request / E-Form menjadi tiket IT Support bertag dengan alur terpandu, chat, satu dokumen bertanda tangan, dan menu pendukung "Perangkat & Akses", sesuai mockup yang disetujui.

**Architecture:** Tiket = induk (`ticketType` HARDWARE_REQUEST / EFORM_REQUEST); `hardware_requests` / `eform_requests` tetap menyimpan detail & state machine, terhubung lewat `sourceTicketId` yang sudah ada. Modul baru `request-flow` di backend memegang alur yang dipilih IT (rute persetujuan, sumber barang), dokumen ber-versi + QR, dan proyeksi "fase / giliran / langkah berikutnya" yang dipakai FE. FE membuat satu set komponen `features/ticket-board/components/request-flow/*` yang dipakai di detail agent, client, dan manager; halaman lama dihapus dan diganti redirect.

**Tech Stack:** NestJS 10 + TypeORM 0.3 (Postgres), pdfkit, Jest (`--runInBand`); React 19 + Vite + TanStack Query + Vitest; Playwright untuk cek visual.

**Spec:** `docs/superpowers/specs/2026-11-22-hardware-eform-unify-design.md` · Mockup acuan: `mockups/ticket-unify.html` (`ticket-unify.js` memuat semua copy, urutan, validasi).

## Global Constraints
- Test dijalankan **serial, satu file per perintah**: BE `npx jest <file> --runInBand`, FE `npx vitest run <file> --pool=forks`. Jangan pernah menjalankan seluruh suite paralel.
- `npx tsc --noEmit -p apps/backend` dan `npx tsc -b apps/frontend` wajib bersih di akhir setiap task yang menyentuh TS.
- Migrasi additive, timestamp mulai `1794800000000`, naik `10000000` per migrasi. Enum ditambah dengan `ALTER TYPE ... ADD VALUE IF NOT EXISTS`.
- Copy UI Bahasa Indonesia, **ambil persis dari `mockups/ticket-unify.js`** (judul bar langkah, label tombol, toast).
- Warna tag: Hardware `--hw: hsl(24 95% 53%)` / ink `hsl(22 90% 36%)` / bg `hsl(30 100% 95%)`; E-Form `--ef: hsl(158 70% 38%)` / ink `hsl(160 80% 24%)` / bg `hsl(152 60% 94%)`. Icon lucide `MonitorSmartphone` / `FileText`.
- Pemroses ICT (approve rute, beli, jadwal, beri akses, ubah barang/no. dokumen, katalog): `ADMIN, AGENT_ADMIN, AGENT_OPERATIONAL_SUPPORT, AGENT`. Pembaca kredensial: pemohon + ICT_ROLES (`ADMIN, AGENT_ADMIN, AGENT_OPERATIONAL_SUPPORT`).
- Site isolation tetap: semua query lewat `applySiteFilter` / `assertSiteAccess` yang ada; approver (atasan/GM) yang ditunjuk boleh melihat tiketnya lintas site.
- Batas: qty 1–50/barang; slot jadwal 1–3; jadwal ulang maks 3; screenshot NAS maks 5 × 5 MB; masa berlaku maks 366 hari untuk VPN/NETWORK/FLASHDISK; auto-close konfirmasi = `RESOLUTION_CONFIRMATION_BUSINESS_MINUTES` (540) yang sudah ada.
- Commit per task, pesan conventional (`feat(request-flow): …`), diakhiri `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus
1. **Dua request di satu tiket lama** (tiket yang sudah punya proposal hardware *dan* e-form dari alur lama): migrasi tidak boleh membuat tiket induk ganda atau mengubah tipe tiket lama — Task 2 test `keeps legacy linked tickets as SERVICE`.
2. **Approver bukan agent dan beda site** membuka tiket dari email: harus bisa melihat & chat, tidak bisa aksi IT — Task 5 test `approver from another site can read and sign but not act`.
3. **Impor TTD kertas versi lama** setelah IT mengubah barang (versi naik): ditolak dengan pesan versi — Task 4 test `rejects a scan whose QR is not the latest version`.
4. **Pemohon menutup tab saat form panjang** (E-Form NAS / Hardware banyak barang): isian tersimpan sebagai draft lokal dan pulih — Task 11 test `restores the draft after reload`.
5. **Katalog: barang dihapus/nonaktif saat ada di keranjang tiket berjalan**: tiket tetap menampilkan snapshot; form baru tidak menampilkannya — Task 8 test `inactive item hidden from form but kept on existing tickets`.

---

## File Structure

**Backend — modul baru `apps/backend/src/modules/request-flow/`**
- `request-flow.module.ts` — wiring; impor HardwareRequest & EForm modul.
- `domain/request-kind.ts` — `RequestKind = 'HARDWARE' | 'EFORM'`, peta `TicketType`↔kind.
- `domain/approval-route.ts` — `ApprovalRoute = 'NONE' | 'MANAGER' | 'MANAGER_GM'`, default per jenis.
- `domain/flow-phase.ts` — `FlowPhase` + `phaseOf(kind, detailStatus, extras)` + `turnOf(...)` (proyeksi fase/giliran).
- `entities/request-flow.entity.ts` — tabel `request_flows` (1 baris per tiket request).
- `entities/request-document-revision.entity.ts` — tabel `request_document_revisions`.
- `services/request-flow.service.ts` — create-from-form, review, approve/return/reject, edit items, remind.
- `services/request-document.service.ts` — versi, PDF ber-QR, impor scan.
- `services/request-flow-query.service.ts` — `GET /tickets/:id/flow` proyeksi lengkap untuk FE.
- `presentation/request-flow.controller.ts`, `dto/*.ts`.
- `migrations/1794800000000-RequestFlow.ts`, `1794810000000-RequestFlowBackfill.ts` (di `src/migrations/`).

**Backend — diubah**
- `ticketing/entities/ticket.entity.ts` — `TicketType.HARDWARE_REQUEST`, `TicketType.EFORM_REQUEST`.
- `ticketing/services/ticket-query.service.ts` — filter `requestKind`, sub-fase di list, approver scope.
- `ticketing/services/ticket-linked-request.service.ts` — dipakai untuk request yang induknya tiket itu sendiri.
- `hardware-request/**` — perbaikan bug (category filter, includeInactive, PROCUREMENT_DONE, aging listener, required fields, notes), procurement per item dengan vendor/invoice, barcode wajib saat selesai, matikan auto-ticket.
- `eform-request/**` — create dari form tiket, synology account fields, aturan pembaca kredensial, rute dari IT.

**Frontend — baru `apps/frontend/src/features/ticket-board/components/request-flow/`**
- `requestKind.ts` (tag, warna, icon), `RequestTypeTag.tsx`, `NextStepBar.tsx`, `ProgressCard.tsx`, `RequestItemsCard.tsx`, `AccessCard.tsx`, `DocumentPane.tsx`, `useRequestFlow.ts` (query + mutations).
- `dialogs/` — `ReviewDialog`, `ApprovalDialog`, `PaperSignDialog`, `ProcurementDialog`, `ArrivalDialog`, `ScheduleDialog`, `PickSlotDialog`, `InstallDoneDialog`, `FulfillDialog`, `CredentialDialog`, `EditItemsDialog`, `DocNumberDialog`, `IssueDialog`.
- `picker/CatalogBasket.tsx` (katalog + keranjang + Ganti + Tulis manual), `picker/RecipientInput.tsx`.

**Frontend — baru `apps/frontend/src/features/client/components/create-request/`**
- `HardwareRequestForm.tsx`, `EformRequestForm.tsx`, `eform/` (6 komponen detail per jenis, `PeriodPicker`, `TermsGate`), `useRequestDraft.ts`.

**Frontend — baru `apps/frontend/src/features/devices-access/`**
- `pages/DevicesAccessPage.tsx` (4 tab), `tabs/ScheduleTab.tsx`, `tabs/AccessExpiryTab.tsx`, `tabs/CatalogTab.tsx`, `tabs/SummaryTab.tsx`, `api.ts`.

**Frontend — diubah**
- `ticket-board/pages/BentoTicketListPage.tsx`, `components/TicketListRow.tsx`, `KanbanCard.tsx`, `pages/BentoTicketDetailPage.tsx`, `components/ticket-detail/TicketHeader.tsx`, `TicketSidebar.tsx`.
- `client/pages/BentoMyTicketsPage.tsx`, `ClientTicketDetailPage.tsx`, `BentoCreateTicketPage.tsx`, `components/create-ticket/createTicketConfig.ts`.
- `components/layout/BentoSidebar.tsx`, `ClientLayout.tsx`, `ManagerSidebar.tsx`, `routes/AppRoutes.tsx`, `lib/pageDefinitions.ts`, `components/notifications/utils/notificationRouter.ts`.
- Dihapus di Task 14: `features/hardware-request/pages|layouts|components/{list,create,dashboard,calendar,catalog,detail}`, `features/request-center/pages/*`, `ticket-board/components/{AccessRequestForm,IctBudgetForm}.tsx`.

---

### Task 1: Tipe tiket baru + tabel `request_flows`

**Files:**
- Create: `apps/backend/src/migrations/1794800000000-RequestFlow.ts`, `apps/backend/src/modules/request-flow/{request-flow.module.ts,domain/request-kind.ts,domain/approval-route.ts,entities/request-flow.entity.ts,entities/request-document-revision.entity.ts}`
- Modify: `apps/backend/src/modules/ticketing/entities/ticket.entity.ts:58-67`, `apps/backend/src/app.module.ts`
- Test: `apps/backend/src/migrations/1794800000000-RequestFlow.spec.ts`, `apps/backend/src/modules/request-flow/domain/approval-route.spec.ts`

**Interfaces:**
- Produces:
  - `TicketType.HARDWARE_REQUEST`, `TicketType.EFORM_REQUEST`.
  - `type RequestKind = 'HARDWARE' | 'EFORM'`; `kindOfTicketType(t: TicketType): RequestKind | null`; `ticketTypeOf(k: RequestKind): TicketType`.
  - `type ApprovalRoute = 'NONE' | 'MANAGER' | 'MANAGER_GM'`; `defaultRoute(kind: RequestKind, eformType?: EFormType): ApprovalRoute` (VPN→MANAGER_GM, SYNOLOGY_NAS→NONE, lainnya→MANAGER); `canChangeRoute(from: ApprovalRoute, to: ApprovalRoute, signed: { manager: boolean; gm: boolean }): boolean` (sebelum ada TTD bebas; sesudah TTD hanya MANAGER→MANAGER_GM).
  - `type HardwareSource = 'ANNUAL_BUDGET' | 'NON_BUDGET' | 'IT_STOCK'`.
  - Entity `RequestFlow` (`request_flows`): `id uuid`, `ticketId uuid unique FK tickets ON DELETE CASCADE`, `kind varchar(16)`, `hardwareRequestId uuid null FK`, `eformRequestId uuid null FK`, `route varchar(16) null`, `managerId uuid null`, `gmId uuid null`, `hardwareSource varchar(16) null`, `reviewedById uuid null`, `reviewedAt timestamptz null`, `returnedReason text null`, `rescheduleCount int default 0`, `documentVersion int default 1`, `createdAt`, `updatedAt`.
  - Entity `RequestDocumentRevision` (`request_document_revisions`): `id`, `flowId FK CASCADE`, `version int`, `kind varchar(8)` (`GEN|DIG|IMP|FIN`), `label varchar(200)`, `actorId uuid null`, `scanPath varchar null select:false`, `createdAt`; unique `(flowId, version)`.

- [ ] **Step 1: Write failing tests** — `approval-route.spec.ts`: `defaultRoute('EFORM','VPN')==='MANAGER_GM'`, `defaultRoute('EFORM','SYNOLOGY_NAS')==='NONE'`, `defaultRoute('HARDWARE')==='MANAGER'`; `canChangeRoute('MANAGER','NONE',{manager:true,gm:false})===false`; `canChangeRoute('MANAGER','MANAGER_GM',{manager:true,gm:false})===true`; `canChangeRoute('MANAGER_GM','MANAGER',{manager:false,gm:false})===true`. Migration spec (pola `1794700000000-AddTicketForwardedFromSite.spec.ts`): `up` memanggil `ALTER TYPE "tickets_tickettype_enum" ADD VALUE IF NOT EXISTS 'HARDWARE_REQUEST'` dan `'EFORM_REQUEST'`, membuat `request_flows` dan `request_document_revisions`; `down` drop kedua tabel.
- [ ] **Step 2: Run** `cd apps/backend && npx jest src/modules/request-flow/domain/approval-route.spec.ts --runInBand` → FAIL (module not found).
- [ ] **Step 3: Implement** enum values, domain files, entities, migration (`CREATE TABLE IF NOT EXISTS`, index `IDX_request_flows_ticketId` unique, `IDX_request_flows_managerId`, `IDX_request_flows_gmId`), `RequestFlowModule` registered in `app.module.ts`.
- [ ] **Step 4: Run** both spec files (one per command) → PASS; `npx tsc --noEmit -p .` → clean.
- [ ] **Step 5: Commit** `feat(request-flow): ticket types and request_flows tables`.

### Task 2: Backfill tiket induk untuk data lama

**Files:**
- Create: `apps/backend/src/migrations/1794810000000-RequestFlowBackfill.ts`, `apps/backend/src/modules/request-flow/services/request-flow-backfill.ts`
- Test: `apps/backend/src/modules/request-flow/services/request-flow-backfill.spec.ts`

**Interfaces:**
- Consumes: Task 1 entities; `generateNextTicketNumber(manager, division, now)` (`ticketing/utils/ticket-number-generator.ts`); `departmentDivision` used by `ticket-create.service.ts:120`.
- Produces: `backfillRequestFlows(manager: EntityManager, now?: Date): Promise<{ created: number; linked: number; skipped: number }>`.

Rules: request **tanpa** `sourceTicketId` dan status bukan `DRAFT`/`CANCELLED` → buat tiket baru (`ticketType` sesuai kind, `handlingTeam OPS_SUPPORT`, `userId = requesterId`, `siteId` request, `title` = HR: `Hardware Request ${requestNumber}` / EF: `Akses ${label} — ${documentNumber}`, `description` = justification/alasan, `createdAt` = request.createdAt, status dipetakan: hardware COMPLETED/CLOSED→CLOSED, REJECTED/CANCELLED→CANCELLED, lainnya→IN_PROGRESS; e-form CONFIRMED→CLOSED, REJECTED→CANCELLED, lainnya→IN_PROGRESS), set `sourceTicketId`, buat `request_flows` (route dari data lama: e-form `requiresGm`→MANAGER_GM, NAS→NONE, lainnya MANAGER; hardware: MANAGER, `hardwareSource` dari prefix justification `[BUDGET TAHUNAN]`→ANNUAL_BUDGET, `[NON-BUDGET]`→NON_BUDGET, `[PENJADWALAN PEMASANGAN]`→IT_STOCK). Request **dengan** `sourceTicketId` (alur lama "usulkan dari tiket"): **tidak** mengubah tipe tiket induk; hanya membuat `request_flows` bila tiket itu baru punya satu request; tiket dengan >1 request dilewati (`skipped`) dan tetap memakai kartu lama. Idempoten (lewati yang sudah punya `request_flows`).

- [ ] **Step 1: Write failing tests** (manager mock seperti `ticket-hardware-link.service.spec.ts`): `creates a parent ticket for a standalone submitted hardware request` (ticketType HARDWARE_REQUEST, status IN_PROGRESS, `sourceTicketId` diisi); `maps a confirmed eform to a CLOSED EFORM_REQUEST ticket with route MANAGER_GM when requiresGm`; `keeps legacy linked tickets as SERVICE` (tiket dengan hardware + e-form → `skipped: 1`, ticketType tidak diubah); `is idempotent` (dua kali jalan → `created` kedua = 0); `skips DRAFT and CANCELLED`.
- [ ] **Step 2: Run** `npx jest src/modules/request-flow/services/request-flow-backfill.spec.ts --runInBand` → FAIL.
- [ ] **Step 3: Implement** `backfillRequestFlows`; migrasi memanggilnya dalam `up` (raw `queryRunner.manager`); `down` = no-op dengan komentar (data tidak dihapus).
- [ ] **Step 4: Run** → PASS; tsc clean.
- [ ] **Step 5: Commit** `feat(request-flow): backfill parent tickets for existing requests`.

### Task 3: Buat tiket dari form (Hardware & E-Form) + perbaikan katalog/validasi

**Files:**
- Create: `apps/backend/src/modules/request-flow/dto/create-hardware-ticket.dto.ts`, `dto/create-eform-ticket.dto.ts`, `services/request-flow.service.ts` (method create), `presentation/request-flow.controller.ts`
- Modify: `hardware-request/services/hardware-request-command.service.ts:55-123` (validasi isian wajib, item manual), `hardware-request/services/hardware-catalog.service.ts` (required-field check helper), `eform-request/eform-request.service.ts:72-140` (terima `sourceTicketId`, simpan `synologyAccountStatus`/`synologyAccountName`/`selectedNasServers` di `formData`), `eform-request/dto/create-eform-request.dto.ts`
- Test: `request-flow/services/request-flow.create.spec.ts`, `hardware-request/services/hardware-catalog.service.spec.ts` (tambahan), `eform-request/eform-request.direct-ict.spec.ts` (tambahan)

**Interfaces:**
- Consumes: Task 1; `TicketCreateService.createTicket` (`ticketing/services/ticket-create.service.ts:72`); `HardwareRequestCommandService.createDraft/submit`; `EFormRequestService.createRequest`.
- Produces:
  - `POST /request-flow/hardware` body `CreateHardwareTicketDto { title: string(3..200); justification: string(1..2000); division: string; recipients: string[] (1..20, tiap 1..120); managerId?: uuid; items: { catalogId?: uuid; manualName?: string(2..120); quantity: 1..50; note?: string(≤300); fields?: Record<string,string|number>; recipientName?: string }[] (1..50, tepat satu dari catalogId/manualName); signatureData: string (data URL png) }` → `{ ticketId: string; ticketNumber: string }`.
  - `POST /request-flow/eform` body `CreateEformTicketDto` = field `CreateEFormRequestDto` sekarang + `startDate: 'YYYY-MM-DD'`, `endDate?: 'YYYY-MM-DD'`, `managerId?: uuid` (opsional; IT yang memutuskan) → `{ ticketId; ticketNumber }`.
  - `HardwareCatalogService.assertRequiredFields(catalog: HardwareCatalog, fields: Record<string, unknown>): void` (throws `BadRequestException('Isian "<label>" wajib untuk <name>')`).
  - `RequestFlowService.createHardware(actor: AuthUser, dto) / createEform(actor: AuthUser, dto)`: satu transaksi → tiket (`ticketType` sesuai kind, status TODO, SLA normal) → detail request dengan `sourceTicketId`, status `SUBMITTED` (hardware) / `PENDING_REVIEW` (e-form, nilai enum baru) → `request_flows` (route null) → revisi dokumen v1 `GEN "Dibuat dari pengajuan · TTD pemohon"` → pesan sistem pertama.
- E-Form: status awal **`PENDING_MANAGER` tidak dipakai lagi saat submit**; tambah nilai enum `PENDING_REVIEW` ke `eform_requests_status_enum` (migrasi di task ini, `1794820000000-EformPendingReview.ts`) — e-form menunggu review IT sebelum rute ditentukan. Tanda tangan pemohon disimpan seperti sekarang. Validasi masa berlaku: `endDate ≥ startDate`; VPN/NETWORK/FLASHDISK wajib `endDate` dan ≤366 hari; WEBSITE/EMAIL/SYNOLOGY_NAS boleh tanpa `endDate`.
- Item manual (`manualName`): disimpan dengan `catalogId null`, `categorySnapshot { code: null, name: manualName, category: 'OTHER', specs: {}, customFields }`.

- [ ] **Step 1: Write failing tests** — `creates an IT ticket and a submitted hardware request linked to it`; `rejects a catalog item whose required field is empty` (pesan persis `Isian "Nama software" wajib untuk Lisensi Software`); `accepts a manual item without catalog`; `rejects quantity 51`; `creates an eform ticket in PENDING_REVIEW with synology account name kept in formData`; `rejects VPN longer than 366 days` dan `allows EMAIL without endDate`; `stores revision v1 GEN`.
- [ ] **Step 2: Run** each spec (one per command) → FAIL.
- [ ] **Step 3: Implement** DTOs (class-validator), service, controller (`@Roles` semua role terautentikasi; site dari JWT seperti `createDraft`), migration enum.
- [ ] **Step 4: Run** → PASS; tsc clean.
- [ ] **Step 5: Commit** `feat(request-flow): create hardware/eform tickets from the unified form`.

### Task 4: Review IT, persetujuan, dokumen ber-versi + TTD kertas

**Files:**
- Create: `request-flow/services/request-document.service.ts`, `request-flow/dto/{review.dto.ts,approve.dto.ts,paper-sign.dto.ts}`
- Modify: `request-flow/services/request-flow.service.ts`, `request-flow/presentation/request-flow.controller.ts`, `eform-request/eform-pdf.service.ts` (QR + versi di footer), `eform-request/eform-request.service.ts` (`approveByManager` / `eform-gm.service.ts` dipanggil dari flow)
- Test: `request-flow/services/request-flow.review.spec.ts`, `request-flow/services/request-document.service.spec.ts`

**Interfaces:**
- Consumes: Task 1–3. Review tidak membawa barang: dialog Review di FE (Task 10) memanggil `PUT /request-flow/:ticketId/items` (Task 6) dulu bila barang diubah, lalu `POST …/review`.
- Produces:
  - `POST /request-flow/:ticketId/review` `ReviewDto { route: ApprovalRoute; managerId?: uuid; gmId?: uuid; hardwareSource?: HardwareSource; message?: string(≤1000) }` — ICT only, only while phase `review`. Hardware: SUBMITTED→UNDER_REVIEW→(route NONE: APPROVED→ (IT_STOCK ? INSTALLATION with items ARRIVED : PROCUREMENT)) else stays UNDER_REVIEW awaiting signatures. E-form: PENDING_REVIEW→ route NONE: PENDING_ICT; MANAGER/MANAGER_GM: PENDING_MANAGER with `currentApproverId=managerId`, `requiresGm` = route===MANAGER_GM, `gmApproverId=gmId`.
  - `POST /request-flow/:ticketId/decision` `ApproveDto { decision: 'APPROVE' | 'RETURN' | 'REJECT'; signatureData?: string; note?: string(≤1000) }` — only the current approver (manager then GM). APPROVE needs signature; RETURN/REJECT need note (≥5). RETURN: phase back to `review` (hardware UNDER_REVIEW, e-form PENDING_REVIEW), `returnedReason` set, signatures kept. After final approval hardware → APPROVED→PROCUREMENT (or INSTALLATION if IT_STOCK); e-form → PENDING_ICT.
  - `POST /request-flow/:ticketId/remind` — ICT; notification + email to current approver; 1×/jam (409 otherwise).
  - `RequestDocumentService.bump(flowId: string, kind: 'GEN'|'DIG'|'IMP'|'FIN', label: string, actorId: string|null, manager: EntityManager): Promise<number>` (returns new version).
  - `GET /request-flow/:ticketId/document.pdf?v=<n>` — PDF of version n (default latest) with QR text `${ticketNumber}/v${n}`. Hardware PDF baru (`request-flow/pdf/hardware-request-pdf.ts`, pdfkit, layout = `paper()` di mockup: header, pemohon, sumber, tabel barang, 4 slot TTD Pemohon/Atasan/GM/ICT, footer QR). E-form memakai `EformPdfService` + footer QR.
  - `POST /request-flow/:ticketId/paper-sign` multipart `file` (PDF/JPG/PNG ≤10 MB) + `qr: string` (diisi FE dari hasil baca QR; server juga mencoba decode untuk PDF) — ICT; diterima hanya bila `qr === ${ticketNumber}/v${documentVersion}`; else 409 `Dokumen versi lama (v<x>). Unduh versi terbaru (v<y>) lalu minta tanda tangan ulang.` Menyimpan scan (pakai `eform-document.service` storage untuk e-form; `uploads/request-scans` untuk hardware), menandai TTD langkah aktif sebagai kertas, bump `IMP`.
  - Setiap TTD/approve: bump `DIG`; review: bump `GEN "Ditinjau IT: <rute> · <sumber>"`; selesai: bump `FIN`.

- [ ] **Step 1: Write failing tests** — `review with route NONE and IT_STOCK sends hardware straight to installation with items arrived`; `review MANAGER_GM on eform sets current approver to manager and requiresGm`; `only the current approver can decide`; `RETURN sends it back to review and keeps the manager signature`; `REJECT requires a note of at least 5 characters`; `rejects a scan whose QR is not the latest version` (versi 3, qr `.../v1` → 409 dengan pesan persis); `accepts a scan for the latest version and advances to the GM step`; `cannot change MANAGER to NONE after the manager signed` (via `canChangeRoute`); `remind is limited to once per hour`.
- [ ] **Step 2: Run** each spec → FAIL.
- [ ] **Step 3: Implement.** QR: tambahkan dependency `qrcode@1.5.4` (BE) untuk render PNG ke pdfkit; decode PDF tidak wajib — bila FE mengirim `qr`, itu yang dipakai; FE membaca QR dari gambar dengan `@zxing/browser` yang sudah ada.
- [ ] **Step 4: Run** → PASS; tsc clean.
- [ ] **Step 5: Commit** `feat(request-flow): IT review, approvals, versioned document and paper signatures`.

### Task 5: Proyeksi flow untuk FE + akses approver

**Files:**
- Create: `request-flow/domain/flow-phase.ts`, `request-flow/services/request-flow-query.service.ts`
- Modify: `request-flow/presentation/request-flow.controller.ts`, `ticketing/services/ticket-query.service.ts` (akses baca approver), `ticketing/utils/site-access.util.ts` (izin approver)
- Test: `request-flow/domain/flow-phase.spec.ts`, `request-flow/services/request-flow-query.service.spec.ts`

**Interfaces:**
- Produces:
  - `type FlowPhase = 'review' | 'appr_mgr' | 'appr_gm' | 'procure' | 'delivery' | 'schedule' | 'install' | 'fulfill' | 'confirm' | 'done' | 'rejected'`.
  - `phaseOf(kind: RequestKind, status: string, ctx: { hasOpenSchedule: boolean }): FlowPhase` — hardware: SUBMITTED/UNDER_REVIEW(without route)→review, UNDER_REVIEW+route & awaiting mgr→appr_mgr, awaiting gm→appr_gm, APPROVED/PROCUREMENT→procure, AWAITING_DELIVERY→delivery, INSTALLATION without confirmed schedule→schedule, with confirmed→install, AWAITING_USER_CONFIRMATION→confirm, COMPLETED/CLOSED→done, REJECTED/CANCELLED→rejected. E-form: PENDING_REVIEW→review, PENDING_MANAGER→appr_mgr, PENDING_GM→appr_gm, PENDING_ICT→fulfill, `AWAITING_CONFIRMATION`→confirm (nilai enum ditambahkan oleh migrasi Task 7; di task ini cukup dipetakan sebagai string), CONFIRMED→done, REJECTED/CANCELLED→rejected.
  - `PHASE_LABEL: Record<FlowPhase,string>` persis mockup `PHASE_SUB` (`review:'Review IT'`, `appr_mgr:'Menunggu Atasan'`, `appr_gm:'Menunggu GM'`, `procure:'Pengadaan'`, `delivery:'Menunggu barang tiba'`, `schedule:'Penjadwalan instalasi'`, `install:'Instalasi'`, `fulfill:'Pemenuhan akses'`, `confirm:'Menunggu konfirmasi pemohon'`, `done:'Selesai'`, `rejected:'Ditolak'`).
  - `isSlaPausedPhase(p: FlowPhase): boolean` → true for `appr_mgr, appr_gm, procure, delivery`.
  - `GET /request-flow/:ticketId` → `RequestFlowView { kind; phase; phaseLabel; route; managerId; gmId; hardwareSource; returnedReason; rescheduleCount; documentVersion; revisions: {version;kind;label;actorName;createdAt}[]; viewerRoleInFlow: 'REQUESTER'|'APPROVER_CURRENT'|'APPROVER'|'ICT'|'OBSERVER'; hardware?: { requestNumber; division; recipients: string[]; items: ItemView[]; schedule: ScheduleView|null; assets: {code; itemId}[] }; eform?: { formType; documentNumber; startDate; endDate|null; fields: Record<string,string>; hasCredentials: boolean; requiresGm: boolean } }`.
  - Ticket SLA: saat flow masuk fase paused → `TicketLinkedRequestService.record` dengan target WAITING_VENDOR (reuse); keluar → IN_PROGRESS.
  - Approver access: user yang `managerId`/`gmId` di `request_flows` tiket boleh `GET /tickets/:id`, membaca & mengirim pesan (bypass site), tidak boleh endpoint agent lainnya.
- [ ] **Step 1: Write failing tests** — tabel `phaseOf` (min. 12 kasus termasuk `INSTALLATION` dengan/tanpa jadwal); `paused phases are approval, procurement, delivery`; `view marks the current approver`; `approver from another site can read and sign but not act` (GET ticket 200, POST message 201, PATCH status 403).
- [ ] **Step 2–4:** run → FAIL → implement → PASS; tsc clean.
- [ ] **Step 5: Commit** `feat(request-flow): flow projection and approver access`.

### Task 6: Hardware — ubah barang, pembelian per barang, tiba, jadwal, pasang (+ bug fix)

**Files:**
- Modify: `hardware-request/services/procurement-decision.service.ts` (vendor/harga/invoice per item, simpan catatan, emit `HR_EVT.PROCUREMENT_DONE`), `hardware-request/services/delivery-tracking.service.ts`, `hardware-request/services/mutual-scheduling.service.ts` (catatan jadwal disimpan, limit 3 tetap, hitung `rescheduleCount` ke flow), `hardware-request/services/hardware-request-command.service.ts:498-545` (selesai butuh kode aset per unit), `hardware-request/services/hardware-asset.service.ts`, `hardware-request/services/hardware-request-query.service.ts:31-82` (filter kategori), `hardware-request/listeners/aging-reminder.cron.ts` + listener baru `aging-notifier.listener.ts`, `hardware-request/listeners/hardware-schedule-ticket.listener.ts` (lewati bila request punya `request_flows`)
- Create: `request-flow/services/request-items.service.ts`, `request-flow/dto/edit-items.dto.ts`, `request-flow/dto/procure.dto.ts`, `request-flow/dto/install-done.dto.ts`
- Test: `request-flow/services/request-items.service.spec.ts`, `hardware-request/services/procurement-decision.service.spec.ts` (baru), `hardware-request/listeners/aging-notifier.listener.spec.ts`, tambahan di `hardware-request-query.service.spec.ts`, `hardware-schedule-ticket.listener.spec.ts`, `hardware-request-command.service.spec.ts`

**Interfaces:**
- Produces:
  - `PUT /request-flow/:ticketId/items` `EditItemsDto { items: { existingItemIds?: uuid[]; catalogId?: uuid; manualName?: string; quantity: 1..50; note?: string; fields?: Record<string,string|number>; recipientName?: string; replacesName?: string }[]; reason: string(5..500) }` — ICT, fase `review|appr_mgr|appr_gm|procure|delivery|schedule`. Diff terhadap item sekarang; unit baru → item rows baru (`quantity:1` per unit, sesuai pola lama), unit hilang → dihapus bila belum ARRIVED (ARRIVED → 409 `Barang yang sudah tiba tidak bisa diubah`). Simpan `replacesName` di `categorySnapshot.replaces`. Pesan sistem "RM … mengubah barang" + `Sebelum/Sesudah` + alasan; bump `GEN "Barang diubah oleh IT"`; bila sudah ada TTD atasan/GM → notifikasi ke mereka.
  - `POST /request-flow/:ticketId/procurement` `ProcureDto { lines: { itemIds: uuid[]; decision: 'APPROVED'|'REJECTED'; vendor?: string(1..255); unitCost?: number(≥0, 2 desimal); invoiceNumber?: string(≤100); invoiceDate?: 'YYYY-MM-DD' }[]; note?: string(≤1000) }` → reuse `ProcurementDecisionService` + `UpdateItemDto` field per item; semua REJECTED → 400 `Isi alasan penolakan` kecuali `note` ≥5 lalu REJECTED.
  - `POST /request-flow/:ticketId/arrivals` `{ itemIds: uuid[] }` → ARRIVED; min 1.
  - Jadwal: reuse endpoint propose/select-slot/request-reschedule yang ada (FE memanggil langsung `/hardware-requests/:id/schedule/...`); tambah `note` tersimpan di `installation_schedules.note` (kolom baru di migrasi `1794830000000-HardwareFlowColumns.ts`, juga `hardware_request_items.recipient_name varchar(120) null`).
  - `POST /request-flow/:ticketId/install-done` `InstallDoneDto { assets: { itemId: uuid; code: string(4..128, [A-Za-z0-9-_]) }[]; signatureData: string; photoUrl?: string }` — wajib satu kode per unit ARRIVED; kode unik (`HR_BARCODE_DUPLICATE`) → `HardwareAssetService` lalu `completeInstallation`; bump `DIG "TTD teknisi — n aset tercatat"`.
  - Bug fixes: list `category` filter applied (`categorySnapshot->>'category' IN (...)`); `PROCUREMENT_DONE` emitted from `ProcurementDecisionService.complete`; `AGING_FLAGGED` listener sends in-app notification `HARDWARE_REQUEST_AGING` (tambah enum di migrasi task ini) ke PIC tiket; procurement `note` disimpan di activity metadata.
- [ ] **Step 1: Write failing tests** — `swapping an item records replaces and bumps the document`; `refuses to remove an arrived unit`; `adding a unit creates one row per unit`; `procurement stores vendor, cost and invoice per item`; `all items rejected needs a note`; `procurement completion emits PROCUREMENT_DONE`; `install-done requires one unique asset code per arrived unit`; `aging flag notifies the ticket PIC`; `category filter narrows the list`; `schedule ticket listener skips requests that belong to a request flow`.
- [ ] **Step 2–4:** run each (serial) → FAIL → implement → PASS; tsc clean.
- [ ] **Step 5: Commit** `feat(request-flow): hardware items, procurement, delivery, installation; fix procurement/aging/category bugs`.

### Task 7: E-Form — beri akses, konfirmasi pemohon, kredensial, no. dokumen

**Files:**
- Modify: `eform-request/eform-request.service.ts:150-311` (fulfil & credentials → status baru `AWAITING_CONFIRMATION`), `eform-request/eform-roles.constants.ts` (pembaca kredensial = requester + ICT_ROLES), `eform-request/eform-credential.service.ts`, `eform-request/listeners/eform-notification.listener.ts`, `eform-request/eform-pdf.service.ts:474` (pakai aturan pembaca yang sama)
- Create: `request-flow/dto/fulfill.dto.ts`, `request-flow/dto/confirm.dto.ts`, migrasi `1794840000000-EformAwaitingConfirmation.ts`
- Test: `request-flow/services/request-flow.fulfill.spec.ts`, tambahan `eform-request.site-isolation.spec.ts`

**Interfaces:**
- Produces:
  - `POST /request-flow/:ticketId/fulfill` `FulfillDto { mode: 'CREDENTIALS'|'NO_CREDENTIALS'; username?; password?; server?; note?(≤2000); accountName?(≤255); signatureData: string }` — ICT, fase `fulfill`. CREDENTIALS butuh username+password (Email: server diabaikan); NO_CREDENTIALS butuh `note`. Status → `AWAITING_CONFIRMATION`, bump `DIG "TTD IT — akses diberikan"`, ticket → RESOLVED dengan `resolutionDeadlineAt` = `computeResolutionDeadline` (auto-close yang ada).
  - `POST /request-flow/:ticketId/confirm` `ConfirmDto { result: 'OK'|'ISSUE'; note?: string(≥5 bila ISSUE) }` — pemohon (atau ICT "atas nama pemohon" dengan pesan sistem berbeda). Hardware OK → `confirmInstallation(ACCEPT_AS_IS)`; ISSUE → REPORT_ISSUE. E-form OK → CONFIRMED; ISSUE → PENDING_ICT. OK → bump `FIN "Final · terkunci"`, ticket CLOSED. Auto-close ticket juga memicu OK.
  - `GET /request-flow/:ticketId/credentials` → `{ username; password; server; note; provisionedAt }` untuk pemohon + ICT_ROLES; setiap panggilan menulis activity `CREDENTIALS_VIEWED`.
  - `PATCH /request-flow/:ticketId/document-number` `{ value: string }` — ICT; reuse validasi `eform-document.service.ts:44-75` (regex `^[A-Za-z0-9/._-]{1,50}$`, unik) untuk e-form; hardware menyimpan di `hardware_requests.requestNumber` dengan validasi sama + unik.
- [ ] **Step 1: Write failing tests** — `fulfil with credentials moves to awaiting confirmation and resolves the ticket`; `fulfil without credentials needs a note`; `requester confirmation closes the ticket and finalises the document`; `issue sends eform back to PENDING_ICT and the ticket to IN_PROGRESS`; `a MANAGER who is not the requester cannot read credentials`; `credential reads are logged`; `document number must be unique`.
- [ ] **Step 2–4:** FAIL → implement → PASS; tsc clean.
- [ ] **Step 5: Commit** `feat(request-flow): eform fulfilment, requester confirmation, credential access`.

### Task 8: List & stats tiket: filter tipe, fase, persetujuan; endpoint "Perangkat & Akses"

**Files:**
- Modify: `ticketing/services/ticket-query.service.ts` (`findAllPaginated` + `getQueueStats` terima `requestKind?: 'IT'|'HARDWARE'|'EFORM'`; list menyertakan `flowPhase`, `flowPhaseLabel`, `flowPaused` per tiket lewat LEFT JOIN `request_flows`; USER scope tidak lagi mengecualikan tiket request), `ticketing/dto/pagination.dto.ts:137` (`QueueStatsQueryDto.requestKind`), `hardware-request/services/hardware-catalog.service.ts` + controller (admin pakai `includeInactive`, `displayOrder` & `requiredFields` editable)
- Create: `request-flow/services/devices-access.service.ts`, endpoints `GET /request-flow/approvals` (tiket yang menunggu TTD saya), `GET /request-flow/center/schedule?weekStart=`, `GET /request-flow/center/access?group=soon|expired|active|permanent`, `GET /request-flow/center/summary`, `POST /request-flow/center/access/:eformId/remind`, `POST /request-flow/center/access/:eformId/revoke` (buat tiket IT Support "Cabut akses <jenis> — <nama>" assigned ke ops support site itu)
- Test: `request-flow/services/devices-access.service.spec.ts`, tambahan `ticketing/services/ticket-query.service.spec.ts` (atau file spec query yang ada), `hardware-request/services/hardware-catalog.service.spec.ts`

**Interfaces:**
- Produces: list item fields `requestKind: 'HARDWARE'|'EFORM'|null; flowPhase: FlowPhase|null; flowPhaseLabel: string|null; flowPaused: boolean; needsMyAction: boolean`; `getQueueStats(..., { requestKind })`; center DTOs mengikuti data yang ditampilkan mockup (`centerSched/centerAccess/centerSummary` di `ticket-unify.js`); catalog list `GET /hardware-requests/catalog?includeInactive=true` untuk ICT.
- [ ] **Step 1: Write failing tests** — `requestKind HARDWARE returns only hardware tickets`; `stats follow the type filter`; `requester sees own request tickets in My Tickets`; `approvals returns tickets waiting for my signature only`; `access groups: soon ≤7 days, expired <0, permanent null end`; `revoke creates an IT support ticket for the site`; `inactive item hidden from form but kept on existing tickets`; `schedule returns this week's confirmed installations with technician load`.
- [ ] **Step 2–4:** FAIL → implement → PASS; tsc clean.
- [ ] **Step 5: Commit** `feat(request-flow): type filter, phase in lists, approvals and devices & access endpoints`.

### Task 9: FE — tag tipe, filter Tipe, fase & SLA dijeda di list/kanban

**Files:**
- Create: `apps/frontend/src/features/ticket-board/components/request-flow/requestKind.ts`, `RequestTypeTag.tsx`, `__tests__/RequestTypeTag.test.tsx`
- Modify: `ticket-board/pages/BentoTicketListPage.tsx:525-547` (dropdown Tipe sebelum Status), `ticket-board/hooks/useTickets.ts`, `useQueueStats.ts`, `useTicketListUrlState.ts` (`?type=hardware|eform|it`), `components/TicketListRow.tsx` (tag di samping nomor, sub-fase di bawah status, SLA "Dijeda"), `components/KanbanCard.tsx`, `src/index.css` (token `--req-hw*`, `--req-ef*`)
- Test: `ticket-board/components/__tests__/TicketListRow.request.test.tsx`, `pages/__tests__/BentoTicketListPage.type-filter.test.tsx`

**Interfaces:**
- Consumes: Task 8 fields. Produces: `REQUEST_KIND_META: Record<'HARDWARE'|'EFORM', { label: 'Hardware'|'E-Form'; longLabel: 'Hardware Request'|'E-Form Request'; icon: LucideIcon; tone: 'hw'|'ef' }>`; `<RequestTypeTag kind size?="sm"|"lg" />`.
- [ ] **Step 1: Write failing tests** — row with `requestKind:'HARDWARE'` renders tag "Hardware" next to number and sub-label "Menunggu Atasan"; paused row shows "Dijeda"; IT ticket renders no tag; selecting Tipe=E-Form sets `?type=eform` and refetches with `requestKind=EFORM`; KPI counts come from stats with the same filter.
- [ ] **Step 2–4:** run each test file → FAIL → implement → PASS; `npx tsc -b` clean.
- [ ] **Step 5: Commit** `feat(ticket-board): request type tag, type filter and phase in lists`.

### Task 10: FE — detail tiket request (bar langkah, progres, dialog IT/approver/pemohon)

**Files:**
- Create: `request-flow/useRequestFlow.ts`, `NextStepBar.tsx`, `nextStep.ts` (pure: `(view, viewer) => NextStep`), `ProgressCard.tsx`, `progress.ts` (pure: stages), `RequestItemsCard.tsx`, `AccessCard.tsx`, `DocumentPane.tsx`, `picker/CatalogBasket.tsx`, `dialogs/*` (13 file daftar di File Structure)
- Modify: `ticket-board/pages/BentoTicketDetailPage.tsx`, `components/ticket-detail/TicketHeader.tsx` (request: satu chip fase, tanpa Teruskan/Selesaikan, menu ⋯ Batalkan/Unduh PDF), `components/ticket-detail/TicketSidebar.tsx` (kartu progres/barang/akses/dokumen/detail menggantikan Properti untuk tiket request), `components/ticket-detail/DetailTabs.tsx` (tab Rincian & Dokumen), `client/pages/ClientTicketDetailPage.tsx`, `client/components/ClientTicketInspector.tsx`
- Test: `request-flow/__tests__/nextStep.test.ts`, `progress.test.ts`, `CatalogBasket.test.tsx`, `ApprovalDialog.test.tsx`, `InstallDoneDialog.test.tsx`, `PaperSignDialog.test.tsx`

**Interfaces:**
- Consumes: Task 4–7 endpoints; `RequestFlowView`.
- Produces: `nextStep(view: RequestFlowView, viewer: 'REQUESTER'|'APPROVER_CURRENT'|'APPROVER'|'ICT'|'OBSERVER'): { mine: boolean; tone: 'hw'|'ef'|'navy'; icon: string; title: string; sub: string; primary?: Action; second?: Action; more: Action[] }` — table persis `nextOf` di `mockups/ticket-unify.js` (revisi 3+5). `stagesOf(view): Stage[]` persis `stagesOf/stageInfo` mockup.
- Dialog behaviour = mockup: Review (picker + sumber + rute + atasan/GM + pesan); Approval (ringkasan + Setuju/Kembalikan/Tolak + pad TTD — reuse `request-center/components/eform/SignaturePad.tsx`, pindahkan ke `components/ui/SignaturePad.tsx`); PaperSign (3 langkah, unggah, baca QR dengan `@zxing/browser` dari gambar/halaman PDF pertama via `pdfjs-dist@4.10.38`, tampilkan cocok/tidak); Procurement (per barang Beli/Batal + vendor/harga/invoice); Arrival; Schedule (barang, teknisi dari `GET /users/technicians` + beban dari center/summary, 1–3 slot preset); PickSlot (+ minta waktu lain, sisa kuota); InstallDone (kode aset per unit, scan kamera via `useBarcodeScanner` yang ada); Fulfill (2 mode); Credential (mask/mata/salin); EditItems (picker + alasan); DocNumber; Issue.
- [ ] **Step 1: Write failing tests** — `nextStep` table (min. 14 kasus: tiap fase × peran utama, termasuk "Bukan giliran Anda" untuk observer dan E-Form done → Perpanjang); `stagesOf` (stok IT melewati pengadaan; NAS rute NONE melewati atasan/GM); `CatalogBasket` tambah/klik ulang menambah qty, Ganti mengganti & menandai "Pengganti dari", Tulis manual, isian wajib memblok submit; `ApprovalDialog` tombol berubah per pilihan & RETURN/REJECT butuh alasan; `InstallDoneDialog` menolak kode kosong/ganda; `PaperSignDialog` menolak QR versi lama.
- [ ] **Step 2–4:** run each → FAIL → implement → PASS; tsc clean.
- [ ] **Step 5: Visual check** — jalankan app lokal (`dev.bat` / vite :4050 + backend :5050), buka tiket hardware & e-form sebagai agent, pemohon, atasan di 1366×768 dan 1920×1080 dengan Playwright; bandingkan dengan mockup (bar langkah satu tombol utama, chat ≥ 55% tinggi panel). Simpan screenshot ke `docs/superpowers/evidence/2026-11-22-unify/`.
- [ ] **Step 6: Commit** `feat(ticket-board): guided request detail with progress, documents and dialogs`.

### Task 11: FE — Buat Tiket: form Hardware & E-Form

**Files:**
- Create: `client/components/create-request/HardwareRequestForm.tsx`, `EformRequestForm.tsx`, `eform/{VpnFields,WebsiteFields,NetworkFields,FlashdiskFields,EmailFields,NasFields}.tsx`, `eform/PeriodPicker.tsx`, `eform/TermsGate.tsx`, `picker/RecipientInput.tsx` (di `ticket-board/components/request-flow/picker/`), `useRequestDraft.ts`
- Modify: `client/components/create-ticket/createTicketConfig.ts:255-278` (kartu `hardware-request` & `eform-request` → `setTicketType('hardware'|'eform')`, judul/desk/cta persis mockup `CT_CARDS`), `client/pages/BentoCreateTicketPage.tsx` (render form baru; `?renewFrom=<ticketId>`)
- Test: `create-request/__tests__/HardwareRequestForm.test.tsx`, `EformRequestForm.test.tsx`, `PeriodPicker.test.tsx`, `useRequestDraft.test.ts`

**Interfaces:**
- Consumes: Task 3 endpoints; `CatalogBasket` (Task 10).
- Produces: `useRequestDraft<T>(key: string, initial: T): [T, (next: T) => void, () => void]` (localStorage, try/catch, debounce 500 ms; key `idesk:req-draft:<userId>:<kind>`).
- Rules = spec §Buat Tiket (langkah bernomor, validasi & pesan persis `efMissing`/`submitCreate` mockup, email local-part dipaksa `[a-z0-9._-]` lowercase, preset masa berlaku per jenis, S&K aktif setelah scroll ke bawah, NAS: server multi, folder unik per server, maks 5 screenshot via `POST /uploads` yang ada).
- [ ] **Step 1: Write failing tests** — hardware: submit tanpa barang → "Pilih minimal satu barang"; isian wajib kosong → "Lengkapi <barang>: <isian>"; penerima per barang muncul bila >1 penerima; e-form: VPN 13 bulan → "Maksimal 12 bulan"; EMAIL tanpa tanggal selesai lolos; S&K checkbox disabled sampai scroll bawah; NAS folder duplikat → "Folder sudah ada"; renewFrom menyalin jenis & tanggal (mulai = akhir lama); `restores the draft after reload`.
- [ ] **Step 2–4:** FAIL → implement → PASS; tsc clean.
- [ ] **Step 5: Commit** `feat(create-ticket): unified hardware and eform request forms`.

### Task 12: FE — Portal pemohon & approver

**Files:**
- Modify: `client/pages/BentoMyTicketsPage.tsx` (segmented Semua/IT Support/Hardware/E-Form, kolom Status + sub-fase, chip "Perlu tindakan Anda", kartu Akses aktif), `client/components/MyTicketsParts.tsx`, `components/layout/ClientLayout.tsx:21-28` (hapus item Hardware/E-Form; tambah "Persetujuan" bila `GET /request-flow/approvals` > 0 atau user pernah jadi approver), `components/layout/ManagerSidebar.tsx`
- Create: `client/components/ActiveAccessCard.tsx`, `client/pages/ApprovalsPage.tsx` (route `/client/approvals`, `/manager/approvals`)
- Test: `client/components/__tests__/ActiveAccessCard.test.tsx`, `client/pages/__tests__/ApprovalsPage.test.tsx`, `BentoMyTicketsPage.type.test.tsx`

**Interfaces:** Consumes Task 8 (`needsMyAction`, `requestKind`, approvals) & Task 7 credentials.
- [ ] **Step 1: Write failing tests** — access card shows "Sisa 5 hari" amber and Perpanjang for ≤30 days, hides Perpanjang for permanent; approvals page lists only tickets waiting for me, row opens the ticket; type segment filters; "Perlu tindakan Anda" appears for confirm/pick-slot phases.
- [ ] **Step 2–4:** FAIL → implement → PASS; tsc clean.
- [ ] **Step 5: Commit** `feat(client): unified my tickets, approvals tab and active access card`.

### Task 13: FE — Menu "Perangkat & Akses"

**Files:**
- Create: `features/devices-access/{api.ts,pages/DevicesAccessPage.tsx,tabs/ScheduleTab.tsx,tabs/AccessExpiryTab.tsx,tabs/CatalogTab.tsx,tabs/SummaryTab.tsx,tabs/CatalogEditDialog.tsx}`
- Modify: `components/layout/BentoSidebar.tsx:231-238` (hapus Hardware Requests & E-Form Access; tambah `{ key:'devices_access', icon: Package, tone:'orange', label:'Perangkat & Akses', path:'/devices-access' }` dengan badge = belum dijadwalkan + segera berakhir), `lib/pageDefinitions.ts` (page key `devices_access` menggantikan `hardware_requests`+`eform_access`; migrasi data page access di Task 14), `routes/AppRoutes.tsx` (`/devices-access/:tab?`, ICT roles)
- Test: `devices-access/__tests__/{ScheduleTab,AccessExpiryTab,CatalogTab}.test.tsx`

**Interfaces:** Consumes Task 8 center endpoints & catalog CRUD. Isi tiap tab = `centerSched/centerAccess/centerCatalog/centerSummary` + `catForm` di mockup (copy, kolom, KPI, aksi).
- [ ] **Step 1: Write failing tests** — schedule filters by technician; access tab KPI click switches group, "Cabut akses" calls revoke and toasts "Tiket pencabutan akses dibuat untuk IT"; catalog: code auto-uppercase & spaces→`_`, duplicate code error, toggle "Tampil di form", isian tambahan tipe Pilihan butuh opsi, nonaktif terlihat dengan filter.
- [ ] **Step 2–4:** FAIL → implement → PASS; tsc clean.
- [ ] **Step 5: Commit** `feat(devices-access): schedule, access expiry, catalog and summary`.

### Task 14: Redirect, notifikasi, search, hapus UI lama

**Files:**
- Modify: `routes/AppRoutes.tsx` (`/hardware-requests/:id`, `/eform-access/:id`, `/eform/:id`, varian `/client` `/manager` → komponen `LegacyRequestRedirect` yang memanggil `GET /request-flow/by-legacy/:kind/:id` → navigate ke tiket portal yang benar; list lama → tiket berfilter; `/hardware-requests/calendar|catalog|dashboard` → tab Perangkat & Akses), `components/notifications/utils/notificationRouter.ts` (CATEGORY_HARDWARE/EFORM → tiket induk via `referenceId` lookup), `features/search/*` (HW scope → tiket bertipe), backend email links `buildAppUrl('/eform/'+id)` dan hardware → `/tickets/<ticketId>` (`eform-notification.listener.ts`, `email-notifier.listener.ts`), migrasi `1794850000000-DevicesAccessPageKey.ts` (user/preset yang punya `hardware_requests` atau `eform_access` → `devices_access` untuk role ICT; dihapus untuk USER)
- Create: `request-flow` endpoint `GET /request-flow/by-legacy/:kind/:id` → `{ ticketId }`
- Delete: daftar di File Structure (UI lama), plus komponen ticket-board `ticket-hardware/ProposeHardwareDialog`, `ticket-eform/ProposeEFormDialog` dan menu "+" usulan (alur usulan dari tiket digantikan: IT membuat tiket request atas nama pemohon dari Buat Tiket dengan `RequesterSelector` yang sudah ada)
- Test: `routes/__tests__/LegacyRequestRedirect.test.tsx`, `notificationRouter.test.ts` (tambahan), `request-flow/presentation/by-legacy.spec.ts`, migration spec

- [ ] **Step 1: Write failing tests** — `/client/eform-access/<id>` redirects to `/client/tickets/<ticketId>`; unknown legacy id → `/client` home with toast "Permintaan tidak ditemukan"; hardware notification opens the ticket; page-key migration maps both keys to `devices_access` for ICT presets only.
- [ ] **Step 2–4:** FAIL → implement → PASS; tsc both apps clean; `grep -rn "request-center/pages\|hardware-request/pages" apps/frontend/src` → no matches.
- [ ] **Step 5: Commit** `refactor(request-flow): redirect legacy request pages and remove old UI`.

### Task 15: Verifikasi end-to-end

- [ ] **Step 1:** Jalankan setiap spec BE yang disentuh (serial, satu per perintah) dan setiap test FE yang disentuh; catat hasil.
- [ ] **Step 2:** `npx tsc --noEmit -p apps/backend`, `npx tsc -b apps/frontend`, `npm run lint` di frontend (batas warnings tidak naik).
- [ ] **Step 3:** Migrasi di DB lokal (`npm run migration:run` di apps/backend terhadap DB dev) lalu jalankan ulang (idempoten). Cek jumlah tiket baru = jumlah request lama standalone.
- [ ] **Step 4:** Playwright skenario mockup penuh di app nyata, viewport 1366×768: (a) pemohon buat Hardware 2 barang + 2 penerima → IT review ganti barang, Non-budget, Atasan saja → atasan Setuju → IT beli 1/batal 1 → tiba → jadwal 2 slot → pemohon minta waktu lain → IT jadwal ulang → pemohon pilih → IT pasang + 2 kode aset → pemohon konfirmasi → tiket CLOSED, dokumen FINAL. (b) E-Form VPN rute Atasan+GM, TTD kertas (versi lama ditolak, terbaru diterima), GM digital, IT kredensial, pemohon lihat & konfirmasi, perpanjang dari kartu Akses aktif. (c) NAS rute Tanpa, tanpa kredensial. Screenshot tiap langkah ke `docs/superpowers/evidence/2026-11-22-unify/`.
- [ ] **Step 5:** Laporkan hasil (lulus/gagal per skenario dengan bukti); commit evidence `test(request-flow): end-to-end evidence`.
