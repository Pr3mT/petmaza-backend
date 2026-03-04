@echo off
echo Restarting Backend Server...
echo.

REM Find and kill process on port 6969
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :6969.*LISTENING') do (
    echo Stopping process %%a on port 6969...
    taskkill /F /PID %%a >nul 2>&1
    timeout /t 1 >nul
)

echo.
echo Starting server...
npm start
