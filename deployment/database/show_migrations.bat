@echo off
setlocal enabledelayedexpansion
title iDesk - Show Database Migration Status

echo =======================================================
echo          iDesk - Show Migration Status
echo =======================================================
echo.
echo Keterangan:
echo   [X] = Sudah dieksekusi di database
echo   [ ] = Pending / Belum dieksekusi (perlu dijalankan)
echo.

:: Pindah ke root repository
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%..\.."

if not exist "apps\backend\package.json" (
    echo [ERROR] Folder apps/backend tidak ditemukan dari %CD%
    pause
    exit /b 1
)

echo [INFO] Menjalankan: npm run migration:show ...
echo -------------------------------------------------------------------
call npm --prefix apps/backend run migration:show
echo -------------------------------------------------------------------

echo.
pause
