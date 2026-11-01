@echo off
chcp 65001 > nul
title CyberPulse System Restore Point
color 0e
cd /d "%~dp0"

echo ================================================================
echo   [CYBERPULSE] Restore Point Recovery Tool
echo ================================================================
echo.
echo This will restore all project files from the stable restore point:
echo [backups/restore-point-stable]
echo.
set /p confirm="Are you sure you want to restore? (Y/N): "
if /i not "%confirm%"=="Y" (
    echo Restore cancelled.
    pause
    exit /b
)

echo.
echo Restoring files...
xcopy /E /I /Y "backups\restore-point-stable\*" "%~dp0" > nul
echo.
echo ================================================================
echo   [OK] System successfully restored to the stable restore point!
echo ================================================================
echo.
pause
