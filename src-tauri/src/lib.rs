mod commands;
mod floating;
mod tray;

use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        // 数据层：SQLite
        .plugin(tauri_plugin_sql::Builder::default().build())
        // 开机自启
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        // 单实例：重复启动时聚焦主窗口
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.show();
                let _ = win.set_focus();
            }
        }))
        // 全局快捷键
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        // 主窗口位置/大小记忆
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            commands::app_version,
            commands::set_autostart,
            commands::get_autostart,
            commands::toggle_floating,
            commands::set_floating_enabled,
            commands::set_floating_always_on_top,
            commands::quit_app,
        ])
        .setup(|app| {
            tray::create_tray(app.handle())?;
            floating::init(app.handle())?;
            commands::register_shortcuts(app.handle())?;
            Ok(())
        })
        .on_window_event(|window, event| {
            // 主窗口关闭时隐藏到托盘而非退出
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" && !window.app_handle().try_state::<tray::Quitting>().is_some() {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("日历应用启动失败");
}

