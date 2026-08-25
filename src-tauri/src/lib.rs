mod commands;
mod floating;
mod tray;

use tauri::Manager;
use tauri_plugin_window_state::{Builder as WindowStateBuilder, StateFlags};

pub fn run() {
    let test_mode = std::env::var("CALENDAR_TEST_MODE").as_deref() == Ok("1");

    let mut builder = tauri::Builder::default()
        // 数据层：SQLite
        .plugin(tauri_plugin_sql::Builder::default().build())
        // 开机自启
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        // 全局快捷键
        .plugin(tauri_plugin_global_shortcut::Builder::new().build());

    // 测试模式不注册单实例：允许与正式版并行，测试窗口使用独立 test-calendar.db
    if !test_mode {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.show();
                let _ = win.set_focus();
            }
        }));
    }

    // 主窗口位置/大小记忆（不保存/恢复可见性，避免上次隐藏到托盘后启动无窗口；测试模式跳过，避免与正式版争用状态文件）
    if !test_mode {
        builder = builder.plugin(
            WindowStateBuilder::default()
                .with_state_flags(
                    StateFlags::SIZE
                        | StateFlags::POSITION
                        | StateFlags::MAXIMIZED
                        | StateFlags::DECORATIONS
                        | StateFlags::FULLSCREEN,
                )
                .build(),
        );
    }

    builder
        .invoke_handler(tauri::generate_handler![
            commands::app_version,
            commands::set_autostart,
            commands::get_autostart,
            commands::toggle_floating,
            commands::set_floating_enabled,
            commands::set_floating_always_on_top,
            commands::quit_app,
            commands::is_test_mode,
        ])
        .setup(move |app| {
            tray::create_tray(app.handle())?;
            // 启动时显式显示主窗口，避免 window-state 将“上次隐藏到托盘”状态恢复后无窗口可见
            tray::show_main_window(app.handle());
            floating::init(app.handle())?;
            if !test_mode {
                // 测试模式跳过全局快捷键注册，避免与已运行的正式版冲突
                commands::register_shortcuts(app.handle())?;
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            // 主窗口关闭时隐藏到托盘而非退出
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main"
                    && !window.app_handle().try_state::<tray::Quitting>().is_some()
                {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("日历应用启动失败");
}
