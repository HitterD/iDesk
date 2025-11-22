@echo off
echo Starting iDesk Database Container...
echo Data will be stored in %~dp0postgres-data

docker-compose -f docker-compose.db.yml up -d

if %errorlevel% neq 0 (
    echo Failed to start database container.
    pause
    exit /b %errorlevel%
)

echo Database started successfully!
pause
