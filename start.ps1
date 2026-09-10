Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  CONTACTLESS RESPIRATORY DISTRESS AND APNEA SYSTEM" -ForegroundColor White
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

# Auto-free ports 5000, 3000, and 8001 if in use to prevent EADDRINUSE errors
$ports = @(5000, 3000, 8001)
foreach ($port in $ports) {
    $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($conn) {
        $pids = $conn | Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($pidToKill in $pids) {
            if ($pidToKill -gt 0) {
                Write-Host "[PORT $port] Releasing port occupied by PID $pidToKill..." -ForegroundColor Yellow
                Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue
            }
        }
    }
}
Start-Sleep -Milliseconds 500

if (-not (Test-Path "$PSScriptRoot\backend\node_modules")) {
    Write-Host "[SETUP] Installing backend dependencies (first run)..." -ForegroundColor Yellow
    Push-Location "$PSScriptRoot\backend"
    npm install
    Pop-Location
}

if (-not (Test-Path "$PSScriptRoot\frontend\node_modules")) {
    Write-Host "[SETUP] Installing frontend dependencies (first run)..." -ForegroundColor Yellow
    Push-Location "$PSScriptRoot\frontend"
    npm install
    Pop-Location
}

Write-Host "Starting Camera rPPG & Respiration Engine on port 8001..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\camera-rppg-service'; python api.py"

Start-Sleep -Seconds 1

Write-Host "Starting Backend on port 5000..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; npm run dev"

Start-Sleep -Seconds 3

Write-Host "Starting Frontend on port 3000..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; npm run dev"

Start-Sleep -Seconds 2

Write-Host "Opening Dashboard in Google Chrome..." -ForegroundColor Green
Start-Process chrome.exe "http://localhost:3000" -ErrorAction SilentlyContinue
if (-not $?) {
    Start-Process "http://localhost:3000"
}

Write-Host ""
Write-Host "System started successfully!" -ForegroundColor Yellow
Write-Host "Frontend:    http://localhost:3000" -ForegroundColor Cyan
Write-Host "Backend:     http://localhost:5000" -ForegroundColor Cyan
Write-Host "Camera rPPG: http://localhost:8001" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
