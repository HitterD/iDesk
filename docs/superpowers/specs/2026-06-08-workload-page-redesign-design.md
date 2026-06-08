# Workload Page Redesign - Design Spec

## Context
Saat ini, halaman Pusat Komando Beban Kerja (Admin Workload Dashboard) di aplikasi iDesk menampilkan *blank slate* (layar kosong) jika admin belum memilih "Site". Komponen pemilih Site berbentuk dropdown yang agak tersembunyi di pojok kanan atas. Hal ini membingungkan *user/admin* karena data tidak otomatis muncul.

## Purpose & Goal
- Mengeliminasi layar kosong agar halaman lebih interaktif dan data-driven sejak detik pertama.
- Mempermudah pemilihan Site dengan membuat UI lebih eksplisit.
- Menghadirkan kesan premium, rapi, dan fungsional sesuai filosofi "Frontend Design" (modern, meminimalisir interaksi klik berlebih).

## Design Decisions

### 1. Auto-Select Default Site
Sistem akan secara otomatis memuat data Site (berdasarkan array pertama dari daftar yang diretur API `sites`) atau menggunakan preferensi Site utama admin. Hal ini menghilangkan kondisi *blank slate* ("Belum Ada Site Terpilih").

### 2. Segmented Controls untuk Site Selector
Pemilih Site diubah dari bentuk *Dropdown Menu* menjadi *Segmented Controls* (Tab berbentuk kapsul) yang ditempatkan sejajar di area *header*. 
- **Fungsionalitas**: Menampilkan semua daftar Site yang aktif.
- **Visual & Estetika**: Menggunakan warna latar solid/lembut untuk status "Aktif", dengan efek transisi warna (*CSS hover & active state*) untuk kesan interaktif.
- **Keuntungan**: Memperjelas status Site mana yang sedang dilihat, sekaligus menyederhanakan interaksi (cukup satu klik dibandingkan dua klik pada dropdown).

## Data Flow & State Management
- `SiteSelector` masih akan me-fetch daftar Site dari API (`/sites`).
- Ketika data berhasil di-load, komponen akan men-*trigger* `onSelectionChange` dengan otomatis mengirim ID dari Site indeks pertama jika tidak ada pilihan tersimpan sebelumnya.
- Parent component (`AdminWorkloadDashboard`) akan merespons pemilihan awal ini dan langsung memanggil `fetchWorkloads(activeSiteId)` untuk me-render statistik dan tabel.

## Scope & Constraints
- Implementasi ini berpusat di halaman `AdminWorkloadDashboard.tsx` dan memodifikasi (atau menduplikasi untuk kebutuhan spesifik) komponen `SiteSelector.tsx`.
- Desain tetap mempertahankan tabel beban agen dan ringkasan eksekutif yang ada, fokus perubahan hanya pada interaksi awal dan komponen *site selection*.

---
*Spec written and validated via Brainstorming session.*
