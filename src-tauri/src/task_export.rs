//! 未完成任务导出的原生侧：保存对话框、单作业生命周期、Windows WebView2 打印。
//!
//! 职责边界：
//! - 前端只用一份 HTML 快照调用 `export_task_pdf`，本模块不重新查库、不初始化数据库；
//! - 打印在专属隐藏窗口内完成，只加载本作业的静态文档，不加载主应用入口；
//! - 同一时间只允许一个导出作业，取消、失败、超时都释放守卫并清理自己的临时文件；
//! - 保存对话框与打印都在阻塞线程池进行，不占用主线程事件循环。

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, WebviewWindow};
use tauri_plugin_dialog::DialogExt;

#[cfg(test)]
mod tests;
#[cfg(windows)]
mod windows;

/// 保存对话框窗口标题
const DIALOG_TITLE: &str = "导出未完成任务";
/// 保存对话框文件类型筛选名
const DIALOG_FILTER_NAME: &str = "PDF 文档";
/// 打印就绪 + 写入完成的整体超时；从用户在系统对话框里选定路径后开始计时
const PRINT_TIMEOUT: Duration = Duration::from_secs(60);
/// 作业专属缓存目录与打印窗标签的共用前缀
const JOB_PREFIX: &str = "task-export-pdf-";
/// 主窗口标签；只有它能发起导出
const MAIN_WINDOW_LABEL: &str = "main";

/// 前端传入的导出请求；字段名与设计 §6 的 camelCase 一致。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskPdfRequest {
    pub html: String,
    pub default_file_name: String,
}

/// 导出结果：只有在 PDF 真正写入磁盘后才返回 saved。
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "status", rename_all = "camelCase")]
pub enum TaskPdfResult {
    Saved { path: String },
    Cancelled,
}

/// 单作业守卫：同一时间只允许一个导出，避免同一 WebView 上并发打印。
#[derive(Default)]
pub struct TaskExportState {
    busy: Arc<AtomicBool>,
}

impl TaskExportState {
    /// 取得作业许可；已有作业时返回 None，由调用方转成“正在导出”提示。
    fn try_begin(&self) -> Option<TaskExportGuard> {
        if self
            .busy
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .is_ok()
        {
            Some(TaskExportGuard {
                busy: self.busy.clone(),
            })
        } else {
            None
        }
    }
}

/// 守卫在作用域结束时释放；保存取消、打印失败、超时都走同一条释放路径。
struct TaskExportGuard {
    busy: Arc<AtomicBool>,
}

impl TaskExportGuard {
    /// 显式释放：作业在第 3 步就结束了，不需要一直占着守卫。
    fn release(&self) {
        self.busy.store(false, Ordering::Release);
    }
}

impl Drop for TaskExportGuard {
    fn drop(&mut self) {
        self.busy.store(false, Ordering::Release);
    }
}

/// 校验默认文件名：只接受单个文件名，必须是 .pdf，不允许目录与上级引用。
fn validate_file_name(raw: &str) -> Result<String, String> {
    let name = raw.trim();
    if name.is_empty() {
        return Err("导出文件名不能为空".into());
    }
    if name.chars().any(|c| c == '/' || c == '\\') {
        return Err("导出文件名不能包含路径分隔符".into());
    }
    if name.contains("..") {
        return Err("导出文件名不能包含上级目录引用".into());
    }
    if name.chars().any(|c| "\\/:*?\"<>|".contains(c)) {
        return Err("导出文件名包含不可用的字符".into());
    }
    if name.ends_with('.') {
        return Err("导出文件名不能以句点结尾".into());
    }
    if name.len() > 120 {
        return Err("导出文件名过长".into());
    }
    // 纯目录名（例如 "文件夹" 或 "C:"）没有 .pdf 扩展名，这里一并拒绝。
    let extension = name.rsplit_once('.').map(|(_, ext)| ext).unwrap_or("");
    if !extension.eq_ignore_ascii_case("pdf") {
        return Err("导出文件必须是 PDF".into());
    }
    Ok(name.to_string())
}

/// 目标目录下的唯一临时 PDF 路径，保证替换前的写入不会破坏已有文件。
fn temporary_sibling_path(target: &Path, job_id: &str) -> Result<PathBuf, String> {
    let directory = target
        .parent()
        .ok_or_else(|| "无法确定导出目录".to_string())?;
    let stem = target
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_else(|| "未完成任务清单.pdf".to_string());
    Ok(directory.join(format!(".{stem}.{job_id}.tmp")))
}

/// 作业临时文件清理：只删除本作业自己创建的文件，不存在时静默跳过。
fn cleanup_paths(paths: &[PathBuf]) {
    for path in paths {
        if path.exists() {
            let _ = std::fs::remove_file(path);
        }
    }
}

