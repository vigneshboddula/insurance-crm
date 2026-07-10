@echo off
title Insurance CRM  -  keep this window open while you use the app
cd /d "%~dp0"

echo ==========================================================
echo    INSURANCE CRM
echo    Keep THIS window open while you use the app.
echo    Close it when you are done to shut the app down.
echo ==========================================================
echo.

REM --- If the app is already running, just open it in the browser ---
netstat -ano | findstr ":3000" | findstr "LISTENING" >nul 2>&1
if %errorlevel%==0 (
  echo The app is already running. Opening it in your browser...
  start "" http://localhost:3000
  timeout /t 2 >nul
  exit /b
)

REM --- First run only: install components ---
if not exist "node_modules" (
  echo First-time setup: installing components. This can take a few minutes...
  call npm install
  if errorlevel 1 goto :error
)

REM --- Keep node_modules + .next outside OneDrive (prevents build corruption) ---
call "%~dp0Fix Build Location.cmd"

REM --- Make sure a production build exists ---
if not exist ".next\BUILD_ID" (
  echo Preparing the app for first use, please wait...
  call npm run build
  if errorlevel 1 goto :error
)

REM --- Open the browser a few seconds after the server starts ---
start "" /b cmd /c "ping -n 6 127.0.0.1 >nul & start "" http://localhost:3000"

echo.
echo Starting the app... your browser will open at http://localhost:3000
echo (If it does not open, type that address into your browser.)
echo.
call npm run start

echo.
echo The app has stopped. You can close this window.
pause
exit /b

:error
echo.
echo Something went wrong during setup. Please send this window to Vignesh's developer.
pause
exit /b 1
