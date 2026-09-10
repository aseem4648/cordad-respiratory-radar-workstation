@echo off
title Contactless Respiratory Radar System Launcher
echo ========================================================
echo   CONTACTLESS RESPIRATORY DISTRESS AND APNEA SYSTEM
echo ========================================================
echo.

echo [PORTS] Inspecting and terminating any hanging processes on Port 5000, 3000, and 8001...
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr /r ":5000\>"') do (
  echo [PORT 5000] Terminating PID %%a...
  taskkill /f /pid %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr /r ":3000\>"') do (
  echo [PORT 3000] Terminating PID %%a...
  taskkill /f /pid %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr /r ":8001\>"') do (
  echo [PORT 8001] Terminating PID %%a...
  taskkill /f /pid %%a >nul 2>&1
)
timeout /t 1 /nobreak >nul

if not exist "%~dp0backend\node_modules" (
  echo [SETUP] Installing backend dependencies...
  cd /d "%~dp0backend" && call npm install
)

if not exist "%~dp0frontend\node_modules" (
  echo [SETUP] Installing frontend dependencies...
  cd /d "%~dp0frontend" && call npm install
)

echo Starting Camera rPPG Service on port 8001...
start "Camera rPPG Service (Port 8001)" cmd /k "cd /d %~dp0camera-rppg-service && python api.py"

timeout /t 1 /nobreak >nul

echo Starting Backend on port 5000...
start "Respiratory Radar Backend (Port 5000)" cmd /k "cd /d %~dp0backend && npm run dev"

timeout /t 3 /nobreak >nul

echo Starting Frontend on port 3000...
start "Respiratory Radar Frontend (Port 3000)" cmd /k "cd /d %~dp0frontend && npm run dev"

timeout /t 2 /nobreak >nul

echo Opening Dashboard in browser...
start http://localhost:3000

echo.
echo ========================================================
echo System started successfully!
echo Frontend:    http://localhost:3000
echo Backend:     http://localhost:5000
echo Camera rPPG: http://localhost:8001
echo ========================================================
