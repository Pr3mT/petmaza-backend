# ============================================================
#  Petmaza Rate Limiter Test Script
#  Tests: authLimiter (10/15min) and generalLimiter (100/15min)
# ============================================================

$BASE = "http://localhost:6969"

function Send-Request($url, $method = "GET", $body = $null) {
    try {
        $params = @{ Uri = $url; Method = $method; ErrorAction = "Stop" }
        if ($body) {
            $params.Body = ($body | ConvertTo-Json)
            $params.ContentType = "application/json"
        }
        $r = Invoke-WebRequest @params
        return @{ code = $r.StatusCode; remaining = $r.Headers["RateLimit-Remaining"]; limit = $r.Headers["RateLimit-Limit"] }
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        return @{ code = $code; remaining = "0"; limit = "?" }
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  PETMAZA RATE LIMITER TEST" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# -----------------------------------------------------------
# TEST 1: Auth Limiter — limit is 10 per 15 min
# -----------------------------------------------------------
Write-Host ""
Write-Host "TEST 1: Auth Limiter  (limit = 10 requests / 15 min)" -ForegroundColor Yellow
Write-Host "  Sending 13 login requests to /api/auth/login ..." -ForegroundColor Gray

$blocked = 0
$passed  = 0

for ($i = 1; $i -le 13; $i++) {
    $res = Send-Request "$BASE/api/auth/login" "POST" @{ email = "test@petmaza.com"; password = "wrongpassword" }
    $color = if ($res.code -eq 429) { "Red" } elseif ($res.code -lt 500) { "Green" } else { "Gray" }
    $label = if ($res.code -eq 429) { "BLOCKED (429)" } else { "Passed  ($($res.code))" }
    if ($res.code -eq 429) { $blocked++ } else { $passed++ }
    Write-Host ("  Request {0,2}:  {1}   [Remaining: {2}]" -f $i, $label, $res.remaining) -ForegroundColor $color
}

Write-Host ""
Write-Host ("  Result: {0} passed, {1} blocked" -f $passed, $blocked) -ForegroundColor Cyan
if ($blocked -gt 0) {
    Write-Host "  [PASS] Auth limiter is WORKING" -ForegroundColor Green
} else {
    Write-Host "  [FAIL] Auth limiter did NOT block - check server is restarted with new code" -ForegroundColor Red
}

# -----------------------------------------------------------
# TEST 2: General Limiter — show headers on products route
# -----------------------------------------------------------
Write-Host ""
Write-Host "TEST 2: General Limiter  (limit = 100 requests / 15 min)" -ForegroundColor Yellow
Write-Host "  Sending 5 requests to /api/products to show RateLimit headers ..." -ForegroundColor Gray

for ($i = 1; $i -le 5; $i++) {
    $res = Send-Request "$BASE/api/products"
    Write-Host ("  Request {0}:  Status={1}  Limit={2}  Remaining={3}" -f $i, $res.code, $res.limit, $res.remaining) -ForegroundColor Green
}

# -----------------------------------------------------------
# TEST 3: Search Limiter header check
# -----------------------------------------------------------
Write-Host ""
Write-Host "TEST 3: Search Limiter  (limit = 200 requests / 15 min)" -ForegroundColor Yellow
Write-Host "  Sending 3 requests to /api/search/suggestions ..." -ForegroundColor Gray

for ($i = 1; $i -le 3; $i++) {
    $res = Send-Request "$BASE/api/search/suggestions?q=dog"
    Write-Host ("  Request {0}:  Status={1}  Limit={2}  Remaining={3}" -f $i, $res.code, $res.limit, $res.remaining) -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TEST COMPLETE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "HOW IT WORKS:" -ForegroundColor White
Write-Host "  - Each IP gets a counter that resets every 15 minutes"
Write-Host "  - /api/auth     : max 10  requests → brute-force protection"
Write-Host "  - /api/*        : max 100 requests → general API protection"
Write-Host "  - /api/search   : max 200 requests → higher limit for browsing"
Write-Host "  - When limit hit: HTTP 429 returned, no processing done"
Write-Host "  - RateLimit-Remaining header counts down on every response"
Write-Host ""
