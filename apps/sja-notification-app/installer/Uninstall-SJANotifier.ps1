<#
.SYNOPSIS
    Uninstaller for SJA Notification App (PT Santos Jaya Abadi)
#>

$ErrorActionPreference = "SilentlyContinue"

Write-Host "Mencopot SJA Notification App..." -ForegroundColor Yellow

# 1. Stop process
Get-Process -Name "SJANotifier" | Stop-Process -Force

# 2. Remove Registry Run
Remove-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "SJANotifier" -ErrorAction SilentlyContinue

# 3. Remove Shortcut
$startMenuDir = [Environment]::GetFolderPath("Programs")
$shortcutPath = Join-Path $startMenuDir "SJA Notifier.lnk"
if (Test-Path $shortcutPath) {
    Remove-Item -Path $shortcutPath -Force
}

# 4. Remove files in %LOCALAPPDATA%\SJANotifier
$targetDir = Join-Path $env:LOCALAPPDATA "SJANotifier"
if (Test-Path $targetDir) {
    Remove-Item -Path $targetDir -Recurse -Force
}

Write-Host "✅ SJA Notification App telah berhasil dicopot dari sistem." -ForegroundColor Green
