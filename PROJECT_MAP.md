# PROJECT_MAP.md — 项目地图

> 面向 AI 代理与开发者：快速定位"改哪个文件"。结构与 `src-tauri` 目录是唯一事实来源，本文件若滞后请同步更新。

## 一、模块总览

| 模块 | 位置 | 职责 |
| --- | --- | --- |
| 应用入口 | `src/main.tsx` | 初始化桥接与数据层，挂载主窗/悬浮窗 |
| 根组件 | `src/App.tsx` | 源布局 1:1：顶部 TabBar（日历 / 数据分析）+ 全屏横幅 |
| 悬浮窗 | `src/FloatingApp.tsx` | 挂载 `WidgetShell`（透明置顶小窗） |
| 页面 | `src/pages/` | `CalendarPage.tsx`（主日历）/ `AnalyticsPage.tsx`（统计） |
| 共享类型 | `src/shared/` | `types.ts` / `constants.ts` / `ipc-channels.ts`（源项目原样） |
| API 层 | `src/api/index.ts` | 类型化 IPC 封装（走 `window.electronAPI`） |
| 全局状态 | `src/store/` | Zustand store：calendar / task / checkin / notes / ui |
| 待办项目 | `src/store/useProjectStore.ts` + `src/components/projects/` | 项目列表/选择持久化与跨窗口同步、A 版轻量切换菜单、新建及重命名、任务所属项目选择、全部视图项目标签 |
| 项目模型与迁移 | `src/lib/types.ts` + `projects.ts` + `project-migration.ts` | Project 实体、默认项目与范围判断、SQLite v3 无损迁移；任务查询、统计及回收箱在 db.ts 按项目过滤 |
| 数据库 | `src/lib/db.ts` | SQLite（Tauri）+ 内存（浏览器）双实现；正式 `calendar.db` / 测试 `test-calendar.db` 分离，源 Prisma 逻辑等价移植 |
| 桥接层 | `src/lib/ipc-bridge.ts` | 安装 `window.electronAPI`：数据通道→db，系统通道→Tauri API |
| 主题 | `src/lib/theme.tsx` | next-themes 轻量替代（`ThemeProvider` + `.dark` class + 皮肤 class + 设置表持久化） |
| 皮肤 | `src/lib/skin.ts` | Skin 类型、3 套参考稿皮肤选项、归一化与根 class |
| 日历状态 | `src/lib/dayCellState.ts` | 选中/今天/非本月状态优先级 |
| 节假日 | `src/lib/holidays.ts` | 法定节假日与调休静态数据（国办通知 2025–2026），含法定日期与年度来源登记；供月视图格子「休/班」角标、节日名、悬浮说明与月度统计查询 |
| 月度天数统计 | `src/lib/monthDayStats.ts` | 月度工作日 / 休息日 / 法定节假日统计纯函数（含假期区间与补班日期、未收录年度的估算标记），供年月标题旁的统计图标使用 |
| 未完成任务导出 | `src/lib/task-export-model.ts`、`task-export-query.ts`、`task-export-document.ts`、`src/styles/task-export-document.css` | 导出快照 DTO 与统一选择器（普通任务不限日期、循环任务可选且只取最近一次待完成；支持全部或单个项目）、单条只读 SQL 查询（不触发失败标记等写库副作用）、唯一的静态 HTML 文档渲染器与 A4 分页样式；预览接收当前皮肤令牌，PDF 保持白底，内容与统计共用同一快照 |
| 循环匹配规则 | `src/lib/task-recurrence.ts` | 从 `db.ts` 原样提取的 `matchesRecurrence`；`db.ts` 继续导入并重新导出，供循环展开与导出选择共用 |
| 农历历法 | `src/lib/lunar.ts` + `lunar-data.ts` | 公历→农历换算、二十四节气、农历/公历节日（1900–2100 内置表，提取自 solarlunar 并固化）；供日历模式纯日历格子展示 |
| 动画替代 | `src/lib/motion.tsx` | framer-motion 轻量子集（CSS keyframes） |
| 彩带 | `src/lib/confetti.ts` | canvas-confetti 原版多波彩带（与源项目一致） |
| 工具函数 | `src/lib/utils.ts` | `cn()`、日期格式化、打卡频率判断 |
| UI 组件 | `src/components/ui/` | shadcn 风格组件（badge/button/dialog/input/popover/select/slider/switch/textarea/toast） |
| 日历组件 | `src/components/calendar/` | CalendarHeader / MonthView / WeekView / DayCell / PureDayCell（日历模式纯日历格子）/ HolidayBadge / DayDetailPopup / MonthlyDayStatsPopover（月度天数统计图标与悬浮信息窗） |
| 侧栏组件 | `src/components/sidebar/` | RightSidebar / TaskOverviewPanel / CheckinPanel / TaskPanel |
| 任务组件 | `src/components/tasks/` | TaskCreationSidebar / TaskEditDialog / RecycleBinDialog / TaskExportDialog（导出未完成任务，含项目选择、循环选项与皮肤预览） / 子任务/优先级/重复 |
| 打卡组件 | `src/components/checkins/` | 定义管理 / 布尔 / 数值 / 文本 / 时间 / 打卡值弹窗 |
| 统计组件 | `src/components/analytics/` | 完成率柱状图 / 环形图 / 数值趋势（自绘 SVG，无 recharts） |
| 布局组件 | `src/components/layout/` | TabBar / SettingsDialog / SkinSwitcher / WhatsNewDialog |
| 强度组件 | `src/components/streaks/` | StreakBadge / AchievementToast |
| 备注组件 | `src/components/notes/` | DailyNoteEditor |
| 主题样式 | `src/styles/globals.css` | 三套参考稿皮肤（极简留白 / 新拟态 / 温暖原木）× 浅色 / 深色的语义令牌、日历状态、控件与悬浮窗 token、动画 keyframes |
| Rust 入口 | `src-tauri/src/main.rs` | 调用 `lib.rs::run()` |
| Rust 装配 | `src-tauri/src/lib.rs` | 插件注册（sql/autostart/single-instance/global-shortcut/window-state）、窗口/托盘初始化 |
| 托盘 | `src-tauri/src/tray.rs` | 系统托盘菜单（显示主窗 / 切换悬浮窗 / 退出） |
| 悬浮窗 | `src-tauri/src/floating.rs` | 置顶小窗创建/切换 |
| Rust 命令 | `src-tauri/src/commands.rs` | 版本 / 自启 / 悬浮窗切换 / 退出 |
| 导出 PDF | `src-tauri/src/task_export.rs` + `src-tauri/src/task_export/windows.rs` | `export_task_pdf` 命令：系统保存对话框（Rust 内调用，无需前端 dialog/fs 权限）、单作业守卫、专属隐藏打印窗与 Windows WebView2 `PrintToPdf`、60 秒超时、成功后校验 `%PDF-` 并在同目录替换目标文件、临时文件清理；打印窗标签不进入窗口状态记忆 |
| 权限 | `src-tauri/capabilities/default.json` | 窗口/事件/SQL/自启等最小权限集；导出功能未新增权限（打印与保存在 Rust 内完成） |
| 打包 | `src-tauri/tauri.conf.json` | 主窗口 / NSIS 配置 |

