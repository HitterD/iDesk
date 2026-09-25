@echo off
setlocal enabledelayedexpansion
title iDesk - Restore Database PostgreSQL

echo =======================================================
echo         iDesk - Restore Database (PostgreSQL)
echo =======================================================
echo.
echo [PERINGATAN]
echo Restore database akan menimpa/menambah data ke database target!
echo Pastikan Anda sudah membuat backup database sebelum melanjutkan.
echo.

set "SCRIPT_DIR=%~dp0"
set "BACKUP_DIR=%SCRIPT_DIR%backups"

if not exist "%BACKUP_DIR%" (
    echo [ERROR] Folder backup %BACKUP_DIR% tidak ditemukan.
    pause
    exit /b 1
)

echo Daftar file backup yang tersedia di folder backups/:
echo -------------------------------------------------------------------
dir /b /o-d "%BACKUP_DIR%\*.sql" 2>nul
echo -------------------------------------------------------------------
echo.

set /p "BACKUP_FILENAME=Ketik nama file backup (contoh: idesk_backup_20260925_110000.sql): "
if "%BACKUP_FILENAME%"=="" (
    echo [ERROR] Nama file tidak boleh kosong.
    pause
    exit /b 1
)

set "FULL_FILE_PATH=%BACKUP_DIR%\%BACKUP_FILENAME%"
if not exist "%FULL_FILE_PATH%" (
    echo [ERROR] File %FULL_FILE_PATH% tidak ditemukan!
    pause
    exit /b 1
)

set "DEFAULT_HOST=192.168.2.136"
set "DEFAULT_PORT=5432"
set "DEFAULT_USER=postgres"
set "DEFAULT_DB=idesk_db"

set /p "TARGET_HOST=Host [%DEFAULT_HOST%]: "
if "%TARGET_HOST%"=="" set "TARGET_HOST=%DEFAULT_HOST%"

set /p "TARGET_PORT=Port [%DEFAULT_PORT%]: "
if "%TARGET_PORT%"=="" set "TARGET_PORT=%DEFAULT_PORT%"

set /p "TARGET_USER=Username [%DEFAULT_USER%]: "
if "%TARGET_USER%"=="" set "TARGET_USER=%DEFAULT_USER%"

set /p "TARGET_DB=Database [%DEFAULT_DB%]: "
if "%TARGET_DB%"=="" set "TARGET_DB=%DEFAULT_DB%"

set /p "TARGET_PASS=Password Database: "

echo.
set /p "CONFIRM=Ketik 'RESTORE' untuk mengonfirmasi proses restore ke %TARGET_HOST% (%TARGET_DB%): "
if not "%CONFIRM%"=="RESTORE" (
    echo Restore dibatalkan.
    pause
    exit /b 0
)

echo.
echo [INFO] Menjalankan restore database...
echo.

where psql >nul 2>nul
if %errorlevel% equ 0 (
    echo Menggunakan psql lokal...
    set "PGPASSWORD=%TARGET_PASS%"
    psql -h %TARGET_HOST% -p %TARGET_PORT% -U %TARGET_USER% -d %TARGET_DB% -f "%FULL_FILE_PATH%"
    set "RESTORE_RESULT=%errorlevel%"
) else (
    echo psql lokal tidak ditemukan. Menggunakan Docker postgres:15-alpine...
    docker run --rm -e PGPASSWORD="%TARGET_PASS%" -v "%BACKUP_DIR%:/backup" postgres:15-alpine psql -h %TARGET_HOST% -p %TARGET_PORT% -U %TARGET_USER% -d %TARGET_DB% -f "/backup/%BACKUP_FILENAME%"
    set "RESTORE_RESULT=%errorlevel%"
)

if %RESTORE_RESULT% equ 0 (
    echo.
    echo =======================================================
    echo [SUCCESS] Restore database berhasil diselesaikan!
    echo =======================================================
) else (
    echo.
    echo [ERROR] Restore database gagal dengan kode %RESTORE_RESULT%.
)

echo.
pause
