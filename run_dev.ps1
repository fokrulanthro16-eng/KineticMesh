# KineticMesh - Full-Stack Local Launcher (FastAPI + Next.js)
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   KINETICMESH // ZERO-TRUST KINEMATIC SWARM CONSENSUS    " -ForegroundColor Green
Write-Host "   Track: Cybersecurity + Dual-Use Aviation Futures       " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

$backendPath = Join-Path $PSScriptRoot "backend"
$frontendPath = Join-Path $PSScriptRoot "frontend"

Write-Host "`n[1/2] Starting FastAPI Backend on http://localhost:8000..." -ForegroundColor Cyan
$backendProc = Start-Process python -ArgumentList "-m uvicorn main:app --host 0.0.0.0 --port 8000 --reload" -WorkingDirectory $backendPath -PassThru

Write-Host "[2/2] Starting Next.js Tactical HUD on http://localhost:3000..." -ForegroundColor Cyan
$frontendProc = Start-Process npm -ArgumentList "run dev" -WorkingDirectory $frontendPath -PassThru

Write-Host "`nBoth services launched in background!" -ForegroundColor Green
Write-Host "Tactical Operations HUD: http://localhost:3000" -ForegroundColor Yellow
Write-Host "Backend API Docs:       http://localhost:8000/docs" -ForegroundColor Yellow
Write-Host "`nPress CTRL+C or close windows to terminate." -ForegroundColor Gray
