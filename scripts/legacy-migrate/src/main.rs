// 一次性迁移工具：把旧版 Electron 应用（Prisma）数据导入新版 Tauri 应用。
// 独立 exe，内嵌 SQLite，不需要 Python / Node / 任何其他软件。
//
// 旧库：%APPDATA%\daily-calendar\calendar.db
// 新库：%APPDATA%\com.calendar.desktop\calendar.db
//
// 用法：
//   legacy-migrate.exe                 安全模式：已导入过或新库有数据时拒绝
//   legacy-migrate.exe --force         清空新库相关表后重新导入
//   legacy-migrate.exe --dry-run       只统计预览，不写入
//   legacy-migrate.exe --old <路径> --new <路径>  手动指定库路径
//   legacy-migrate.exe --no-pause      结束后不等待按键（供脚本调用）

use rusqlite::types::Value;
use rusqlite::{params, params_from_iter, Connection};
use std::collections::HashMap;
use std::env;
use std::io::{self, IsTerminal, Write};
use std::path::PathBuf;
use std::process;

// 旧库（Prisma 驼峰表名）-> 新库表名，插入顺序保证外键
const LEGACY_MAP: [(&str, &str); 9] = [
    ("Task", "tasks"),
    ("TaskOccurrence", "task_occurrences"),
    ("Subtask", "subtasks"),
    ("SubtaskOccurrence", "subtask_occurrences"),
    ("CheckinDefinition", "checkin_definitions"),
    ("CheckinEntry", "checkin_entries"),
    ("DailyNote", "daily_notes"),
    ("AchievementDefinition", "achievement_definitions"),
    ("EarnedAchievement", "earned_achievements"),
];

const MARKER_KEY: &str = "legacy_imported_at";

// 新表名 -> 需要做毫秒->ISO 转换的日期列
const DATETIME_COLUMNS: [(&str, &[&str]); 6] = [
    (
        "tasks",
        &["createdAt", "updatedAt", "completedAt", "deletedAt"],
    ),
    ("subtasks", &["createdAt", "updatedAt"]),
    ("checkin_definitions", &["createdAt", "archivedAt"]),
    ("checkin_entries", &["updatedAt"]),
    ("daily_notes", &["updatedAt"]),
    ("earned_achievements", &["earnedAt"]),
];

// ---------- 时间转换 ----------

fn civil_from_days(z: i64) -> (i64, u32, u32) {
    let z = z + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = z - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    (if m <= 2 { y + 1 } else { y }, m, d)
}

/// 毫秒时间戳 -> JS toISOString() 格式（UTC，3 位毫秒 + Z）
fn ms_to_iso(ms: i64) -> String {
    let secs = ms.div_euclid(1000);
    let millis = ms.rem_euclid(1000);
    let days = secs.div_euclid(86400);
    let rem = secs.rem_euclid(86400);
    let (y, m, d) = civil_from_days(days);
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}.{:03}Z",
        y,
        m,
        d,
        rem / 3600,
        (rem % 3600) / 60,
        rem % 60,
        millis
    )
}

fn now_iso() -> String {
    let d = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    ms_to_iso(d.as_secs() as i64 * 1000 + d.subsec_millis() as i64)
}

fn norm_iso(v: Value) -> Value {
    match v {
        Value::Integer(i) => Value::Text(ms_to_iso(i)),
        Value::Real(f) => Value::Text(ms_to_iso(f as i64)),
        Value::Text(s) => {
            let t = s.trim();
            let numeric = (!t.is_empty() && t.bytes().all(|b| b.is_ascii_digit()))
                || (t.len() > 1
                    && t.starts_with('-')
                    && t[1..].bytes().all(|b| b.is_ascii_digit()));
            if numeric {
                if let Ok(i) = t.parse::<i64>() {
                    return Value::Text(ms_to_iso(i));
                }
            }
            Value::Text(s)
        }
        other => other,
    }
}

