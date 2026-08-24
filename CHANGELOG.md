# CHANGELOG.md

本项目变更记录。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本遵循语义化版本。

## [Unreleased]

### 改版（纯 UI 样式，不改变任何功能）
- 品牌视觉升级为“年轻化 × 科技感 × 圆润”：主色换为鲜亮紫罗兰，并引入青蓝次色，形成紫罗兰 → 青蓝品牌渐变；暗色主题改为深邃蓝紫底。
- 设计令牌重构（`src/styles/globals.css`）：
  - 新增品牌次色 `--accent-2`、品牌渐变工具类（`bg-gradient-brand` / `text-gradient-brand`）、玻璃拟态（`glass-panel`）、品牌光晕阴影（`--shadow-glow`）。
  - 圆角全面加大（基础半径 0.75rem → 1.125rem，卡片与对话框使用更大圆角），按钮、分段控件、徽章等统一为胶囊圆角。
  - 亮色背景加入柔和紫色光斑、暗色背景加入蓝紫光晕，营造轻量科技感氛围。
- 组件样式统一：主按钮、Tab/视图切换激活态、今日日期徽章、打卡/筛选胶囊、统计图（柱状渐变、环形用主题色、趋势图渐变折线与渐变面积）、悬浮窗顶部渐变条与进度条均接入品牌渐变与光晕。
- 交互细节：激活态与主按钮增加光晕阴影，悬浮上浮、按压缩放过渡更轻盈（仅样式与过渡参数，逻辑不变）。
- 主题实时同步：新增 `PUSH_THEME_CHANGED` IPC 通道，主窗口切换深浅主题时悬浮窗实时跟随（与现有数据刷新通道一致，定向 `emitTo` + 定向 `listen`）。
- 窗口装饰现代化：主窗口启用无边框（`decorations:false`），新增自定义标题栏窗口控件（最小化 / 最大化·还原 / 关闭），圆角胶囊样式随主题变化；支持拖动窗口、双击标题栏最大化，全屏时自动隐藏控件。
- 标题栏留白调整：标题栏加高至 56px，左右边距加大（左 24px / 右 20px），设置按钮与窗口控件组间距加大，避免无边框窗口下控件紧贴窗口边缘（尤其右侧圆角裁切问题）。
- 应用图标更换为自有图标：`src-tauri/icons/` 使用 `icon.ico`（窗口/任务栏/安装包）+ `logo.png`（备用），托盘改用独立 `tray-icon.png`（32×32，Rust 内嵌解码，零额外运行时依赖）。
- 构建验证：`npm run build`（tsc + vite）通过，无类型错误。

### 工具
- 新增独立迁移工具：`导入旧版数据.exe`（源码 `scripts/legacy-migrate/`，Rust + 内嵌 SQLite，约 1.2 MB，无需 Python/Node/任何其他软件）。功能与原 Python 版一致：自动探测新旧库路径、Prisma 驼峰表名映射、毫秒时间戳转 ISO、成就按 key 重映射、保留 `settings`；默认拒绝覆盖，`--force` 清空重导，`--dry-run` 预览。
- Python 版迁移脚本 `scripts/migrate_legacy.py` 已移除（依赖本机 Python），统一改用独立 exe `导入旧版数据.exe`。

- 当天所有任务完成特效改为单发礼炮爆炸：触发瞬间在界面正中间直接炸开约 2/3 屏幕的实心彩色粒子（canvas 自绘、零依赖，无升空飞行、粒子无透明度）；播放速度调慢约 40% 后再提速 20%；成就解锁保留小号单发礼炮。

### 修复
- 打卡值弹窗支持回车直接确认并关闭；数值/文字型输入回车会立即提交（不再受防抖延迟影响）；打卡组件表单的单位输入框回车可直接保存。
- 修复时间型打卡无法调出时间选择器：时间输入框点击时主动调用 `showPicker`，并增加时钟按钮，主界面与悬浮窗统一生效。
- 开关型打卡可直接在日历格子上点击切换完成状态，无需再打开弹窗。
- 更新公告措辞简化：调整为与常规 App 更新公告一致的简短描述。
- 修复数值型打卡（如体重）输入数值后界面白屏卡死：`checkins:upsertEntry` 桥接层未返回写入结果，store 把 `undefined` 写进打卡记录导致渲染崩溃；现桥接层返回最新打卡记录，并在 store 增加空结果防御。
- 数值型打卡输入不允许负值：主界面与悬浮窗的数值输入框均禁止以 `-` 开头的输入，并设置 `min=0`。
- 修复悬浮窗置顶状态失效：之前悬浮窗创建和托盘/快捷键重新显示时都会无条件置顶，且前端启动时只更新按钮状态、未应用到窗口，导致“没有开置顶却仍然置顶”。现将置顶偏好同步到 Rust 状态，创建、显示、启动、切换时统一按保存的偏好应用。

### 规划中
- 任务提醒（系统通知）
- 数据导出/导入（JSON/CSV）

## [0.2.0] — 2026-08-23

### 新增
- 悬浮窗母任务与子任务联动：完成母任务时子任务一并划掉显示完成，取消完成时恢复各自原状态（仅展示层联动，不改动数据库子任务状态）。
- 设置新增“更新公告”入口，可随时查看各版本更新内容；首次启动新版本自动弹出更新公告。
- 暗色模式下任务勾选按钮优化：未勾选框边框提亮并增加底色，完成/失败状态更醒目。