## 二、数据模型（SQLite）

详见 `docs/schema.md`。核心表：

- `tasks` / `task_occurrences` — 任务与重复任务每日状态
- `projects` — 待办项目（默认项目 id=1，tasks.projectId 关联）；打卡和每日备注共享
- `subtasks` / `subtask_occurrences` — 子任务与每日完成状态
- `checkin_definitions` / `checkin_entries` — 打卡定义与记录
- `daily_notes` — 每日备注
- `achievement_definitions` / `earned_achievements` — 成就体系
- `settings` — KV 设置（theme / skin / widgetPrefs 等）

数据访问：`src/lib/db.ts` 暴露 `initDb()/getDb()`，Tauri 环境走 `SqliteDb`（`@tauri-apps/plugin-sql`），浏览器预览走 `MemoryDb`（同接口内存实现）。正式版使用 `calendar.db`，测试版使用独立的 `test-calendar.db`；安装包不包含数据库，升级只替换安装目录，不删除应用数据。

## 三、前端页面结构

单页应用，无路由库：

- `App.tsx` → `TabBar`（日历 / 数据分析）+ `CalendarPage` 或 `AnalyticsPage`
- `CalendarPage` → `CalendarHeader` + `MonthView/WeekView` + `RightSidebar` + 各类弹窗
- `AnalyticsPage` → `TimeFilterBar` + 完成率环形图/柱状图 + 数值趋势 + 任务趋势

