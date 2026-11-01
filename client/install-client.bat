@echo off
setlocal EnableDelayedExpansion
title CyberPulse Client One-Time Station Installer
color 0b

:: Self-elevation to Administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [*] Requesting Administrator Privileges...
    powershell -NoProfile -Command "Start-Process cmd.exe -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs"
    exit /b
)

cls
echo ================================================================
echo     CYBERPULSE CLIENT - ONE-TIME STATION INSTALLER
echo     (Permanent Zero-Touch Setup: Auto-Updates from Server)
echo ================================================================
echo.
echo  This installer will:
echo   1. Install the Station Client permanently to C:\CyberPulseClient
echo   2. Enable Auto-Start on Windows Boot/Login (even after Sign Out)
echo   3. Lock down Windows (disable Task Manager, hide Sign Out from Ctrl+Alt+Del)
echo   4. Enable Automatic Self-Updating directly from the Server!
echo.
echo ================================================================
echo.

set "DEF_NAME=%COMPUTERNAME%"
if "%DEF_NAME%"=="" set "DEF_NAME=PC-01"

set /p "PC_NAME=Enter Station Name/ID [Press Enter for %DEF_NAME%]: "
if "%PC_NAME%"=="" set "PC_NAME=%DEF_NAME%"

set /p "SERVER_IP=Enter Cashier Server IP [Press Enter for 10.10.10.100]: "
if "%SERVER_IP%"=="" set "SERVER_IP=10.10.10.100"

set "INSTALL_DIR=C:\CyberPulseClient"
echo.
echo [1/5] Creating permanent installation folder at %INSTALL_DIR%...
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%" > nul 2>&1

:: Write Config
echo [2/5] Writing station configuration...
(
    echo PC_NAME=%PC_NAME%
    echo SERVER_IP=%SERVER_IP%
) > "%INSTALL_DIR%\client_config.ini"

:: Write Permanent Watchdog Runner
echo [3/5] Installing client launcher and auto-update engine...
(
    echo @echo off
    echo setlocal EnableDelayedExpansion
    echo title CyberPulse Client Watchdog
    echo color 0b
    echo set "INSTALL_DIR=C:\CyberPulseClient"
    echo set "CONFIG_FILE=%%INSTALL_DIR%%\client_config.ini"
    echo set "PC_NAME="
    echo set "SERVER_IP="
    echo if exist "%%CONFIG_FILE%%" (
    echo     for /f "usebackq tokens=1* delims==" %%%%a in ^("%%CONFIG_FILE%%"^) do (
    echo         if /i "%%%%a"=="PC_NAME" set "PC_NAME=%%%%b"
    echo         if /i "%%%%a"=="SERVER_IP" set "SERVER_IP=%%%%b"
    echo     )
    echo )
    echo if "%%PC_NAME%%"=="" set "PC_NAME=%COMPUTERNAME%"
    echo if "%%SERVER_IP%%"=="" set "SERVER_IP=10.10.10.100"
    echo set "CLIENT_URL=http://%%SERVER_IP%%:4000/client.html?pc=%%PC_NAME%%"
    echo set "KIOSK_DATA_DIR=%%TEMP%%\cyber_kiosk_%%PC_NAME%%"
    echo set "BROWSER_EXE="
    echo set "BROWSER_TYPE="
    echo if exist "%%ProgramFiles(x86)%%\Microsoft\Edge\Application\msedge.exe" ^(
    echo     set "BROWSER_EXE=%%ProgramFiles(x86)%%\Microsoft\Edge\Application\msedge.exe"
    echo     set "BROWSER_TYPE=edge"
    echo ^) else if exist "%%ProgramFiles%%\Microsoft\Edge\Application\msedge.exe" ^(
    echo     set "BROWSER_EXE=%%ProgramFiles%%\Microsoft\Edge\Application\msedge.exe"
    echo     set "BROWSER_TYPE=edge"
    echo ^) else if exist "%%ProgramFiles%%\Google\Chrome\Application\chrome.exe" ^(
    echo     set "BROWSER_EXE=%%ProgramFiles%%\Google\Chrome\Application\chrome.exe"
    echo     set "BROWSER_TYPE=chrome"
    echo ^) else if exist "%%ProgramFiles(x86)%%\Google\Chrome\Application\chrome.exe" ^(
    echo     set "BROWSER_EXE=%%ProgramFiles(x86)%%\Google\Chrome\Application\chrome.exe"
    echo     set "BROWSER_TYPE=chrome"
    echo ^)
    echo if "%%BROWSER_EXE%%"=="" ^(
    echo     start "" "%%CLIENT_URL%%"
    echo     exit /b
    echo ^)
    echo :WATCHDOG_LOOP
    echo if "%%BROWSER_TYPE%%"=="edge" ^(
    echo     "%%BROWSER_EXE%%" --kiosk "%%CLIENT_URL%%" --edge-kiosk-type=fullscreen --no-first-run --kiosk-idle-timeout-minutes=0 --disable-pinch --overscroll-history-navigation=0 --user-data-dir="%%KIOSK_DATA_DIR%%"
    echo ^) else ^(
    echo     "%%BROWSER_EXE%%" --kiosk "%%CLIENT_URL%%" --no-first-run --disable-pinch --overscroll-history-navigation=0 --user-data-dir="%%KIOSK_DATA_DIR%%"
    echo ^)
    echo ping -n 2 127.0.0.1 ^> nul
    echo goto WATCHDOG_LOOP
) > "%INSTALL_DIR%\run.bat"

