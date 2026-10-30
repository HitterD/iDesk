@echo off
setlocal enabledelayedexpansion
title iDesk - Run Database Migrations

echo =======================================================
echo           iDesk - Run Pending Migrations
echo =======================================================
echo.
echo Menjalankan semua file migrasi yang pending (belum dieksekusi)
echo ke database sesuai konfigurasi apps/backend/.env
echo.

:: Pindah ke root repository
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%..\.."

if not exist "apps\backend\package.json" (
    echo [ERROR] Folder apps/backend tidak ditemukan dari %CD%
    pause
    exit /b 1
)

echo [INFO] Menjalankan: npm run migration:run ...
echo -------------------------------------------------------------------
call npm --prefix apps/backend run migration:run
set "RUN_RESULT=%errorlevel%"
echo -------------------------------------------------------------------

if %RUN_RESULT% equ 0 (
    echo.
    echo [SUCCESS] Semua migrasi pending berhasil dieksekusi!
) else (
    echo.
    echo [ERROR] Terjadi kesalahan saat menjalankan migrasi (Exit Code: %RUN_RESULT%).
    echo Pastikan PostgreSQL sedang berjalan dan kredensial di apps/backend/.env sudah benar.
)

echo.
pause
