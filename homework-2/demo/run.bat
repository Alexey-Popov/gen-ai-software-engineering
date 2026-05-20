@echo off
setlocal

set NODE_ENV=development
set PORT=3000

cd /d "%~dp0.."

if not exist node_modules (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo ERROR: npm install failed.
        pause
        exit /b 1
    )
)

echo.
echo Starting Customer Support Ticket API...
echo Base URL: http://localhost:%PORT%
echo Press Ctrl+C to stop.
echo.

npm run dev
