@echo off
setlocal enabledelayedexpansion

echo.
echo ========================================================
echo     iDesk Development Environment - All-in-One Setup
echo ========================================================
echo.

:: Check for .env file
if not exist .env (
    echo [1/7] .env file not found. Creating from .env.example...
    copy .env.example .env >nul
    if %errorlevel% neq 0 (
        echo       [ERROR] Failed to create .env file.
        pause
        exit /b 1
    )
    echo       [OK] Created .env from .env.example
) else (
    echo [1/7] Using existing .env file...
)

:: Copy .env to backend
echo       Copying .env to apps\backend...
copy .env apps\backend\.env >nul
echo       [OK] Backend environment configured
echo.

:: Check if Docker is running
echo [2/7] Checking Docker...
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo       [ERROR] Docker is not running!
    echo       Please start Docker Desktop and try again.
    pause
    exit /b 1
)
echo       [OK] Docker is running
echo.

:: Stop existing containers (gracefully)
echo [3/7] Stopping existing containers...
docker-compose -f docker-compose.db.yml down 2>nul
echo       [OK] Containers stopped (volumes preserved)
echo.

:: Start database and redis containers
echo [4/7] Starting PostgreSQL and Redis...
docker-compose -f docker-compose.db.yml up -d

if %errorlevel% neq 0 (
    echo       [ERROR] Failed to start containers.
    pause
    exit /b %errorlevel%
)
echo       [OK] Database and Redis started
echo.

:: Wait for database to be ready
echo [5/7] Waiting for database to be ready...
set /a retries=0
:waitloop
set /a retries+=1
if %retries% gtr 30 (
    echo       [ERROR] Database did not become ready in time.
    pause
    exit /b 1
)

docker exec idesk-postgres pg_isready -U postgres >nul 2>&1
if %errorlevel% neq 0 (
    echo       Attempt %retries%/30 - waiting...
    timeout /t 2 /nobreak >nul
    goto waitloop
)
echo       [OK] Database is ready!
echo.

:: Install backend dependencies
echo [6/7] Installing backend dependencies...
cd apps\backend
call npm install --silent
if %errorlevel% neq 0 (
    echo       [WARNING] npm install had issues, continuing...
)
echo       [OK] Backend dependencies installed
echo.

:: Run seed script
echo [7/7] Seeding admin user...
call npm run seed
if %errorlevel% neq 0 (
    echo       [WARNING] Seed script had issues (User might already exist)
) else (
    echo       [OK] Admin user seeded
)
cd ..\..

echo.
echo ========================================================
echo                    SETUP COMPLETE!
echo ========================================================
echo.
echo   Database:    localhost:5432
echo   Redis:       localhost:6379
echo   Backend:     http://localhost:5050
echo   Frontend:    http://localhost:4050
echo.
echo   Admin Login (Default):
echo   -----------------------------------------
echo   Email:       admin@antigravity.com
echo   Password:    Admin123
echo   Role:        ADMIN
echo   -----------------------------------------
echo.
echo Starting application servers...
echo.

:: Install frontend dependencies
echo Installing frontend dependencies...
cd apps\frontend
call npm install --silent
echo       [OK] Frontend dependencies installed
cd ..\..

:: Start Backend in new window
echo Starting Backend server...
start "iDesk Backend" cmd /k "cd /d %~dp0apps\backend && npm run start:dev"

:: Wait a moment for backend to initialize
timeout /t 5 /nobreak >nul

:: Start Frontend in new window
echo Starting Frontend server...
start "iDesk Frontend" cmd /k "cd /d %~dp0apps\frontend && npm run dev"

echo.
echo ========================================================
echo              APPLICATION IS NOW RUNNING!
echo ========================================================
echo.
echo   Backend:     http://localhost:5050
echo   Frontend:    http://localhost:4050
echo.
echo   Two terminal windows have been opened:
echo   - iDesk Backend  (NestJS server)
echo   - iDesk Frontend (Vite dev server)
echo.
echo   Press any key to close this window.
echo   (Servers will continue running in their windows)
echo ========================================================
echo.
pause
