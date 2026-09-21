@echo off
REM Launches dcf-podman.ps1 without changing the machine ExecutionPolicy.
REM Usage: dcf-podman.cmd build
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0dcf-podman.ps1" %*
exit /b %ERRORLEVEL%
