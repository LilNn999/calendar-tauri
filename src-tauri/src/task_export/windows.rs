//! Windows 原生打印适配器：隐藏专属窗口 + WebView2 `PrintToPdf`。
//!
//! 关键约束与踩过的坑：
//! - 打印窗只加载本作业的本地静态文档，不加载主应用入口，也不初始化数据库；
//! - 同一 WebView 不能并发打印，因此同一时间只保留一个作业窗口；
//! - **不能用页面 `postMessage` 汇报就绪**：`file://` 页面的消息会进入 wry 的 IPC
//!   处理器，那里把消息来源当 HTTP URI 解析并 `unwrap()`，`InvalidUri` 会直接
//!   panic 掉主线程（release 下 panic = "abort"）。因此改为导航完成后由原生侧
//!   执行就绪脚本，并在脚本回调里启动打印；
//! - `AddScriptToExecuteOnDocumentCreated` 不能作为主路径：窗口创建时传入 URL 就
//!   已开始加载，`with_webview` 要晚约 100ms 才执行，此时文档创建阶段已过，注入
//!   会被静默丢弃，表现为页面永不就绪、直到 60 秒超时；
//! - 完成回调只汇报一次，迟到结果与超时结果互相不会覆盖；
//! - 成功后由调用方校验 %PDF- 签名并在同目录替换目标文件。

use std::path::Path;
use std::sync::mpsc::Sender;
use std::sync::{Arc, Mutex};

use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use webview2_com::Microsoft::Web::WebView2::Win32::{
    ICoreWebView2, ICoreWebView2Environment6, ICoreWebView2PrintSettings, ICoreWebView2_2,
    ICoreWebView2_7,
};
use webview2_com::{
    ExecuteScriptCompletedHandler, NavigationCompletedEventHandler, PrintToPdfCompletedHandler,
};
use windows_core::{Interface, PCWSTR};

use super::PRINT_TIMEOUT;

/// 打印窗使用固定标签，保证同一时间只有一个作业窗口；前缀与缓存目录共用。
const WINDOW_LABEL: &str = "task-export-pdf-job";

/// A4 按 96dpi 约 794x1123，取略大尺寸避免触发横向缩放。
const WINDOW_WIDTH: f64 = 900.0;
const WINDOW_HEIGHT: f64 = 1200.0;

/// 打印阶段：保证“页面就绪 → 打印”只推进一次。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Stage {
    Loading,
    Printing,
}

/// 一次性汇报端：完成回调、导航失败与超时共用，谁先到谁生效。
#[derive(Clone)]
struct Reporter {
    tx: Sender<Result<(), String>>,
    sent: Arc<Mutex<bool>>,
}

impl Reporter {
    fn new(tx: Sender<Result<(), String>>) -> Self {
        Self {
            tx,
            sent: Arc::new(Mutex::new(false)),
        }
    }

    fn report(&self, outcome: Result<(), String>) {
        let mut sent = lock(&self.sent);
        if *sent {
            return;
        }
        *sent = true;
        let _ = self.tx.send(outcome);
    }
}

/// 等待页面就绪并输出 PDF；`html_file` 是调用方写好的本作业静态文档。
pub(super) fn render_html_to_pdf(
    app: &AppHandle,
    html_file: &Path,
    output: &Path,
) -> Result<(), String> {
    if app.get_webview_window(WINDOW_LABEL).is_some() {
        return Err("上次导出的打印窗口未关闭，请稍后重试".into());
    }
    let url = url::Url::from_file_path(html_file).map_err(|_| "导出文档路径无效".to_string())?;

    let (tx, rx) = std::sync::mpsc::channel::<Result<(), String>>();
    let reporter = Reporter::new(tx);
    let output_path = output.to_path_buf();

    crate::diag::log(&format!(
        "打印: 创建隐藏打印窗，目标 {}",
        output_path.display()
    ));
    let window = WebviewWindowBuilder::new(app, WINDOW_LABEL, WebviewUrl::External(url))
        .title("导出 PDF")
        .inner_size(WINDOW_WIDTH, WINDOW_HEIGHT)
        .visible(false)
        .focused(false)
        .skip_taskbar(true)
        .decorations(false)
        .resizable(false)
        .build()
        .map_err(|e| format!("创建导出打印窗口失败: {e}"))?;
    crate::diag::log("打印: 隐藏打印窗已创建");

    if let Err(error) = setup_webview(&window, &output_path, reporter) {
        crate::diag::log(&format!("打印: 注册回调失败 {error}"));
        let _ = window.close();
        return Err(error);
    }
    crate::diag::log("打印: 回调已注册，等待页面就绪与打印完成");

    let outcome = match rx.recv_timeout(PRINT_TIMEOUT) {
        Ok(result) => result,
        Err(_) => Err("导出超时，请重试（文档较大时可缩短导出范围）".to_string()),
    };
    crate::diag::log(&format!(
        "打印: 等待结束 {}",
        match &outcome {
            Ok(()) => "成功".to_string(),
            Err(error) => format!("失败：{error}"),
        }
    ));

    // 无论成功、失败还是超时，都先关掉本作业窗口再返回，避免残留隐藏窗口。
    if let Some(win) = app.get_webview_window(WINDOW_LABEL) {
        let _ = win.close();
        crate::diag::log("打印: 打印窗已关闭");
    }
    outcome
}

