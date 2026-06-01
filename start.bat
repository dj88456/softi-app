@echo off
echo Starting BTS SOFTI Weekly Report App...
echo.
echo Backend : http://localhost:3001
echo Frontend: http://localhost:5174
echo.
echo Press Ctrl+C to stop all servers.
echo ----------------------------------------

:: Start backend silently in background
start /B node "%~dp0backend\server.js"

:: Give backend a moment to bind
timeout /t 2 /nobreak > nul

:: Run frontend in foreground (keeps this window open)
cd /d "%~dp0frontend"
npm run dev
