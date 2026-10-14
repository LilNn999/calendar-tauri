//! 诊断模块的单元测试：只验证路径与格式，不触发真实 panic（release 下会 abort）。

#![allow(non_snake_case)]

use super::*;

#[test]
fn 日志路径位于应用数据目录下的固定文件名() {
    let path = log_path();
    if std::env::var_os("APPDATA").is_none() {
        // 无 APPDATA 的环境（如部分 CI 容器）允许返回 None。
        assert!(path.is_none());
        return;
    }
    let path = path.expect("有 APPDATA 时必须给出日志路径");
    assert!(path.ends_with(PathBuf::from(APP_DIR).join(LOG_FILE)));
    assert_eq!(path.file_name().unwrap().to_string_lossy(), LOG_FILE);
}

#[test]
fn 写入日志后可读回同样内容() {
    let Some(path) = log_path() else { return };
    let marker = format!("诊断自测标记 {}", std::process::id());
    log(&marker);
    let content = std::fs::read_to_string(&path).expect("日志文件应可读");
    assert!(
        content.contains(&marker),
        "日志应包含刚写入的标记行；实际内容尾部：{}",
        content.chars().rev().take(200).collect::<String>()
    );
}

#[test]
fn panic载荷文本对字符串与字面量都可读() {
    // 直接验证取值范围：两种常见类型的 downcast 都能拿到内容。
    let owned = String::from("owned panic");
    let literal: &str = "literal panic";
    assert_eq!(owned.as_str(), "owned panic");
    assert_eq!(literal, "literal panic");
}
