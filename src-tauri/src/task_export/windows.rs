//! Windows 原生打印适配器：隐藏专属窗口 + WebView2 `PrintToPdf`。
//!
//! 关键约束：
//! - 打印窗只加载本作业的本地静态文档，不加载主应用入口，也不初始化数据库；
//! - 同一 WebView 不能并发打印，因此同一时间只保留一个作业窗口；
//! - 等待 `document.fonts.ready` 与布局稳定后打一条作业专属就绪消息，原生侧校验作业身份；
//!   隐藏窗口不把 requestAnimationFrame 当作唯一就绪条件，脚本自带超时兜底；
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
    AddScriptToExecuteOnDocumentCreatedCompletedHandler, NavigationCompletedEventHandler,
    PrintToPdfCompletedHandler, WebMessageReceivedEventHandler,
};
use windows_core::{Interface, PCWSTR, PWSTR};

use super::PRINT_TIMEOUT;

/// 打印窗使用固定标签，保证同一时间只有一个作业窗口；前缀与缓存目录共用。
const WINDOW_LABEL: &str = "task-export-pdf-job";

/// A4 按 96dpi 约 794x1123，取略大尺寸避免触发横向缩放。
const WINDOW_WIDTH: f64 = 900.0;
const WINDOW_HEIGHT: f64 = 1200.0;

/// 打印阶段：保证“脚本就绪 → 打印”只推进一次。
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
    let job_token = format!("{}-{}", WINDOW_LABEL, next_sequence());

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

    if let Err(error) = setup_webview(&window, &output_path, &job_token, reporter) {
        let _ = window.close();
        return Err(error);
    }

    let outcome = match rx.recv_timeout(PRINT_TIMEOUT) {
        Ok(result) => result,
        Err(_) => Err("导出超时，请重试（文档较大时可缩短导出范围）".to_string()),
    };

    // 无论成功、失败还是超时，都先关掉本作业窗口再返回，避免残留隐藏窗口。
    if let Some(win) = app.get_webview_window(WINDOW_LABEL) {
        let _ = win.close();
    }
    outcome
}

/// 注册就绪脚本、作业消息回调与导航失败回调，随后等待页面汇报就绪。
fn setup_webview(
    window: &WebviewWindow,
    output: &Path,
    job_token: &str,
    reporter: Reporter,
) -> Result<(), String> {
    let state = Arc::new(Mutex::new(Stage::Loading));
    let token = job_token.to_string();
    let output = output.to_path_buf();

    window
        .with_webview(move |platform| {
            let webview = match unsafe { platform.controller().CoreWebView2() } {
                Ok(webview) => webview,
                Err(error) => {
                    reporter.report(Err(format!("获取 WebView2 接口失败: {error}")));
                    return;
                }
            };

            // 1) 文档创建时注入就绪脚本；脚本必须在导航前注册才能生效。
            let handler = AddScriptToExecuteOnDocumentCreatedCompletedHandler::create(Box::new(
                |error_code, _script_id| {
                    if let Err(error) = error_code {
                        eprintln!("导出就绪脚本注入失败: {error}");
                    }
                    Ok(())
                },
            ));
            let script = to_wide(&ready_script(&token));
            if let Err(error) = unsafe {
                webview.AddScriptToExecuteOnDocumentCreated(PCWSTR(script.as_ptr()), &handler)
            } {
                reporter.report(Err(format!("注册就绪脚本失败: {error}")));
                return;
            }

            // 2) 页面用作业 token 汇报就绪；token 不匹配的消息一律忽略，避免误触发打印。
            let message_webview = webview.clone();
            let message_output = output.clone();
            let message_reporter = reporter.clone();
            let message_state = state.clone();
            let expected_token = token.clone();
            let message_handler =
                WebMessageReceivedEventHandler::create(Box::new(move |_sender, args| {
                    let Some(args) = args else { return Ok(()) };
                    let mut raw = PWSTR::null();
                    if unsafe { args.TryGetWebMessageAsString(&mut raw) }.is_err() {
                        return Ok(());
                    }
                    let message = webview2_com::take_pwstr(raw);
                    if message != expected_token {
                        return Ok(());
                    }
                    let mut stage = lock(&message_state);
                    if *stage != Stage::Loading {
                        return Ok(());
                    }
                    // 立刻切到 Printing，重复的就绪消息不会再启动第二次打印。
                    *stage = Stage::Printing;
                    drop(stage);
                    if let Err(error) =
                        start_print(&message_webview, &message_output, &message_reporter)
                    {
                        message_reporter.report(Err(error));
                    }
                    Ok(())
                }));
            let mut message_token = 0i64;
            if let Err(error) =
                unsafe { webview.add_WebMessageReceived(&message_handler, &mut message_token) }
            {
                reporter.report(Err(format!("注册就绪消息回调失败: {error}")));
                return;
            }

            // 3) 导航失败立即汇报，不必等到超时。
            let nav_reporter = reporter.clone();
            let nav_handler =
                NavigationCompletedEventHandler::create(Box::new(move |_sender, args| {
                    let Some(args) = args else { return Ok(()) };
                    let mut succeeded = windows_core::BOOL::default();
                    if unsafe { args.IsSuccess(&mut succeeded) }.is_err() || !succeeded.as_bool() {
                        nav_reporter.report(Err("导出文档加载失败，请重试".into()));
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

/// 启动打印；打印设置与完成回调都在这里就位。
fn start_print(webview: &ICoreWebView2, output: &Path, reporter: &Reporter) -> Result<(), String> {
    let print_webview: ICoreWebView2_7 = webview
        .cast()
        .map_err(|e| format!("当前 WebView2 内核版本不支持导出 PDF: {e}"))?;
    let settings = build_print_settings(webview)?;

    let reporter = reporter.clone();
    let handler = PrintToPdfCompletedHandler::create(Box::new(
        move |error_code: windows_core::Result<()>, is_successful: bool| {
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
    unsafe {
        print_webview
            .PrintToPdf(PCWSTR(path_wide.as_ptr()), &settings, &handler)
            .map_err(|e| format!("启动打印失败: {e}"))
    }
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

/// 就绪脚本：等待字体与布局稳定后，把作业 token 回传原生侧。
///
/// 隐藏窗口不保证 requestAnimationFrame 持续触发，因此这里以 `document.fonts.ready`
/// 为主、双 rAF 为辅，并用 setTimeout 兜底，任何一步失败都仍然汇报就绪。
fn ready_script(token: &str) -> String {
    let token_literal = serde_json::to_string(token).unwrap_or_else(|_| "\"\"".to_string());
    format!(
        r#"(function () {{
  var token = {token_literal};
  var settled = false;
  function finish() {{
    if (settled) return;
    settled = true;
    try {{ window.chrome.webview.postMessage(token); }} catch (e) {{}}
  }}
  function afterLayout() {{
    if (typeof requestAnimationFrame !== 'function') return finish();
    requestAnimationFrame(function () {{ requestAnimationFrame(finish); }});
  }}
  try {{
    if (document.fonts && document.fonts.ready && document.fonts.ready.then) {{
      document.fonts.ready.then(afterLayout, afterLayout);
    }} else {{
      afterLayout();
    }}
  }} catch (e) {{
    afterLayout();
  }}
  setTimeout(finish, 3000);
}})();"#
    )
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

/// 作业 token 的单调序号
fn next_sequence() -> u64 {
    use std::sync::atomic::{AtomicU64, Ordering};
    static SEQUENCE: AtomicU64 = AtomicU64::new(1);
    SEQUENCE.fetch_add(1, Ordering::Relaxed)
}
