# Spesifikasi Desain: Pelacakan Pembaca & Avatar Viewer Modal Knowledge Base

**Tanggal**: 19 Agustus 2026  
**Topik**: Pelacakan Pembaca Artikel (Viewer Tracking), Avatar Stack di Header, dan Modal "Daftar Pembaca" Realtime.

---

## 1. Ringkasan & Tujuan
Fitur ini memungkinkan pengguna dan tim IT untuk mengetahui siapa saja karyawan/user yang telah membaca artikel panduan Knowledge Base. 
- Di header artikel, ditampilkan **Avatar Stack** (3–5 foto profil pembaca terbaru beserta indikator `+X lainnya`).
- Ketika avatar stack atau tombol *"Lihat Semua"* diklik, muncul modal interaktif **"Daftar Pembaca Artikel"** yang memuat nama, role/jabatan, avatar, dan waktu terakhir melihat.
- Tersinkronisasi secara **Realtime via WebSocket** ketika ada pembaca baru yang membuka artikel.

---

## 2. Arsitektur & Perubahan Database / Backend

### A. Entity `ArticleView` (`apps/backend/src/modules/knowledge-base/entities/article-view.entity.ts`)
Tambahkan relasi ke user dan metadata pembaca:
- `userId` (UUID, nullable)
- `user` (`@ManyToOne(() => User)`)
- `userName` (string, nullable)
- `userAvatar` (string, nullable)
- `userRole` (string, nullable)
- `lastViewedAt` (Date)

### B. Endpoint API Baru & Update
1. **`POST /kb/articles/:id/view`**:
   - Mengambil identitas user dari JWT token (`req.user?.id`, `req.user?.fullName`, `req.user?.avatarUrl`, `req.user?.role`).
   - Menyimpan/mengupdate riwayat pembaca unik di tabel `article_views`.
   - Mengirim event WebSocket `kb:article:viewed` dengan payload `{ articleId, viewCount, viewer: { id, fullName, avatarUrl, role, lastViewedAt } }`.
2. **`GET /kb/articles/:id/viewers`**:
   - Mengembalikan daftar pembaca artikel terbaru dengan pagination/limit (default: 50 pembaca terbaru).
   - Format respons:
     ```json
     {
       "totalViewers": 14,
       "recentViewers": [
         {
           "id": "uuid",
           "userId": "uuid",
           "fullName": "Bagas Tyo",
           "avatarUrl": "/uploads/avatars/...",
           "jobTitle": "IT Support Engineer",
           "role": "agent",
           "lastViewedAt": "2026-08-19T10:45:00Z"
         }
       ]
     }
     ```

---

## 3. Komponen Antarmuka Frontend (UI/UX)

### A. Komponen `ArticleViewersStack.tsx`
- Menampilkan 3-4 avatar melingkar yang saling bertumpukan (*overlapping avatar stack* dengan border halus).
- Avatar dilengkapi *tooltip* berisi nama dan waktu baca saat di-hover.
- Di sebelah kanan stack terdapat pill counter: `+12 pembaca` yang dapat diklik.

### B. Komponen Modal `ArticleViewersModal.tsx`
- Dialog pop-up yang bersih (bebas ungu, anti-slop) dengan:
  - Header: *"Daftar Pembaca Artikel (14 Karyawan)"* + Search bar untuk mencari nama pembaca tertentu.
  - List Pembaca: Avatar/Inisial, Nama Lengkap, Jabatan/Role, dan waktu baca (*"5 menit yang lalu"* / *"19 Agu 2026"*).
  - Empty state jika belum ada pembaca tercatat.

### C. Integrasi Halaman
- Terpasang di **`BentoArticleDetailPage.tsx`** (Admin/Agent) dan **`ClientArticleDetailPage.tsx`** (Client/User).

---

## 4. Rencana Verifikasi
1. **Uji Realtime**: Buka artikel di satu tab browser, lalu login sebagai user lain di tab baru untuk memastikan avatar langsung muncul seketika tanpa refresh.
2. **Uji Deduplikasi**: Refresh berkali-kali pada user yang sama memastikan jumlah pembaca tidak bertambah ganda.
3. **Uji TypeScript & Unit Test**: Menjalankan `npx tsc --noEmit` dan `npm test` untuk memastikan 100% pass.
