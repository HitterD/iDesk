# Direktori Deployment & Maintenance iDesk

Folder ini berisi seluruh script otomatisasi, konfigurasi reverse proxy, serta utilitas manajemen database untuk iDesk Production & Development.

---

## Struktur Folder

```text
deployment/
├── deploy/
│   ├── push_deploy.bat          # Script 1-klik untuk git push & trigger build GitHub Actions ke Coolify
│   └── push_deploy.ps1          # Logika PowerShell dengan proteksi aset dan deteksi migrasi
├── database/
│   ├── generate_migration.bat   # Script interaktif men-generate migrasi TypeORM dari Entity TypeScript
│   ├── run_migrations.bat       # Menjalankan migrasi pending ke database lokal
│   ├── show_migrations.bat      # Melihat status migrasi database ([X] selesai, [ ] pending)
│   ├── revert_migration.bat     # Rollback 1 migrasi terakhir
│   ├── backup_db_prod.bat       # Backup database PostgreSQL ke file .sql
│   ├── restore_db_prod.bat      # Restore database dari file .sql
│   └── README.md                # Panduan alur migrasi database dev & prod
└── nginx/
    ├── idesk.santos.co.id.conf  # Virtual host configuration lengkap Nginx standalone
    ├── npm-advanced-snippet.txt # Snippet siap pakai untuk tab Advanced di Nginx Proxy Manager
    └── README.md                # Panduan langkah konfigurasi reverse proxy
```

---

## Ringkasan Perintah Penting

### 1. Push Perubahan ke Production
Cukup jalankan:
- `push_deploy.bat` (di root repository) ATAU `deployment\deploy\push_deploy.bat`
- Script akan otomatis men-commit perubahan backend, frontend, compose, serta migrasi baru, lalu me-push ke branch `main`. GitHub Actions akan otomatis mem-build Docker Image.

### 2. Ada Perubahan Tabel Database?
Ikuti 3 langkah cepat:
1. `deployment\database\generate_migration.bat` (buat file migrasi dari entity).
2. `deployment\database\run_migrations.bat` (test migrasi di database lokal).
3. `push_deploy.bat` (push ke GitHub; Coolify akan otomatis mengeksekusi migrasi saat dideploy).
