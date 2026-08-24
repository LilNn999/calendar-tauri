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
| 数据库 | `src/lib/db.ts` | SQLite（Tauri）+ 内存（浏览器）双实现，源 Prisma 逻辑等价移植 |
| 桥接层 | `src/lib/ipc-bridge.ts` | 安装 `window.electronAPI`：数据通道→db，系统通道→Tauri API |
| 主题 | `src/lib/theme.tsx` | next-themes 轻量替代（`ThemeProvider` + `.dark` class + 设置表持久化） |
| 动画替代 | `src/lib/motion.tsx` | framer-motion 轻量子集（CSS keyframes） |
| 彩带 | `src/lib/confetti.ts` | canvas-confetti 轻量自绘替代 |
| 工具函数 | `src/lib/utils.ts` | `cn()`、日期格式化、打卡频率判断 |
| UI 组件 | `src/components/ui/` | shadcn 风格组件（badge/button/dialog/input/popover/select/slider/switch/textarea/toast） |
| 日历组件 | `src/components/calendar/` | CalendarHeader / MonthView / WeekView / DayCell / DayDetailPopup |
| 侧栏组件 | `src/components/sidebar/` | RightSidebar / TaskOverviewPanel / CheckinPanel / TaskPanel |
| 任务组件 | `src/components/tasks/` | TaskCreationSidebar / TaskEditDialog / RecycleBinDialog / 子任务/优先级/重复 |
| 打卡组件 | `src/components/checkins/` | 定义管理 / 布尔 / 数值 / 文本 / 时间 / 打卡值弹窗 |
| 统计组件 | `src/components/analytics/` | 完成率柱状图 / 环形图 / 数值趋势（自绘 SVG，无 recharts） |
| 布局组件 | `src/components/layout/` | TabBar / SettingsDialog / WhatsNewDialog |
| 强度组件 | `src/components/streaks/` | StreakBadge / AchievementToast |
| 备注组件 | `src/components/notes/` | DailyNoteEditor |
| 主题样式 | `src/styles/globals.css` | 源项目 HSL 令牌 + Tailwind v4 `@theme` + 动画 keyframes |
| Rust 入口 | `src-tauri/src/main.rs` | 调用 `lib.rs::run()` |
| Rust 装配 | `src-tauri/src/lib.rs` | 插件注册（sql/autostart/single-instance/global-shortcut/window-state）、窗口/托盘初始化 |
| 托盘 | `src-tauri/src/tray.rs` | 系统托盘菜单（显示主窗 / 切换悬浮窗 / 退出） |
| 悬浮窗 | `src-tauri/src/floating.rs` | 置顶小窗创建/切换 |
| Rust 命令 | `src-tauri/src/commands.rs` | 版本 / 自启 / 悬浮窗切换 / 退出 |
| 权限 | `src-tauri/capabilities/default.json` | 窗口/事件/SQL/自启等最小权限集 |
| 打包 | `src-tauri/tauri.conf.json` | 主窗口 / NSIS 配置 |

## 二、数据模型（SQLite）

详见 `docs/schema.md`。核心表：

- `tasks` / `task_occurrences` — 任务与重复任务每日状态
- `subtasks` / `subtask_occurrences` — 子任务与每日完成状态
- `checkin_definitions` / `checkin_entries` — 打卡定义与记录
- `daily_notes` — 每日备注
- `achievement_definitions` / `earned_achievements` — 成就体系
- `settings` — KV 设置（theme / widgetPrefs 等）

数据访问：`src/lib/db.ts` 暴露 `initDb()/getDb()`，Tauri 环境走 `SqliteDb`（`@tauri-apps/plugin-sql`），浏览器预览走 `MemoryDb`（同接口内存实现）。

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