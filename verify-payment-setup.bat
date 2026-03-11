@echo off
echo.
echo =====================================
echo   PAYMENT FLOW VERIFICATION
echo =====================================
echo.
echo Checking configuration...
echo.

REM Check if backend .env has Razorpay keys
echo [Backend Configuration]
findstr /C:"RAZORPAY_KEY_ID" .env >nul 2>&1
if %errorlevel%==0 (
    echo   [OK] Razorpay Key ID configured
) else (
    echo   [ERROR] Razorpay Key ID missing in backend .env
)

findstr /C:"SKIP_PAYMENT=false" .env >nul 2>&1
if %errorlevel%==0 (
    echo   [OK] Payment mode: Production
) else (
    echo   [WARN] Payment might be in test mode
)

findstr /C:"SMTP_USER" .env >nul 2>&1
if %errorlevel%==0 (
    echo   [OK] Email SMTP configured
) else (
    echo   [ERROR] SMTP configuration missing
)

echo.
echo [Frontend Configuration]
cd ..\petmaza-frontend
findstr /C:"REACT_APP_RAZORPAY_KEY_ID" .env >nul 2>&1
if %errorlevel%==0 (
    echo   [OK] Frontend Razorpay Key configured
) else (
    echo   [ERROR] Frontend Razorpay Key missing!
    echo   [ACTION NEEDED] Add to petmaza-frontend/.env:
    echo   REACT_APP_RAZORPAY_KEY_ID=rzp_test_SARmEJFgYTXwxR
)

cd ..\petmaza-backend
echo.
echo =====================================
echo   BACKEND SERVER STATUS
echo =====================================
echo.
tasklist /FI "IMAGENAME eq node.exe" | find "node.exe" >nul
if %errorlevel%==0 (
    echo   [OK] Backend server is running
) else (
    echo   [ERROR] Backend server NOT running
    echo   [ACTION] Run: npm start
)

echo.
echo =====================================
echo   FRONTEND SERVER STATUS
echo =====================================
echo.
tasklist /FI "IMAGENAME eq node.exe" | find "node.exe" >nul
if %errorlevel%==0 (
    echo   [INFO] Node process detected
    echo   [ACTION] Restart frontend to load new .env:
    echo            1. Stop: Ctrl+C in frontend terminal
    echo            2. Start: npm start
) else (
    echo   [WARN] Frontend may not be running
)

echo.
echo =====================================
echo   NEXT STEPS
echo =====================================
echo.
echo 1. RESTART FRONTEND (IMPORTANT!)
echo    - Stop: Ctrl+C
echo    - Start: npm start
echo.
echo 2. Clear Browser Cache
echo    - Press: Ctrl+Shift+Delete
echo    - Clear cached files
echo.
echo 3. Test Payment Flow:
echo    - Login as: samrudhiamrutkar15@gmail.com
echo    - Add: Dog Food + Fish Accessories
echo    - Click: "Place Order and Pay"
echo    - Expected: Payment page shows
echo.
echo 4. Complete Payment:
echo    - Card: 4111 1111 1111 1111
echo    - CVV: 123
echo    - Any future date
echo.
echo 5. Check Emails:
echo    - Check: samrudhiamrutkar15@gmail.com
echo    - Expected: 2 payment receipts
echo.
echo =====================================
pause
