@echo off
setlocal enabledelayedexpansion

:: Force working directory to script location
cd /d "%~dp0"

:: Add Node.js to PATH explicitly
SET PATH=%PATH%;C:\Program Files\nodejs\

:: Ensure root and backend .env files exist
if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
    )
)
if not exist "apps\backend\.env" (
    if exist ".env" (
        copy ".env" "apps\backend\.env" >nul
    )
)

:: Ensure Docker database and Redis containers are running
echo ===================================================
echo Checking Docker containers...
echo ===================================================
docker-compose -f docker-compose.db.yml up -d >nul 2>&1

:: Detect Local IP Address dynamically (supports English & Indonesian OS)
set "IP=localhost"
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4 Alamat" ^| findstr /v "127.0.0.1"') do (
    set "TEMP_IP=%%a"
    set "TEMP_IP=!TEMP_IP: =!"
    if not "!TEMP_IP!"=="" (
        set "IP=!TEMP_IP!"
        goto :ip_found
    )
)
:ip_found

echo ===================================================
echo Starting iDesk Development Environment...
echo Detected IP Address: !IP!
echo ===================================================

:: Start Backend
start "iDesk Backend" cmd /k "cd /d "%~dp0apps\backend" && set FRONTEND_URL=http://!IP!:4050&& (if not exist node_modules\.bin (echo Installing Backend Dependencies... & call npm install)) & npm run start:dev"

:: Start Frontend
start "iDesk Frontend" cmd /k "cd /d "%~dp0apps\frontend" && set VITE_API_URL=http://!IP!:5050&& (if not exist node_modules\.bin (echo Installing Frontend Dependencies... & call npm install)) & npm run dev"

:: Wait for services to start (approx 5 seconds)
timeout /t 5 /nobreak >nul 2>&1

:: Open Browser
start http://localhost:4050

echo ===================================================
echo Development environment started!
echo Accessible locally: http://localhost:4050
echo Accessible network: http://!IP!:4050
echo ===================================================
