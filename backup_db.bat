@echo off
setlocal

echo.
echo ========================================================
echo     iDesk Database Backup Utility
echo ========================================================
echo.

set BACKUP_DIR=backups
if not exist %BACKUP_DIR% mkdir %BACKUP_DIR%

:: Get timestamp
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set TIMESTAMP=%datetime:~0,8%_%datetime:~8,6%

echo [1/2] Backing up PostgreSQL data...
docker run --rm --volumes-from idesk-postgres -v %cd%\%BACKUP_DIR%:/backup ubuntu tar cvf /backup/postgres_backup_%TIMESTAMP%.tar /var/lib/postgresql/data
if %errorlevel% neq 0 (
    echo       [ERROR] Failed to backup PostgreSQL data.
) else (
    echo       [OK] PostgreSQL backup saved to %BACKUP_DIR%\postgres_backup_%TIMESTAMP%.tar
)

echo.
echo [2/2] Backing up Redis data...
docker run --rm --volumes-from idesk-redis -v %cd%\%BACKUP_DIR%:/backup ubuntu tar cvf /backup/redis_backup_%TIMESTAMP%.tar /data
if %errorlevel% neq 0 (
    echo       [ERROR] Failed to backup Redis data.
) else (
    echo       [OK] Redis backup saved to %BACKUP_DIR%\redis_backup_%TIMESTAMP%.tar
)

echo.
echo ========================================================
echo     BACKUP COMPLETE
echo ========================================================
echo.
pause
