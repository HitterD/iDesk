# Panduan Migrasi Database iDesk (DEV & PROD)

Dokumen ini menjelaskan alur kerja (workflow) migrasi skema tabel database PostgreSQL pada iDesk antara server **Development (DEV)** dan **Production (PROD)**, serta penyebab umum error dan cara mengatasinya.

---

## 1. Mengapa Error Database Sering Muncul di DEV / PROD?

### A. Di Server DEV
- **Penyebab:** Ketika Anda atau developer lain mengubah Entity (`*.entity.ts`) atau menarik (*git pull*) fitur baru yang membutuhkan tabel/kolom baru, kode TypeScript sudah merujuk kolom tersebut. Jika migrasi belum dijalankan di database lokal, PostgreSQL melempar error:
  ```text
  QueryFailedError: relation "nama_tabel" does not exist
  atau
  QueryFailedError: column "nama_kolom" of relation "nama_tabel" does not exist
  ```
- **Solusi:** Jalankan script `run_migrations.bat` untuk mengeksekusi semua migrasi yang pending ke database lokal.

### B. Di Server PROD
- **Penyebab:** Di server production (`docker-compose.prod.yml`), `DB_SYNCHRONIZE` **selalu dimatikan (`false`)** demi keamanan (agar tidak terjadi kehilangan data atau drop kolom otomatis).
- **Mekanisme Otomatis:** iDesk dikonfigurasi dengan:
  ```typescript
  migrationsRun: process.env.NODE_ENV === 'production'
  ```
  Artinya: Saat container backend iDesk menyala di Coolify, TypeORM akan **otomatis mengecek tabel `migrations` di PostgreSQL dan mengeksekusi file migrasi baru**.
- **KAPAN BISA ERROR DI PROD?**
  Error terjadi jika developer **mengubah file Entity tetapi lupa men-generate file migrasi** di DEV! Jika file migrasi tidak dibuat dan tidak di-push ke GitHub, Docker Image baru tidak membawa script migrasi -> database PROD tidak terupdate -> backend PROD crash saat query dijalankan.

---

## 2. Alur Standar (SOP) Perubahan Tabel / Skema Database

Jika Anda membuat tabel baru atau mengubah kolom di iDesk:

```text
[Ubah Entity TS] -> [generate_migration.bat] -> [run_migrations.bat] -> [push_deploy.bat] -> [Coolify Deploy]
```

1. **Ubah / Tambah Entity:**
   Edit file entity di `apps/backend/src/modules/<nama_modul>/entities/<nama>.entity.ts`.
2. **Generate File Migrasi:**
   Klik ganda `deployment\database\generate_migration.bat`.
   Ketik nama deskriptif (misal: `AddAssetWarrantyDate` atau `CreateVendorTable`).
   TypeORM akan otomatis membuat file migrasi TypeScript di `apps/backend/src/migrations/<timestamp>-<Nama>.ts`.
3. **Jalankan di Lokal (DEV):**
   Saat diminta di script, pilih `y` untuk menjalankan migrasi ke database lokal, atau klik ganda `deployment\database\run_migrations.bat`.
4. **Push ke GitHub & Build:**
   Klik ganda `deployment\deploy\push_deploy.bat` (atau `push_deploy.bat` di root).
   Script akan mendeteksi file migrasi baru, men-commit, dan me-push ke branch `main`.
   GitHub Action akan otomatis mem-build Docker Image backend yang berisi file migrasi tersebut.
5. **Deploy di Coolify:**
   Buka Coolify (`http://192.168.2.136:8000`), klik **Redeploy** pada stack iDesk.
   Saat container backend start, TypeORM otomatis menjalankan migrasi ke PostgreSQL PROD!

---

## 3. Daftar Script Utilitas di Folder Ini

| Nama File | Deskripsi |
|-----------|-----------|
| `generate_migration.bat` | Membandingkan Entity TypeScript dengan database aktif dan men-generate file migrasi baru. |
| `run_migrations.bat` | Menjalankan semua migrasi pending ke database target (lokal/dev). |
| `show_migrations.bat` | Melihat daftar seluruh migrasi: `[X]` sudah dieksekusi, `[ ]` belum dieksekusi. |
| `revert_migration.bat` | Membatalkan / me-rollback 1 migrasi terakhir jika terjadi kesalahan. |
| `backup_db_prod.bat` | Melakukan dump/backup database PostgreSQL ke file `.sql` di folder `backups/`. |
| `restore_db_prod.bat` | Me-restore file `.sql` backup ke database PostgreSQL. |

---

## 4. Cara Memverifikasi Migrasi Berjalan di PROD

Setelah menekan tombol **Redeploy** di Coolify:
1. Buka container `idesk-backend` di dashboard Coolify.
2. Lihat tab **Logs**.
3. Cari log TypeORM saat container booting:
   ```text
   [Nest] 1 - LOG [TypeOrmModule] Migration "AddAssetWarrantyDate1792600000000" has been executed successfully
   ```
4. Jika muncul tulisan tersebut, skema database Production sudah 100% sinkron dan siap digunakan.
