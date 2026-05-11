@echo off
echo Starting Banking Transactions API...
echo.

cd /d "%~dp0.."

if not exist "node_modules" (
    echo Installing dependencies...
    npm install
    echo.
)

echo Server running at http://localhost:3000
echo Press Ctrl+C to stop.
echo.

npm run dev
