@echo off
chcp 65001 > nul
title CyberPulse Client Installer
color 0b

echo ================================================================
echo       [CYBERPULSE] Setup and Install Client on this Station
echo ================================================================
echo.

:: 1. Ask for PC Name/ID
set /p pc_id="1. Enter PC Name / ID (e.g. PC-01 or PC-02 or VIP-01): "
if "%pc_id%"=="" set pc_id=PC-01

:: 2. Ask for Server IP
set /p server_ip="2. Enter Cashier Server IP (e.g. 192.168.1.100 or localhost): "
if "%server_ip%"=="" set server_ip=localhost

echo.
echo [1/4] Updating configuration file (config.json)...
(
echo {
echo   "serverUrl": "http://%server_ip%:4000",
echo   "pcId": "%pc_id%",
echo   "adminUnlockPassword": "admin",
echo   "autoStartOnBoot": true,
echo   "kioskMode": true,
echo   "preventClosing": true,
echo   "installedGames": [
echo     {
echo       "id": "val",
echo       "name": "Valorant",
echo       "executable": "C:\\Riot Games\\Riot Client\\RiotClientServices.exe",
echo       "args": ["--launch-product=valorant", "--launch-patchline=live"]
echo     },
echo     {
echo       "id": "cs2",
echo       "name": "Counter-Strike 2",
echo       "executable": "C:\\Program Files (x86)\\Steam\\steam.exe",
echo       "args": ["-applaunch", "730"]
echo     }
echo   ]
echo }
) > "%~dp0config.json"
echo [✔] Configured PC ID: %pc_id% and Server: http://%server_ip%:4000

echo.
echo [2/4] Disabling Task Manager to prevent client bypass...
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Policies\System" /v DisableTaskMgr /t REG_DWORD /d 1 /f > nul 2>&1
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Policies\System" /v DisableRegistryTools /t REG_DWORD /d 1 /f > nul 2>&1
echo [✔] System administration locked and secured.

echo.
echo [3/4] Registering auto-start on Windows boot...
set "CURRENT_DIR=%~dp0"
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "CyberPulseClient" /t REG_SZ /d "\"%CURRENT_DIR%run-client.bat\"" /f > nul 2>&1
echo [✔] Added to Windows Startup successfully.

echo.
echo [4/4] Launching Lock Screen and Gaming Launcher now...
echo ================================================================
echo   [✔] Installation complete! Station is protected and ready.
echo ================================================================
timeout /t 3 > nul

cd /d "%~dp0\.."
start "" "%~dp0run-client.bat"
exit
