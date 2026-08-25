# docs/schema.md — 数据表结构

数据库：SQLite（`@tauri-apps/plugin-sql`）。正式模式使用 `calendar.db`，测试模式使用 `test-calendar.db`，均位于应用数据目录 `com.calendar.desktop`。测试模式由 `CALENDAR_TEST_MODE=1`（`启动测试窗口.bat`）触发，测试数据不会写入正式库；正式库启动时会自动清理旧版本遗留的测试数据标记。
所有表变更需同步：`src/lib/db.ts` 迁移（`PRAGMA user_version` 递增）、本文件、`CHANGELOG.md`。
表结构与源项目（Electron + Prisma）一一对应。

## tasks — 任务

| 列 | 类型 | 说明 |
| --- | --- | --- |
| id | INTEGER PK AUTOINCREMENT | 主键 |
| title | TEXT NOT NULL | 标题 |
| priority | TEXT NOT NULL DEFAULT 'none' | none / low / medium / high |
| dueDate | TEXT NOT NULL | 日期 `YYYY-MM-DD`（重复任务为每次发生日期） |
| isCompleted | INTEGER NOT NULL DEFAULT 0 | 0/1 |
| isFailed | INTEGER NOT NULL DEFAULT 0 | 过期未完成标记 0/1 |
| completedAt | TEXT | 完成时间，可空 |
| notes | TEXT | 备注，可空 |
| recurrenceType | TEXT | 重复类型 daily/weekday/weekend/weekly/monthly，可空 |
| recurrenceEnd | TEXT | 重复结束日期，可空 |
| deletedAt | TEXT | 软删除时间，NULL 表示未删除 |
| createdAt / updatedAt | TEXT | 时间戳 |

索引：`idx_tasks_dueDate (dueDate)`。

## task_occurrences — 重复任务每日状态

| 列 | 类型 | 说明 |
| --- | --- | --- |
| id | INTEGER PK AUTOINCREMENT | 主键 |
| taskId | INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE | 所属任务 |
| date | TEXT NOT NULL | 发生日期 `YYYY-MM-DD` |
| isCompleted | INTEGER NOT NULL DEFAULT 0 | 0/1 |
| isFailed | INTEGER NOT NULL DEFAULT 0 | 0/1 |
| isSkipped | INTEGER NOT NULL DEFAULT 0 | 跳过 0/1 |

唯一约束：`UNIQUE(taskId, date)`。

## subtasks — 子任务

| 列 | 类型 | 说明 |
| --- | --- | --- |
| id | INTEGER PK AUTOINCREMENT | 主键 |
| taskId | INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE | 所属任务 |
| title | TEXT NOT NULL | 内容 |
| sortOrder | INTEGER NOT NULL DEFAULT 0 | 排序 |
| createdAt / updatedAt | TEXT | 时间戳 |

索引：`idx_subtasks_taskId (taskId)`。

## subtask_occurrences — 子任务每日完成状态

| 列 | 类型 | 说明 |
| --- | --- | --- |
| id | INTEGER PK AUTOINCREMENT | 主键 |
| subtaskId | INTEGER NOT NULL REFERENCES subtasks(id) ON DELETE CASCADE | 所属子任务 |
| date | TEXT NOT NULL | 日期 `YYYY-MM-DD` |
| isCompleted | INTEGER NOT NULL DEFAULT 0 | 0/1 |

唯一约束：`UNIQUE(subtaskId, date)`。

## checkin_definitions — 打卡定义

| 列 | 类型 | 说明 |
| --- | --- | --- |
| id | INTEGER PK AUTOINCREMENT | 主键 |
| name | TEXT NOT NULL | 名称 |
| type | TEXT NOT NULL DEFAULT 'boolean' | numeric / boolean / text / time |
| unit | TEXT | 单位，可空 |
| sortOrder | INTEGER NOT NULL DEFAULT 0 | 排序 |
| archivedAt | TEXT | 归档时间，可空 |
| startDate / endDate | TEXT | 生效区间，可空 |
| frequency | TEXT DEFAULT 'daily' | daily/weekday/weekend/weekly/monthly |
| createdAt | TEXT NOT NULL | 时间戳 |

## checkin_entries — 打卡记录

| 列 | 类型 | 说明 |
| --- | --- | --- |
| id | INTEGER PK AUTOINCREMENT | 主键 |
| definitionId | INTEGER NOT NULL REFERENCES checkin_definitions(id) ON DELETE CASCADE | 所属定义 |
| entryDate | TEXT NOT NULL | 日期 `YYYY-MM-DD` |
| value | TEXT NOT NULL DEFAULT '' | 值（数字/布尔/文本/时间字符串） |
| updatedAt | TEXT NOT NULL | 时间戳 |

唯一约束：`UNIQUE(definitionId, entryDate)`。

## daily_notes — 每日备注

| 列 | 类型 | 说明 |
| --- | --- | --- |
| id | INTEGER PK AUTOINCREMENT | 主键 |
| noteDate | TEXT NOT NULL UNIQUE | 日期 `YYYY-MM-DD` |
| content | TEXT NOT NULL DEFAULT '' | 内容 |
| updatedAt | TEXT NOT NULL | 时间戳 |

## achievement_definitions — 成就定义

| 列 | 类型 | 说明 |
| --- | --- | --- |
| id | INTEGER PK AUTOINCREMENT | 主键 |
| key | TEXT NOT NULL UNIQUE | 成就键 |
| title / description / icon | TEXT NOT NULL | 标题 / 描述 / 图标 |

种子数据见 `src/shared/constants.ts` 的 `ACHIEVEMENT_SEEDS`。

## earned_achievements — 已解锁成就

| 列 | 类型 | 说明 |
| --- | --- | --- |
| id | INTEGER PK AUTOINCREMENT | 主键 |
| definitionId | INTEGER NOT NULL UNIQUE REFERENCES achievement_definitions(id) ON DELETE CASCADE | 成就定义 |
| earnedAt | TEXT NOT NULL | 解锁时间 |

## settings — KV 设置

| 列 | 类型 | 说明 |
| --- | --- | --- |
| key | TEXT PK | 键名 |
| value | TEXT NOT NULL | JSON 值 |

常用键：`theme`（light/dark/system）、`widgetPrefs`（悬浮窗位置/尺寸/置顶/透明度，JSON）、`lastFailedCheckDate`（过期失败标记日期）。

## 迁移约定

- 版本号存于 `PRAGMA user_version`，当前版本 `1`。
- 每次结构变更：在 `SqliteDb.migrate()` 中递增版本并追加建表/改表 SQL。
- 已发布的迁移不可修改，只能追加。