### 修复
- 修复“点完成任务后右侧任务总览闪到外侧再闪回来”：motion shim 的 `motion.div` 每次渲染都返回新组件引用，导致 React 每次状态更新都重挂载侧栏并重播展开动画；现缓存各标签的组件引用，动画只在本该挂载时播放。
- 修复“点击完成任务后右侧栏闪回”：刷新信号原来广播给所有窗口（包括自己），导致主窗口每次操作都自我重载；现与源项目一致——事件只定向发给“另一个窗口”（监听绑定窗口标签 + `emitTo` 定向发送），成就提示也只发给主窗口。
- 修复“添加日程后看不到任务”：`tasks:list` / `checkins:getEntries` 桥接层按两个参数读取，而前端发送的是 `{ start, end }` 对象，导致列表永远查不到数据；现统一按对象解构。
- 修复悬浮窗拖动抽搐/闪烁：`saveWidgetPrefs` 不再附带移动窗口，位置改为仅启动时恢复一次，切断 `onMoved → 保存 → setPosition → onMoved` 的反馈回路。
- 前端构建通过验证（`npm run build`）：修复 9 处 TypeScript 错误——移除未使用变量与属性（`DayDetail` 的 `onDeleteTask`、`MonthGrid` 的 `Checkin` 导入、`stats.ts` 与 `utils.ts` 的未用变量）；`TaskDialog` 子任务回调改为直接返回 Promise；`FloatingApp` 中 `WebviewWindow.getByLabel` 改为 await。

### 构建
- 版本号统一升级至 0.2.0（`package.json` / `src-tauri/tauri.conf.json` / `src-tauri/Cargo.toml` / `src-tauri/Cargo.lock` 同步）。

## [0.1.0] — 2026-08-23

### 新增
- 项目初始化：Tauri v2 + React + Vite + TypeScript + Tailwind CSS v4 + Shadcn/ui。
- AI 文档体系：`AGENTS.md`、`PROJECT_MAP.md`、`CHANGELOG.md`、`docs/schema.md`。
- 数据层：SQLite（`@tauri-apps/plugin-sql`），表结构 tasks / subtasks / checkins / notes / settings，含顺序迁移。
- 核心功能：
  - 任务：增删改、优先级、状态流转、按日筛选。
  - 子任务：任务下嵌套清单，勾选进度自动同步。
  - 打卡：每日一次、连续天数统计、心情记录。
  - 备注：按日期/任务关联的富文本（纯文本）备注。
  - 统计：完成率、近 7/30 天趋势、优先级分布（自绘 SVG，无图表库）。
- 桌面能力：
  - 系统托盘：显示/隐藏主窗、快速新建任务、退出。
  - 置顶悬浮窗：`Alt+Space` 唤出，显示今日任务与打卡状态。
  - 开机自启开关（`tauri-plugin-autostart`）。
  - 单实例运行（重复启动聚焦主窗）。
- UI/UX：
  - 现代高级感视觉：渐变主色、玻璃拟态卡片、柔和阴影。
  - 深浅双主题，自动跟随系统 + 手动覆盖，偏好持久化。
  - 响应式布局，窄屏侧边栏可折叠。

### 重构（源 UI 1:1 迁移）
- 按源项目（Electron + React 18）1:1 迁移界面布局，未改动 UI 分布：
  - `App.tsx` 恢复为顶部 `TabBar`（日历 / 数据分析）+ 主日历区 + 右侧可折叠栏。
  - 恢复 `CalendarPage` / `AnalyticsPage` 及全部弹窗（DayDetailPopup / TaskEditDialog / TaskCreationSidebar / CheckinValueDialog / RecycleBinDialog 等）。
  - 数据模型与源 Prisma 一一对应：任务 / 重复任务 occurrence / 子任务 occurrence / 打卡定义与记录 / 每日备注 / 成就 / 设置 KV。
- 技术栈替换（布局与交互保持源样）：
  - 数据层由 Prisma 改为 `@tauri-apps/plugin-sql`（`src/lib/db.ts` 双实现：SQLite + 浏览器内存）。
  - `window.electronAPI` 由 `src/lib/ipc-bridge.ts` 双通道桥接（数据→db，系统→Tauri API）。
  - recharts → 自绘 SVG（柱状 / 环形 / 趋势图）；framer-motion → `src/lib/motion.tsx` CSS 动画 shim；next-themes → `src/lib/theme.tsx`；canvas-confetti → 自绘彩带。
- 桌面能力对齐源行为：托盘三项菜单（显示主窗 / 切换悬浮窗 / 退出）、悬浮窗启动常驻、位置/尺寸/置顶/透明度持久化、深浅主题跨窗口同步。
- 文档同步：`PROJECT_MAP.md`、`docs/schema.md`。

### 构建
- 打包优化：release profile 开启 LTO + strip，NSIS 安装包目标 5~10 MB。
- WebView2 使用下载引导模式，减小安装包体积。

[0.1.0]: 初始版本（2026-08-23）
[0.2.0]: 体验优化与问题修复版（2026-08-23）
