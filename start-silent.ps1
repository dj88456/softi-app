# BTS SOFTI - Start servers silently (no cmd windows)
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

# Kill any existing instances on these ports
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

Start-Sleep -Milliseconds 500

# Start backend
Start-Process -WindowStyle Hidden -FilePath "node" `
    -ArgumentList "server.js" `
    -WorkingDirectory "$root\backend"

Start-Sleep -Milliseconds 1500

# Start frontend
Start-Process -WindowStyle Hidden -FilePath "npm" `
    -ArgumentList "run", "dev" `
    -WorkingDirectory "$root\frontend"

Write-Host "BTS SOFTI servers started in background."
Write-Host "Backend:  http://localhost:3001"
Write-Host "Frontend: http://localhost:5174"