/// 注册导航回调；导航成功后执行就绪脚本，脚本回调里启动打印。
fn setup_webview(window: &WebviewWindow, output: &Path, reporter: Reporter) -> Result<(), String> {
    let state = Arc::new(Mutex::new(Stage::Loading));
    let output = output.to_path_buf();
    let script = to_wide(&ready_script());

    window
        .with_webview(move |platform| {
            let webview = match unsafe { platform.controller().CoreWebView2() } {
                Ok(webview) => webview,
                Err(error) => {
                    reporter.report(Err(format!("获取 WebView2 接口失败: {error}")));
                    return;
                }
            };
            crate::diag::log("打印: 已取得 WebView2 接口");

            let nav_webview = webview.clone();
            let nav_output = output.clone();
            let nav_reporter = reporter.clone();
            let nav_state = state.clone();
            let nav_script = script.clone();
            let nav_handler =
                NavigationCompletedEventHandler::create(Box::new(move |_sender, args| {
                    let Some(args) = args else { return Ok(()) };
                    let mut succeeded = windows_core::BOOL::default();
                    let ok =
                        unsafe { args.IsSuccess(&mut succeeded) }.is_ok() && succeeded.as_bool();
                    if !ok {
                        crate::diag::log("打印: 导航失败");
                        nav_reporter.report(Err("导出文档加载失败，请重试".into()));
                        return Ok(());
                    }
                    crate::diag::log("打印: 导航完成，执行就绪脚本");
                    // 先抢阶段锁再启动打印，重复的导航回调不会打印两次。
                    let mut stage = lock(&nav_state);
                    if *stage != Stage::Loading {
                        return Ok(());
                    }
                    *stage = Stage::Printing;
                    drop(stage);
                    if let Err(error) =
                        run_ready_script(&nav_webview, &nav_output, &nav_reporter, &nav_script)
                    {
                        crate::diag::log(&format!("打印: 执行就绪脚本失败 {error}"));
                        nav_reporter.report(Err(error));
                    }
                    Ok(())
                }));
            let mut nav_token = 0i64;
            if let Err(error) =
                unsafe { webview.add_NavigationCompleted(&nav_handler, &mut nav_token) }
            {
                reporter.report(Err(format!("注册导航回调失败: {error}")));
            }
        })
        .map_err(|e| format!("初始化导出窗口失败: {e}"))
}

/// 执行就绪脚本；脚本结束即表示字体与布局已稳定，随后启动打印。
///
/// 脚本自身报错不阻断打印：排版稳定只是锦上添花，真正的失败由打印完成回调汇报。
fn run_ready_script(
    webview: &ICoreWebView2,
    output: &Path,
    reporter: &Reporter,
    script: &[u16],
) -> Result<(), String> {
    let print_webview = webview.clone();
    let print_output = output.to_path_buf();
    let print_reporter = reporter.clone();
    let handler = ExecuteScriptCompletedHandler::create(Box::new(
        move |error_code: windows_core::Result<()>, _result: String| {
            match &error_code {
                Ok(()) => crate::diag::log("打印: 就绪脚本执行完成"),
                Err(error) => crate::diag::log(&format!("打印: 就绪脚本报错（继续打印）{error}")),
            }
            if let Err(error) = start_print(&print_webview, &print_output, &print_reporter) {
                crate::diag::log(&format!("打印: 启动打印失败 {error}"));
                print_reporter.report(Err(error));
            }
            Ok(())
        },
    ));
    unsafe {
        webview
            .ExecuteScript(PCWSTR(script.as_ptr()), &handler)
            .map_err(|e| format!("执行就绪脚本失败: {e}"))
    }
}