:: Write Silent Runner
(
    echo Set WshShell = CreateObject^("WScript.Shell"^)
    echo WshShell.Run "cmd.exe /c ""C:\CyberPulseClient\run.bat""", 0, False
    echo Set WshShell = Nothing
) > "%INSTALL_DIR%\run-silent.vbs"

:: Write Uninstaller
(
    echo @echo off
    echo title CyberPulse Client Uninstaller
    echo color 0a
    echo net session ^>nul 2^>^&1
    echo if %%errorLevel%% neq 0 ^(
    echo     powershell -NoProfile -Command "Start-Process cmd.exe -ArgumentList '/c \"\"%%~f0\"\"' -Verb RunAs"
    echo     exit /b
    echo ^)
    echo ================================================================
    echo     CYBERPULSE CLIENT UNINSTALLER ^& RESTORE WINDOWS
    echo ================================================================
    echo.
    echo Restoring Windows policies and removing auto-start...
    echo schtasks /delete /tn "CyberPulseStationLock" /f ^> nul 2^>^&1
    echo reg delete "HKLM\Software\Microsoft\Windows\CurrentVersion\Run" /v "CyberPulseClient" /f ^> nul 2^>^&1
    echo reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "CyberPulseClient" /f ^> nul 2^>^&1
    echo reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Policies\System" /v "DisableTaskMgr" /f ^> nul 2^>^&1
    echo reg delete "HKLM\Software\Microsoft\Windows\CurrentVersion\Policies\System" /v "DisableTaskMgr" /f ^> nul 2^>^&1
    echo reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Policies\Explorer" /v "NoLogoff" /f ^> nul 2^>^&1
    echo reg delete "HKLM\Software\Microsoft\Windows\CurrentVersion\Policies\Explorer" /v "NoLogoff" /f ^> nul 2^>^&1
    echo reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Policies\System" /v "DisableLockWorkstation" /f ^> nul 2^>^&1
    echo reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Policies\System" /v "DisableChangePassword" /f ^> nul 2^>^&1
    echo reg delete "HKLM\Software\Microsoft\Windows\CurrentVersion\Policies\System" /v "HideFastUserSwitching" /f ^> nul 2^>^&1
    echo reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Policies\Explorer" /v "NoRun" /f ^> nul 2^>^&1
    echo reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Policies\System" /v "DisableRegistryTools" /f ^> nul 2^>^&1
    echo if exist "%%ProgramData%%\Microsoft\Windows\Start Menu\Programs\Startup\CyberPulseLaunch.bat" del /f /q "%%ProgramData%%\Microsoft\Windows\Start Menu\Programs\Startup\CyberPulseLaunch.bat" ^> nul 2^>^&1
    echo [*] Uninstallation complete! Windows restored to default.
    echo pause
) > "%INSTALL_DIR%\UNINSTALL.bat"

