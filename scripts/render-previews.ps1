# Merender seluruh permukaan aplikasi dalam tema terang dan gelap.
# Jalankan dari root repo: .\scripts\render-previews.ps1

$ErrorActionPreference = "Stop"
$outDir = "apps/sja-notification-app/bin/Debug/net10.0-windows10.0.19041.0"
$exe = Join-Path $outDir "SJANotifier.exe"

if (-not (Test-Path $exe)) {
    Write-Error "Build dulu: dotnet build apps/sja-notification-app/SJANotificationApp.csproj"
}

$surfaces = @(
    @("--test-render-main", "dashboard"),
    @("--test-render-main", "history"),
    @("--test-render-main", "settings"),
    @("--test-render-main", "login"),
    @("--test-render-main", "empty"),
    @("--test-render-main", "disconnected"),
    @("--test-render-tray"),
    @("--test-render-popup", "ticket"),
    @("--test-render-popup", "broadcast"),
    @("--test-render-remote"),
    @("--test-render-remote-viewer"),
    @("--test-render-remote-privacy")
)

foreach ($theme in @("light", "dark")) {
    foreach ($s in $surfaces) {
        $argList = $s + @($theme)
        Write-Host "Render: $($argList -join ' ')"
        & $exe @argList | Where-Object { $_ -like "PREVIEW_SAVED:*" }
    }
}

Write-Host "`nSelesai. PNG ada di: $outDir"
