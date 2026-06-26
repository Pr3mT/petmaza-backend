# ============================================================
# Petmaza - Clone Atlas DB to Local MongoDB
# Run this in PowerShell as Administrator after installing:
#   1. MongoDB Community Edition
#   2. MongoDB Database Tools
# ============================================================

$ATLAS_URI = "mongodb+srv://RivrTechlabs:RivrTech@2100@rivrcluster.k62al.mongodb.net/pet-marketplace?appName=RIVRCluster"
$LOCAL_URI = "mongodb://localhost:27017/pet-marketplace"
$DUMP_DIR  = "$PSScriptRoot\db-dump"

Write-Host ""
Write-Host "=== Petmaza Local DB Setup ===" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Check MongoDB tools are available ─────────────────
Write-Host "Checking MongoDB tools..." -ForegroundColor Yellow
$mongodump    = Get-Command mongodump    -ErrorAction SilentlyContinue
$mongorestore = Get-Command mongorestore -ErrorAction SilentlyContinue
$mongod       = Get-Command mongod       -ErrorAction SilentlyContinue

if (-not $mongodump -or -not $mongorestore) {
    Write-Host ""
    Write-Host "ERROR: mongodump / mongorestore not found in PATH." -ForegroundColor Red
    Write-Host "Install MongoDB Database Tools from:" -ForegroundColor Red
    Write-Host "  https://www.mongodb.com/try/download/database-tools" -ForegroundColor Red
    Write-Host "Then add its bin folder to your PATH and re-run this script." -ForegroundColor Red
    exit 1
}
Write-Host "  mongodump    : $($mongodump.Source)" -ForegroundColor Green
Write-Host "  mongorestore : $($mongorestore.Source)" -ForegroundColor Green

# ── Step 2: Ensure local MongoDB is running ───────────────────
Write-Host ""
Write-Host "Checking local MongoDB service..." -ForegroundColor Yellow
$svc = Get-Service -Name "MongoDB" -ErrorAction SilentlyContinue
if ($svc -and $svc.Status -ne "Running") {
    Write-Host "  Starting MongoDB service..." -ForegroundColor Yellow
    Start-Service MongoDB
    Start-Sleep -Seconds 3
}
$svc = Get-Service -Name "MongoDB" -ErrorAction SilentlyContinue
if ($svc -and $svc.Status -eq "Running") {
    Write-Host "  MongoDB service is running" -ForegroundColor Green
} else {
    Write-Host "  WARNING: MongoDB service not found or not running." -ForegroundColor Yellow
    Write-Host "  Make sure mongod is running before continuing." -ForegroundColor Yellow
    $continue = Read-Host "  Press ENTER to continue anyway, or Ctrl+C to abort"
}

# ── Step 3: Dump from Atlas ───────────────────────────────────
Write-Host ""
Write-Host "Step 1/2 — Dumping live Atlas database..." -ForegroundColor Cyan
Write-Host "  Source : $ATLAS_URI" -ForegroundColor Gray
Write-Host "  Output : $DUMP_DIR" -ForegroundColor Gray
Write-Host ""

if (Test-Path $DUMP_DIR) {
    Remove-Item -Recurse -Force $DUMP_DIR
}

mongodump --uri="$ATLAS_URI" --out="$DUMP_DIR"

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: mongodump failed. Check your Atlas credentials or network." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "  Atlas dump complete" -ForegroundColor Green

# ── Step 4: Restore to local ──────────────────────────────────
Write-Host ""
Write-Host "Step 2/2 — Restoring to local MongoDB..." -ForegroundColor Cyan
Write-Host "  Target : $LOCAL_URI" -ForegroundColor Gray
Write-Host ""

# Drop existing local DB and restore fresh
mongorestore --uri="$LOCAL_URI" --drop "$DUMP_DIR\pet-marketplace"

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: mongorestore failed." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "  Restore complete" -ForegroundColor Green

# ── Step 5: Switch .env to local ─────────────────────────────
Write-Host ""
Write-Host "Switching .env to local MongoDB..." -ForegroundColor Yellow
$envFile = "$PSScriptRoot\.env"
$envContent = Get-Content $envFile -Raw

# Comment out Atlas URI, uncomment local URI
$envContent = $envContent -replace '(?m)^MONGODB_URI=mongodb\+srv://.*$', '# MONGODB_URI=mongodb+srv://RivrTechlabs:RivrTech%402100@rivrcluster.k62al.mongodb.net/pet-marketplace?appName=RIVRCluster'
$envContent = $envContent -replace '(?m)^# MONGODB_URI=mongodb://localhost', 'MONGODB_URI=mongodb://localhost'

Set-Content $envFile $envContent -NoNewline
Write-Host "  .env updated to use local MongoDB" -ForegroundColor Green

# ── Done ─────────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Local DB setup complete!" -ForegroundColor Green
Write-Host "  Run: npm run dev" -ForegroundColor Green
Write-Host ""
Write-Host "  To switch BACK to Atlas:" -ForegroundColor Gray
Write-Host "  Edit .env, uncomment the Atlas URI and" -ForegroundColor Gray
Write-Host "  comment out the localhost URI." -ForegroundColor Gray
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
