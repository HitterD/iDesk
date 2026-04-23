# E-Form Access Redesign — Design Spec

**Date:** 2026-04-23  
**Status:** Approved  
**Scope:** Frontend rework + backend approval flow simplification + credential management page

---

## 1. Problem Statement

Halaman E-Form Access saat ini memiliki:
- Label "Section 1/2/3:" yang tidak sesuai dengan feel form PDF
- Nama Pemohon & Departemen tidak bisa diedit (read-only dari auth)
- Alur approval 2 level manager (MANAGER_1 + MANAGER_2) — overkill untuk kebutuhan aktual
- Tidak ada halaman dedicated untuk ICT memasukkan kredensial akses
- Dropdown atasan hanya ambil dari `/users/approvers` — seharusnya semua user

---

## 2. Decisions

| Keputusan | Pilihan |
|-----------|---------|
| Layout form | **C — Modern Compact**: gradient header, semua field satu scroll area |
| Workflow | **A — Linear**: User → Atasan → ICT → Done |
| Cara atasan review | **Y — Halaman detail tersendiri** (`/eform-requests/:id/approve`) |
| Syarat & Ketentuan | **Tetap**, sebagai inline checkbox dalam form |
| Dropdown atasan | **Semua user dari DB** (endpoint `/users`) |
| ICT notif | **ADMIN + AGENT_ADMIN** roles |

---

## 3. Status Enum (Baru)

```
DRAFT → PENDING_MANAGER → PENDING_ICT → CONFIRMED
                                      → REJECTED
```

**Hapus:** `PENDING_MANAGER_2`  
**Rename:** `PENDING_MANAGER_1` → `PENDING_MANAGER`

---

## 4. Workflow Linear

```
1. User isi form + TTD + pilih atasan → Submit
2. Status: PENDING_MANAGER
3. Notifikasi real-time → manager yang dipilih
4. Manager buka /eform-requests/:id/approve
5. Manager review + TTD + klik Setujui / Tolak
   - Setujui: status → PENDING_ICT, notif ke semua ADMIN + AGENT_ADMIN
   - Tolak: status → REJECTED, notif ke requester dengan alasan
6. ICT buka /eform-requests/:id/credentials
7. ICT input username VPN, password awal, VPN server, catatan → Selesai
8. Status → CONFIRMED, notif ke requester berisi kredensial
```

---

## 5. Frontend Changes

### 5.1 EformAccessCreatePage.tsx (rework)

**Hapus:**
- Heading "Section 1: ...", "Section 2: ...", "Section 3: ..."
- Progressive disclosure (auto-scroll antar section)
- Card terpisah per section

**Ubah:**
- Layout → Modern Compact: gradient header + semua field dalam satu scroll area
- `Nama Pemohon`: editable `<Input>`, prefilled dari `user.fullName`
- `Departemen`: editable `<Input>`, prefilled dari `user.department?.name`
- T&C (TermsAndConditions): inline checkbox, bukan card terpisah
- `ManagerSelector`: fetch dari `GET /users` (semua user, bukan `/users/approvers`)

**Layout field order:**
```
[Header gradient: E-FORM ACCESS REQUEST]
[Jenis Akses: VPN | Website | Network tabs]
[Nama Pemohon*] [Departemen*]
[Dari Tanggal] [Sampai Tanggal]
[Field spesifik per tipe akses]
[Alasan Pengajuan*]
---divider---
[Atasan Persetujuan* — dropdown semua user]
---divider---
[T&C inline checkbox]
[Tanda Tangan Pemohon]
  → Nama Terang (auto-fill fullName)
  → Tanggal TTD (auto-timestamp saat save)
[Tombol: KIRIM PENGAJUAN]
```

### 5.2 SignaturePad.tsx (update)

Tambah 2 field di bawah canvas signature:
- **Nama Terang**: read-only, auto-filled dari prop `signerName`
- **Tanggal TTD**: read-only, auto-filled dengan `new Date()` saat signature di-save/lock

Setelah di-lock, kedua field tidak bisa diubah. Data dikirim sebagai bagian dari `signatureData` object: `{ dataUrl, signerName, signedAt }`.

### 5.3 EformApprovalPage.tsx (halaman baru)

**Route:** `/eform-requests/:id/approve`  
**Akses:** Hanya manager yang dipilih sebagai `currentApproverId`

**Konten:**
- Info form: Pemohon, Departemen, Jenis Akses, Periode, Alasan
- Tanda tangan pemohon (read-only: canvas + nama terang + tanggal)
- Tanda tangan atasan: SignaturePad aktif + Nama Terang + Tanggal TTD
- Tombol: **✓ SETUJUI** | **✗ TOLAK** (dengan input alasan jika tolak)

**Guard frontend:** Cek `eformRequest.currentApproverId === currentUser.id`, jika bukan → redirect.

### 5.4 EformCredentialPage.tsx (halaman baru)

**Route:** `/eform-requests/:id/credentials`  
**Akses:** 
- ICT (ADMIN / AGENT_ADMIN): lihat + input kredensial
- Requester (`requesterId === currentUser.id`): lihat read-only (setelah CONFIRMED)
- Manager: diblokir → redirect 403/forbidden

