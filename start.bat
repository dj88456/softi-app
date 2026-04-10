@echo off
echo Starting BTS SOFTI Weekly Report App...
echo.

:: Start backend
start "BTS Backend" cmd /k "cd /d %~dp0backend && node server.js"

:: Wait a moment for backend to start
timeout /t 2 /nobreak > nul

:: Start frontend
start "BTS Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo Backend running at: http://localhost:3001
echo Frontend running at: http://localhost:5174
echo.
echo Open your browser at: http://localhost:5174
pause
