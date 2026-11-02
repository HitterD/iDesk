@echo off
setlocal
cd /d "%~dp0"
title Uninstall SJA Notification App

echo Mencopot SJA Notification App...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Uninstall-SJANotifier.ps1"
echo Selesai.
timeout /t 3
