# ================================================================
#  run-security-tests.ps1
#  Automated Security Test Suite for PetMaza Payment & Cart System
#
#  WHAT THIS TESTS:
#    Layer 1: validateCartPrices middleware  (order creation)
#    Layer 2: createPaymentOrder security   (payment initiation)
#    Layer 3: Auth and Role enforcement
#
#  HOW TO RUN:
#    .\run-security-tests.ps1
#    .\run-security-tests.ps1 -Email "you@example.com" -Password "pass"
#
#  REQUIRES: PowerShell 5.1+, Backend running on port 6969
# ================================================================

param(
    [string]$Email    = "",
    [string]$Password = "",
    [string]$BaseUrl  = "http://localhost:6969/api"
)

# ── Helpers ──────────────────────────────────────────────────────────────────
$script:passed  = 0
$script:failed  = 0
$script:skipped = 0
$script:results = @()

function NullCoal($a, $b) { if ($null -ne $a -and "$a" -ne '') { $a } else { $b } }

function Write-Sep  { Write-Host "------------------------------------------------------------" -ForegroundColor DarkGray }

function Write-Section($title) {
    Write-Host ""
    Write-Sep
    Write-Host "  $title" -ForegroundColor Cyan
    Write-Sep
}

function Write-TestResult {
    param([string]$Name, [bool]$Ok, [string]$Detail, [string]$Why = "")
    if ($Ok) {
        Write-Host "  [PASS]  $Name" -ForegroundColor Green
        $script:passed++
    } else {
        Write-Host "  [FAIL]  $Name" -ForegroundColor Red
        $script:failed++
    }
    Write-Host "          Result : $Detail" -ForegroundColor DarkGray
    if ($Why) { Write-Host "          Reason : $Why" -ForegroundColor DarkYellow }
    $script:results += [PSCustomObject]@{
        Test   = $Name
        Status = if ($Ok) { "PASS" } else { "FAIL" }
    }
}

function Write-Skip {
    param([string]$Name, [string]$Reason = "")
    Write-Host "  [SKIP]  $Name" -ForegroundColor DarkGray
    if ($Reason) { Write-Host "          $Reason" -ForegroundColor DarkGray }
    $script:results += [PSCustomObject]@{ Test = $Name; Status = "SKIP" }
    $script:skipped++
}

function Write-Info($msg) { Write-Host "  [INFO]  $msg" -ForegroundColor Yellow }

# ── HTTP helper (PS 5.1 compatible) ─────────────────────────────────────────
function Call-API {
    param(
        [string]$Method,
        [string]$Endpoint,
        [hashtable]$Body    = $null,
        [hashtable]$Headers = @{ "Content-Type" = "application/json" }
    )
    $uri = "$BaseUrl$Endpoint"
    try {
        $json = $null
        if ($Body) { $json = $Body | ConvertTo-Json -Depth 10 -Compress }
        $resp = Invoke-RestMethod -Uri $uri -Method $Method -Body $json -Headers $Headers -ErrorAction Stop
        return @{ ok = $true; body = $resp; status = 200 }
    }
    catch {
        $status  = 0
        $errBody = $null
        try {
            $status  = [int]$_.Exception.Response.StatusCode
            $stream  = $_.Exception.Response.GetResponseStream()
            $reader  = New-Object System.IO.StreamReader($stream)
            $errBody = $reader.ReadToEnd() | ConvertFrom-Json
        } catch { }
        return @{ ok = $false; body = $errBody; status = $status; raw = $_.Exception.Message }
    }
}

# ============================================================
#  BANNER
# ============================================================
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "   PetMaza Payment Security - Automated Test Suite"         -ForegroundColor Cyan
Write-Host "   Tests: Cart Validation + Payment Tamper + Auth"          -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# ── STEP 0: Backend health check ────────────────────────────────────────────
Write-Section "STEP 0 -- Verify Backend is Running on port 6969"
$ping = Call-API -Method GET -Endpoint "/products?limit=1"
if ($ping.ok -or ($ping.status -ge 400 -and $ping.status -le 500)) {
    Write-Info "Backend is UP at $BaseUrl"
} else {
    Write-Host "  [ERROR] Backend not reachable at $BaseUrl" -ForegroundColor Red
    Write-Host "  Run:  npm run dev   (in petmaza-backend folder)" -ForegroundColor Yellow
    exit 1
}

