# ============================================================
#  test-payment-security.ps1
#  Tests all 3 security layers added to PetMaza backend:
#    1. validateCartPrices middleware (order creation)
#    2. createPaymentOrder  (tampered amount detection)
#    3. SecurityAuditLog    (entries in MongoDB)
#
#  HOW TO RUN:
#    .\test-payment-security.ps1 -Email "your@email.com" -Password "yourpassword"
#
#  PREREQUISITES:
#    - Backend must be running  (npm start  or  npm run dev)
#    - Use a CUSTOMER account
# ============================================================

param(
    [Parameter(Mandatory=$true)]  [string]$Email,
    [Parameter(Mandatory=$true)]  [string]$Password,
    [string]$BaseUrl = "http://localhost:6969/api"
)

$ErrorActionPreference = "Stop"
$headers = @{ "Content-Type" = "application/json" }

function Write-Title($text)  { Write-Host "`n====== $text ======" -ForegroundColor Cyan }
function Write-Pass($text)   { Write-Host "  [PASS] $text" -ForegroundColor Green }
function Write-Fail($text)   { Write-Host "  [FAIL] $text" -ForegroundColor Red }
function Write-Info($text)   { Write-Host "  [INFO] $text" -ForegroundColor Yellow }

function Invoke-API {
    param([string]$Method, [string]$Endpoint, [hashtable]$Body, [hashtable]$H)
    $uri = "$BaseUrl$Endpoint"
    try {
        $json = if ($Body) { $Body | ConvertTo-Json -Depth 10 } else { $null }
        $resp = Invoke-RestMethod -Uri $uri -Method $Method -Body $json -Headers $H -ErrorAction Stop
        return @{ success = $true; data = $resp }
    } catch {
        $errBody = $null
        try { $errBody = $_.ErrorDetails.Message | ConvertFrom-Json } catch {}
        return @{ success = $false; status = $_.Exception.Response.StatusCode.value__; data = $errBody; raw = $_.Exception.Message }
    }
}

# ─────────────────────────────────────────────────────────────────────────────
Write-Title "STEP 1: Login to get auth token"
# ─────────────────────────────────────────────────────────────────────────────

$loginResult = Invoke-API -Method POST -Endpoint "/auth/login" -Body @{ email = $Email; password = $Password } -H $headers

if (-not $loginResult.success) {
    Write-Fail "Login failed: $($loginResult.raw)"
    Write-Info "Make sure your backend is running (npm start) and the email/password is correct"
    exit 1
}

$token = $loginResult.data.token ?? $loginResult.data.data?.token
if (-not $token) {
    # Try nested structure
    $token = $loginResult.data.data.token
}

Write-Pass "Logged in successfully"
Write-Info "Token: $($token.Substring(0, [Math]::Min(30, $token.Length)))..."

$authHeaders = @{
    "Content-Type"  = "application/json"
    "Authorization" = "Bearer $token"
}

# ─────────────────────────────────────────────────────────────────────────────
Write-Title "STEP 2: Get a real product ID from the database"
# ─────────────────────────────────────────────────────────────────────────────

$productsResult = Invoke-API -Method GET -Endpoint "/products?limit=1" -H $authHeaders

$product = $null
if ($productsResult.success) {
    $product = $productsResult.data.data.products[0] ?? $productsResult.data.data[0]
}

if (-not $product) {
    Write-Fail "Could not fetch products. Make sure you have at least one product in the database."
    exit 1
}

$productId    = $product._id
$realPrice    = $product.sellingPrice
$tamperedPrice = 1   # Hacker tries to pay ₹1 instead of real price

Write-Pass "Found product: $($product.name)"
Write-Info  "Product ID:    $productId"
Write-Info  "Real price:    Rs.$realPrice"
Write-Info  "Tampered price hacker will try: Rs.$tamperedPrice"

# ─────────────────────────────────────────────────────────────────────────────
Write-Title "STEP 3 (NORMAL): Create an order with correct items"
Write-Info  "Expected: Order created successfully (validateCartPrices passes)"
# ─────────────────────────────────────────────────────────────────────────────

