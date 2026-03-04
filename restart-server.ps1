# Restart Server Script - Stops any process on port 6969 and starts fresh

Write-Host "🔍 Checking for processes on port 6969..." -ForegroundColor Cyan

# Find process using port 6969
$portInfo = netstat -ano | Select-String ":6969.*LISTENING"
if ($portInfo) {
    $pid = ($portInfo -split '\s+')[-1]
    Write-Host "⚠️  Found process $pid using port 6969" -ForegroundColor Yellow
    Write-Host "🛑 Stopping process..." -ForegroundColor Red
    taskkill /F /PID $pid 2>&1 | Out-Null
    Start-Sleep -Seconds 1
    Write-Host "✅ Process stopped" -ForegroundColor Green
} else {
    Write-Host "✅ Port 6969 is free" -ForegroundColor Green
}

Write-Host ""
Write-Host "🚀 Starting backend server..." -ForegroundColor Cyan
npm start
