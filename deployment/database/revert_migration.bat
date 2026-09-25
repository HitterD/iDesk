@echo off
setlocal enabledelayedexpansion
title iDesk - Revert Database Migration

echo =======================================================
echo          iDesk - Revert Database Migration
echo =======================================================
echo.
echo [PERINGATAN]
echo Script ini akan me-ROLLBACK 1 migrasi TERAKHIR yang sudah
echo dieksekusi di database target (apps/backend/.env)!
echo Tindakan ini bisa mengubah struktur tabel / menghapus kolom baru.
echo.

set /p "CONFIRM=Apakah Anda benar-benar yakin ingin me-revert migrasi terakhir? (y/n): "
if /i "%CONFIRM%" neq "y" (
    echo Proses dibatalkan.
    pause
    exit /b 0
)

:: Pindah ke root repository
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%..\.."

if not exist "apps\backend\package.json" (
    echo [ERROR] Folder apps/backend tidak ditemukan dari %CD%
    pause
    exit /b 1
)

echo.
echo [INFO] Menjalankan: npm run migration:revert ...
echo -------------------------------------------------------------------
call npm --prefix apps/backend run migration:revert
set "REV_RESULT=%errorlevel%"
echo -------------------------------------------------------------------

if %REV_RESULT% equ 0 (
    echo.
    echo [SUCCESS] Migrasi terakhir berhasil di-revert!
) else (
    echo.
    echo [ERROR] Gagal melakukan revert migrasi (Exit Code: %REV_RESULT%).
)

echo.
pause
