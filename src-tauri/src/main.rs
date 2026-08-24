// 在 Windows 上隐藏控制台窗口（release 模式）
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    calendar_tauri_lib::run()
}
