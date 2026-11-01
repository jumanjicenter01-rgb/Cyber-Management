@echo off
chcp 65001 > nul
echo ========================================================
echo [CYBERPULSE] Windows Station Unlock (Restore Admin Tools)
echo ========================================================

reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Policies\System" /v DisableTaskMgr /f
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Policies\System" /v DisableRegistryTools /f
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Policies\System" /v DisableLockWorkstation /f

echo [✔] Task Manager and Windows policies restored successfully!
pause