## 四、IPC 双通道

| 通道类型 | 处理方式 |
| --- | --- |
| 数据通道（tasks/checkins/notes/analytics/achievements） | `ipc-bridge.ts` 路由到 `db.ts`（SQLite / 内存） |
| 系统通道（托盘/悬浮窗/全屏/缩放/主题/自启/退出） | Tauri 环境走 `@tauri-apps/api` 与 Rust 命令；浏览器降级 |
| 推送通道（widgetDataRefresh / achievementUnlocked / fullscreenChanged） | Tauri 事件跨窗口转发 + 本地事件总线 |

## 五、构建与验证

```bash
npm run build        # 前端构建（tsc + vite，必须通过）
npm run dev          # 浏览器预览（Tauri API 降级为内存实现）
npm run tauri dev    # 完整桌面开发（需 Rust 工具链）
npm run tauri build  # 打包 NSIS 安装包（目标 5~10 MB）
```

## 六、开发计划与设计记录

| 功能 | 记录 | 状态 |
| --- | --- | --- |
| 未完成任务导出 | [实现验证记录](docs/task-export-validation.md)；[构建记录](docs/build-notes.md)；[快速交接](docs/handoffs/2026-10-14-task-export.md)；[需求设计](docs/superpowers/specs/2026-10-14-task-export-design.md)；[7 项实施计划](docs/superpowers/plans/2026-10-14-task-export.md)；[样式说明](docs/superpowers/plans/2026-10-14-task-export-ui.md)；[交互预览](docs/mockups/task-export.html)；[PDF 示例](output/pdf/task-export-sample.pdf)；[PDF 排版](docs/mockups/task-export-pdf.png)；[真实渲染截图](docs/mockups/task-export-live-4-11-4.png)、[长清单 PDF](docs/mockups/task-export-live-long.pdf) | 0.12.0：任务总览工具区导出未完成母任务及全部子任务，支持当前、单个或全部项目；循环任务可选且每条仅取今天或未来最近一次待完成。预览适配六套皮肤与深浅主题，PDF 保持白底。前端 131 项、Rust 18 项与浏览器 21 项检查通过；最新安装包与校验信息见构建记录，原生交互由用户安装复验 |
| 月度天数统计图标与悬浮信息窗 | [2026-10-14 开发计划](docs/superpowers/plans/2026-10-14-monthly-day-stats.md)；[交互预览](docs/mockups/monthly-day-stats.html)；[浅色截图](docs/mockups/monthly-day-stats-live-light.png)、[深色截图](docs/mockups/monthly-day-stats-live-dark.png)、[未收录年度截图](docs/mockups/monthly-day-stats-live-estimate.png) | 已实现：悬停展开当月工作日 / 休息日 / 法定节假日与假期、补班信息，月视图与纯日历模式共用入口；`npm test` 40 项、浏览器真实界面 49 项检查通过；桌面测试窗口与发布由用户执行 |
