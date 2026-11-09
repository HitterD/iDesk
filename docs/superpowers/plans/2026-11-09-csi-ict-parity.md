# CSI ICT parity (fungsi pelayanan, report per tim, hasil anonim) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Fitur CSI HC yang baru (fungsi pelayanan di kartu, report per layanan untuk penanggung jawab, hasil penilaian anonim, statistik belum menilai per departemen) juga tersedia untuk ICT, dengan "layanan" ICT = tim penanganan.

**Architecture:** ICT tetap memakai model subjek ICT yang sudah ada (agent per site + tim per site, `csi_subject_profiles`), TIDAK dipindah ke `csi_pics` (data prod ICT tidak disentuh). Layanan ICT diturunkan dari role agent (sama seperti `report-team-scope.util.ts`): OPS (AGENT, AGENT_ADMIN, AGENT_OPERATIONAL_SUPPORT), ORACLE, WEB, MOBILE, MGR (MANAGER). Fungsi pelayanan ICT = kolom baru `serviceFunction` di `csi_subject_profiles`, di-snapshot ke `csi_period_ratees.serviceCode/serviceFunction` saat penugasan. Service report owners & self results digeneralisasi per scope; HC tidak berubah perilakunya.

**Spec:** memory `csi-hc-service-function-decisions.md` bagian "Keputusan ICT parity".

## Global Constraints
- Pertanyaan ICT TIDAK diubah (CSI_TEMPLATE_2025 tetap). Survei & laporan ICT lama tidak berubah.
- "Hasil penilaian saya" ICT hanya untuk periode ICT dengan `createdAt >= ICT_SELF_RESULTS_FROM` (tanggal rilis, konstanta) — survei lama tidak ditampilkan.
- Migrasi additive saja. Tes serial (`--runInBand`, `--pool=forks`), satu file per kali.
- Tidak ada perilaku HC yang berubah (semua tes HC tetap hijau).

## Review Focus
1. Periode ICT lama: self results kosong, report tidak berubah, form tidak berubah selain chip fungsi pelayanan.
2. Agent ICT yang dinilai sekaligus penanggung jawab tim: baris dirinya anonim (logika HC dipakai ulang).
3. TEAM ratee (tim per site) di ICT: tidak punya layanan; tidak masuk report per tim, tetap di report admin.
4. Role berubah setelah survei dibuat: layanan pakai snapshot periode (bukan role saat ini).
5. Endpoint HC tetap menolak/menerima persis seperti sebelumnya.

### Task 1: Layanan ICT + fungsi pelayanan subjek ICT
- Migration `1794200000000-CsiIctServiceFunction`: `csi_subject_profiles.serviceFunction varchar(150) NULL`.
- `org/csi-services.ts`: `CSI_SERVICES: Record<ServiceScope, Array<{ code; name }>>` (HC = HCC/HCD/HCS dari CSI_HC_SERVICES; ICT = OPS/ORACLE/WEB/MOBILE/MGR), `ictServiceOfRole(role)`, `serviceNameOf(scope, code)`.
- Subject master: edit fungsi pelayanan per orang ICT (SubjectEditSheet field), `CsiSubjectView.serviceFunction`.
- Snapshot: `toSnapshot(user, …)` untuk scope ICT mengisi `serviceCode = ictServiceOfRole(user.role)`, `serviceFunction = profile.serviceFunction` (ratee baru & sinkron people).
- Form: `formProfile` sudah mengirim `ratee.serviceFunction` → kartu ICT menampilkannya.
- Tests: snapshot ICT mengisi serviceCode/serviceFunction; TEAM ratee tidak; role → layanan.

### Task 2: Report owners & service report per scope
- `CsiReportAccessService` pakai `CSI_SERVICES[scope]`; admin endpoint `report-owners` terima ICT; `csi/me/:scope/...` (tambahan rute ICT; rute HC lama `csi/me/hc/...` tetap).
- `CsiServiceReportService` parametris scope; recap ICT dibangun dari ratee PERSON dengan `serviceCode` (pic = ratee, bagian = site code).
- Frontend: ReportOwnersTab untuk ICT (label tim), CsiServiceReportPage memilih scope dari akses (`report-access` per scope).
- Tests: owner OPS ICT hanya melihat OPS; baris diri anonim; HC tetap.

### Task 3: Self results ICT (survei baru saja) + pending per departemen ICT
- `CsiSelfResultService`: scope HC ATAU (ICT dan `period.createdAt >= ICT_SELF_RESULTS_FROM`).
- RespondentStatus: rekap per departemen + "Tampilkan nama" untuk ICT juga.
- Tests: periode ICT lama tidak tampil, baru tampil; HC tidak berubah.

### Task 4: Verifikasi, demo lokal, PR
- Suite CSI serial; tsc; eslint; build; demo ICT lokal + screenshot; PR + CI.
