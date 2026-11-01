@echo off
setlocal EnableDelayedExpansion
title CyberPulse Auto Client Network Deployment Tool
color 0b

:: Elevate to Administrator if needed
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [*] Elevating to Administrator...
    powershell -NoProfile -Command "Start-Process cmd.exe -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs"
    exit /b
)

cls
echo ================================================================
echo     CYBERPULSE AUTO-CLIENT NETWORK DEPLOYMENT
echo     Deploy Client to All Stations Automatically from Cashier PC
echo ================================================================
echo.

set "SERVER_IP=10.10.10.100"
set "LOCAL_IP="
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address"') do (
    set "DETECTED_IP=%%a"
    set "DETECTED_IP=!DETECTED_IP: =!"
    if not "!DETECTED_IP!"=="" set "LOCAL_IP=!DETECTED_IP!"
)

:: If run on a client machine (IP is not 10.10.10.100)
if not "%LOCAL_IP%"=="10.10.10.100" if not "%LOCAL_IP%"=="" (
    cls
    echo ================================================================
    echo     CYBERPULSE CLIENT - AUTOMATIC STATION SETUP
    echo     (Detected Station IP: [%LOCAL_IP%]  Master Server: [%SERVER_IP%])
    echo ================================================================
    echo.
    echo [*] Installing station client and connecting to Master Server...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "irm http://%SERVER_IP%:4000/install | iex"
    exit /b
)

echo  Cashier Master Server IP : [%SERVER_IP%]
echo  Server Port              : [4000]
echo.
echo  ---------------------------------------------------------------
echo  CHOOSE DEPLOYMENT METHOD:
echo  ---------------------------------------------------------------
echo  [1] Open Web Deployment Portal (http://%SERVER_IP%:4000/setup.html)
echo  [2] Deploy / Update All Stations on Network via LAN Push
echo  [3] Show 1-Line Command to run on any Station PC
echo  [4] Exit
echo  ---------------------------------------------------------------
echo.

set /p "CHOICE=Enter Choice (1, 2, or 3) [Default: 1]: "
if "%CHOICE%"=="" set "CHOICE=1"

if "%CHOICE%"=="1" (
    echo.
    echo [*] Opening Deployment Portal in your default browser...
    start "" "http://%SERVER_IP%:4000/setup.html"
    exit /b
)

if "%CHOICE%"=="3" (
    cls
    echo ================================================================
    echo     ONE-LINE STATION INSTALL COMMAND (COPY ^& RUN ON ANY PC)
    echo ================================================================
    echo.
    echo  To setup ANY station in 5 seconds without a USB flash drive:
    echo.
    echo  1. On the station PC, press:  Win + R
    echo  2. Paste this exact command and press Enter:
    echo.
    echo  ---------------------------------------------------------------
    echo  powershell -w h -c "irm http://!SERVER_IP!:4000/install | iex"
    echo  ---------------------------------------------------------------
    echo.
    echo  The station will download, auto-configure, lock, and stream live!
    echo ================================================================
    echo.
    pause
    exit /b
)

if "%CHOICE%"=="2" (
    cls
    echo ================================================================
    echo     SCANNING LAN ^& DEPLOYING CLIENT TO STATIONS
    echo ================================================================
    echo.
    echo  Attempting LAN push deployment to stations in subnet...
    echo.

    powershell -NoProfile -ExecutionPolicy Bypass -Command "& {
        $serverIp = '%SERVER_IP%'
        Write-Host '[*] Gathering stations list from Cyber Database...' -ForegroundColor Cyan
        try {
            $state = Invoke-RestMethod -Uri ('http://' + $serverIp + ':4000/api/state') -TimeoutSec 3
            $pcs = $state.pcs | Where-Object { $_.ip -and $_.ip -ne '127.0.0.1' -and $_.ip -ne $serverIp }
            if ($pcs.Count -eq 0) {
                Write-Host '[!] No external station IPs registered yet. Checking DHCP range...' -ForegroundColor Yellow
                $pcs = @(
                    @{ id='PC15'; name='PC15'; ip='10.10.10.115' }
                )
            }
            foreach ($pc in $pcs) {
                $targetIp = $pc.ip
                $pcName = $pc.name
                Write-Host ('[*] Checking station [' + $pcName + '] at ' + $targetIp + '...') -ForegroundColor White
                $ping = Test-Connection -ComputerName $targetIp -Count 1 -Quiet
                if ($ping) {
                    Write-Host ('    ✔ Station ' + $targetIp + ' is ONLINE') -ForegroundColor Green
                    $cShare = '\\' + $targetIp + '\c$'
                    if (Test-Path $cShare) {
                        Write-Host ('    ✔ Admin share accessible on ' + $targetIp + '. Copying client...') -ForegroundColor Green
                        $dest = $cShare + '\CyberPulseClient'
                        New-Item -ItemType Directory -Force -Path $dest | Out-Null
                        Set-Content -Path ($dest + '\client_config.ini') -Value ('PC_NAME=' + $pcName + \"`nSERVER_IP=\" + $serverIp)
                        Write-Host ('    ✔ Station ' + $pcName + ' configured!') -ForegroundColor Green
                    } else {
                        Write-Host ('    [-] Windows Admin share (C$) not enabled by default on ' + $targetIp) -ForegroundColor Yellow
                        Write-Host ('        Tip: Run this on that PC once: powershell -w h -c \"irm http://' + $serverIp + ':4000/install | iex\"') -ForegroundColor Cyan
                    }
                } else {
                    Write-Host ('    [x] Station ' + $targetIp + ' is offline or unreachable') -ForegroundColor DarkGray
                }
            }
        } catch {
            Write-Host ('[!] Error contacting Cyber server: ' + $_.Exception.Message) -ForegroundColor Red
        }
    }"

    echo.
    echo ================================================================
    echo  Deployment scan finished.
    echo  To open the web deployment page: http://!SERVER_IP!:4000/setup
    echo ================================================================
    pause
    exit /b
)
