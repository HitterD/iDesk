@echo off
setlocal enabledelayedexpansion
title iDesk Production Push & Deploy

echo =======================================================
echo          iDesk Production - Push to GitHub
echo =======================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0push_deploy.ps1"

echo.
echo Selesai. Tekan sembarang tombol untuk keluar...
pause >nul
