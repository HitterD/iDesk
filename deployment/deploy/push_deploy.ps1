# ==============================================================================
# iDesk Production Push & Deploy Script
# Menstandarisasi proses push ke GitHub agar otomatis mentrigger build GHCR
# ==============================================================================

# Deteksi root repository secara dinamis
try {
    $gitRoot = (git rev-parse --show-toplevel 2>$null)
    if ($gitRoot) {
        $rootDir = $gitRoot.Trim()
    } else {
        $rootDir = (Resolve-Path "$PSScriptRoot\..\..").Path
    }
} catch {
    $rootDir = (Resolve-Path "$PSScriptRoot\..\..").Path
}

Set-Location $rootDir

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "         iDesk Production Push & Deploy Helper          " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "[INFO] Repository Root: $rootDir" -ForegroundColor Gray

# 1. Pastikan Git terinstall
try {
    $gitVersion = git --version
    Write-Host "[OK] $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Git tidak ditemukan. Pastikan Git sudah terinstall dan ada di PATH." -ForegroundColor Red
    exit 1
}

# 2. Cek branch saat ini
$currentBranch = (git rev-parse --abbrev-ref HEAD).Trim()
Write-Host "[INFO] Branch aktif saat ini: $currentBranch" -ForegroundColor Yellow

# 3. Cek apakah ada file migrasi database baru/berubah
$migrationChanges = git status -s apps/backend/src/migrations
if ($migrationChanges) {
    Write-Host "`n--------------------------------------------------------" -ForegroundColor Magenta
    Write-Host "[MIGRATION] Terdeteksi file migrasi database baru/berubah:" -ForegroundColor Magenta
    $migrationChanges | ForEach-Object { Write-Host "   $_" -ForegroundColor Yellow }
    Write-Host "-> File migrasi ini akan otomatis dieksekusi oleh TypeORM saat" -ForegroundColor Gray
    Write-Host "   backend dideploy dan container start di Coolify (NODE_ENV=production)." -ForegroundColor Gray
    Write-Host "--------------------------------------------------------`n" -ForegroundColor Magenta
}

# 4. Tampilkan perubahan pada core iDesk (backend, frontend, compose, github, deployment)
Write-Host "[INFO] Memeriksa perubahan pada modul iDesk (backend/frontend/compose/deployment)..." -ForegroundColor Cyan
$status = git status -s apps/backend apps/frontend docker-compose.prod.yml .github deployment
if (-not $status) {
    Write-Host "[INFO] Tidak ada uncommitted changes pada apps/backend, apps/frontend, atau deployment di branch lokal." -ForegroundColor Yellow
} else {
    Write-Host "File yang dimodifikasi:" -ForegroundColor Gray
    $status | ForEach-Object { Write-Host "   $_" -ForegroundColor DarkGray }
}

# 5. Input pesan commit
$defaultMsg = "update(prod): sync idesk production $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
if ($args.Count -gt 0 -and -not [string]::IsNullOrWhiteSpace($args[0])) {
    $commitMsg = $args[0]
} else {
    Write-Host "`nMasukkan pesan commit (Tekan Enter untuk default):" -ForegroundColor Cyan
    $commitMsg = Read-Host "> "
    if ([string]::IsNullOrWhiteSpace($commitMsg)) {
        $commitMsg = $defaultMsg
    }
}

# 6. Eksekusi Staging & Commit khusus file iDesk di root repo
Write-Host "`n[STEP 1/3] Menyiapkan file produksi (staging)..." -ForegroundColor Cyan
git add apps/backend apps/frontend docker-compose.prod.yml .github deployment

$stagedChanges = git diff --cached --name-only
if ($stagedChanges) {
    Write-Host "[STEP 2/3] Membuat git commit di branch lokal..." -ForegroundColor Cyan
    git commit -m $commitMsg
} else {
    Write-Host "[INFO] Tidak ada file baru yang perlu dicommit di branch lokal." -ForegroundColor Gray
}

# 7. Push ke branch 'main' di GitHub
Write-Host "`n[STEP 3/3] Melakukan push ke origin/main..." -ForegroundColor Cyan

$pushSuccess = $false
$worktreePath = Join-Path $rootDir ".worktrees\deploy-prod"

