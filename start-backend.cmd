@echo off
setlocal
cd /d "%~dp0"
title SOL - Starting website

if not exist "package.json" (
  echo Put START-SOL.cmd in your project folder, beside package.json.
  pause
  exit /b 1
)
if not exist "server\server.py" (
  echo Backend file not found: server\server.py
  pause
  exit /b 1
)
where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo Node.js / npm was not found. Install Node.js, then reopen this file.
  pause
  exit /b 1
)
where py >nul 2>nul
if errorlevel 1 (
  where python >nul 2>nul
  if errorlevel 1 (
    echo Python was not found. Install Python, then reopen this file.
    pause
    exit /b 1
  )
  set "SOL_PYTHON=python"
) else (
  set "SOL_PYTHON=py -3"
)

echo Starting SOL. Please keep the backend and website windows open.
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing 'http://localhost:3001/api/health' -TimeoutSec 2; if (($r.Content | ConvertFrom-Json).ok -eq $true) { exit 0 }; exit 1 } catch { exit 1 }" >nul 2>nul
if errorlevel 1 start "SOL Backend - keep open" cmd.exe /k "%SOL_PYTHON% server/server.py"

powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing 'http://localhost:5173/' -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 }; exit 1 } catch { exit 1 }" >nul 2>nul
if errorlevel 1 start "SOL Website - keep open" cmd.exe /k "npm.cmd run dev -- --host localhost --port 5173 --strictPort"

powershell -NoProfile -Command "$deadline = (Get-Date).AddSeconds(60); while ((Get-Date) -lt $deadline) { try { $a = Invoke-WebRequest -UseBasicParsing 'http://localhost:3001/api/health' -TimeoutSec 2; $b = Invoke-WebRequest -UseBasicParsing 'http://localhost:5173/' -TimeoutSec 2; if (($a.Content | ConvertFrom-Json).ok -eq $true -and $b.StatusCode -eq 200) { Start-Process 'http://localhost:5173/'; exit 0 } } catch { }; Start-Sleep -Seconds 1 }; Write-Host 'SOL did not become ready. Check the backend and website windows for the error.'; exit 1"
if errorlevel 1 (
  echo Startup did not finish. Send a screenshot of the error window.
  pause
  exit /b 1
)
exit /b 0
ى