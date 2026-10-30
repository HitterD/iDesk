@echo off
setlocal enabledelayedexpansion
title iDesk - Generate Database Migration

echo =======================================================
echo         iDesk Database Migration Generator
echo =======================================================
echo.
echo Tool ini akan membandingkan Entity TypeScript (apps/backend/src)
echo dengan skema database aktif, lalu otomatis membuat file
echo migrasi baru di apps/backend/src/migrations/
echo.

:: Pindah ke root repository
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%..\.."

:: Verifikasi apakah apps/backend ada
if not exist "apps\backend\package.json" (
    echo [ERROR] Folder apps/backend tidak ditemukan dari %CD%
    pause
    exit /b 1
)

:: Minta nama migrasi dari user
:INPUT_NAME
set /p "MIG_NAME=Masukkan nama migrasi (contoh: AddAssetWarrantyDate / UpdateUserRoles): "
if "%MIG_NAME%"=="" (
    echo [WARN] Nama migrasi tidak boleh kosong!
    goto INPUT_NAME
)

:: Bersihkan spasi jika ada
set "MIG_NAME=%MIG_NAME: =%"

echo.
echo [1/2] Men-generate file migrasi: src/migrations/%MIG_NAME% ...
echo -------------------------------------------------------------------
call npm --prefix apps/backend run typeorm -- migration:generate src/migrations/%MIG_NAME%
set "GEN_RESULT=%errorlevel%"
echo -------------------------------------------------------------------

if %GEN_RESULT% neq 0 (
    echo.
    echo [INFO/ERROR] TypeORM selesai dengan kode %GEN_RESULT%.
    echo Catatan: Jika pesan di atas adalah "No changes in database schema were found",
    echo artinya tidak ada perbedaan antara Entity TypeScript dan skema Database Anda.
    echo.
    pause
    exit /b %GEN_RESULT%
)

echo.
echo [OK] File migrasi berhasil dibuat di folder: apps/backend/src/migrations/
echo.

:: Tawarkan untuk langsung menjalankan ke database lokal/dev
set /p "RUN_NOW=Apakah Anda ingin langsung menjalankan migrasi ini ke DB lokal? (y/n): "
if /i "%RUN_NOW%"=="y" (
    echo.
    echo [2/2] Menjalankan migrasi lokal...
    call npm --prefix apps/backend run migration:run
    echo.
)

echo =======================================================
echo LANGKAH SELANJUTNYA:
echo 1. Periksa file baru di apps/backend/src/migrations/
echo 2. Gunakan deployment\deploy\push_deploy.bat untuk push ke GitHub.
echo 3. Coolify akan otomatis menjalankan migrasi ini saat container
echo    backend menyala di server Production!
echo =======================================================
echo.
pause
