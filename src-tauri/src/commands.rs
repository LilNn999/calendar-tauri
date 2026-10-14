use tauri::{AppHandle, Manager};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

use crate::{floating, tray};

/// 测试模式：批处理脚本通过环境变量标记后，前端据此写入示例数据。
#[tauri::command]
pub fn is_test_mode() -> bool {
    std::env::var("CALENDAR_TEST_MODE").as_deref() == Ok("1")
}

/// 应用版本号
#[tauri::command]
pub fn app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// 设置开机自启
#[tauri::command]
pub fn set_autostart(app: AppHandle, enabled: bool) -> Result<(), String> {
    let autostart = app.autolaunch();
    if enabled {
        autostart
            .enable()
            .map_err(|e| format!("启用自启失败: {e}"))?;
    } else {
        autostart
            .disable()
            .map_err(|e| format!("关闭自启失败: {e}"))?;
    }
    Ok(())
}

/// 查询开机自启状态
#[tauri::command]
pub fn get_autostart(app: AppHandle) -> Result<bool, String> {
    app.autolaunch()
        .is_enabled()
        .map_err(|e| format!("查询自启状态失败: {e}"))
}

/// 切换悬浮窗
#[tauri::command]
pub fn toggle_floating(app: AppHandle) -> Result<(), String> {
    floating::toggle(&app).map_err(|e| e.to_string())
}

/// 设置悬浮窗置顶
#[tauri::command]
pub fn set_floating_always_on_top(app: AppHandle, enabled: bool) -> Result<(), String> {
    floating::set_always_on_top(&app, enabled).map_err(|e| e.to_string())
}

/// 设置悬浮窗开关
#[tauri::command]
pub fn set_floating_enabled(app: AppHandle, enabled: bool) -> Result<(), String> {
    floating::set_enabled(&app, enabled).map_err(|e| e.to_string())
}

/// 注册全局快捷键
pub fn register_shortcuts(app: &AppHandle) -> tauri::Result<()> {
    use tauri_plugin_global_shortcut::Shortcut;

    let shortcuts: Vec<Shortcut> = vec![
        "Alt+Q".parse().expect("invalid shortcut"),
        "Ctrl+Shift+M".parse().expect("invalid shortcut"),
    ];

    app.global_shortcut()
        .on_shortcuts(shortcuts, move |app, shortcut, event| {
            if event.state == ShortcutState::Pressed {
                match shortcut.to_string().as_str() {
                    // Alt+Q：唤起/隐藏悬浮窗
                    "Alt+Q" => {
                        let _ = floating::toggle(app);
                    }
                    // Ctrl+Shift+M：显示/隐藏主窗口
                    "Ctrl+Shift+M" => {
                        if let Some(win) = app.get_webview_window("main") {
                            match win.is_visible() {
                                Ok(true) => {
                                    let _ = win.hide();
                                }
                                _ => tray::show_main_window(app),
                            }
                        }
                    }
                    _ => {}
                }
            }
        })
        .map_err(|e| {
            tauri::Error::from(std::io::Error::new(
                std::io::ErrorKind::Other,
                e.to_string(),
            ))
        })?;
    Ok(())
}

/// 彻底退出应用（设置退出标记，绕过关闭时隐藏到托盘）
#[tauri::command]
pub fn quit_app(app: AppHandle) {
    app.manage(crate::tray::Quitting::default());
    app.exit(0);
}
