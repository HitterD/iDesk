Write-Host "Publishing self-contained .NET 10 binary for win-x64..." -ForegroundColor Cyan
dotnet publish (Join-Path $PSScriptRoot "SJANotificationApp.csproj") -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o (Join-Path $PSScriptRoot "publish\win-x64")

$distDir = Join-Path $PSScriptRoot "dist-package"
if (Test-Path $distDir) {
    Remove-Item -Path $distDir -Recurse -Force
}
New-Item -ItemType Directory -Path $distDir -Force | Out-Null

$publishDir = Join-Path $PSScriptRoot "publish\win-x64"
if (Test-Path $publishDir) {
    Get-ChildItem -Path $publishDir | Copy-Item -Destination $distDir -Recurse -Force
}

$installerDir = Join-Path $PSScriptRoot "installer"
Get-ChildItem -Path $installerDir | Copy-Item -Destination $distDir -Recurse -Force

$zipPath = Join-Path $PSScriptRoot "dist-package\SJANotifier-Setup.zip"
$filesToZip = Get-ChildItem -Path $distDir | Where-Object { $_.Extension -ne ".zip" }

Compress-Archive -Path $filesToZip.FullName -DestinationPath $zipPath -Force

Write-Host "SUCCESS: Created $zipPath with size $((Get-Item $zipPath).Length) bytes"
