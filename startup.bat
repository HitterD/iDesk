@echo off
echo Starting iDesk Development Environment...

:: Start Backend
start "iDesk Backend" cmd /k "cd apps\backend && npm run start:dev"

:: Start Frontend
start "iDesk Frontend" cmd /k "cd apps\frontend && npm run dev"

:: Wait for services to start (approx 10 seconds)
timeout /t 10

:: Open Browser
start http://localhost:4050

echo Development environment started!
