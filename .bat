@echo off

@REM Frontend
echo Starting frontend...
start cmd /k "cd /d frontend && npm run dev -- --host"

timeout /t 2 >nul

@REM Backend
echo Starting backend...
start cmd /k "cd /d backend && npm run dev"

echo.
echo All services started!
pause