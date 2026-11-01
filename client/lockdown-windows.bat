@echo off
chcp 65001 > nul
echo ========================================================
echo [CYBERPULSE] Windows Station Lockdown & Anti-Tamper
echo ========================================================

:: 1. Disable Task Manager
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Policies\System" /v DisableTaskMgr /t REG_DWORD /d 1 /f

:: 2. Disable Registry Editor
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Policies\System" /v DisableRegistryTools /t REG_DWORD /d 1 /f

:: 3. Disable Lock Workstation
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Policies\System" /v DisableLockWorkstation /t REG_DWORD /d 1 /f

echo [✔] Task Manager and system modifications disabled successfully!
pause
