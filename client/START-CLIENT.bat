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

if not "%PC_NAME%"=="" (
    cls
    echo ================================================================
    echo     ⚡ CYBERPULSE GAMING CLIENT - STATION LOCK SYSTEM ⚡
    echo ================================================================
    echo.
    echo  Current Station Name : [%PC_NAME%]
    echo  Cashier Server IP    : [%SERVER_IP%]
    echo.
    echo  [Enter] Start Fullscreen Lock Screen
    echo  [R]     Reset / Change Server IP or Station Name
    echo ================================================================
    set "USER_CHOICE="
    set /p USER_CHOICE="Select option [Press Enter to Launch]: "
    if /i "%USER_CHOICE%"=="R" (
        set "PC_NAME="
        set "SERVER_IP="
        del /f /q "%CONFIG_FILE%" > nul 2>&1
    )
)

if "%PC_NAME%"=="" (
    cls
    echo ================================================================
    echo     ⚡ CYBERPULSE CLIENT QUICK SETUP (Zero-Install Mode) ⚡
    echo     No programming software or installation required!
    echo ================================================================
    echo.
    set /p PC_NAME="Enter Station Name / ID [Press Enter for %COMPUTERNAME%]: "
    if "%PC_NAME%"=="" set "PC_NAME=%COMPUTERNAME%"
    
    set /p SERVER_IP="Enter Cashier Server IP (e.g. 10.10.10.100) [Press Enter for 10.10.10.100]: "
    if "%SERVER_IP%"=="" set "SERVER_IP=10.10.10.100"
    
    (
        echo PC_NAME=%PC_NAME%
        echo SERVER_IP=%SERVER_IP%
    ) > "%CONFIG_FILE%"
    
    echo.
    echo [✔] Station configuration saved to client_config.ini!
    timeout /t 1 > nul
)

set "CLIENT_URL=http://%SERVER_IP%:4000/client.html?pc=%PC_NAME%"
set "KIOSK_DATA_DIR=%TEMP%\cyber_kiosk_%PC_NAME%"

:: Find Browser Executable (Edge or Chrome)
set "BROWSER_EXE="
set "BROWSER_TYPE="

if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    set "BROWSER_EXE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
    set "BROWSER_TYPE=edge"
) else if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    set "BROWSER_EXE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
    set "BROWSER_TYPE=edge"
) else if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    set "BROWSER_EXE=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
    set "BROWSER_TYPE=chrome"
) else if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    set "BROWSER_EXE=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
    set "BROWSER_TYPE=chrome"
)

cls
echo ================================================================
echo     ⚡ CYBERPULSE CLIENT ACTIVE - WATCHDOG LOCK ENABLED ⚡
echo ================================================================
echo  Station ID    : [%PC_NAME%]
echo  Server Target : [%CLIENT_URL%]
echo.
echo  [!] The client is running in 100%% Fullscreen Kiosk Lock Mode.
echo  [!] If closed, it will automatically restart within 1 second.
echo  [!] Master Exit Combo: Press Ctrl + Alt + Shift + F12 on screen
echo ================================================================
echo.

if "%BROWSER_EXE%"=="" (
    echo [!] No Microsoft Edge or Chrome detected. Opening default browser...
    start "" "%CLIENT_URL%"
    pause
    exit
)

:KIOSK_WATCHDOG_LOOP
if "%BROWSER_TYPE%"=="edge" (
    "%BROWSER_EXE%" --kiosk "%CLIENT_URL%" --edge-kiosk-type=fullscreen --no-first-run --kiosk-idle-timeout-minutes=0 --disable-pinch --overscroll-history-navigation=0 --user-data-dir="%KIOSK_DATA_DIR%"
) else (
    "%BROWSER_EXE%" --kiosk "%CLIENT_URL%" --no-first-run --disable-pinch --overscroll-history-navigation=0 --user-data-dir="%KIOSK_DATA_DIR%"
)

echo [!] Station client was closed or interrupted.
echo [!] Watchdog re-launching fullscreen lock screen in 1 second...
timeout /t 1 > nul
goto KIOSK_WATCHDOG_LOOP
