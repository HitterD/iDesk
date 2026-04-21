@echo off
echo ============================================
echo   iDesk Quick Test Runner
echo ============================================
echo.

echo [1/2] Running database seed...
cd /d c:\iDesk\apps\backend
call npx ts-node src/seeds/run-seed.ts
if errorlevel 1 (
    echo ❌ Seed failed!
    pause
    exit /b 1
)

echo.
echo [2/2] Running API tests...
echo (Make sure backend is running on port 5050)
echo.
call npx ts-node src/tests/api-test.ts

echo.
echo ============================================
echo   Test run complete!
echo ============================================
pause
