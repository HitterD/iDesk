@echo off
setlocal enabledelayedexpansion
title iDesk - Backup Database Production

echo =======================================================
echo         iDesk - Backup Database (PostgreSQL)
echo =======================================================
echo.

set "SCRIPT_DIR=%~dp0"
set "BACKUP_DIR=%SCRIPT_DIR%backups"
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

:: Konfigurasi default (bisa disesuaikan)
set "DEFAULT_HOST=192.168.2.136"
set "DEFAULT_PORT=5432"
set "DEFAULT_USER=postgres"
set "DEFAULT_DB=idesk_db"

echo Masukkan target database (Tekan Enter untuk default):
set /p "TARGET_HOST=Host [%DEFAULT_HOST%]: "
if "%TARGET_HOST%"=="" set "TARGET_HOST=%DEFAULT_HOST%"

set /p "TARGET_PORT=Port [%DEFAULT_PORT%]: "
if "%TARGET_PORT%"=="" set "TARGET_PORT=%DEFAULT_PORT%"

set /p "TARGET_USER=Username [%DEFAULT_USER%]: "
if "%TARGET_USER%"=="" set "TARGET_USER=%DEFAULT_USER%"

set /p "TARGET_DB=Database [%DEFAULT_DB%]: "
if "%TARGET_DB%"=="" set "TARGET_DB=%DEFAULT_DB%"

set /p "TARGET_PASS=Password Database: "

:: Generate timestamp YYYYMMDD_HHMMSS
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set TIMESTAMP=%datetime:~0,8%_%datetime:~8,6%
set "OUTPUT_FILE=%BACKUP_DIR%\idesk_backup_%TIMESTAMP%.sql"

echo.
echo [INFO] Memulai backup database %TARGET_DB% dari %TARGET_HOST%:%TARGET_PORT%...
echo File target: %OUTPUT_FILE%
echo.

:: Cek apakah pg_dump lokal tersedia
where pg_dump >nul 2>nul
if %errorlevel% equ 0 (
    echo Menggunakan pg_dump sistem lokal...
    set "PGPASSWORD=%TARGET_PASS%"
    pg_dump -h %TARGET_HOST% -p %TARGET_PORT% -U %TARGET_USER% -d %TARGET_DB% -F p -b -v -f "%OUTPUT_FILE%"
    set "DUMP_RESULT=%errorlevel%"
) else (
    :: Fallback menggunakan Docker jika pg_dump lokal tidak ada
    echo pg_dump lokal tidak ditemukan. Menggunakan Docker postgres:15-alpine...
    docker run --rm -e PGPASSWORD="%TARGET_PASS%" -v "%BACKUP_DIR%:/backup" postgres:15-alpine pg_dump -h %TARGET_HOST% -p %TARGET_PORT% -U %TARGET_USER% -d %TARGET_DB% -F p -b -v -f "/backup/idesk_backup_%TIMESTAMP%.sql"
    set "DUMP_RESULT=%errorlevel%"
)

if %DUMP_RESULT% equ 0 (
    echo.
    echo =======================================================
    echo [SUCCESS] Backup berhasil disimpan!
    echo Lokasi: %OUTPUT_FILE%
    echo =======================================================
) else (
    echo.
    echo [ERROR] Backup gagal dengan kode %DUMP_RESULT%.
    echo Pastikan host, port, username, dan password sudah benar,
    echo serta firewall mengizinkan koneksi ke port %TARGET_PORT%.
)

echo.
pause