// ---------- 数据库工具 ----------

fn table_exists(con: &Connection, name: &str) -> bool {
    con.query_row(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?1",
        params![name],
        |_| Ok(()),
    )
    .is_ok()
}

fn table_columns(con: &Connection, name: &str) -> Vec<String> {
    let sql = format!("PRAGMA table_info(\"{}\")", name);
    con.prepare(&sql)
        .and_then(|mut stmt| {
            stmt.query_map([], |r| r.get::<_, String>(1))
                .map(|it| it.filter_map(Result::ok).collect::<Vec<String>>())
        })
        .unwrap_or_default()
}

fn count_rows(con: &Connection, name: &str) -> i64 {
    let sql = format!("SELECT COUNT(*) FROM \"{}\"", name);
    con.query_row(&sql, [], |r| r.get(0)).unwrap_or(0)
}

fn wipe_new_data(con: &Connection) -> rusqlite::Result<()> {
    for (_, table) in LEGACY_MAP.iter().rev() {
        if table_exists(con, table) {
            con.execute(&format!("DELETE FROM \"{}\"", table), [])?;
        }
    }
    if table_exists(con, "sqlite_sequence") {
        let _ = con.execute("DELETE FROM sqlite_sequence", []);
    }
    Ok(())
}

fn appdata() -> PathBuf {
    env::var("APPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("."))
}

fn default_old_db() -> PathBuf {
    appdata().join("daily-calendar").join("calendar.db")
}

fn default_new_db() -> PathBuf {
    appdata().join("com.calendar.desktop").join("calendar.db")
}
// ---------- 迁移主流程 ----------

fn run(old_path: &PathBuf, new_path: &PathBuf, force: bool, dry_run: bool) -> i32 {
    println!("旧库: {}", old_path.display());
    println!("新库: {}", new_path.display());

    if !old_path.exists() {
        println!("[错误] 旧库不存在：{}", old_path.display());
        return 2;
    }
    if !new_path.exists() {
        println!(
            "[错误] 新库不存在：{}（请先运行一次新版应用完成初始化）",
            new_path.display()
        );
        return 2;
    }

    let old = match Connection::open(old_path) {
        Ok(c) => c,
        Err(e) => {
            println!("[错误] 无法打开旧库：{}", e);
            return 2;
        }
    };
    let new = match Connection::open(new_path) {
        Ok(c) => c,
        Err(e) => {
            println!("[错误] 无法打开新库：{}", e);
            return 2;
        }
    };
    if let Err(e) = new.execute_batch("PRAGMA foreign_keys = ON;") {
        println!("[错误] 设置外键失败：{}", e);
        return 2;
    }

    // 已导入标记
    let mut marker = false;
    if table_exists(&new, "settings") {
        marker = new
            .query_row(
                "SELECT 1 FROM settings WHERE key=?1",
                params![MARKER_KEY],
                |_| Ok(()),
            )
            .is_ok();
    }
    if marker && !force {
        println!(
            "[错误] 检测到已导入标记（legacy_imported_at）。已导入过一次，如需重导请加 --force。"
        );
        return 2;
    }

    // 新库已有数据则拒绝（除非 --force）
    if !force {
        for (_, table) in LEGACY_MAP {
            if table_exists(&new, table) && count_rows(&new, table) > 0 {
                println!(
                    "[错误] 新库 {} 表已有 {} 行数据，为避免覆盖新版数据已中止。确认清空重导请加 --force。",
                    table,
                    count_rows(&new, table)
                );
                return 2;
            }
        }
    }

    println!("\n迁移前数据量：");
    for (old_name, table) in LEGACY_MAP {
        if table_exists(&old, old_name) {
            println!("  旧库 {:<24} {:>6} 行", table, count_rows(&old, old_name));
        } else {
            println!("  旧库 {:<24} （不存在，跳过）", table);
        }
    }

    if dry_run {
        println!("\n[dry-run] 未写入任何数据，结束。");
        return 0;
    }

    if force {
        println!("\n[force] 清空新库相关表后导入…");
        if let Err(e) = wipe_new_data(&new) {
            println!("[错误] 清空失败：{}", e);
            return 1;
        }
    }

    let tx = match new.unchecked_transaction() {
        Ok(t) => t,
        Err(e) => {
            println!("[错误] 开启事务失败：{}", e);
            return 1;
        }
    };

    let result = do_import(&old, &tx);
    match result {
        Ok(()) => {
            if let Err(e) = tx.commit() {
                println!("[错误] 提交失败：{}", e);
                return 1;
            }
        }
        Err(e) => {
            // tx 被 drop 时自动回滚
            println!("[错误] 迁移失败，已回滚：{}", e);
            return 1;
        }
    }

    println!("\n迁移完成，导入后数据量：");
    for (_, table) in LEGACY_MAP {
        if table_exists(&new, table) {
            println!("  新库 {:<24} {:>6} 行", table, count_rows(&new, table));
        }
    }
    println!("\n提示：请打开新版应用检查数据；如需重导，删除 settings 中的 legacy_imported_at 或加 --force。");
    0
}

fn do_import(old: &Connection, new: &Connection) -> rusqlite::Result<()> {
    // 1) 成就定义按 key 对齐，建立 旧 id -> 新 id 映射
    let mut id_map: HashMap<i64, i64> = HashMap::new();
    if table_exists(old, "AchievementDefinition") && table_exists(new, "achievement_definitions") {
        let mut stmt =
            old.prepare("SELECT id, key, title, description, icon FROM AchievementDefinition")?;
        let rows = stmt.query_map([], |r| {
            Ok((
                r.get::<_, i64>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
                r.get::<_, String>(4)?,
            ))
        })?;
        for row in rows {
            let (oid, key, title, desc, icon) = row?;
            let existed: Option<i64> = new
                .query_row(
                    "SELECT id FROM achievement_definitions WHERE key=?1",
                    params![key],
                    |r| r.get(0),
                )
                .ok();
            let nid = match existed {
                Some(id) => id,
                None => {
                    new.execute(
                        "INSERT INTO achievement_definitions (key, title, description, icon) VALUES (?1, ?2, ?3, ?4)",
                        params![key, title, desc, icon],
                    )?;
                    new.last_insert_rowid()
                }
            };
            id_map.insert(oid, nid);
        }
    }

    // 2) 其余表按列名交集复制，显式保留 id
    for (old_name, table) in LEGACY_MAP {
        if !table_exists(old, old_name) || !table_exists(new, table) {
            continue;
        }
        if table == "achievement_definitions" {
            continue; // 上面已处理
        }
        if table == "earned_achievements" {
            let mut stmt =
                old.prepare("SELECT id, definitionId, earnedAt FROM EarnedAchievement")?;
            let rows = stmt.query_map([], |r| Ok((r.get::<_, i64>(1)?, r.get::<_, Value>(2)?)))?;
            for row in rows {
                let (def_id, earned_at) = row?;
                if let Some(new_def) = id_map.get(&def_id) {
                    new.execute(
                        "INSERT OR IGNORE INTO earned_achievements (definitionId, earnedAt) VALUES (?1, ?2)",
                        params![new_def, norm_iso(earned_at)],
                    )?;
                }
            }
            continue;
        }

        let old_cols = table_columns(old, old_name);
        let new_cols = table_columns(new, table);
        let shared: Vec<String> = old_cols
            .iter()
            .filter(|c| new_cols.contains(c))
            .cloned()
            .collect();
        if shared.is_empty() {
            continue;
        }
        let cols_sql = shared
            .iter()
            .map(|c| format!("\"{}\"", c))
            .collect::<Vec<_>>()
            .join(", ");
        let placeholders = (1..=shared.len())
            .map(|i| format!("?{}", i))
            .collect::<Vec<_>>()
            .join(", ");
        let insert_sql = format!(
            "INSERT OR IGNORE INTO \"{}\" ({}) VALUES ({})",
            table, cols_sql, placeholders
        );
        let dt_cols: Vec<&str> = DATETIME_COLUMNS
            .iter()
            .find(|(t, _)| *t == table)
            .map(|(_, cols)| cols.to_vec())
            .unwrap_or_default();

        let select_sql = format!("SELECT {} FROM \"{}\"", cols_sql, old_name);
        let mut stmt = old.prepare(&select_sql)?;
        let mut rows = stmt.query([])?;
        let mut copied = 0i64;
        while let Some(row) = rows.next()? {
            let mut vals: Vec<Value> = Vec::with_capacity(shared.len());
            for (i, c) in shared.iter().enumerate() {
                let v: Value = row.get(i)?;
                vals.push(if dt_cols.contains(&c.as_str()) {
                    norm_iso(v)
                } else {
                    v
                });
            }
            new.execute(&insert_sql, params_from_iter(vals))?;
            copied += 1;
        }
        println!("  已导入 {:<24} {} 行", table, copied);
    }

    // 3) 写入导入标记
    if table_exists(new, "settings") {
        new.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
            params![MARKER_KEY, now_iso()],
        )?;
    }
    Ok(())
}
// ---------- 入口 ----------

