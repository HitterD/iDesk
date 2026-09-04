@echo off
setlocal enabledelayedexpansion

:: Force working directory to script location
pushd "%~dp0"

:: Add Node.js to PATH explicitly
SET "PATH=%PATH%;C:\Program Files\nodejs\"

:: Ensure root and backend .env files exist and stay synchronized
if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
    )
)
if exist ".env" (
    copy /y ".env" "apps\backend\.env" >nul
)

:: Step 1: Ensure Docker database and Redis containers are running
echo ===================================================
echo [1/4] Checking Docker containers...
echo ===================================================
start /b "" docker-compose -f docker-compose.db.yml up -d >nul 2>&1

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

:: Step 2: Start Backend
echo ===================================================
echo [2/4] Starting Backend (Port 5050)...
echo Detected IP: !IP!
echo ===================================================
start "iDesk Backend" cmd /k "cd /d "%~dp0apps\backend" && npm run start:dev"

:: Step 3: Wait for Backend to be fully ready BEFORE starting frontend
echo ===================================================
echo [3/4] Waiting for Backend to be ready on port 5050...
echo ===================================================

set /a RETRY=0
:wait_backend
set /a RETRY+=1
if !RETRY! geq 35 (
    echo [WARNING] Backend is taking longer than usual to start. Continuing...
    goto :start_frontend
)

curl.exe -s --connect-timeout 1 http://127.0.0.1:5050/v1/health >nul 2>&1
if !ERRORLEVEL! equ 0 (
    echo [SUCCESS] Backend is UP and READY on port 5050!
    goto :start_frontend
)

timeout /t 1 /nobreak >nul 2>&1
goto :wait_backend

:start_frontend
echo ===================================================
echo [4/4] Starting Frontend (Port 4050)...
echo ===================================================

:: Start Frontend (only launched after backend is already listening)
start "iDesk Frontend" cmd /k "cd /d "%~dp0apps\frontend" && npm run dev"

:: Short 2-second delay for Vite to bind port 4050
timeout /t 2 /nobreak >nul 2>&1

:: Open Browser
start http://localhost:4050

echo ===================================================
echo All services are running!
echo Accessible locally: http://localhost:4050
echo Accessible network: http://!IP!:4050
echo Accessible domain:  http://idesk.santos.co.id
echo ===================================================

popd
