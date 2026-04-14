# BTS SOFTI - Stop all servers
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Write-Host "All BTS SOFTI servers stopped."
