@echo off
cd /d "%~dp0"
echo Creating a Desktop shortcut for the Insurance CRM...

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ws = New-Object -ComObject WScript.Shell;" ^
  "$lnk = $ws.CreateShortcut([Environment]::GetFolderPath('Desktop') + '\Insurance CRM.lnk');" ^
  "$lnk.TargetPath = '%~dp0Start CRM.cmd';" ^
  "$lnk.WorkingDirectory = '%~dp0';" ^
  "$lnk.IconLocation = '%SystemRoot%\System32\shell32.dll,13';" ^
  "$lnk.Description = 'Launch the Insurance CRM';" ^
  "$lnk.Save()"

if errorlevel 1 (
  echo Could not create the shortcut. You can still launch with "Start CRM.cmd".
) else (
  echo.
  echo Done! Look for "Insurance CRM" on your Desktop. Double-click it to start.
)
echo.
echo TIP: to also start the app automatically every time you log in,
echo      press Windows+R, type  shell:startup  and press Enter, then
echo      copy the "Insurance CRM" Desktop shortcut into that folder.
echo.
pause
