//! 导出适配器的生命周期与拒绝路径测试。
//!
//! 这里不弹系统保存对话框，也不创建真实打印窗：保存与打印都被替换成测试实现，
//! 因此覆盖的是作业生命周期、文件名校验、临时文件清理与守卫释放。

// 测试名使用中文描述，关闭 snake_case 风格检查。
#![allow(non_snake_case)]

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use super::*;

/// 旧文件内容标记（避免字节串里出现非 ASCII 字符）
const OLD_BODY: &[u8] = b"%PDF-1.4\nOLD-PAYLOAD-MUCH-LONGER-THAN-NEW";
/// 新文件内容标记
const NEW_BODY: &[u8] = b"%PDF-1.7\nNEW";

/// 保存目标提供者：返回预设结果，并记录是否被调用。
#[derive(Default)]
struct FakeSaver {
    target: Option<PathBuf>,
    error: Option<String>,
    calls: Mutex<u32>,
}

impl FakeSaver {
    fn saving(path: impl Into<PathBuf>) -> Self {
        Self {
            target: Some(path.into()),
            ..Default::default()
        }
    }

    fn cancelled() -> Self {
        Self::default()
    }

    fn call_count(&self) -> u32 {
        *self.calls.lock().unwrap()
    }
}

impl SaveTargetProvider for FakeSaver {
    fn select(&self, _default_name: &str) -> Result<Option<PathBuf>, String> {
        *self.calls.lock().unwrap() += 1;
        if let Some(error) = &self.error {
            return Err(error.clone());
        }
        Ok(self.target.clone())
    }
}

/// 渲染器：按脚本写出文件或返回错误；`delay` 用于模拟超时。
struct FakeRenderer {
    body: Option<&'static [u8]>,
    error: Option<String>,
    delay: Duration,
    timeout: Duration,
    wrote: Arc<AtomicBool>,
}

impl FakeRenderer {
    fn writing(body: &'static [u8]) -> Self {
        Self {
            body: Some(body),
            error: None,
            delay: Duration::ZERO,
            timeout: Duration::from_millis(500),
            wrote: Arc::new(AtomicBool::new(false)),
        }
    }

    fn failing(message: &str) -> Self {
        Self {
            body: None,
            error: Some(message.to_string()),
            delay: Duration::ZERO,
            timeout: Duration::from_millis(500),
            wrote: Arc::new(AtomicBool::new(false)),
        }
    }

    fn slow(delay: Duration, timeout: Duration) -> Self {
        Self {
            body: Some(NEW_BODY),
            error: None,
            delay,
            timeout,
            wrote: Arc::new(AtomicBool::new(false)),
        }
    }

    fn wrote(&self) -> bool {
        self.wrote.load(Ordering::Acquire)
    }
}

impl PdfRenderer for FakeRenderer {
    fn timeout(&self) -> Duration {
        self.timeout
    }

    fn render(&self, _html_file: &Path, output: &Path) -> Result<(), String> {
        if !self.delay.is_zero() {
            std::thread::sleep(self.delay);
            // 真实实现也在自己的时间窗内超时；这里模拟“超时后不产出任何文件”。
            if self.delay > self.timeout {
                return Err("导出超时，请重试（文档较大时可缩短导出范围）".to_string());
            }
        }
        if let Some(error) = &self.error {
            return Err(error.clone());
        }
        std::fs::write(output, self.body.unwrap_or(b"")).map_err(|e| e.to_string())?;
        self.wrote.store(true, Ordering::Release);
        Ok(())
    }
}

/// 每个测试独立的临时工作目录。
struct Workspace {
    root: PathBuf,
}

impl Workspace {
    fn new(name: &str) -> Self {
        let root = std::env::temp_dir().join(format!(
            "task-export-test-{name}-{}",
            std::process::id() as u64 * 1000 + next_probe()
        ));
        std::fs::create_dir_all(&root).unwrap();
        Self { root }
    }

    fn join(&self, name: &str) -> PathBuf {
        self.root.join(name)
    }

    fn entries(&self) -> Vec<String> {
        let mut names: Vec<String> = std::fs::read_dir(&self.root)
            .unwrap()
            .filter_map(|entry| entry.ok())
            .map(|entry| entry.file_name().to_string_lossy().to_string())
            .collect();
        names.sort();
        names
    }
}

impl Drop for Workspace {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.root);
    }
}

/// 工作目录名去重计数
fn next_probe() -> u64 {
    static PROBE: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(1);
    PROBE.fetch_add(1, Ordering::Relaxed)
}

fn request(default_file_name: &str) -> TaskPdfRequest {
    TaskPdfRequest {
        html: "<!doctype html><html><body>清单</body></html>".to_string(),
        default_file_name: default_file_name.to_string(),
    }
}

