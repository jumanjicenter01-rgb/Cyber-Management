@echo off
chcp 65001 > nul
title Create CyberPulse Restore Point
color 0a
cd /d "%~dp0"

echo ================================================================
echo   [CYBERPULSE] Create Restore Point
echo ================================================================
echo.
node create_restore_point.js
echo.
echo ================================================================
echo   [OK] Restore point created in: backups\
echo ================================================================
echo.
pause
