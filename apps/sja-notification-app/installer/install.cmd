@echo off
setlocal
cd /d "%~dp0"
title SJA Notification App - One-Click Installer

echo ====================================================
echo     PT Santos Jaya Abadi - SJA Notification App
echo ====================================================
echo Memasang aplikasi notifikasi ke sistem Anda...
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-SJANotifier.ps1"

if %ERRORLEVEL% equ 0 (
    echo.
    echo Pemasangan selesai dengan sukses. Jendela ini dapat ditutup.
) else (
    echo.
    echo Terjadi kendala saat instalasi. Kode error: %ERRORLEVEL%
)

echo.
timeout /t 5
