use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

/// 悬浮窗状态（Rust 侧维护，保证托盘/快捷键显示时也能按用户偏好应用）
#[derive(Default)]
pub struct FloatingState {
    /// 悬浮窗开关状态（默认关闭，由托盘/快捷键调用 toggle 时需先开启）
    pub enabled: AtomicBool,
    /// 置顶状态（默认置顶，与前端默认偏好一致；由前端启动/切换时同步）
    pub always_on_top: AtomicBool,
}

fn state(app: &AppHandle) -> tauri::State<'_, FloatingState> {
    app.state::<FloatingState>()
}

/// 初始化：注册状态，并创建悬浮窗常驻桌面（与源项目行为一致）
pub fn init(app: &AppHandle) -> tauri::Result<()> {
    app.manage(FloatingState {
        enabled: AtomicBool::new(false),
        always_on_top: AtomicBool::new(true),
    });
    ensure(app)?;
    if let Some(win) = app.get_webview_window("floating") {
        win.show()?;
    }
    Ok(())
}

/// 确保悬浮窗存在（懒创建）
pub fn ensure(app: &AppHandle) -> tauri::Result<()> {
    if app.get_webview_window("floating").is_none() {
        WebviewWindowBuilder::new(app, "floating", WebviewUrl::App("index.html".into()))
            .title("日历 · 悬浮")
            .inner_size(320.0, 480.0)
            .min_inner_size(260.0, 360.0)
            // 支持边缘拖动缩放（前端提供 resize 手柄）
            .resizable(true)
            .maximizable(false)
            .minimizable(false)
            .decorations(false)
            .transparent(true)
            .shadow(false)
            // 按用户保存的置顶偏好创建，不再无条件置顶
            .always_on_top(state(app).always_on_top.load(Ordering::Relaxed))
            .skip_taskbar(true)
            .visible(false)
            .build()?;
        // Tauri v2 在 Windows 上的透明窗口 bug（#10318/#8133）：
        // 初始尺寸下背景会渲染成白色，需要先缩到 0 再恢复目标尺寸触发透明生效。
        if let Some(win) = app.get_webview_window("floating") {
            win.set_size(tauri::LogicalSize::new(0.0, 0.0))?;
            win.set_size(tauri::LogicalSize::new(320.0, 480.0))?;
        }
    }
    Ok(())
}

/// 切换悬浮窗显示/隐藏
pub fn toggle(app: &AppHandle) -> tauri::Result<()> {
    if !state(app).enabled.load(Ordering::Relaxed) {
        return Ok(());
    }
    ensure(app)?;
    if let Some(win) = app.get_webview_window("floating") {
        if win.is_visible()? {
            win.hide()?;
        } else {
            win.show()?;
            // 显示时按用户保存的置顶偏好应用，不再强制置顶
            win.set_always_on_top(state(app).always_on_top.load(Ordering::Relaxed))?;
            win.set_focus()?;
        }
    }
    Ok(())
}

/// 设置悬浮窗开关：关闭时隐藏窗口
pub fn set_enabled(app: &AppHandle, enabled: bool) -> tauri::Result<()> {
    state(app).enabled.store(enabled, Ordering::Relaxed);
    if !enabled {
        if let Some(win) = app.get_webview_window("floating") {
            win.hide()?;
        }
    }
    Ok(())
}

/// 设置悬浮窗置顶：同步 Rust 状态并应用到窗口
pub fn set_always_on_top(app: &AppHandle, always_on_top: bool) -> tauri::Result<()> {
    state(app)
        .always_on_top
        .store(always_on_top, Ordering::Relaxed);
    if let Some(win) = app.get_webview_window("floating") {
        win.set_always_on_top(always_on_top)?;
    }
    Ok(())
}
