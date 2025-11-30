@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1

echo.
echo ========================================================
echo     iDesk Database Deployment ^& Migration Tool
echo ========================================================
echo     Data Preservation Mode Enabled
echo ========================================================
echo.

:: Set directories
set PROJECT_DIR=%~dp0
set BACKUP_DIR=%PROJECT_DIR%backups
set POSTGRES_DATA=%BACKUP_DIR%\postgres
set REDIS_DATA=%BACKUP_DIR%\redis
set BACKEND_DIR=%PROJECT_DIR%apps\backend

:: Menu selection
echo Select deployment mode:
echo.
echo   [1] Fresh Install (First time setup)
echo   [2] Server Migration (Move from old server)
echo   [3] Update/Restart (Keep existing data)
echo   [4] Backup Only (Create backup before migration)
echo   [5] Restore from Backup
echo   [6] Run Database Migrations Only
echo   [0] Exit
echo.
set /p CHOICE="Enter choice (0-6): "

if "%CHOICE%"=="1" goto :FreshInstall
if "%CHOICE%"=="2" goto :ServerMigration
if "%CHOICE%"=="3" goto :UpdateRestart
if "%CHOICE%"=="4" goto :BackupOnly
if "%CHOICE%"=="5" goto :RestoreBackup
if "%CHOICE%"=="6" goto :RunMigrations
if "%CHOICE%"=="0" goto :Exit
echo Invalid choice!
pause
goto :EOF

:: ========================================================
:: FRESH INSTALL
:: ========================================================
:FreshInstall
echo.
echo ========================================================
echo     FRESH INSTALL MODE
echo ========================================================
echo.
echo WARNING: This will create new empty databases.
echo If you have existing data, use option [2] or [3] instead.
echo.
set /p CONFIRM="Continue? (y/n): "
if /i not "%CONFIRM%"=="y" goto :EOF

echo.
echo [1/5] Creating data directories...
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"
if not exist "%POSTGRES_DATA%" mkdir "%POSTGRES_DATA%"
if not exist "%REDIS_DATA%" mkdir "%REDIS_DATA%"
echo       [OK] Directories created

echo.
echo [2/5] Checking Docker status...
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo       [ERROR] Docker is not running! Please start Docker Desktop.
    pause
    goto :EOF
)
echo       [OK] Docker is running

echo.
echo [3/5] Starting database containers...
docker-compose -f docker-compose.db.yml up -d
if %errorlevel% neq 0 (
    echo       [ERROR] Failed to start containers!
    pause
    goto :EOF
)
echo       [OK] Containers started

echo.
echo [4/5] Waiting for database to be ready...
:WaitLoop1
timeout /t 3 /nobreak >nul
docker exec idesk-postgres pg_isready -U postgres >nul 2>&1
if %errorlevel% neq 0 (
    echo       Waiting for PostgreSQL...
    goto :WaitLoop1
)
echo       [OK] PostgreSQL is ready

echo.
echo [5/5] Running database migrations...
cd /d "%BACKEND_DIR%"
call npm run migration:run
if %errorlevel% neq 0 (
    echo       [WARNING] Migration failed. You may need to run it manually.
) else (
    echo       [OK] Migrations completed
)

echo.
echo ========================================================
echo     FRESH INSTALL COMPLETE!
echo ========================================================
echo.
echo Data locations:
echo   - PostgreSQL: %POSTGRES_DATA%
echo   - Redis: %REDIS_DATA%
echo.
pause
goto :EOF

:: ========================================================
:: SERVER MIGRATION
:: ========================================================
:ServerMigration
echo.
echo ========================================================
echo     SERVER MIGRATION MODE
echo ========================================================
echo.
echo This mode helps you migrate from an old server to a new one.
echo.
echo PRE-REQUISITES:
echo   1. Copy the entire 'backups' folder from old server
echo   2. Or copy backup .tar files to restore
echo.
echo Current data directories:
echo   - PostgreSQL: %POSTGRES_DATA%
echo   - Redis: %REDIS_DATA%
echo.

:: Check if data exists
if exist "%POSTGRES_DATA%\PG_VERSION" (
    echo [INFO] Existing PostgreSQL data found!
    set HAS_DATA=1
) else (
    echo [INFO] No existing PostgreSQL data found.
    set HAS_DATA=0
)

echo.
echo Options:
echo   [A] Use existing data in backups folder (already copied)
echo   [B] Restore from backup .tar files
echo   [C] Cancel
echo.
set /p MIGRATE_CHOICE="Enter choice (A/B/C): "

if /i "%MIGRATE_CHOICE%"=="A" goto :MigrateExisting
if /i "%MIGRATE_CHOICE%"=="B" goto :RestoreBackup
if /i "%MIGRATE_CHOICE%"=="C" goto :EOF
goto :EOF

