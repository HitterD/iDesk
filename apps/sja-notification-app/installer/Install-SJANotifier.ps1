<#
.SYNOPSIS
    Automated Installer for SJA Notification App (PT Santos Jaya Abadi)
.DESCRIPTION
    Installs SJANotifier to %LOCALAPPDATA%\SJANotifier, sets up startup registry,
    creates Start Menu shortcut, and launches the application.
#>

$ErrorActionPreference = "Stop"

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "    PT SANTOS JAYA ABADI - SJA NOTIFICATION APP     " -ForegroundColor Yellow
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "Memulai proses instalasi otomatis..." -ForegroundColor Gray

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$sourceExe = Join-Path $scriptDir "..\publish\win-x64\SJANotifier.exe"
if (-not (Test-Path $sourceExe)) {
    $sourceExe = Join-Path $scriptDir "SJANotifier.exe"
}

if (-not (Test-Path $sourceExe)) {
    Write-Host "❌ Error: File SJANotifier.exe tidak ditemukan di folder installer!" -ForegroundColor Red
    Write-Host "Lokasi pencarian: $sourceExe" -ForegroundColor Red
    exit 1
}

# 1. Hentikan proses jika sedang berjalan
Write-Host "[1/5] Memeriksa proses yang sedang berjalan..." -ForegroundColor Green
$runningProcesses = Get-Process -Name "SJANotifier" -ErrorAction SilentlyContinue
if ($runningProcesses) {
    Write-Host "Menutup instance SJANotifier yang lama..." -ForegroundColor Yellow
    $runningProcesses | Stop-Process -Force
    Start-Sleep -Seconds 1
}

# 2. Siapkan folder target di %LOCALAPPDATA%\SJANotifier
$targetDir = Join-Path $env:LOCALAPPDATA "SJANotifier"
Write-Host "[2/5] Menyiapkan direktori instalasi di $targetDir..." -ForegroundColor Green
if (-not (Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
}

$destExe = Join-Path $targetDir "SJANotifier.exe"
Write-Host "[3/5] Menyalin file aplikasi, pustaka binary & aset..." -ForegroundColor Green

# Salin seluruh file binary dan dependensi dari folder installer/publish
$sourceDir = Split-Path -Parent $sourceExe
Get-ChildItem -Path $sourceDir | Where-Object { $_.Name -notmatch '\.(ps1|cmd|zip)$' } | Copy-Item -Destination $targetDir -Recurse -Force

# 3. Buat Shortcut di Start Menu
Write-Host "[4/5] Membuat shortcut Start Menu..." -ForegroundColor Green
try {
    $wshShell = New-Object -ComObject WScript.Shell
    $startMenuDir = [Environment]::GetFolderPath("Programs")
    $shortcutPath = Join-Path $startMenuDir "SJA Notifier.lnk"
    $shortcut = $wshShell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $destExe
    $shortcut.WorkingDirectory = $targetDir
    $shortcut.Description = "SJA Notification App - Santos Jaya Abadi"
    $shortcut.Save()
} catch {
    Write-Host "Peringatan: Gagal membuat shortcut Start Menu: $_" -ForegroundColor Yellow
}

# 4. Daftarkan di Registry Run (Startup saat login Windows) & Auto-Pin Tray Policy
Write-Host "[5/5] Mendaftarkan autostart & mengonfigurasi system tray..." -ForegroundColor Green
$regPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
Set-ItemProperty -Path $regPath -Name "SJANotifier" -Value "`"$destExe`"" -Force

# Daftarkan AUMID Toast Action Center & sinkronkan cache icon resmi Santos
try {
    $aumid = "SantosJayaAbadi.Idesk.Notifier"
    $compatDir = Join-Path $env:LOCALAPPDATA "ToastNotificationManagerCompat\Apps\$aumid"
    if (-not (Test-Path $compatDir)) { New-Item -ItemType Directory -Path $compatDir -Force | Out-Null }
    $santosLogo = Join-Path $targetDir "assets\santos-logo.png"
    $cachedIcon = Join-Path $compatDir "Icon.png"
    if (Test-Path $santosLogo) {
        Copy-Item $santosLogo $cachedIcon -Force
    }

    $aumidReg = "HKCU:\Software\Classes\AppUserModelId\$aumid"
    if (-not (Test-Path $aumidReg)) { New-Item -Path $aumidReg -Force | Out-Null }
    Set-ItemProperty -Path $aumidReg -Name "DisplayName" -Value "SJA Notifier" -Force
    Set-ItemProperty -Path $aumidReg -Name "IconUri" -Value $cachedIcon -Force
    Set-ItemProperty -Path $aumidReg -Name "IconBackgroundColor" -Value "00000000" -Force
    Set-ItemProperty -Path $aumidReg -Name "ShowInSettings" -Value 1 -Type DWord -Force
} catch {}

# Tweak Explorer agar System Tray icon selalu unhidden/pinned
try {
    $explorerPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer"
    Set-ItemProperty -Path $explorerPath -Name "EnableAutoTray" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue
} catch {}

# 5. Jalankan aplikasi langsung
Write-Host "Menjalankan SJA Notifier..." -ForegroundColor Cyan
Start-Process -FilePath $destExe -WorkingDirectory $targetDir

Write-Host ""
Write-Host "====================================================" -ForegroundColor Green
Write-Host "✅ INSTALASI BERHASIL!" -ForegroundColor Green
Write-Host "Aplikasi SJA Notifier kini aktif di Taskbar Tray Anda" -ForegroundColor White
Write-Host "(Lihat ikon di pojok kanan bawah dekat jam Windows)." -ForegroundColor Gray
Write-Host "====================================================" -ForegroundColor Green
Write-Host ""
