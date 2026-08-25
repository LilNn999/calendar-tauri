@echo off
chcp 65001 >nul
cd /d "%~dp0"

title 日历 - 测试窗口

set "APP_EXE=%~dp0src-tauri\target\release\calendar-tauri.exe"
set "CARGO_TARGET_DIR=%~dp0src-tauri\target"
rem 启用测试数据模式：首次启动自动写入一组示例任务/打卡/备注
set "CALENDAR_TEST_MODE=1"

rem ===== 环境检查 =====
where node >nul 2>nul
if errorlevel 1 (
    echo [错误] 未找到 Node.js，请先安装 Node.js。
    pause
    exit /b 1
)

rem ===== 自动检测最新测试版 =====
set "NEED_REBUILD=1"
if exist "%APP_EXE%" (
    for /f "delims=" %%i in ('node "%~dp0scripts\check-test-build-stale.mjs"') do set "NEED_REBUILD=%%i"
)

if "%NEED_REBUILD%"=="0" goto launch

rem ===== 过期或未构建：自动重建，不生成安装包 =====
echo ============================================
echo  检测到源码/配置已更新，正在构建最新测试版...
echo  本次不会生成安装包，约需 1~3 分钟。
set "CALENDAR_TEST_EXE=%APP_EXE%"
powershell -NoProfile -Command "$p=Get-Process calendar-tauri -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $env:CALENDAR_TEST_EXE }; if ($p) { exit 1 }" >nul 2>nul
if errorlevel 1 (
    echo [提示] 检测到旧测试窗口仍在运行，请先关闭它，再点击本脚本自动重建。
    pause
    exit /b 1
)

echo ============================================
echo.

where npm >nul 2>nul
if errorlevel 1 (
    echo [错误] 未找到 npm，请先安装 Node.js。
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [首次运行] 正在安装前端依赖，请稍候...
    call npm install
    if errorlevel 1 (
        echo [错误] 前端依赖安装失败，请检查网络。
        pause
        exit /b 1
    )
)

echo 正在构建 release 版本...
call npm run tauri build -- --no-bundle
if errorlevel 1 (
    echo.
    echo [错误] 构建失败，请查看上方日志。
    pause
    exit /b 1
)

if not exist "%APP_EXE%" (
    echo.
    echo [错误] 构建完成但未找到可执行文件：%APP_EXE%
    pause
    exit /b 1
)

:launch
echo 正在启动最新测试窗口（独立测试库 test-calendar.db）...
start "" "%APP_EXE%"
exit /b 0