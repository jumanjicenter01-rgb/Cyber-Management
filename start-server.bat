@echo off
chcp 65001 > nul
title CyberPulse Central Management Server
color 0a
cd /d "%~dp0"
echo =======================================================
echo   [CYBERPULSE] Central Gaming Lounge Server
echo =======================================================
echo.
echo [1] Starting server on http://localhost:4000 ...
echo [2] Cashier Dashboard: http://localhost:4000
echo [3] Client Simulation: http://localhost:4000/client.html?pc=PC-01
echo.
echo Keep this window running while the lounge is open!
echo =======================================================
echo.
set "NODE_EXE=node"
if exist "C:\Program Files\nodejs\node.exe" set "NODE_EXE=C:\Program Files\nodejs\node.exe"
"%NODE_EXE%" server.js
pause
