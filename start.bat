@echo off
echo Starting Hello Chat services on network...
echo.
echo This will open 3 terminal windows:
echo   1. Backend
echo   2. Frontend
echo.
timeout /t 2

REM Get the directory where this script is located
cd /d "%~dp0"

REM Start Backend in new window
echo Starting Backend...
start "Backend - Hello Chat" cmd /k "cd backend && npm run dev"
timeout /t 2

REM Start Frontend in new window
echo Starting Frontend...
start "Frontend - Hello Chat" cmd /k "cd frontend && npm run dev"
timeout /t 2