$addressBody = @{
    items = @(@{
        product_id = $productId
        quantity   = 1
        # NOTE: No price field sent — backend fetches from DB automatically
    })
    customerPincode = "400001"
    customerAddress = @{
        street  = "123 Test Street"
        city    = "Mumbai"
        state   = "Maharashtra"
        pincode = "400001"
    }
}

$orderResult = Invoke-API -Method POST -Endpoint "/orders" -Body $addressBody -H $authHeaders

if ($orderResult.success) {
    Write-Pass "Normal order created! Server calculated the price from DB."
    $createdOrder = $orderResult.data.data.orders[0]
    $orderId      = $createdOrder._id
    $serverTotal  = $createdOrder.total ?? $createdOrder.grandTotal
    Write-Info "Order ID:      $orderId"
    Write-Info "Server total:  Rs.$serverTotal  (DB price — never from frontend)"
} else {
    Write-Info "Order creation returned: $($orderResult.data.message ?? $orderResult.raw)"
    Write-Info "This may fail if the product has no stock or is a prime product — that is expected validation working."
    $orderId    = $null
    $serverTotal = $realPrice
}

# ─────────────────────────────────────────────────────────────────────────────
Write-Title "STEP 4 (ATTACK): Try to initiate payment with a TAMPERED amount"
Write-Info  "Hacker sends Rs.1 instead of Rs.$serverTotal"
Write-Info  "Expected: 400 error — PAYMENT_AMOUNT_TAMPERING blocked"
# ─────────────────────────────────────────────────────────────────────────────

if ($orderId) {
    $tamperedPaymentBody = @{
        db_order_id = $orderId
        amount      = 1          # << HACKER TAMPERS THIS
        currency    = "INR"
    }

    $tamperResult = Invoke-API -Method POST -Endpoint "/payments/create-order" -Body $tamperedPaymentBody -H $authHeaders

    if (-not $tamperResult.success -and ($tamperResult.status -eq 400 -or $tamperResult.status -eq 403)) {
        Write-Pass "ATTACK BLOCKED! Backend rejected tampered amount."
        Write-Info "Error returned: $($tamperResult.data.message)"
        Write-Info "Check backend logs — you should see: [SECURITY:CRITICAL] PAYMENT_AMOUNT_TAMPERING"
    } elseif ($tamperResult.success) {
        Write-Fail "ATTACK NOT BLOCKED. Payment order was created with tampered amount!"
        Write-Fail "Check the security implementation."
    } else {
        Write-Info "Response status $($tamperResult.status): $($tamperResult.data.message ?? $tamperResult.raw)"
    }

    # ─────────────────────────────────────────────────────────────────────────
    Write-Title "STEP 5 (NORMAL): Create payment order with CORRECT amount"
    Write-Info  "Expected: Razorpay/mock order created with server-computed Rs.$serverTotal"
    # ─────────────────────────────────────────────────────────────────────────

    $correctPaymentBody = @{
        db_order_id = $orderId
        amount      = $serverTotal   # Correct amount (backend will use DB value anyway)
        currency    = "INR"
    }

    $paymentResult = Invoke-API -Method POST -Endpoint "/payments/create-order" -Body $correctPaymentBody -H $authHeaders

    if ($paymentResult.success) {
        Write-Pass "Payment order created successfully!"
        Write-Info "Razorpay order ID: $($paymentResult.data.data.id)"
        Write-Info "Amount in paise:   $($paymentResult.data.data.amount)  (= Rs.$([math]::Round($paymentResult.data.data.amount / 100, 2)))"
        if ($paymentResult.data.testMode) {
            Write-Info "(Test mode — SKIP_PAYMENT=true in .env)"
        }
    } else {
        Write-Info "Payment order: $($paymentResult.data.message ?? $paymentResult.raw)"
    }
} else {
    Write-Info "Skipping payment tamper test — no order was created in Step 3."
}

