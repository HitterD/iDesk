---
description: Panduan AI untuk merancang, mengumpulkan requirement, dan mempersiapkan implementasi fitur baru di iDesk bersama user agar tidak terjadi bug/error.
---

# /feature-request — Feature Design & Planning Workflow

> **Tujuan:** Merancang fitur baru secara komprehensif (end-to-end) sebelum penulisan kode dimulai. AI bertindak sebagai System Analyst & Tech Lead untuk menggali requirement, merancang arsitektur, memvalidasi edge cases, dan menyusun spesifikasi teknis (Implementation Plan) berdasarkan **Master Rules Gemini**.

---

## Cara Pakai

```
/feature-request [nama/deskripsi singkat fitur]
```

**Contoh:**
- `/feature-request sistem export laporan ke PDF`
- `/feature-request filter realtime pada ticket board`
- `/feature-request role management yang lebih granular`

---

## Langkah-Langkah Sistematis (AI Execution Steps)

AI **WAJIB** menjalankan langkah-langkah di bawah ini secara sekuensial. JANGAN melompat ke penulisan kode sebelum *Tahap 3 (Implementation Plan)* disetujui oleh User.

### TAHAP 1: Requirement Gathering & Ambiguity Check (Master Rule: Ask Before Assume)

1. **Analisis Initial Request:** Pahami deskripsi fitur. Identifikasi *What, Why, Where, How, Risk, Gaps*.
2. **Klarifikasi Wajib (The Interrogation):** Ajukan pertanyaan spesifik kepada user untuk mengisi "Gaps" (jangan tanya sekaligus terlalu panjang, kelompokkan pertanyaannya). Fokus pada:
   - **Business Logic & Scope:** Apa saja data spesifik yang diolah? Siapa (role apa) yang bisa mengaksesnya?
   - **User Experience (UX):** Di mana letak fitur ini di UI existing? (Modal, page baru, inline?)
   - **Edge Cases & Failure Modes:** Apa ekspektasi sistem jika data kosong? Jika API gagal? Jika user tidak punya permission?
   - **Dependencies:** Apakah perlu third-party service/API?

⛔ *AI WAJIB berhenti sejenak dan menunggu jawaban user sebelum lanjut membuat Implementation Plan final.*

---

### TAHAP 2: Analisis Existing System (Master Rule: Read Before Speak & Evidence First)

// turbo-all

3. **Discovery & Reconnaissance:** Gunakan tools pencarian (`grep_search`, `list_dir`, `view_file`) untuk memetakan referensi codebase yang ada:
   - **Database:** Cek `apps/backend/prisma/schema.prisma` untuk relasi data.
   - **Backend Modules:** Cari modul terkait di `apps/backend/src/modules/` (Controller, Service, Entity).
   - **Frontend Components:** Cari halaman/komponen relevan di `apps/frontend/src/features/`.
4. **Pattern Matching:** Temukan kode existing yang bisa dijadikan *template* atau rujukan (misal: pattern CRUD, socket handling, custom hooks, struktur file). **KONSISTENSI > PREFERENSI**.
5. **Impact Analysis:** Analisis risiko. File apa saja yang akan terpengaruh? Apakah berisiko merusak endpoint/UI/komponen shared lain?

---

### TAHAP 3: Technical Design & Implementation Plan (Master Rule: Plan Before Execute)

6. **Susun Draft Implementation Plan:** Buat `implementation_plan.md` artifact (atau presentasikan dalam format *markdown* yang rapi di chat) dengan struktur detail:

```markdown
# 🚀 Implementation Plan: [Nama Fitur]

## 1. Goal & Scope
[Ringkasan eksekutif fitur & batasan scope]

## 2. Database / Schema Changes
- [ ] Model `[NamaModel]` (tambah/modifikasi)
- [ ] Fields: `field1` (String), `field2` (Boolean), dll.

## 3. Backend (API & Services)
- [ ] DTO: `Create[X]Dto`, `Update[X]Dto`
- [ ] Controller: Endpoint `GET`, `POST`, `PATCH`
- [ ] Service: Core logic, error handling
- [ ] Security: Guard (Role requirement: `ADMIN` / `AGENT`)

## 4. Frontend (UI & State)
- [ ] Types & Interface: `types.ts`
- [ ] API Integration: Tambah endpoint di `api.ts` atau buat custom hook (TanStack Query)
- [ ] Components: `[NamaComponent].tsx` (Styled with Glassmorphism, Tailwind)
- [ ] Page Integration: Route & render logic
- [ ] UX Details: Skeleton loaders, empty states, error handling (`useApiError`)

## 5. Risk & Edge Cases Mapping
| Skenario | Expected Behavior |
|----------|-------------------|
| Error 500 API | Muncul toast error via `toast` / `useApiError` |
| No Data (Empty) | Tampil `<EmptyState>` ilustrasi |
| Unauthorized | Redirect back atau hide UI element |
```

7. **Review Gate:** Tanyakan kepada user secara eksplisit: *"Apakah Implementation Plan ini sudah sesuai dengan ekspektasi? Jika disetujui, saya akan mulai tahap eksekusi kode (Database & Backend First)."*

---

### TAHAP 4: Atomic Execution (Master Rule: Correct Before Continue)

8. **Eksekusi Bertahap (Step-by-Step):** Kerjakan satu lapisan pada satu waktu. Jangan memodifikasi banyak fitur sekaligus tanpa validasi di antara langkah-langkahnya.
   - **Step A:** Database Schema & Prisma Migrate (berikan instruksi migrasi jika butuh).
   - **Step B:** Backend (DTO, Entity, Service, Controller) -> Verifikasi endpoint dan TS errors.
   - **Step C:** Frontend API Layer & Types (`types.ts`, `lib/api.ts`).
   - **Step D:** Frontend UI Components & Page Integration.
9. **Verify Tiap Langkah:** Pastikan build frontend dan backend valid, tidak ada TypeScript error yang mengganggu, dan mengikuti pola/aturan project yang ada.

---

### TAHAP 5: Final Review & Delivery (Master Rule: Test Before Done)

10. **QA Self-Check:**
    - Apakah semua requirement dari awal sudah terpenuhi?
    - Apakah error handling (timeout, validation, permission) sudah terpasang?
    - Apakah UI sudah konsisten dengan *design system* (`index.css`, `glassmorphism.css`, `consistency.css`)?
    - Apakah *tidak ada kode hardcoded* yang rentan menimbulkan *bug* jika data berubah?
11. **Final Report:** Berikan laporan ringkas fitur apa saja yang sudah selesai, file apa saja yang diubah, serta panduan untuk user agar bisa melakukan *manual test* (bila perlu).

---

## 🚫 AI Mandatory Constraints (CHECKLIST HARGA MATI!)
- [x] **JANGAN BERASUMSI:** Jika detail skenario (A/B/C) tidak disebut user sejak awal, WAJIB TANYA!
- [x] **JANGAN FAKE CONFIDENCE:** Jika tidak yakin pattern backend/frontend yang benar di codebase ini, WAJIB *search/view file* terkait dulu!
- [x] **SINGLE RESPONSIBILITY & DRY:** Pastikan fungsi dan komponen mudah dire-use dan tidak ada banyak redundansi. (Jangan biarkan 1 file reaktif (*.tsx*) membengkak lebih dari 300-400 baris kalau bisa dipecah).
- [x] **ROLLBACK AWARENESS:** Pastikan bisa segera mereset/mundur satu langkah kalau di tengah eksekusi ada *TS error* atau fitur lama rusak.
