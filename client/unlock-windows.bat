@echo off
title CyberPulse Windows Station Unlock
color 0a

echo ================================================================
echo     CYBERPULSE GAMING LOUNGE - WINDOWS STATION UNLOCK
echo     (Restore Full Windows Desktop & Admin Access)
echo ================================================================
echo.
echo  This tool removes all station restrictions for maintenance:
echo   [-] Restores Task Manager
echo   [-] Restores "Sign out" (Logoff) in Ctrl+Alt+Delete and Start Menu
echo   [-] Restores "Lock PC" (Win+L)
echo   [-] Restores "Change Password"
echo   [-] Restores "Switch User"
echo   [-] Restores Run dialog (Win+R)
echo   [-] Restores Registry Editor (regedit)
echo   [-] Removes Auto-Start from Windows login
echo.
echo ================================================================
echo  Press any key to restore Windows defaults...
pause > nul

:: 1. Restore Task Manager
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Policies\System" /v "DisableTaskMgr" /f > nul 2>&1
reg delete "HKLM\Software\Microsoft\Windows\CurrentVersion\Policies\System" /v "DisableTaskMgr" /f > nul 2>&1

:: 2. Restore Logoff / Sign out
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Policies\Explorer" /v "NoLogoff" /f > nul 2>&1
reg delete "HKLM\Software\Microsoft\Windows\CurrentVersion\Policies\Explorer" /v "NoLogoff" /f > nul 2>&1

:: 3. Restore Lock Workstation
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Policies\System" /v "DisableLockWorkstation" /f > nul 2>&1

:: 4. Restore Change Password
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Policies\System" /v "DisableChangePassword" /f > nul 2>&1

:: 5. Restore Switch User
reg delete "HKLM\Software\Microsoft\Windows\CurrentVersion\Policies\System" /v "HideFastUserSwitching" /f > nul 2>&1

:: 6. Restore Run dialog
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Policies\Explorer" /v "NoRun" /f > nul 2>&1

:: 7. Restore Registry Tools
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Policies\System" /v "DisableRegistryTools" /f > nul 2>&1

:: 8. Remove Auto-Start from Registry Run
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "CyberPulseClient" /f > nul 2>&1

:: 9. Remove Startup folder launcher
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
if exist "%STARTUP_FOLDER%\CyberPulseLaunch.bat" (
    del /f /q "%STARTUP_FOLDER%\CyberPulseLaunch.bat" > nul 2>&1
)

echo.
echo [*] Windows restrictions removed successfully!
echo [*] Task Manager, Sign out, and all system tools are restored.
echo.
echo Press any key to finish...
pause > nul