fn run(
    workspace: &Workspace,
    label: &str,
    saver: &dyn SaveTargetProvider,
    renderer: &dyn PdfRenderer,
) -> Result<TaskPdfResult, String> {
    let ctx = JobContext {
        window_label: label,
        saver,
        renderer,
        temp_html: workspace.join("document.html"),
    };
    run_job(&ctx, &request("未完成任务清单_2026-10-14.pdf"))
}

#[test]
fn 拒绝非主窗口调用且不创建任何文件() {
    let workspace = Workspace::new("label");
    let saver = FakeSaver::saving(workspace.join("out.pdf"));
    let renderer = FakeRenderer::writing(NEW_BODY);

    let error = run(&workspace, "floating", &saver, &renderer).unwrap_err();
    assert!(error.contains("主窗口"), "实际错误：{error}");
    assert_eq!(saver.call_count(), 0, "非主窗口不应弹出保存对话框");
    assert!(!renderer.wrote(), "非主窗口不应触发打印");
    assert!(workspace.entries().is_empty(), "非主窗口不应留下任何文件");
}

#[test]
fn 拒绝路径穿越与目录型默认文件名() {
    for name in [
        "../a.pdf",
        "..\\a.pdf",
        "子目录/清单.pdf",
        "子目录\\清单.pdf",
        "C:文件夹",
        "清单",
        "清单.txt",
        "清单.pdf.exe",
        "",
        "   ",
        "清单.pdf.",
    ] {
        let error = validate_file_name(name).unwrap_err();
        assert!(!error.is_empty(), "文件名 {name:?} 应被拒绝");
    }
    assert_eq!(
        validate_file_name("未完成任务清单_2026-10-14.pdf").unwrap(),
        "未完成任务清单_2026-10-14.pdf"
    );
    assert_eq!(validate_file_name("清单.PDF").unwrap(), "清单.PDF");
}

#[test]
fn 取消保存返回cancelled且不创建任何文件() {
    let workspace = Workspace::new("cancel");
    let saver = FakeSaver::cancelled();
    let renderer = FakeRenderer::writing(NEW_BODY);

    let result = run(&workspace, "main", &saver, &renderer).unwrap();
    assert_eq!(result, TaskPdfResult::Cancelled);
    assert_eq!(saver.call_count(), 1);
    assert!(!renderer.wrote(), "取消后不应启动打印");
    assert!(workspace.entries().is_empty(), "取消后不应留下文件");
}

#[test]
fn 单作业守卫拒绝重复请求并在错误后释放() {
    let state = TaskExportState::default();
    let first = state.try_begin().expect("首次请求应取得作业许可");
    assert!(state.try_begin().is_none(), "并发的第二次请求必须被拒绝");

    let workspace = Workspace::new("busy");
    let saver = FakeSaver::saving(workspace.join("out.pdf"));
    let renderer = FakeRenderer::failing("打印失败: 内核异常");
    let error = run(&workspace, "main", &saver, &renderer).unwrap_err();
    assert!(error.contains("打印失败"), "实际错误：{error}");

    first.release();
    assert!(
        state.try_begin().is_some(),
        "作业失败后守卫必须释放，允许重试"
    );
}

#[test]
fn 打印失败不替换已有目标文件并清理临时文件() {
    let workspace = Workspace::new("keep-old");
    let target = workspace.join("未完成任务清单_2026-10-14.pdf");
    std::fs::write(&target, OLD_BODY).unwrap();

    let saver = FakeSaver::saving(target.clone());
    let renderer = FakeRenderer::failing("打印失败: 超时");
    let error = run(&workspace, "main", &saver, &renderer).unwrap_err();
    assert!(error.contains("打印失败"), "实际错误：{error}");

    assert_eq!(
        std::fs::read(&target).unwrap(),
        OLD_BODY,
        "失败时旧 PDF 不能被破坏"
    );
    assert_eq!(
        workspace.entries(),
        vec!["未完成任务清单_2026-10-14.pdf".to_string()],
        "失败后不能留下临时文件"
    );
}

#[test]
fn 空文件与非PDF内容不会被当作导出结果() {
    for body in [b"".as_slice(), b"<html>WRONG-PAGE</html>".as_slice()] {
        let workspace = Workspace::new("signature");
        let target = workspace.join("清单.pdf");
        let saver = FakeSaver::saving(target.clone());
        let renderer = FakeRenderer::writing(body);

        let error = run(&workspace, "main", &saver, &renderer).unwrap_err();
        assert!(
            error.contains("空文件") || error.contains("不是有效的 PDF"),
            "实际错误：{error}"
        );
        assert!(!target.exists(), "校验失败的输出不能被保存");
        assert_eq!(workspace.entries().len(), 0, "校验失败后不能留下临时文件");
    }
}