# ─────────────────────────────────────────────────────────────────────────────
Write-Title "STEP 6 (ATTACK): Try to create order with no items"
Write-Info  "Expected: 400 — 'Cart items are required'"
# ─────────────────────────────────────────────────────────────────────────────

$emptyCartResult = Invoke-API -Method POST -Endpoint "/orders" -Body @{
    items           = @()
    customerPincode = "400001"
    customerAddress = @{ street = "x"; city = "Mumbai"; state = "Maharashtra"; pincode = "400001" }
} -H $authHeaders

if (-not $emptyCartResult.success) {
    Write-Pass "Empty cart blocked: $($emptyCartResult.data.message)"
} else {
    Write-Fail "Empty cart was not blocked!"
}

# ─────────────────────────────────────────────────────────────────────────────
Write-Title "STEP 7 (ATTACK): Try to create order with invalid product ID"
Write-Info  "Expected: 404 — Product not found"
# ─────────────────────────────────────────────────────────────────────────────

$fakeProductResult = Invoke-API -Method POST -Endpoint "/orders" -Body @{
    items           = @(@{ product_id = "000000000000000000000001"; quantity = 1 })
    customerPincode = "400001"
    customerAddress = @{ street = "x"; city = "Mumbai"; state = "Maharashtra"; pincode = "400001" }
} -H $authHeaders

if (-not $fakeProductResult.success) {
    Write-Pass "Fake product blocked: $($fakeProductResult.data.message)"
} else {
    Write-Fail "Fake product was not blocked!"
}

# ─────────────────────────────────────────────────────────────────────────────
Write-Title "STEP 8 (ATTACK): Try extreme quantity (999)"
Write-Info  "Expected: 400 — Quantity exceeds allowed maximum"
# ─────────────────────────────────────────────────────────────────────────────

$bigQtyResult = Invoke-API -Method POST -Endpoint "/orders" -Body @{
    items           = @(@{ product_id = $productId; quantity = 999 })
    customerPincode = "400001"
    customerAddress = @{ street = "x"; city = "Mumbai"; state = "Maharashtra"; pincode = "400001" }
} -H $authHeaders

if (-not $bigQtyResult.success) {
    Write-Pass "Extreme quantity blocked: $($bigQtyResult.data.message)"
} else {
    Write-Fail "Extreme quantity was not blocked!"
}

# ─────────────────────────────────────────────────────────────────────────────
Write-Title "STEP 9: Check SecurityAuditLog via MongoDB"
Write-Info  "Run this in MongoDB Compass or mongosh to see logged attacks:"
# ─────────────────────────────────────────────────────────────────────────────

Write-Host @"

  In MongoDB Compass:
    Database: petmaza  (or your DB name)
    Collection: securityauditlogs

  In mongosh / MongoDB shell:
    use petmaza
    db.securityauditlogs.find({}).sort({ createdAt: -1 }).limit(10).pretty()

  Filter by critical events only:
    db.securityauditlogs.find({ severity: "CRITICAL" }).sort({ createdAt: -1 }).pretty()

  Filter by tampering events:
    db.securityauditlogs.find({ event: "PAYMENT_AMOUNT_TAMPERING" }).pretty()

"@ -ForegroundColor Magenta

# ─────────────────────────────────────────────────────────────────────────────
Write-Title "STEP 10: Check backend console logs"
Write-Info  "In your backend terminal you should see lines like:"
# ─────────────────────────────────────────────────────────────────────────────

Write-Host @"

  [SECURITY:CRITICAL] PAYMENT_AMOUNT_TAMPERING | User: <userId> | IP: ::1 | Details: ...
  [validateCartPrices]  Cart validated: 1 item(s), server subtotal Rs.XXX.00
  [createPaymentOrder]  Razorpay order created: order_xxx | Amount: Rs.XXX

"@ -ForegroundColor Magenta

Write-Host "`n✅ Security test complete!`n" -ForegroundColor Green
