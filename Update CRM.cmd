@echo off
title Insurance CRM - applying updates
cd /d "%~dp0"

echo ==========================================================
echo    Updating the Insurance CRM
echo    Run this AFTER any code changes were made to the app.
echo ==========================================================
echo.

echo Installing any new components...
call npm install
if errorlevel 1 goto :error

REM --- Keep node_modules + .next outside OneDrive (prevents build corruption) ---
call "%~dp0Fix Build Location.cmd"

echo.
echo Rebuilding the app (this can take a minute or two)...
call npm run build
if errorlevel 1 goto :error

echo.
echo Update complete. Launch the app with "Start CRM" (or your Desktop shortcut).
echo.
pause
exit /b

:error
echo.
echo The update failed. Please send this window to Vignesh's developer.
pause
exit /b 1
