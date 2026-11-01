@echo off
title GitHub Sync - Cyber Management
echo ===================================================
echo             Syncing with GitHub...
echo ===================================================
echo.

cd /d "%~dp0"

set "GIT_EXE=C:\Program Files\Git\cmd\git.exe"
if not exist "%GIT_EXE%" set "GIT_EXE=git"

echo [1/3] Checking and adding changes...
"%GIT_EXE%" add -A

echo.
echo [2/3] Committing changes...
"%GIT_EXE%" commit -m "Auto update: %date% %time%"

echo.
echo [3/3] Uploading to GitHub...
"%GIT_EXE%" push -u origin main

echo.
if %errorlevel% equ 0 (
    echo ===================================================
    echo       SUCCESS: Project uploaded to GitHub!
    echo ===================================================
) else (
    echo ===================================================
    echo       ERROR: Push failed.
    echo ===================================================
)

echo.
pause