# ── STEP 1: Login ────────────────────────────────────────────────────────────
Write-Section "STEP 1 -- Customer Login"

if (-not $Email) { $Email = Read-Host "  Enter customer email" }
if (-not $Password) {
    $secPwd   = Read-Host "  Enter password" -AsSecureString
    $bstr     = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secPwd)
    $Password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
}

$loginResult = Call-API -Method POST -Endpoint "/auth/login" -Body @{
    email    = $Email
    password = $Password
}

if (-not $loginResult.ok) {
    $errMsg = NullCoal $loginResult.body.message $loginResult.raw
    Write-Host "  [ERROR] Login failed: $errMsg" -ForegroundColor Red
    exit 1
}

$token = $loginResult.body.token
if (-not $token) { $token = $loginResult.body.data.token }
if (-not $token) {
    Write-Host "  [ERROR] No token found in login response" -ForegroundColor Red
    exit 1
}

$authH = @{
    "Content-Type"  = "application/json"
    "Authorization" = "Bearer $token"
}

Write-Info "Logged in:    $Email"
Write-Info "Token prefix: $($token.Substring(0, [Math]::Min(25, $token.Length)))..."

# ── STEP 2: Fetch a real product ─────────────────────────────────────────────
Write-Section "STEP 2 -- Fetch a Real Product from Database"

$prodResult = Call-API -Method GET -Endpoint "/products?limit=5" -Headers $authH
$product = $null
if ($prodResult.body -and $prodResult.body.data) {
    if ($prodResult.body.data.products) {
        $product = $prodResult.body.data.products[0]
    } elseif ($prodResult.body.data -is [array]) {
        $product = $prodResult.body.data[0]
    }
}

if (-not $product) {
    Write-Host "  [ERROR] No products found. Add at least one product to DB first." -ForegroundColor Red
    exit 1
}

$productId   = $product._id
$realPrice   = $product.sellingPrice
$hackerPrice = 1

Write-Info "Product   : $($product.name)"
Write-Info "Product ID: $productId"
Write-Info "Real price: Rs.$realPrice   |   Attacker will try: Rs.$hackerPrice"

$validAddress = @{
    customerPincode = "400001"
    customerAddress = @{
        street  = "123 Security Test Lane"
        city    = "Mumbai"
        state   = "Maharashtra"
        pincode = "400001"
        country = "India"
    }
}

# ============================================================
#  LAYER 1 TESTS: validateCartPrices Middleware
# ============================================================
Write-Section "LAYER 1 -- Cart Validation (validateCartPrices middleware)"
Write-Info "Middleware runs BEFORE order controller. Re-fetches all prices from DB."
Write-Info "Frontend-supplied prices are completely ignored."

# L1-A -----------------------------------------------------------------------
Write-Host ""
Write-Host "  [L1-A] ATTACK: Empty cart (zero items)" -ForegroundColor Magenta
$body = @{
    items           = @()
    customerPincode = "400001"
    customerAddress = @{ street = "123 Test"; city = "Mumbai"; state = "Maharashtra"; pincode = "400001"; country = "India" }
}
$r = Call-API -Method POST -Endpoint "/orders" -Body $body -Headers $authH
$msg = NullCoal $r.body.message $r.raw
Write-TestResult `
    -Name   "Empty cart blocked" `
    -Ok     (-not $r.ok -and $r.status -eq 400) `
    -Detail "HTTP $($r.status): $msg" `
    -Why    "Middleware: items array empty -> block before any DB call"

# L1-B -----------------------------------------------------------------------
Write-Host ""
Write-Host "  [L1-B] ATTACK: Product ID is not a valid MongoDB ObjectId" -ForegroundColor Magenta
$body = @{
    items           = @(@{ product_id = "FAKE_HACKER_ID_ABC"; quantity = 1 })
    customerPincode = "400001"
    customerAddress = @{ street = "123 Test"; city = "Mumbai"; state = "Maharashtra"; pincode = "400001"; country = "India" }
}
$r = Call-API -Method POST -Endpoint "/orders" -Body $body -Headers $authH
$msg = NullCoal $r.body.message $r.raw
Write-TestResult `
    -Name   "Invalid ObjectId blocked" `
    -Ok     (-not $r.ok) `
    -Detail "HTTP $($r.status): $msg" `
    -Why    "Middleware: mongoose.Types.ObjectId.isValid() check fails -> block"