:: 4. Windows Startup & Task Scheduler Registration
echo [4/5] Registering Auto-Start on Boot / Any User Login...
schtasks /create /tn "CyberPulseStationLock" /tr "wscript.exe C:\CyberPulseClient\run-silent.vbs" /sc onlogon /rl highest /f > nul 2>&1
reg add "HKLM\Software\Microsoft\Windows\CurrentVersion\Run" /v "CyberPulseClient" /t REG_SZ /d "wscript.exe \"C:\CyberPulseClient\run-silent.vbs\"" /f > nul 2>&1
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "CyberPulseClient" /t REG_SZ /d "wscript.exe \"C:\CyberPulseClient\run-silent.vbs\"" /f > nul 2>&1

set "ALL_USERS_STARTUP=%ProgramData%\Microsoft\Windows\Start Menu\Programs\Startup"
if exist "%ALL_USERS_STARTUP%" (
    (
        echo @echo off
        echo start "" wscript.exe "C:\CyberPulseClient\run-silent.vbs"
    ) > "%ALL_USERS_STARTUP%\CyberPulseLaunch.bat"
)

:: 5. Security Screen Lockdown (Prevent Ctrl+Alt+Del Sign Out and Bypass)
echo [5/5] Locking down Windows (disabling Task Manager and Sign Out)...
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Policies\System" /v "DisableTaskMgr" /t REG_DWORD /d 1 /f > nul 2>&1
reg add "HKLM\Software\Microsoft\Windows\CurrentVersion\Policies\System" /v "DisableTaskMgr" /t REG_DWORD /d 1 /f > nul 2>&1
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Policies\Explorer" /v "NoLogoff" /t REG_DWORD /d 1 /f > nul 2>&1
reg add "HKLM\Software\Microsoft\Windows\CurrentVersion\Policies\Explorer" /v "NoLogoff" /t REG_DWORD /d 1 /f > nul 2>&1
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Policies\System" /v "DisableLockWorkstation" /t REG_DWORD /d 1 /f > nul 2>&1
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Policies\System" /v "DisableChangePassword" /t REG_DWORD /d 1 /f > nul 2>&1
reg add "HKLM\Software\Microsoft\Windows\CurrentVersion\Policies\System" /v "HideFastUserSwitching" /t REG_DWORD /d 1 /f > nul 2>&1
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Policies\Explorer" /v "NoRun" /t REG_DWORD /d 1 /f > nul 2>&1
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Policies\System" /v "DisableRegistryTools" /t REG_DWORD /d 1 /f > nul 2>&1

cls
echo ================================================================
echo     CYBERPULSE CLIENT - INSTALLATION COMPLETED SUCCESSFULLY!
echo ================================================================
echo.
echo  [*] Station [%PC_NAME%] is now permanently secured and installed.
echo  [*] Ctrl+Alt+Delete bypass / Sign out has been completely blocked.
echo  [*] Client will auto-launch on every PC boot, restart, and login.
echo  [*] Master Exit Shortcut: Ctrl + Alt + Shift + F12 (Password: admin)
echo  [*] To uninstall or restore Windows: run C:\CyberPulseClient\UNINSTALL.bat
echo.
echo  Launching Station Lock Screen in 2 seconds...
echo ================================================================
ping -n 3 127.0.0.1 > nul

start "" wscript.exe "C:\CyberPulseClient\run-silent.vbs"
exit