#[test]
fn 超时后守卫释放且不产生目标文件() {
    let workspace = Workspace::new("timeout");
    let target = workspace.join("清单.pdf");
    let saver = FakeSaver::saving(target.clone());
    let renderer = FakeRenderer::slow(Duration::from_millis(600), Duration::from_millis(60));

    let error = run(&workspace, "main", &saver, &renderer).unwrap_err();
    assert!(error.contains("超时"), "实际错误：{error}");
    assert!(!target.exists(), "超时不能产出目标文件");
    assert_eq!(workspace.entries().len(), 0, "超时后不能留下临时文件");
}

#[test]
fn 成功导出写入目标文件且临时文件被清理() {
    let workspace = Workspace::new("success");
    let target = workspace.join("未完成任务清单_2026-10-14.pdf");
    let saver = FakeSaver::saving(target.clone());
    let renderer = FakeRenderer::writing(NEW_BODY);

    let result = run(&workspace, "main", &saver, &renderer).unwrap();
    match result {
        TaskPdfResult::Saved { path } => {
            assert_eq!(PathBuf::from(path), target, "必须返回真实保存路径");
        }
        TaskPdfResult::Cancelled => panic!("成功路径不应返回 cancelled"),
    }
    assert_eq!(std::fs::read(&target).unwrap(), NEW_BODY);
    assert_eq!(
        workspace.entries(),
        vec!["未完成任务清单_2026-10-14.pdf".to_string()],
        "成功后不能留下临时 HTML 或临时 PDF"
    );
}

#[test]
fn 覆盖已有目标文件时不留残余() {
    let workspace = Workspace::new("overwrite");
    let target = workspace.join("清单.pdf");
    std::fs::write(&target, OLD_BODY).unwrap();

    let saver = FakeSaver::saving(target.clone());
    let renderer = FakeRenderer::writing(NEW_BODY);
    run(&workspace, "main", &saver, &renderer).unwrap();

    assert_eq!(std::fs::read(&target).unwrap(), NEW_BODY);
    assert_eq!(workspace.entries(), vec!["清单.pdf".to_string()]);
}

#[test]
fn 保存对话框异常时直接报错不写文件() {
    let workspace = Workspace::new("dialog-error");
    let saver = FakeSaver {
        error: Some("保存对话框异常结束，请重试".to_string()),
        ..Default::default()
    };
    let renderer = FakeRenderer::writing(NEW_BODY);

    let error = run(&workspace, "main", &saver, &renderer).unwrap_err();
    assert!(error.contains("保存对话框"), "实际错误：{error}");
    assert!(!renderer.wrote());
    assert!(workspace.entries().is_empty());
}

#[test]
fn 空内容请求被拒绝() {
    let workspace = Workspace::new("empty-html");
    let saver = FakeSaver::saving(workspace.join("out.pdf"));
    let renderer = FakeRenderer::writing(NEW_BODY);
    let ctx = JobContext {
        window_label: "main",
        saver: &saver,
        renderer: &renderer,
        temp_html: workspace.join("document.html"),
    };
    let mut req = request("清单.pdf");
    req.html = "   ".to_string();

    let error = run_job(&ctx, &req).unwrap_err();
    assert!(error.contains("导出内容为空"), "实际错误：{error}");
    assert_eq!(saver.call_count(), 0, "内容为空时不应打扰用户选择路径");
}

#[test]
fn 临时PDF路径与目标同目录且带作业标记() {
    let target = PathBuf::from("D:\\导出\\未完成任务清单_2026-10-14.pdf");
    let temporary = temporary_sibling_path(&target, "abc-1").unwrap();
    assert_eq!(temporary.parent(), target.parent());
    assert_ne!(temporary, target, "临时文件不能覆盖目标文件");
    assert!(
        temporary
            .file_name()
            .unwrap()
            .to_string_lossy()
            .contains("abc-1"),
        "临时文件名必须带作业标记，避免并发作业互相覆盖"
    );
}

#[test]
fn 作业id单调递增且互不相同() {
    let counter = Mutex::new(0u64);
    let first = next_job_id(&counter);
    let second = next_job_id(&counter);
    assert_ne!(first, second);
    assert!(second.ends_with("-2"));
}

#[test]
fn 打印窗标签不与主窗和悬浮窗冲突() {
    assert!(is_print_window_label("task-export-pdf-job"));
    assert!(is_print_window_label("task-export-pdf-123"));
    assert!(!is_print_window_label("main"));
    assert!(!is_print_window_label("floating"));
}
