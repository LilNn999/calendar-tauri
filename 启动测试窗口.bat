@echo off
chcp 65001 >nul
title 日历 - 测试窗口
cd /d "%~dp0"

rem ===== 查找 Rust 工具链（cargo）=====
set "CARGO_CMD="
where cargo >nul 2>nul && set "CARGO_CMD=cargo"
if not defined CARGO_CMD if exist "%USERPROFILE%\.cargo\bin\cargo.exe" (
    set "CARGO_CMD=%USERPROFILE%\.cargo\bin\cargo.exe"
    set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
)
if not defined CARGO_CMD (
    echo [提示] 未检测到 Rust 工具链，无法启动桌面测试窗口。
    echo 请先安装 Rust：https://rustup.rs 后重试。
    pause
    exit /b 1
)

rem ===== 首次运行自动安装前端依赖 =====
if not exist "node_modules" (
    echo [首次运行] 正在安装前端依赖，请稍候...
    call npm install
    if errorlevel 1 (
        echo 依赖安装失败，请检查网络后重试。
        pause
        exit /b 1
    )
)

echo ============================================
echo  正在启动测试窗口，首次编译可能需要几分钟...
echo  关闭方式：直接关闭弹出的应用窗口，
echo  或在下方终端按 Ctrl+C 结束。
echo ============================================
echo.

call npm run tauri dev

echo.
echo 测试窗口已退出。
pause
