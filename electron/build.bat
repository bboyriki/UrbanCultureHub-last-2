@echo off
REM ═══════════════════════════════════════════════════════════════════════════
REM  UCH Control Center — Windows build script
REM  Run this from the electron\ folder:  cd electron && build.bat
REM ═══════════════════════════════════════════════════════════════════════════

echo.
echo  ⚡ UCH Control Center — Windows Build
echo  ════════════════════════════════════════
echo.

REM Check Node is available
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  ERROR: Node.js not found. Install from https://nodejs.org
    pause
    exit /b 1
)

REM Check icon exists (warn if missing)
if not exist "assets\icon.ico" (
    echo  WARNING: assets\icon.ico not found.
    echo  The build will succeed but use a default icon.
    echo  See assets\README.txt for how to create an icon.
    echo.
)

echo  Step 1/3 — Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo  ERROR: npm install failed.
    pause
    exit /b 1
)

echo.
echo  Step 2/3 — Building Windows installer ^(.exe^)...
call npm run build:win
if %errorlevel% neq 0 (
    echo  ERROR: Build failed. Check the output above.
    pause
    exit /b 1
)

echo.
echo  Step 3/3 — Done!
echo.
echo  Output files are in:  electron\dist\
echo.
echo  Files created:
echo    UCH Control Center Setup X.X.X.exe   — installer (double-click to install)
echo    UCH-Control-Center-portable.exe       — portable (no install needed)
echo.
echo  To install: double-click the Setup .exe
echo  To run portable: double-click UCH-Control-Center-portable.exe
echo.
pause
