//! 崩溃诊断钩子。
//!
//! release 构建使用 `panic = "abort"`，一旦发生 panic 进程会直接以
//! `0xc0000409`（STATUS_STACK_BUFFER_OVERRUN）终止，界面上不会留下任何提示，
//! Windows 事件日志也只记录“在自身模块里崩了”。为了让线上崩溃可定位，
//! 这里安装一个 panic 钩子：在 abort 之前把 panic 信息与回溯写进日志文件。
//!
//! 只做诊断，不改变任何业务行为；日志写入失败时静默忽略，不能因为日志问题
//! 再制造一次崩溃。

use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

/// 应用数据目录名，与 `tauri.conf.json` 的 identifier 保持一致。
const APP_DIR: &str = "com.calendar.desktop";
/// 诊断日志文件名
const LOG_FILE: &str = "task-export.log";

/// 诊断日志路径：`%APPDATA%\com.calendar.desktop\task-export.log`。
///
/// 不使用 `AppHandle` 取路径，因为 panic 钩子必须在任何线程都能安全调用，
/// 且要能在 Tauri 尚未就绪时工作。
pub fn log_path() -> Option<PathBuf> {
    let base = std::env::var_os("APPDATA")?;
    Some(PathBuf::from(base).join(APP_DIR).join(LOG_FILE))
}

/// 追加一行带时间戳的日志；失败时静默忽略。
pub fn log(message: &str) {
    let Some(path) = log_path() else { return };
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let line = format!("[{stamp}] {message}\n");
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&path) {
        let _ = file.write_all(line.as_bytes());
    }
}

/// 安装 panic 钩子；在 `run()` 最开始调用，早于任何插件与窗口创建。
pub fn install_panic_hook() {
    std::panic::set_hook(Box::new(|info| {
        log("===== PANIC BEGIN =====");
        log(&format!("thread: {:?}", std::thread::current().id()));
        log(&format!("payload: {}", payload_of(info)));
        let location = info
            .location()
            .map(|l| format!("{}:{}:{}", l.file(), l.line(), l.column()))
            .unwrap_or_else(|| "未知位置".to_string());
        log(&format!("location: {location}"));
        // release 关闭了 unwind，回溯是唯一能给出调用链的手段。
        log(&format!(
            "backtrace:\n{}",
            std::backtrace::Backtrace::force_capture()
        ));
        log("===== PANIC END =====");
    }));
}

/// 取 panic 载荷的可读文本；`&str` 与 `String` 覆盖绝大多数实际 panic。
fn payload_of(info: &std::panic::PanicHookInfo<'_>) -> String {
    if let Some(text) = info.payload().downcast_ref::<&str>() {
        return (*text).to_string();
    }
    if let Some(text) = info.payload().downcast_ref::<String>() {
        return text.clone();
    }
    "（无法读取 panic 载荷）".to_string()
}

#[cfg(test)]
mod tests;