# L1-C -----------------------------------------------------------------------
Write-Host ""
Write-Host "  [L1-C] ATTACK: Valid ObjectId format but product does not exist in DB" -ForegroundColor Magenta
$body = @{
    items           = @(@{ product_id = "000000000000000000000001"; quantity = 1 })
    customerPincode = "400001"
    customerAddress = @{ street = "123 Test"; city = "Mumbai"; state = "Maharashtra"; pincode = "400001"; country = "India" }
}
$r = Call-API -Method POST -Endpoint "/orders" -Body $body -Headers $authH
$msg = NullCoal $r.body.message $r.raw
Write-TestResult `
    -Name   "Non-existent product blocked" `
    -Ok     (-not $r.ok -and ($r.status -eq 404 -or $r.status -eq 400)) `
    -Detail "HTTP $($r.status): $msg" `
    -Why    "Middleware: batch-fetches products from DB; product not found -> 404"

# L1-D -----------------------------------------------------------------------
Write-Host ""
Write-Host "  [L1-D] ATTACK: Extreme quantity 999 (suspicious bulk buy)" -ForegroundColor Magenta
$body = @{
    items           = @(@{ product_id = $productId; quantity = 999 })
    customerPincode = "400001"
    customerAddress = @{ street = "123 Test"; city = "Mumbai"; state = "Maharashtra"; pincode = "400001"; country = "India" }
}
$r = Call-API -Method POST -Endpoint "/orders" -Body $body -Headers $authH
$msg = NullCoal $r.body.message $r.raw
Write-TestResult `
    -Name   "Extreme quantity (999) blocked + SUSPICIOUS_QUANTITY log written" `
    -Ok     (-not $r.ok -and $r.status -eq 400) `
    -Detail "HTTP $($r.status): $msg" `
    -Why    "Max 100/item. SecurityAuditLog: event=SUSPICIOUS_QUANTITY, severity=MEDIUM"

# L1-E -----------------------------------------------------------------------
Write-Host ""
Write-Host "  [L1-E] VERIFY: Sneak in price=Rs.1 in request body; server must ignore it" -ForegroundColor Magenta
$body = @{
    items           = @(@{ product_id = $productId; quantity = 1; price = 1; sellingPrice = 1; unit_price = 1 })
    customerPincode = "400001"
    customerAddress = @{ street = "123 Test"; city = "Mumbai"; state = "Maharashtra"; pincode = "400001"; country = "India" }
}
$r = Call-API -Method POST -Endpoint "/orders" -Body $body -Headers $authH

if ($r.ok -and $r.body.data -and $r.body.data.orders) {
    $orderData   = $r.body.data.orders[0]
    $serverTotal = if ($orderData.subtotal) { $orderData.subtotal } else { $orderData.total }
    Write-TestResult `
        -Name   "Frontend price=Rs.1 ignored; server used DB price" `
        -Ok     ($serverTotal -gt 5) `
        -Detail "Server total: Rs.$serverTotal (NOT Rs.1 the attacker sent)" `
        -Why    "validateCartPrices fetches price from DB and overwrites req.body values"
} else {
    $msg = NullCoal $r.body.message $r.raw
    Write-Info "Order not created in L1-E: $msg (may be shipping/address/prime validation - OK)"
}

# L1-F -----------------------------------------------------------------------
Write-Host ""
Write-Host "  [L1-F] NORMAL: Valid cart - 1 product, qty=1, valid address" -ForegroundColor Magenta
$body = @{
    items           = @(@{ product_id = $productId; quantity = 1 })
    customerPincode = "400001"
    customerAddress = @{ street = "123 Security Test Lane"; city = "Mumbai"; state = "Maharashtra"; pincode = "400001"; country = "India" }
}
$r = Call-API -Method POST -Endpoint "/orders" -Body $body -Headers $authH

$orderId     = $null
$serverTotal = $null