/// 启动打印；打印设置与完成回调都在这里就位。
fn start_print(webview: &ICoreWebView2, output: &Path, reporter: &Reporter) -> Result<(), String> {
    let print_webview: ICoreWebView2_7 = webview
        .cast()
        .map_err(|e| format!("当前 WebView2 内核版本不支持导出 PDF: {e}"))?;
    let settings = build_print_settings(webview)?;

    let reporter = reporter.clone();
    let handler = PrintToPdfCompletedHandler::create(Box::new(
        move |error_code: windows_core::Result<()>, is_successful: bool| {
            crate::diag::log(&format!(
                "打印: 完成回调 isSuccessful={is_successful} 错误={:?}",
                error_code.as_ref().err().map(|e| e.code().0)
            ));
            let outcome = match (error_code, is_successful) {
                (Err(error), _) => Err(format!("打印失败: {error}")),
                (Ok(()), false) => Err("打印未完成，请重试".to_string()),
                (Ok(()), true) => Ok(()),
            };
            reporter.report(outcome);
            Ok(())
        },
    ));

    let path_wide = to_wide(&output.to_string_lossy());
    crate::diag::log(&format!("打印: 调用 PrintToPdf，输出 {}", output.display()));
    let started = unsafe {
        print_webview
            .PrintToPdf(PCWSTR(path_wide.as_ptr()), &settings, &handler)
            .map_err(|e| format!("启动打印失败: {e}"))
    };
    crate::diag::log(match &started {
        Ok(()) => "打印: PrintToPdf 已受理，等待完成回调",
        Err(error) => error,
    });
    started
}

/// A4、背景打印、关闭引擎默认页眉页脚；页边距交给文档 CSS 的 @page 控制，避免叠加。
fn build_print_settings(webview: &ICoreWebView2) -> Result<ICoreWebView2PrintSettings, String> {
    // Environment / CreatePrintSettings 从 ICoreWebView2_2 起提供。
    let webview2: ICoreWebView2_2 = webview
        .cast()
        .map_err(|e| format!("当前 WebView2 内核版本过低，无法读取打印设置: {e}"))?;
    let environment =
        unsafe { webview2.Environment() }.map_err(|e| format!("获取 WebView2 环境失败: {e}"))?;
    // CreatePrintSettings 从 ICoreWebView2Environment6 起提供。
    let environment6: ICoreWebView2Environment6 = environment
        .cast()
        .map_err(|e| format!("当前 WebView2 内核版本过低，无法创建打印设置: {e}"))?;
    let settings = unsafe { environment6.CreatePrintSettings() }
        .map_err(|e| format!("创建打印设置失败: {e}"))?;
    unsafe {
        settings
            .SetShouldPrintBackgrounds(true)
            .map_err(|e| format!("设置背景打印失败: {e}"))?;
        settings
            .SetShouldPrintHeaderAndFooter(false)
            .map_err(|e| format!("关闭默认页眉页脚失败: {e}"))?;
        // 8.27 x 11.69 英寸即 A4；边距为 0，页面边距完全由文档 @page 决定。
        settings
            .SetPageWidth(8.27)
            .map_err(|e| format!("设置页面宽度失败: {e}"))?;
        settings
            .SetPageHeight(11.69)
            .map_err(|e| format!("设置页面高度失败: {e}"))?;
        settings
            .SetMarginTop(0.0)
            .map_err(|e| format!("设置上边距失败: {e}"))?;
        settings
            .SetMarginBottom(0.0)
            .map_err(|e| format!("设置下边距失败: {e}"))?;
        settings
            .SetMarginLeft(0.0)
            .map_err(|e| format!("设置左边距失败: {e}"))?;
        settings
            .SetMarginRight(0.0)
            .map_err(|e| format!("设置右边距失败: {e}"))?;
    }
    Ok(settings)
}

/// 就绪脚本：等待字体与布局稳定后结束。
///
/// 返回 Promise，`ExecuteScript` 的完成回调在 Promise 落地后才触发，
/// 因此脚本结束就等于“可以打印”。不使用 `postMessage`（见模块注释）。
fn ready_script() -> String {
    r#"(async () => {
  try {
    if (document.fonts && document.fonts.ready) { await document.fonts.ready; }
  } catch (e) {}
  await new Promise((resolve) => {
    if (typeof requestAnimationFrame !== 'function') { resolve(); return; }
    requestAnimationFrame(() => requestAnimationFrame(resolve));
    setTimeout(resolve, 1000);
  });
  return 'ready';
})()"#
        .to_string()
}

/// 把 Rust 字符串转成以 NUL 结尾的 UTF-16。
fn to_wide(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(std::iter::once(0)).collect()
}

/// 统一处理被污染的作业锁：作业阶段没有需要保持一致的数据结构。
fn lock<T>(mutex: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    match mutex.lock() {
        Ok(guard) => guard,
        Err(poisoned) => poisoned.into_inner(),
    }
}
