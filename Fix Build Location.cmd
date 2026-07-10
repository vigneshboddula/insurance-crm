@echo off
REM ============================================================
REM  Keeps the big, fast-changing build folders OUT of OneDrive.
REM  OneDrive kept corrupting the Next.js build (.next) and can
REM  lock node_modules, so both live outside OneDrive and are
REM  "junctioned" back into the project. This script re-links them
REM  if they ever revert to real folders (e.g. after a reinstall).
REM  Safe to double-click anytime; it does nothing if all is well.
REM ============================================================
setlocal
set "PROJ=%~dp0"
if "%PROJ:~-1%"=="\" set "PROJ=%PROJ:~0,-1%"
set "ROOT=C:\Users\vigne\insurance-crm-build"

if not exist "%ROOT%" mkdir "%ROOT%"

call :ensure "%PROJ%\node_modules" "%ROOT%\node_modules"
call :ensure "%PROJ%\.next"        "%ROOT%\.next"
endlocal
exit /b 0

:ensure
set "LINK=%~1"
set "TGT=%~2"
REM Already a junction/reparse point? Then we're done.
fsutil reparsepoint query "%LINK%" >nul 2>&1
if %errorlevel%==0 exit /b 0
REM Not a junction. If a real folder is here, get it out of OneDrive.
if exist "%LINK%" (
  if exist "%TGT%" (
    rmdir /s /q "%LINK%"
  ) else (
    move "%LINK%" "%TGT%" >nul
  )
)
if not exist "%TGT%" mkdir "%TGT%"
mklink /J "%LINK%" "%TGT%" >nul
exit /b 0