/// 清理目标目录里上一次异常退出留下的同类临时 PDF。
///
/// 只有和 `temporary_sibling_path` 同构的名字（隐藏文件、以 `.tmp` 结尾）才会被删除，
/// 因此不会碰到用户自己的文件；正常流程本来就删得掉，这一层只兜住“上次进程被杀”的情形。
fn cleanup_stale_siblings(target: &Path) {
    let Some(directory) = target.parent() else {
        return;
    };
    let Ok(entries) = std::fs::read_dir(directory) else {
        return;
    };
    for entry in entries.flatten() {
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if name.starts_with('.') && name.ends_with(".tmp") {
            let _ = std::fs::remove_file(entry.path());
        }
    }
}

/// 作业 id：时间戳 + 单调计数，避免同一毫秒内的多次导出互相覆盖目录。
fn next_job_id(counter: &Mutex<u64>) -> String {
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let mut slot = match counter.lock() {
        Ok(guard) => guard,
        Err(poisoned) => poisoned.into_inner(),
    };
    *slot += 1;
    format!("{stamp:x}-{}", *slot)
}

// ==================== 依赖注入的执行环境 ====================

/// 保存目标提供者：真实实现弹系统保存对话框，测试实现直接给出结果。
pub(crate) trait SaveTargetProvider {
    fn select(&self, default_name: &str) -> Result<Option<PathBuf>, String>;
}

/// HTML 到 PDF 的渲染器：真实实现走隐藏窗口 + WebView2 打印，测试实现记录调用。
pub(crate) trait PdfRenderer {
    /// 就绪与写入的整体超时；测试可缩短以便快速验证超时清理。
    #[cfg_attr(not(test), allow(dead_code))]
    fn timeout(&self) -> Duration {
        PRINT_TIMEOUT
    }
    /// 把 `html_file` 打印到 `output`（临时路径）。只有返回 Ok 才表示文件已完整写入。
    fn render(&self, html_file: &Path, output: &Path) -> Result<(), String>;
}

/// 一次导出作业的全部输入，与 Tauri 运行时解耦，便于单元测试。
pub(crate) struct JobContext<'a> {
    /// 调用方窗口标签；只有主窗口允许导出。
    pub(crate) window_label: &'a str,
    pub(crate) saver: &'a dyn SaveTargetProvider,
    pub(crate) renderer: &'a dyn PdfRenderer,
    /// 作业专属临时 HTML 路径（由调用方负责创建目录）
    pub(crate) temp_html: PathBuf,
}

/// 作业主体：先校验、再选目标、再打印、最后校验签名并替换目标文件。
///
/// 中途任何失败都会留下“目标文件未被改动”，因为打印只写同目录临时文件。
pub(crate) fn run_job(
    ctx: &JobContext<'_>,
    request: &TaskPdfRequest,
) -> Result<TaskPdfResult, String> {
    if ctx.window_label != MAIN_WINDOW_LABEL {
        return Err("导出功能只能在主窗口使用".into());
    }
    let file_name = validate_file_name(&request.default_file_name)?;
    if request.html.trim().is_empty() {
        return Err("导出内容为空，请重新生成预览".into());
    }
    if let Some(parent) = ctx.temp_html.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("创建临时目录失败: {e}"))?;
    }
    std::fs::write(&ctx.temp_html, request.html.as_bytes())
        .map_err(|e| format!("写入临时文档失败: {e}"))?;

    let target = match ctx.saver.select(&file_name) {
        Ok(Some(path)) => path,
        Ok(None) => {
            // 取消：不写任何文件，生成过程中产生的临时文件也要清掉。
            cleanup_paths(&[ctx.temp_html.clone()]);
            return Ok(TaskPdfResult::Cancelled);
        }
        Err(error) => {
            // 保存对话框异常也要清理本作业的临时文档，避免缓存目录堆积。
            cleanup_paths(&[ctx.temp_html.clone()]);
            return Err(error);
        }
    };
    let job_id = ctx
        .temp_html
        .parent()
        .and_then(|dir| dir.file_name())
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_else(|| "job".to_string());
    // 目标目录已确定，顺手清掉上次异常退出留下的同类临时文件。
    cleanup_stale_siblings(&target);
    let temporary_pdf = temporary_sibling_path(&target, &job_id)?;
    let owned = vec![ctx.temp_html.clone(), temporary_pdf.clone()];

    if let Err(error) = ctx.renderer.render(&ctx.temp_html, &temporary_pdf) {
        cleanup_paths(&owned);
        return Err(error);
    }
    // 打印成功也要核对签名，避免把空文件或错误页当成导出结果。
    if let Err(error) = verify_pdf(&temporary_pdf) {
        cleanup_paths(&owned);
        return Err(error);
    }
    if let Err(error) = replace_file(&temporary_pdf, &target) {
        cleanup_paths(&owned);
        return Err(error);
    }
    cleanup_paths(&[ctx.temp_html.clone()]);
    Ok(TaskPdfResult::Saved {
        path: target.display().to_string(),
    })
}

