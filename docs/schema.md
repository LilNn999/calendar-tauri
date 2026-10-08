# docs/schema.md — 数据表结构

数据库：SQLite（`@tauri-apps/plugin-sql`）。正式模式使用 `calendar.db`，测试模式使用 `test-calendar.db`，均位于应用数据目录 `com.calendar.desktop`。测试模式由 `CALENDAR_TEST_MODE=1`（`启动测试窗口.bat`）触发，测试数据不会写入正式库；正式库启动时会自动清理旧版本遗留的测试数据标记。
所有表变更需同步：`src/lib/db.ts` 迁移（`PRAGMA user_version` 递增）、本文件、`CHANGELOG.md`。
表结构与源项目（Electron + Prisma）一一对应。

## tasks — 任务

| 列 | 类型 | 说明 |
| --- | --- | --- |
| id | INTEGER PK AUTOINCREMENT | 主键 |
| projectId | INTEGER NOT NULL DEFAULT 1 | 所属待办项目，关联 projects(id)，旧任务升级时自动归入默认项目（v3 新增） |
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

项目日期索引：`idx_tasks_project_dueDate (projectId, dueDate)`。

`tasks_project_insert` / `tasks_project_update` 触发器校验项目存在；使用触发器而不在新增列声明 REFERENCES，兼容启用外键且已有数据的 SQLite 旧库，避免重建任务表。

## projects — 待办项目（v3 新增）

| 列 | 类型 | 说明 |
| --- | --- | --- |
| id | INTEGER PK AUTOINCREMENT | 主键，默认项目固定为 1 |
| name | TEXT NOT NULL COLLATE NOCASE UNIQUE | 项目名称，界面限制 1–40 个字，去除首尾空白、不允许同名 |
| createdAt | TEXT NOT NULL | 创建时间 |

普通任务、循环任务与回收箱按 `tasks.projectId` 隔离；子任务及每日完成记录通过所属任务归入同一项目。循环任务单日拆分与后续拆分默认继承原项目，也可在编辑时指定目标项目。打卡定义、打卡记录和每日备注继续共享。

项目重命名只更新 `projects.name`，保留 `id`、`createdAt`、任务归属及所有完成记录；默认项目也允许改名。名称沿用创建时的非空、最多 40 字与不允许同名规则，改名后通过 `push:projectsChanged` 同步主窗口及悬浮窗。此次仅增加改名操作，表结构与 `user_version = 3` 保持不变。

查看全部项目时查询不限制 `projectId`；新建任务必须归属于一个具体项目，全部视图中默认预选默认项目，可在表单修改。项目创建与任务归属使用同一 SQLite 数据库，不新增数据库文件。

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
| skipDates | TEXT | 单日跳过日期的 JSON 数组（`["YYYY-MM-DD", …]`，v2 新增；循环打卡范围删除「仅此日程」写入） |
| createdAt | TEXT NOT NULL | 时间戳 |

> 迁移版本：v2（`PRAGMA user_version`）。删除循环打卡的三种范围映射：仅此日程 → 追加 `skipDates`；此日程及此前所有 → `startDate` 前移到次日；此日程及未来所有 → `endDate` 前移到前一日。前移后若无剩余日期，整条定义归档。

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

`selectedProjectId`：当前项目主键，JSON `null` 表示全部项目；默认值为 `1`。主窗口与悬浮窗通过 `push:projectsChanged` 同步项目列表和选择。

## 迁移约定

- 版本号存于 `PRAGMA user_version`，当前版本 `3`（v2 新增打卡 `skipDates`；v3 新增项目及任务归属）。
- 每次结构变更：在 `SqliteDb.migrate()` 中递增版本并追加建表/改表 SQL。
- 已发布的迁移不可修改，只能追加。
