@echo off
:: MISTER — One-click launcher (Windows)
:: Double-click this file to start

cd /d "%~dp0"
echo.
echo   MISTER — Starting...
echo.

:: Install deps if needed
if not exist "node_modules" (
    echo   Installing dependencies ^(first run only^)...
    call npm install --legacy-peer-deps --no-audit --no-fund 2>nul
)

:: Try Electron
where npx >nul 2>nul
if %errorlevel%==0 (
    npx --no-install electron --version >nul 2>nul
    if %errorlevel%==0 (
        echo   Opening desktop app...
        npx electron main.js
        goto :eof
    )
)

:: Fallback: browser
echo   Opening in browser...
set PORT=3000
echo   http://localhost:%PORT%
start "" "http://localhost:%PORT%"
cd demo
python -m http.server %PORT% 2>nul || python3 -m http.server %PORT% 2>nul || npx --yes serve . -l %PORT%