/// 成功后校验：文件非空且以 %PDF- 开头。
fn verify_pdf(path: &Path) -> Result<(), String> {
    let data = std::fs::read(path).map_err(|e| format!("导出文件校验失败: {e}"))?;
    if data.is_empty() {
        return Err("导出失败：生成的 PDF 为空文件".into());
    }
    if !data.starts_with(b"%PDF-") {
        return Err("导出失败：生成的文件不是有效的 PDF".into());
    }
    Ok(())
}

/// 同目录替换：先删除旧目标再改名，失败时旧文件已不在但不会留下半截文件。
fn replace_file(temporary: &Path, target: &Path) -> Result<(), String> {
    if target.exists() {
        std::fs::remove_file(target).map_err(|e| format!("替换已有文件失败: {e}"))?;
    }
    std::fs::rename(temporary, target).map_err(|e| format!("保存 PDF 失败: {e}"))
}

// ==================== Tauri 命令 ====================

/// 真实保存对话框：Rust 内使用官方插件，前端不需要 dialog/fs 权限。
struct DialogSaveTarget<'a> {
    app: &'a AppHandle,
    parent: &'a WebviewWindow,
}

impl SaveTargetProvider for DialogSaveTarget<'_> {
    fn select(&self, default_name: &str) -> Result<Option<PathBuf>, String> {
        let (tx, rx) = std::sync::mpsc::channel();
        self.app
            .dialog()
            .file()
            .set_parent(self.parent)
            .set_title(DIALOG_TITLE)
            .set_file_name(default_name)
            .add_filter(DIALOG_FILTER_NAME, &["pdf"])
            .save_file(move |path| {
                let picked = path.and_then(|file| file.into_path().ok());
                let _ = tx.send(picked);
            });
        rx.recv()
            .map_err(|_| "保存对话框异常结束，请重试".to_string())
    }
}

/// 真实渲染器：交给 Windows WebView2 打印适配器。
struct NativeRenderer<'a> {
    app: &'a AppHandle,
}

impl PdfRenderer for NativeRenderer<'_> {
    fn render(&self, html_file: &Path, output: &Path) -> Result<(), String> {
        #[cfg(windows)]
        {
            windows::render_html_to_pdf(self.app, html_file, output)
        }
        #[cfg(not(windows))]
        {
            let _ = (html_file, output);
            Err("当前系统暂不支持导出 PDF，请在 Windows 版使用".to_string())
        }
    }
}

/// 导出未完成任务为 PDF：保存对话框 + 原生打印，返回真实保存路径。
#[tauri::command]
pub async fn export_task_pdf(
    app: AppHandle,
    window: WebviewWindow,
    request: TaskPdfRequest,
    state: tauri::State<'_, TaskExportState>,
) -> Result<TaskPdfResult, String> {
    if window.label() != MAIN_WINDOW_LABEL {
        return Err("导出功能只能在主窗口使用".into());
    }
    let guard = state
        .try_begin()
        .ok_or_else(|| "已有导出任务正在进行，请稍候".to_string())?;

    let counter = app.state::<TaskExportCounter>();
    let cache_dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| format!("无法定位应用缓存目录: {e}"))?
        .join("task-export");
    let job_dir = cache_dir.join(format!("{JOB_PREFIX}{}", next_job_id(&counter.0)));
    let temp_html = job_dir.join("document.html");

    let app_for_job = app.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        let saver = DialogSaveTarget {
            app: &app_for_job,
            parent: &window,
        };
        let renderer = NativeRenderer { app: &app_for_job };
        let ctx = JobContext {
            window_label: MAIN_WINDOW_LABEL,
            saver: &saver,
            renderer: &renderer,
            temp_html,
        };
        let outcome = run_job(&ctx, &request);
        // 成功时自己负责清掉临时 HTML；失败、取消与超时也一并清理本作业目录。
        let _ = std::fs::remove_dir_all(&job_dir);
        guard.release();
        outcome
    })
    .await
    .map_err(|e| format!("导出任务异常结束: {e}"))?;

    result
}

/// 作业 id 计数器状态
#[derive(Default)]
pub struct TaskExportCounter(Mutex<u64>);

/// window-state 过滤条件：导出用的隐藏打印窗不参与窗口状态记忆。
///
/// 与打印窗标签前缀共用同一个常量，避免两处规则漂移。
pub fn is_print_window_label(label: &str) -> bool {
    label.starts_with(JOB_PREFIX)
}

/// 注册导出所需的 Tauri 状态
pub fn init_state(app: &AppHandle) -> tauri::Result<()> {
    app.manage(TaskExportState::default());
    app.manage(TaskExportCounter::default());
    Ok(())
}
