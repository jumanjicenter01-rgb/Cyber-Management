@echo off
chcp 65001 > nul
title CyberPulse Server - Open Firewall Port 4000
color 0a
echo ================================================================
echo       CYBERPULSE SERVER - WINDOWS FIREWALL CONFIGURATION
echo ================================================================
echo.
echo Opening Inbound Port 4000 (TCP) for local cyber cafe network...
echo.

netsh advfirewall firewall delete rule name="CyberPulse Server (Port 4000)" > nul 2>&1
netsh advfirewall firewall add rule name="CyberPulse Server (Port 4000)" dir=in action=allow protocol=TCP localport=4000 profile=any

echo.
if %errorlevel% equ 0 (
    echo [✔] SUCCESS: Port 4000 is now OPEN in Windows Firewall!
    echo [✔] Client devices can now connect to http://10.10.10.100:4000 across the local network!
) else (
    echo [✖] ERROR: Please right-click this file and select "Run as administrator" to grant permission!
)
echo.
pause