**ICT view (PENDING_ICT):**
- Input: Username VPN, Password Awal, VPN Server/Host, Catatan ICT (opsional)
- Tombol: **✓ SELESAI — KIRIM KREDENSIAL KE USER**

**User view (CONFIRMED):**
- Tampilkan credential box: Username, Password Awal, Server
- Warning: "Segera ganti password setelah login pertama"
- Read-only, tidak bisa diubah

---

## 6. Backend Changes

### 6.1 EFormStatus enum

```typescript
export enum EFormStatus {
  DRAFT = 'DRAFT',
  PENDING_MANAGER = 'PENDING_MANAGER',   // renamed dari PENDING_MANAGER_1
  PENDING_ICT = 'PENDING_ICT',
  CONFIRMED = 'CONFIRMED',
  REJECTED = 'REJECTED'
  // HAPUS: PENDING_MANAGER_2
}
```

### 6.2 eform-request.service.ts

- `create()`: set status = PENDING_MANAGER setelah submit, kirim notif ke `managerId`
- `approveByManager()`: 
  - Jika approve: status → PENDING_ICT, kirim notif ke semua user role ADMIN + AGENT_ADMIN
  - Jika reject: status → REJECTED, simpan `rejectionReason`, notif ke requester
- `submitCredentials()`: status → CONFIRMED, notif ke requester berisi kredensial

### 6.3 Endpoints

| Method | Path | Akses | Keterangan |
|--------|------|-------|------------|
| GET | `/users?limit=200` | Authenticated | Semua user untuk dropdown atasan — endpoint sudah ada, pakai query param limit |
| POST | `/eform-requests` | USER | Submit form baru |
| GET | `/eform-requests/:id` | Owner/Manager/ICT | Detail form |
| POST | `/eform-requests/:id/approve` | Manager (currentApprover) | Approve/reject |
| GET | `/eform-requests/:id/credentials` | ICT + Requester | Lihat kredensial |
| POST | `/eform-requests/:id/credentials` | ICT only | Input kredensial |

> **Note:** `GET /users` sudah ada dengan pagination. ManagerSelector update: fetch `/users?limit=200` atau tambah endpoint `/users/all` tanpa pagination jika perlu.

### 6.4 CredentialAccessGuard

```typescript
// Guard untuk /credentials endpoint
canActivate(context): boolean {
  const user = getUser(context);
  const eform = getEform(context);
  const isICT = [UserRole.ADMIN, UserRole.AGENT_ADMIN].includes(user.role);
  const isRequester = eform.requesterId === user.id;
  return isICT || isRequester;
}
```

### 6.5 EFormSignature entity (update)

Tambah kolom:
```typescript
@Column({ type: 'varchar', nullable: true })
signerName: string;   // nama terang

@Column({ type: 'timestamp', nullable: true })
signedAt: Date;       // timestamp tanda tangan
```

### 6.6 EFormCredential entity (update)

Entity sudah ada dengan enkripsi (`encryptedUsername`, `encryptedPassword`, `iv`, `authTag`). Tambah kolom yang belum ada:
```typescript
@Column({ type: 'varchar', nullable: true })
vpnServer: string;    // host/server VPN

@Column({ type: 'text', nullable: true })
notes: string;        // catatan ICT
```

### 6.7 Notification flow

| Event | Penerima |
|-------|---------|
| User submit | Manager yang dipilih |
| Manager approve | Semua ADMIN + AGENT_ADMIN |
| Manager reject | Requester |
| ICT submit credentials | Requester |

---

## 7. Access Control Summary

| Halaman | USER (requester) | Manager | ICT |
|---------|-----------------|---------|-----|
| Form create | ✅ | ❌ | ❌ |
| Form detail | ✅ (own) | ✅ (assigned) | ✅ |
| Approval page | ❌ | ✅ (assigned only) | ❌ |
| Credential page | ✅ (read-only, post-confirmed) | ❌ | ✅ (full) |

---

## 8. Files to Create/Modify

### Create
- `apps/frontend/src/features/request-center/pages/EformApprovalPage.tsx`
- `apps/frontend/src/features/request-center/pages/EformCredentialPage.tsx`
- `apps/backend/src/modules/eform-request/guards/credential-access.guard.ts`

### Modify
- `apps/frontend/src/features/request-center/pages/EformAccessCreatePage.tsx`
- `apps/frontend/src/features/request-center/components/eform/SignaturePad.tsx`
- `apps/frontend/src/features/request-center/components/eform/ManagerSelector.tsx`
- `apps/frontend/src/features/request-center/api/eform-request.api.ts`
- `apps/backend/src/modules/eform-request/eform-request.service.ts`
- `apps/backend/src/modules/eform-request/eform-request.controller.ts`
- `apps/backend/src/modules/eform-request/entities/eform-request.entity.ts`
- `apps/backend/src/modules/eform-request/entities/eform-signature.entity.ts`
- `apps/backend/src/modules/eform-request/dto/create-eform-request.dto.ts`
- Router (tambah 2 route baru)
