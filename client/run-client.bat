@echo off
title CyberPulse Client & Launcher
cd /d "%~dp0\.."
if exist "node_modules\.bin\electron.cmd" (
    call "node_modules\.bin\electron.cmd" client/main.js
) else (
    npx electron client/main.js
)