:MigrateExisting
echo.
echo [1/4] Checking Docker status...
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo       [ERROR] Docker is not running!
    pause
    goto :EOF
)
echo       [OK] Docker is running

echo.
echo [2/4] Stopping any existing containers...
docker-compose -f docker-compose.db.yml down >nul 2>&1
echo       [OK] Containers stopped

echo.
echo [3/4] Starting containers with existing data...
docker-compose -f docker-compose.db.yml up -d
if %errorlevel% neq 0 (
    echo       [ERROR] Failed to start containers!
    pause
    goto :EOF
)
echo       [OK] Containers started

echo.
echo [4/4] Waiting for database to be ready...
:WaitLoop2
timeout /t 3 /nobreak >nul
docker exec idesk-postgres pg_isready -U postgres >nul 2>&1
if %errorlevel% neq 0 (
    echo       Waiting for PostgreSQL...
    goto :WaitLoop2
)
echo       [OK] PostgreSQL is ready

echo.
echo Do you want to run database migrations?
echo (Only needed if there are new migrations since last deployment)
set /p RUN_MIG="Run migrations? (y/n): "
if /i "%RUN_MIG%"=="y" (
    cd /d "%BACKEND_DIR%"
    call npm run migration:run
)

echo.
echo ========================================================
echo     SERVER MIGRATION COMPLETE!
echo ========================================================
echo.
echo Your data has been preserved and containers are running.
echo.
pause
goto :EOF

:: ========================================================
:: UPDATE/RESTART
:: ========================================================
:UpdateRestart
echo.
echo ========================================================
echo     UPDATE/RESTART MODE
echo ========================================================
echo.

echo [1/5] Creating backup before update...
call :CreateBackup
if %errorlevel% neq 0 (
    echo       [WARNING] Backup failed, but continuing...
)

echo.
echo [2/5] Stopping containers...
docker-compose -f docker-compose.db.yml down
echo       [OK] Containers stopped

echo.
echo [3/5] Pulling latest images...
docker-compose -f docker-compose.db.yml pull
echo       [OK] Images updated

echo.
echo [4/5] Starting containers...
docker-compose -f docker-compose.db.yml up -d
if %errorlevel% neq 0 (
    echo       [ERROR] Failed to start containers!
    pause
    goto :EOF
)
echo       [OK] Containers started

echo.
echo [5/5] Waiting for database to be ready...
:WaitLoop3
timeout /t 3 /nobreak >nul
docker exec idesk-postgres pg_isready -U postgres >nul 2>&1
if %errorlevel% neq 0 (
    echo       Waiting for PostgreSQL...
    goto :WaitLoop3
)
echo       [OK] PostgreSQL is ready

echo.
echo Do you want to run database migrations?
set /p RUN_MIG2="Run migrations? (y/n): "
if /i "%RUN_MIG2%"=="y" (
    cd /d "%BACKEND_DIR%"
    call npm run migration:run
)

echo.
echo ========================================================
echo     UPDATE/RESTART COMPLETE!
echo ========================================================
echo.
pause
goto :EOF

:: ========================================================
:: BACKUP ONLY
:: ========================================================
:BackupOnly
echo.
echo ========================================================
echo     BACKUP MODE
echo ========================================================
echo.
call :CreateBackup
echo.
echo ========================================================
echo     BACKUP COMPLETE!
echo ========================================================
echo.
pause
goto :EOF

:: ========================================================
:: RESTORE FROM BACKUP
:: ========================================================
:RestoreBackup
echo.
echo ========================================================
echo     RESTORE FROM BACKUP
echo ========================================================
echo.

:: List available backups
echo Available backup files in %BACKUP_DIR%:
echo.
dir /b "%BACKUP_DIR%\*.tar" 2>nul
if %errorlevel% neq 0 (
    echo No .tar backup files found!
    echo.
    echo Please copy your backup files to: %BACKUP_DIR%
    pause
    goto :EOF
)

echo.
set /p PG_BACKUP="Enter PostgreSQL backup filename (or 'skip'): "
set /p REDIS_BACKUP="Enter Redis backup filename (or 'skip'): "

echo.
echo [1/4] Stopping existing containers...
docker-compose -f docker-compose.db.yml down >nul 2>&1
echo       [OK]

if not "%PG_BACKUP%"=="skip" (
    echo.
    echo [2/4] Restoring PostgreSQL data...
    if exist "%POSTGRES_DATA%" (
        echo       Backing up current data first...
        ren "%POSTGRES_DATA%" "postgres_old_%date:~-4%%date:~4,2%%date:~7,2%"
    )
    mkdir "%POSTGRES_DATA%"
    docker run --rm -v "%BACKUP_DIR%:/backup" -v "%POSTGRES_DATA%:/restore" ubuntu bash -c "cd /restore && tar xvf /backup/%PG_BACKUP% --strip-components=4"
    echo       [OK] PostgreSQL restored
) else (
    echo.
    echo [2/4] Skipping PostgreSQL restore
)

