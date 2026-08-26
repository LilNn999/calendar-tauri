@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 日历数据迁移

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\migrate-daily-calendar.ps1" %*
set "EXIT_CODE=%errorlevel%"
echo.
pause
exit /b %EXIT_CODE%