#[cfg(windows)]
#[link(name = "kernel32")]
extern "system" {
    fn SetConsoleOutputCP(cp: u32) -> i32;
}

#[cfg(windows)]
fn setup_console() {
    unsafe {
        SetConsoleOutputCP(65001);
    }
}

#[cfg(not(windows))]
fn setup_console() {}

struct Args {
    old: PathBuf,
    new: PathBuf,
    force: bool,
    dry_run: bool,
    no_pause: bool,
}

fn print_help() {
    println!("旧版日历数据导入新版应用（独立 exe，无需任何其他软件）");
    println!();
    println!("用法: legacy-migrate.exe [选项]");
    println!("  --old <路径>    旧库路径（默认 %APPDATA%\\daily-calendar\\calendar.db）");
    println!("  --new <路径>    新库路径（默认 %APPDATA%\\com.calendar.desktop\\calendar.db）");
    println!("  --force         新库已有数据时先清空相关表再导入");
    println!("  --dry-run       只统计预览，不写入");
    println!("  --no-pause      结束后不等待按键");
    println!("  -h, --help      显示帮助");
}

fn parse_args() -> Args {
    let mut args = Args {
        old: default_old_db(),
        new: default_new_db(),
        force: false,
        dry_run: false,
        no_pause: false,
    };
    let mut it = env::args().skip(1);
    let mut help = false;
    while let Some(a) = it.next() {
        match a.as_str() {
            "--old" => {
                if let Some(v) = it.next() {
                    args.old = PathBuf::from(v);
                }
            }
            "--new" => {
                if let Some(v) = it.next() {
                    args.new = PathBuf::from(v);
                }
            }
            "--force" => args.force = true,
            "--dry-run" => args.dry_run = true,
            "--no-pause" => args.no_pause = true,
            "-h" | "--help" => help = true,
            _ => {}
        }
    }
    if help {
        print_help();
        process::exit(0);
    }
    args
}

fn pause_if_interactive(no_pause: bool) {
    if no_pause {
        return;
    }
    if io::stdin().is_terminal() {
        print!("\n按任意键关闭窗口…");
        let _ = io::stdout().flush();
        let mut buf = String::new();
        let _ = io::stdin().read_line(&mut buf);
    }
}

fn main() {
    setup_console();
    let args = parse_args();
    let code = run(&args.old, &args.new, args.force, args.dry_run);
    pause_if_interactive(args.no_pause);
    process::exit(code);
}
