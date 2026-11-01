@echo off
title CyberPulse Windows Station Lockdown
color 0c

echo ================================================================
echo     CYBERPULSE GAMING LOUNGE - WINDOWS STATION LOCKDOWN
echo     (Anti-Tamper & Security Screen Protection)
echo ================================================================
echo.
echo  This tool locks down Windows to prevent gamers from bypassing:
echo   [+] Disables Task Manager (Ctrl+Alt+Delete -^> Task Manager blocked)
echo   [+] Removes "Sign out" / Logoff from Ctrl+Alt+Delete and Start Menu
echo   [+] Disables "Lock PC" and Win+L
echo   [+] Disables "Change Password"
echo   [+] Disables "Switch User"
echo   [+] Disables Run dialog (Win+R)
echo   [+] Disables Registry Editor (regedit)
echo   [+] Registers Client to auto-start immediately on Windows login
echo.
echo ================================================================
echo  Press any key to apply station lockdown...
pause > nul

set "SCRIPT_DIR=%~dp0"

:: 1. Disable Task Manager in Ctrl+Alt+Delete
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Policies\System" /v "DisableTaskMgr" /t REG_DWORD /d 1 /f > nul 2>&1
reg add "HKLM\Software\Microsoft\Windows\CurrentVersion\Policies\System" /v "DisableTaskMgr" /t REG_DWORD /d 1 /f > nul 2>&1

:: 2. Remove "Sign out" (Logoff) from Ctrl+Alt+Delete and Start Menu
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Policies\Explorer" /v "NoLogoff" /t REG_DWORD /d 1 /f > nul 2>&1
reg add "HKLM\Software\Microsoft\Windows\CurrentVersion\Policies\Explorer" /v "NoLogoff" /t REG_DWORD /d 1 /f > nul 2>&1

:: 3. Disable Lock Workstation (Win+L and Ctrl+Alt+Delete Lock)
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Policies\System" /v "DisableLockWorkstation" /t REG_DWORD /d 1 /f > nul 2>&1

:: 4. Disable Change Password in Ctrl+Alt+Delete
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Policies\System" /v "DisableChangePassword" /t REG_DWORD /d 1 /f > nul 2>&1

:: 5. Disable Switch User (Fast User Switching)
reg add "HKLM\Software\Microsoft\Windows\CurrentVersion\Policies\System" /v "HideFastUserSwitching" /t REG_DWORD /d 1 /f > nul 2>&1

:: 6. Disable Run command (Win+R)
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Policies\Explorer" /v "NoRun" /t REG_DWORD /d 1 /f > nul 2>&1

:: 7. Disable Registry Tools (regedit)
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Policies\System" /v "DisableRegistryTools" /t REG_DWORD /d 1 /f > nul 2>&1

:: 8. Register Client to Auto-Start on Windows Boot / Login
if exist "%SCRIPT_DIR%START-CLIENT-SILENT.vbs" (
    reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "CyberPulseClient" /t REG_SZ /d "wscript.exe \"%SCRIPT_DIR%START-CLIENT-SILENT.vbs\"" /f > nul 2>&1
) else (
    reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "CyberPulseClient" /t REG_SZ /d "\"%SCRIPT_DIR%START-CLIENT.bat\"" /f > nul 2>&1
)

:: 9. Copy to Windows Startup folder as secondary safeguard
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
if exist "%STARTUP_FOLDER%" (
    if exist "%SCRIPT_DIR%START-CLIENT-SILENT.vbs" (
        (
            echo @echo off
            echo start "" wscript.exe "%SCRIPT_DIR%START-CLIENT-SILENT.vbs"
        ) > "%STARTUP_FOLDER%\CyberPulseLaunch.bat"
    ) else (
        (
            echo @echo off
            echo call "%SCRIPT_DIR%START-CLIENT.bat"
        ) > "%STARTUP_FOLDER%\CyberPulseLaunch.bat"
    )
)

echo.
echo [*] Windows Station Lockdown applied successfully!
echo [*] Ctrl+Alt+Delete bypass and Sign out options are now disabled.
echo [*] The client will now automatically launch on every PC reboot and login.
echo.
echo Press any key to finish...
pause > nul