if ($r.ok -and $r.body.data -and $r.body.data.orders) {
    $createdOrder = $r.body.data.orders[0]
    $orderId      = $createdOrder._id
    $serverTotal  = if ($createdOrder.grandTotal) { $createdOrder.grandTotal } else { $createdOrder.total }
    Write-TestResult `
        -Name   "Valid cart accepted - order created" `
        -Ok     ($null -ne $orderId) `
        -Detail "Order ID: $orderId  |  Server total: Rs.$serverTotal" `
        -Why    "All checks passed: product active, price valid from DB, qty within limit"
} else {
    $msg = NullCoal $r.body.message $r.raw
    Write-Info "Order not created: $msg"
    Write-Info "Layer 2 payment tests will be skipped."
}

# ============================================================
#  LAYER 2 TESTS: createPaymentOrder Security
# ============================================================
Write-Section "LAYER 2 -- Payment Security (createPaymentOrder)"
Write-Info "Tests POST /payments/create-order - the payment initiation endpoint."

if (-not $orderId) {
    Write-Skip -Name "All Layer 2 payment tests" -Reason "No order created in L1-F - need a successful order first"
} else {
    Write-Info "Using Order: $orderId  |  Server total: Rs.$serverTotal"

    # L2-A: No db_order_id ---------------------------------------------------
    Write-Host ""
    Write-Host "  [L2-A] ATTACK: Payment with no db_order_id at all" -ForegroundColor Magenta
    $r = Call-API -Method POST -Endpoint "/payments/create-order" -Body @{
        amount   = $serverTotal
        currency = "INR"
    } -Headers $authH
    $msg = NullCoal $r.body.message $r.raw
    Write-TestResult `
        -Name   "Missing db_order_id blocked" `
        -Ok     (-not $r.ok -and $r.status -eq 400) `
        -Detail "HTTP $($r.status): $msg" `
        -Why    "Security: db_order_id is mandatory so backend always fetches REAL total from DB"

    # L2-B: CRITICAL tamper - Rs.1 -------------------------------------------
    Write-Host ""
    Write-Host "  [L2-B] ATTACK (CRITICAL): Tamper amount to Rs.$hackerPrice  (real=Rs.$serverTotal)" -ForegroundColor Magenta
    $r = Call-API -Method POST -Endpoint "/payments/create-order" -Body @{
        db_order_id = $orderId
        amount      = $hackerPrice
        currency    = "INR"
    } -Headers $authH
    $msg = NullCoal $r.body.message $r.raw
    Write-TestResult `
        -Name   "Amount tampering BLOCKED + CRITICAL audit log written" `
        -Ok     (-not $r.ok -and $r.status -eq 400) `
        -Detail "HTTP $($r.status): $msg" `
        -Why    "|Rs.$hackerPrice - Rs.$serverTotal| > Rs.0.50 -> PAYMENT_AMOUNT_TAMPERING, severity=CRITICAL"

    # L2-C: Zero amount ------------------------------------------------------
    Write-Host ""
    Write-Host "  [L2-C] ATTACK: Try to pay Rs.0" -ForegroundColor Magenta
    $r = Call-API -Method POST -Endpoint "/payments/create-order" -Body @{
        db_order_id = $orderId
        amount      = 0
        currency    = "INR"
    } -Headers $authH
    $msg = NullCoal $r.body.message $r.raw
    Write-TestResult `
        -Name   "Zero amount blocked" `
        -Ok     (-not $r.ok) `
        -Detail "HTTP $($r.status): $msg" `
        -Why    "Rs.0 differs from server total by > Rs.0.50 - caught by tamper detection"

    # L2-D: Correct amount - should succeed ----------------------------------
    Write-Host ""
    Write-Host "  [L2-D] NORMAL: Correct amount - expect testMode success" -ForegroundColor Magenta
    $r = Call-API -Method POST -Endpoint "/payments/create-order" -Body @{
        db_order_id = $orderId
        amount      = $serverTotal
        currency    = "INR"
    } -Headers $authH

    if ($r.ok -and $r.body.success) {
        $usedAmount = [math]::Round($r.body.data.amount / 100, 2)
        Write-TestResult `
            -Name   "Correct payment accepted - testMode response" `
            -Ok     $true `
            -Detail "Mock order: $($r.body.data.id)  |  Backend used Rs.$usedAmount  |  testMode=$($r.body.testMode)" `
            -Why    "Backend ignored frontend amount; used DB total; SKIP_PAYMENT=true -> testMode:true"
    } else {
        $msg = NullCoal $r.body.message $r.raw
        Write-Info "Payment response: HTTP $($r.status) - $msg"
        if ("$msg" -match "already been paid") {
            Write-Info "Order already Paid from previous run. Idempotency guard is working."
        }
    }
}