# Cek apakah kita di branch main dan bisa push langsung
if ($currentBranch -eq "main") {
    git push origin main
    if ($LASTEXITCODE -eq 0) {
        $pushSuccess = $true
        Write-Host "`n[SUCCESS] Berhasil dipush ke branch 'main' di GitHub!" -ForegroundColor Green
    }
}

if (-not $pushSuccess) {
    # Gunakan sinkronisasi worktree deploy-prod yang terhubung langsung ke origin/main
    if (Test-Path $worktreePath) {
        Write-Host "`n[SYNC] Menggunakan worktree deploy-prod untuk sinkronisasi bersih ke origin/main..." -ForegroundColor Cyan
        Set-Location $worktreePath
        git fetch origin main
        git reset --hard origin/main
        
        Write-Host "[SYNC] Menyalin file produksi terbaru ke worktree deploy-prod..." -ForegroundColor Gray
        robocopy "$rootDir\apps\backend" "$worktreePath\apps\backend" /E /XD node_modules dist coverage /NJH /NJS /ndl /nc /ns
        $global:LASTEXITCODE = 0
        robocopy "$rootDir\apps\frontend" "$worktreePath\apps\frontend" /E /XD node_modules dist /NJH /NJS /ndl /nc /ns
        $global:LASTEXITCODE = 0
        robocopy "$rootDir\deployment" "$worktreePath\deployment" /E /NJH /NJS /ndl /nc /ns
        $global:LASTEXITCODE = 0
        if (Test-Path "$rootDir\.github") {
            robocopy "$rootDir\.github" "$worktreePath\.github" /E /NJH /NJS /ndl /nc /ns
            $global:LASTEXITCODE = 0
        }
        if (Test-Path "$rootDir\docker-compose.prod.yml") {
            Copy-Item "$rootDir\docker-compose.prod.yml" "$worktreePath\docker-compose.prod.yml" -Force
        }

        git add apps/backend apps/frontend docker-compose.prod.yml deployment .github
        $stagedInWorktree = git status -s
        if ($stagedInWorktree) {
            Write-Host "[SYNC] Membuat commit produksi di worktree deploy-prod..." -ForegroundColor Cyan
            git commit -m $commitMsg
        } else {
            Write-Host "[INFO] Tidak ada perbedaan berkas antara branch lokal dan origin/main." -ForegroundColor Gray
        }

        Write-Host "[PUSH] Mendorong commit ke origin/main di GitHub..." -ForegroundColor Cyan
        git push origin deploy-prod:main
        if ($LASTEXITCODE -eq 0) {
            $pushSuccess = $true
            Set-Location $rootDir
            Write-Host "`n[SUCCESS] Berhasil dipush via worktree ke branch 'main' di GitHub!" -ForegroundColor Green
        } else {
            Set-Location $rootDir
            Write-Host "`n[ERROR] Gagal melakukan push ke origin/main!" -ForegroundColor Red
            exit 1
        }
    } else {
        # Fallback jika worktree tidak ada: buat worktree deploy-prod
        Write-Host "[WARN] Worktree deploy-prod belum ada, mencoba push langsung..." -ForegroundColor Yellow
        git push origin "${currentBranch}:main"
        if ($LASTEXITCODE -eq 0) {
            $pushSuccess = $true
            Write-Host "`n[SUCCESS] Berhasil dipush ke branch 'main' di GitHub!" -ForegroundColor Green
        } else {
            Write-Host "`n[ERROR] Gagal melakukan push ke origin/main!" -ForegroundColor Red
            exit 1
        }
    }
}

# 8. Informasi Status GitHub Actions & Coolify
Write-Host "`n========================================================" -ForegroundColor Magenta
Write-Host "                WORKFLOW OTOMATIS BERJALAN              " -ForegroundColor Magenta
Write-Host "========================================================" -ForegroundColor Magenta
Write-Host "GitHub Actions sedang mem-build Docker Image terbaru."
Write-Host "Pantau proses build di:" -ForegroundColor Yellow
Write-Host "   https://github.com/HitterD/iDesk/actions`n" -ForegroundColor Cyan
Write-Host "Petunjuk Deployment Coolify:" -ForegroundColor Yellow
Write-Host "1. Tunggu pipeline GitHub Actions selesai (berstatus Hijau/Success ~5 menit)."
Write-Host "2. Buka Coolify di: http://192.168.2.136:8000"
Write-Host "3. Klik tombol 'Redeploy' pada stack iDesk."
Write-Host "========================================================`n" -ForegroundColor Magenta
