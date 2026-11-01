@echo off
chcp 65001 >nul
title رفع التعديلات إلى GitHub
echo ===================================================
echo        جاري فحص ورفع التعديلات إلى GitHub...
echo ===================================================
echo.

cd /d "%~dp0"

set "GIT_EXE=C:\Program Files\Git\cmd\git.exe"
if not exist "%GIT_EXE%" set "GIT_EXE=git"

echo [1/3] فحص الملفات الجديدة والمعدلة...
"%GIT_EXE%" add -A

echo.
echo [2/3] تسجيل التعديلات (Commit)...
for /f "tokens=1-2 delims=: " %%a in ("%time%") do set current_time=%%a:%%b
"%GIT_EXE%" commit -m "تحديث تلقائي للمشروع: %date% %current_time%"

echo.
echo [3/3] جاري الرفع إلى GitHub (Push)...
"%GIT_EXE%" push -u origin main

echo.
if %errorlevel% equ 0 (
    echo ===================================================
    echo       ✅ تم رفع التعديلات بنجاح إلى GitHub!
    echo ===================================================
) else (
    echo ===================================================
    echo       ❌ تنبيه: تعذر الرفع إلى GitHub.
    echo       تأكد من اتصال الإنترنت ورابط المستودع.
    echo ===================================================
)

echo.
pause