if not "%REDIS_BACKUP%"=="skip" (
    echo.
    echo [3/4] Restoring Redis data...
    if exist "%REDIS_DATA%" (
        ren "%REDIS_DATA%" "redis_old_%date:~-4%%date:~4,2%%date:~7,2%"
    )
    mkdir "%REDIS_DATA%"
    docker run --rm -v "%BACKUP_DIR%:/backup" -v "%REDIS_DATA%:/restore" ubuntu bash -c "cd /restore && tar xvf /backup/%REDIS_BACKUP% --strip-components=1"
    echo       [OK] Redis restored
) else (
    echo.
    echo [3/4] Skipping Redis restore
)

echo.
echo [4/4] Starting containers with restored data...
docker-compose -f docker-compose.db.yml up -d
if %errorlevel% neq 0 (
    echo       [ERROR] Failed to start containers!
    pause
    goto :EOF
)

:WaitLoop4
timeout /t 3 /nobreak >nul
docker exec idesk-postgres pg_isready -U postgres >nul 2>&1
if %errorlevel% neq 0 (
    echo       Waiting for PostgreSQL...
    goto :WaitLoop4
)
echo       [OK] Containers started and ready

echo.
echo ========================================================
echo     RESTORE COMPLETE!
echo ========================================================
echo.
pause
goto :EOF

:: ========================================================
:: RUN MIGRATIONS ONLY
:: ========================================================
:RunMigrations
echo.
echo ========================================================
echo     RUN DATABASE MIGRATIONS
echo ========================================================
echo.

echo [1/2] Checking database connection...
docker exec idesk-postgres pg_isready -U postgres >nul 2>&1
if %errorlevel% neq 0 (
    echo       [ERROR] Database is not running!
    echo       Please start the containers first using option [3].
    pause
    goto :EOF
)
echo       [OK] Database is ready

echo.
echo [2/2] Running migrations...
cd /d "%BACKEND_DIR%"
echo.
echo Current migration status:
call npm run migration:show
echo.
set /p CONFIRM_MIG="Proceed with running migrations? (y/n): "
if /i "%CONFIRM_MIG%"=="y" (
    call npm run migration:run
    echo.
    echo       [OK] Migrations completed
) else (
    echo       Cancelled.
)

echo.
pause
goto :EOF

:: ========================================================
:: CREATE BACKUP FUNCTION
:: ========================================================
:CreateBackup
echo Creating database backup...

:: Get timestamp
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value 2^>nul') do set datetime=%%I
set TIMESTAMP=%datetime:~0,8%_%datetime:~8,6%

:: Check if containers are running
docker ps --filter "name=idesk-postgres" --format "{{.Names}}" 2>nul | findstr "idesk-postgres" >nul
if %errorlevel% neq 0 (
    echo       [WARNING] PostgreSQL container not running, skipping container backup
    goto :BackupFiles
)

:: Backup PostgreSQL
echo       Creating PostgreSQL backup...
docker exec idesk-postgres pg_dump -U postgres idesk_db > "%BACKUP_DIR%\idesk_db_dump_%TIMESTAMP%.sql" 2>nul
if %errorlevel% equ 0 (
    echo       [OK] SQL dump saved to: idesk_db_dump_%TIMESTAMP%.sql
)

:: Create tar backup
docker run --rm --volumes-from idesk-postgres -v "%BACKUP_DIR%:/backup" ubuntu tar cvf /backup/postgres_backup_%TIMESTAMP%.tar /var/lib/postgresql/data >nul 2>&1
if %errorlevel% equ 0 (
    echo       [OK] Full backup saved to: postgres_backup_%TIMESTAMP%.tar
)

:: Backup Redis
docker ps --filter "name=idesk-redis" --format "{{.Names}}" 2>nul | findstr "idesk-redis" >nul
if %errorlevel% equ 0 (
    echo       Creating Redis backup...
    docker run --rm --volumes-from idesk-redis -v "%BACKUP_DIR%:/backup" ubuntu tar cvf /backup/redis_backup_%TIMESTAMP%.tar /data >nul 2>&1
    if %errorlevel% equ 0 (
        echo       [OK] Redis backup saved to: redis_backup_%TIMESTAMP%.tar
    )
)

:BackupFiles
exit /b 0

:: ========================================================
:: EXIT
:: ========================================================
:Exit
echo Goodbye!
goto :EOF
