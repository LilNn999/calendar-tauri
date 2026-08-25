@echo off
chcp 65001 >nul
cd /d "%~dp0"

title 日历 - 测试窗口

set "APP_EXE=src-tauri\target\release\calendar-tauri.exe"
set "CARGO_TARGET_DIR=%~dp0src-tauri\target"
rem 启用测试数据模式：首次启动自动写入一组示例任务/打卡/备注
set "CALENDAR_TEST_MODE=1"

rem ===== 已构建：直接秒开测试窗口 =====
if exist "%APP_EXE%" (
    echo 正在启动测试窗口（测试数据模式）...
    start "" "%APP_EXE%"
    exit /b 0
)

rem ===== 未构建：自动执行 release 构建 =====
echo ============================================
echo  未找到测试版程序，正在自动构建...
echo  首次构建约需 3 分钟，请勿关闭本窗口。
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

echo.
echo 构建成功，正在启动测试窗口...
start "" "%APP_EXE%"
exit /b 0
