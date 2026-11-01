@echo off
chcp 65001 > nul
title CyberPulse Gaming Client Station
color 0b

set "CONFIG_FILE=%~dp0client_config.ini"

if exist "%CONFIG_FILE%" (
    for /f "tokens=1,2 delims==" %%a in (%CONFIG_FILE%) do (
        if "%%a"=="PC_NAME" set "PC_NAME=%%b"
        if "%%a"=="SERVER_IP" set "SERVER_IP=%%b"
    )
)

if "%PC_NAME%"=="" (
    cls
    echo ================================================================
    echo     [CYBERPULSE] First-Time Client Station Quick Setup
    echo     (Zero-Install Mode: Works without any programming software)
    echo ================================================================
    echo.
    set /p PC_NAME="Enter Station Name / ID (e.g. PC-01 or PC-02 or VIP-01) [Default: PC-01]: "
    if "%PC_NAME%"=="" set "PC_NAME=PC-01"
    
    set /p SERVER_IP="Enter Cashier Server IP (e.g. 192.168.1.100 or localhost) [Default: localhost]: "
    if "%SERVER_IP%"=="" set "SERVER_IP=localhost"
    
    (
        echo PC_NAME=%PC_NAME%
        echo SERVER_IP=%SERVER_IP%
    ) > "%CONFIG_FILE%"
    
    echo.
    echo [✔] Station configuration saved to client_config.ini!
    timeout /t 2 > nul
)

echo.
echo Launching CyberPulse Station Client for [%PC_NAME%] on [http://%SERVER_IP%:4000]...

:: Option A: Standalone Portable Electron if present
if exist "%~dp0..\node_modules\electron\dist\electron.exe" (
    start "" "%~dp0..\node_modules\electron\dist\electron.exe" "%~dp0main.js"
    exit
)

:: Option B: Node Modules Electron if present
if exist "%~dp0..\node_modules\.bin\electron.cmd" (
    start "" "%~dp0..\node_modules\.bin\electron.cmd" "%~dp0main.js"
    exit
)

:: Option C: 100% Zero-Install Windows Native Mode (Microsoft Edge Standalone App Mode)
set "CLIENT_URL=http://%SERVER_IP%:4000/client.html?pc=%PC_NAME%"

if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app="%CLIENT_URL%" --start-fullscreen --disable-pinch --overscroll-history-navigation=0 --no-first-run
    exit
)

if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --app="%CLIENT_URL%" --start-fullscreen --disable-pinch --overscroll-history-navigation=0 --no-first-run
    exit
)

:: Option D: Google Chrome Standalone App Mode
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app="%CLIENT_URL%" --start-fullscreen
    exit
)

if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" --app="%CLIENT_URL%" --start-fullscreen
    exit
)

:: Fallback Default Browser
start "" "%CLIENT_URL%"
exit