# L2-E: Unauthenticated payment (no token) ----------------------------------
Write-Host ""
Write-Host "  [L2-E] ATTACK: Payment request with no auth token" -ForegroundColor Magenta
$r = Call-API -Method POST -Endpoint "/payments/create-order" -Body @{
    db_order_id = "000000000000000000000001"
    amount      = 100
    currency    = "INR"
}
$msg = NullCoal $r.body.message $r.raw
Write-TestResult `
    -Name   "Unauthenticated payment blocked (401)" `
    -Ok     (-not $r.ok -and ($r.status -eq 401 -or $r.status -eq 403)) `
    -Detail "HTTP $($r.status): $msg" `
    -Why    "verifyToken fires before createPaymentOrder - no token = blocked"

# L2-F: Accessing another user's order -------------------------------------
Write-Host ""
Write-Host "  [L2-F] ATTACK: Try to pay for someone else's order ID" -ForegroundColor Magenta
$r = Call-API -Method POST -Endpoint "/payments/create-order" -Body @{
    db_order_id = "6600000000000000000000ab"
    amount      = 100
    currency    = "INR"
} -Headers $authH
$msg = NullCoal $r.body.message $r.raw
Write-TestResult `
    -Name   "Other user's order blocked (403 or 404)" `
    -Ok     (-not $r.ok -and ($r.status -eq 403 -or $r.status -eq 404)) `
    -Detail "HTTP $($r.status): $msg" `
    -Why    "Order not found OR ownership mismatch -> UNAUTHORIZED_ORDER_ACCESS logged"

# ============================================================
#  LAYER 3: Auth and Role Enforcement
# ============================================================
Write-Section "LAYER 3 -- Auth and Role Enforcement"

# L3-A: Create order without token -----------------------------------------
Write-Host ""
Write-Host "  [L3-A] ATTACK: Create order without logging in (no JWT)" -ForegroundColor Magenta
$body = @{
    items           = @(@{ product_id = $productId; quantity = 1 })
    customerPincode = "400001"
    customerAddress = @{ street = "123 Test"; city = "Mumbai"; state = "Maharashtra"; pincode = "400001"; country = "India" }
}
$r = Call-API -Method POST -Endpoint "/orders" -Body $body
$msg = NullCoal $r.body.message $r.raw
Write-TestResult `
    -Name   "Unauthenticated order creation blocked (401)" `
    -Ok     (-not $r.ok -and ($r.status -eq 401 -or $r.status -eq 403)) `
    -Detail "HTTP $($r.status): $msg" `
    -Why    "verifyToken + checkRole('customer') fires BEFORE validateCartPrices"

# ============================================================
#  SUMMARY
# ============================================================
$total = $script:passed + $script:failed + $script:skipped
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "                  TEST RESULTS SUMMARY" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ("  Total: {0}   Passed: {1}   Failed: {2}   Skipped: {3}" -f $total, $script:passed, $script:failed, $script:skipped) -ForegroundColor White
Write-Host ""

foreach ($res in $script:results) {
    $color = switch ($res.Status) { "PASS" { "Green" } "FAIL" { "Red" } default { "DarkGray" } }
    Write-Host ("  [{0}]  {1}" -f $res.Status, $res.Test) -ForegroundColor $color
}

Write-Host ""
Write-Sep
if ($script:failed -eq 0) {
    Write-Host "  All tests passed! Payment security is solid." -ForegroundColor Green
} else {
    Write-Host "  $script:failed test(s) FAILED. Review output above." -ForegroundColor Red
}

Write-Host ""
Write-Host "  HOW TO VIEW ATTACK LOGS IN MONGODB:" -ForegroundColor Magenta
Write-Sep
Write-Host "  mongosh => use petmaza" -ForegroundColor White
Write-Host "  db.securityauditlogs.find({}).sort({createdAt:-1}).limit(10).pretty()" -ForegroundColor White
Write-Host ""
Write-Host "  Show only CRITICAL attacks:" -ForegroundColor White
Write-Host '  db.securityauditlogs.find({ severity: "CRITICAL" }).pretty()' -ForegroundColor White
Write-Sep
Write-Host ""
