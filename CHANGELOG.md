# CHANGELOG.md

本项目变更记录。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本遵循语义化版本。

## [0.11.0] — 2026-10-14

### 新增
- 未完成任务导出功能已落地：任务总览标题工具区新增下载图标，弹窗可预览并导出**全部项目的未完成母任务及其全部子任务**为 A4 PDF（`src/components/tasks/TaskExportDialog.tsx`）。母任务未完成即保留其全部子任务，已完成子任务保留绿色勾选与划线；普通任务不受当前月份与所选项目限制，逾期未完成、远期与跨项目任务都在清单内。
- 新增可选的「包含循环任务」复选框，默认不勾选且不持久化（`src/lib/task-export-model.ts`）。不勾选时循环任务及其子任务完全不导出；勾选后每条循环母任务只保留今天或未来最近一次未完成、未失败、未跳过的有效发生，并读取该日期的子任务状态。模板自身的 `isCompleted`/`isFailed` 不代表整个序列，纳入与否只看所选发生日期的真实记录。
- 新增导出专用的全量只读查询（`src/lib/task-export-query.ts`）：一条 `SELECT` + `UNION ALL` 读取候选任务、项目、子任务与发生记录，参数全部绑定、JSON 载荷统一解析、`0/1` 规范化为布尔。导出**不调用** `checkAndMarkFailed`，不写入 `lastFailedCheckDate`，也不改动任何任务、子任务、发生记录或设置。
- 新增统一选择器与快照 DTO（`src/lib/task-export-model.ts`）与提取后的循环匹配规则（`src/lib/task-recurrence.ts`，`db.ts` 继续导入并重新导出，既有导入入口与循环展开行为不变）。SQLite 与浏览器内存实现共用同一份选择规则，测试断言两者结果一致。
- 新增唯一的静态文档渲染器（`src/lib/task-export-document.ts` 与文档样式 `src/styles/task-export-document.css`）：预览 iframe 与原生打印使用同一个返回值。文档全部文本转义、无外链字体/图片/脚本、无示例 PDF 的 base64，带 CSP `default-src 'none'`，A4 页边距 14/15/16mm，页脚使用 CSS `@page` 页码与总页数，跨年日期带完整年份。
- 新增 Windows 原生 PDF 保存（`src-tauri/src/task_export.rs`、`src-tauri/src/task_export/windows.rs`）：Rust 内弹出系统保存对话框（标题「导出未完成任务」、筛选「PDF 文档」），在专属隐藏窗口内用 WebView2 `PrintToPdf` 输出，关闭引擎默认页眉页脚并开启背景打印。单作业守卫、保存对话框取消返回 `cancelled`、打印超时与失败都释放守卫并清理临时文件；成功后校验 `%PDF-` 签名并在同目录替换目标文件，不破坏已有 PDF。打印窗标签不进入窗口状态记忆，前端不需要新增 dialog/fs 权限。
- 新增 IPC 与数据入口：`TASKS_EXPORT_SNAPSHOT`（`tasks:exportSnapshot`）、`SYSTEM_EXPORT_TASK_PDF`（`system:exportTaskPdf`）、`tasksApi.exportSnapshot`、`systemApi.exportTaskPdf`、`useTaskStore.fetchExportSnapshot`。快照接口不改动 `tasks`、不改项目选择、不发数据变更通知；浏览器环境导出返回明确的「PDF 导出请在桌面版使用」，不以 Blob 或示例 PDF 冒充。

### 测试
- 新增导出相关测试：选择器与循环口径 21 例（`src/lib/task-export-model.test.ts`）、双实现只读查询 16 例（`src/lib/db-task-export.test.ts`）、文档渲染与分页 10 例（`src/lib/task-export-document.test.ts`）、只读 store 入口 2 例（`src/lib/project-store.test.ts`）、原生适配器生命周期 14 例（`src-tauri/src/task_export/tests.rs`）。前端 117 例、Rust 14 例全部通过。
- 新增验证工具（不参与打包）：`scripts/verify-task-export-render.mjs` 输出真实渲染文档，`scripts/verify-pdf-text.mjs` 按页解析 PDF CMap 还原文字，用于核对页数与内容完整性。

### 文档
- 新增实现验证记录（`docs/task-export-validation.md`）：分列「编译通过/自动测试通过/浏览器渲染核对通过/原生待用户实机确认」，含 100 条母任务 13 页分页核对结果，以及用户需在测试窗口逐项确认的清单。

### 依赖
- 新增 `tauri-plugin-dialog =2.3.3`（固定版本，仅 Rust 侧使用）、`webview2-com =0.38.2`、`windows-core =0.61.2`（与 `tauri-runtime-wry` 锁定版本一致）、`tokio =1.53.1`（仅 `sync`/`time`）、`url = "2"`。`rust-version` 由 `1.77` 校正为依赖树实际要求的 `1.77.2`，未升级 CLI 与 NSIS 模板。

## [0.10.0] — 2026-10-14

### 新增
- 月历标题旁新增月度天数统计图标（`src/components/calendar/MonthlyDayStatsPopover.tsx`）：鼠标悬停展开信息窗，显示当月工作日、休息日、法定节假日天数，以及本月假期区间与调休补班日期。普通月视图与纯日历模式共用同一入口，周视图不显示；与年月选择面板互斥，支持点击、键盘聚焦与 Escape，浮层经 portal 定位并适配窄窗口。休息日包含法定节假日，法定天数单独列出且不重复累加，未收录年度显示“—”并注明仅按周末估算。
- 新增月度统计纯函数与节假日结构化查询（`src/lib/monthDayStats.ts`、`src/lib/holidays.ts`）：`getMonthDayStats()` 输出当月工作日、休息日、法定天数、假期区间与补班日期；放假规则补充法定节假日日期并登记年度来源，2025 年通知文号校正为国办发明电〔2024〕12号（原注释误写为〔2024〕7号），2026 年为〔2025〕7号。已收录年份的统计口径为“工作日 + 休息日 = 当月公历总天数”。
- 新增月度统计回归测试（`src/lib/monthDayStats.test.ts`）：覆盖 2025—2026 年验收基线、逐月恒等式、全年法定合计 13 天、国庆中秋合并连休去重、跨月假期与补班切分、未收录年度的未知项处理及日期文案。

### 设计预览
- 新增未完成任务导出的独立 UI 样式稿（`docs/mockups/task-export.html`）：在任务总览展示导出入口，支持弹窗、完整文件预览、深浅主题、窄窗口与键盘操作。母任务未完成时保留全部子任务，已完成子任务显示勾选和划线；提供按日期排列、包含项目/优先级/备注的 A4 PDF 示例（`output/pdf/task-export-sample.pdf`）。预览内嵌同款示例 PDF，可离线下载；当前使用示例数据，尚未接入正式界面与数据库。
- 新增独立的月度天数统计 UI 预览（`docs/mockups/monthly-day-stats.html`）：年月标题旁显示统计图标，悬停展开工作日、休息日、法定节假日及本月假期/补班信息，移入悬浮窗保持展开，移开后收起。支持深浅主题、2026 年月份切换、日期高亮、点击和键盘操作。仅用于方案确认，未接入正式界面或数据库。

### 文档
- 保存已接受的未完成任务导出方案、7 项实施任务及模型交接入口（`docs/superpowers/specs/2026-10-14-task-export-design.md`、`docs/superpowers/plans/2026-10-14-task-export.md`、`docs/handoffs/2026-10-14-task-export.md`）：包含用户新追加的循环任务勾选规则、全量只读查询、统一快照和渲染、Windows PDF 保存方案、文件接口、测试与桌面验收边界。当前仅完成规划，正式业务尚未实现。
- 记录已确认的月度统计图标方案及开发计划（`docs/superpowers/plans/2026-10-14-monthly-day-stats.md`），包含统计口径、法定日期与连休区分、年度数据缺失处理、实施步骤、验收用例，以及实现后的验证结果记录；正式界面关键截图存档于 `docs/mockups/monthly-day-stats-live-light.png`、`-dark.png`、`-estimate.png`。

## [0.9.1] — 2026-10-09

### 修复
- 待办编辑与新建弹窗限制高度为当前窗口可用范围，内容过长时表单可独立滚动；标题、关闭按钮与底部操作按钮保持可见，避免子任务较多时弹窗超出边界且无法向下滚动。

### 构建
- 修复版本由 0.9.0 升级至 0.9.1，前端包、锁文件、Tauri 配置、Rust crate 与更新公告同步。

## [0.9.0] — 2026-10-08

### 新增
- 项目入口采用 A 版轻量菜单：标题栏仅显示项目名、圆点与箭头，查看全部、新建和重命名收在菜单中；支持鼠标及键盘切换，悬浮窗使用同一入口，菜单适配窗口边界与深浅主题。
- 项目重命名：包含默认项目，支持空名称/长度/重名校验；只更新名称，保留任务、子任务、循环完成记录、回收箱及项目选择，主窗口与悬浮窗同步显示新名称，旧读取请求不会覆盖刚保存的名称。
- 待办项目：顶部支持新建项目、切换项目与查看全部项目；新建项目后自动切换，普通任务和循环任务分项目展示，全部视图标记任务来源。新建与编辑表单可指定所属项目，循环任务按编辑范围保留或调整归属，子任务进度随任务保留。
- 任务统计、回收箱与桌面悬浮窗跟随当前项目；主窗口与悬浮窗同步项目选择，快速切换时旧请求不会覆盖新项目的列表。打卡与每日备注继续共享。
- 项目切换与跨窗口刷新时，公共任务读取逻辑保留母任务完成后的子任务展示联动；不改子任务真实完成记录，取消完成后恢复各自进度。月视图、周视图、日期详情、任务总览与悬浮窗保持一致。
- SQLite 迁移 v3：新增 projects 与 tasks.projectId，原有任务自动归入默认项目，保留完成记录与子任务状态；浏览器内存实现同步支持项目。
- 增加真实内存 SQLite、浏览器数据层与异步状态回归验证，覆盖项目隔离、查看全部、循环任务拆分、任务移项、回收箱范围、共享打卡、旧库迁移、跨窗口通知及快速切换时的过期请求。

## [0.8.0] — 2026-09-20

### 新增
- 日历模式新增年月选择面板：点击左上角「2026年 9月」标题直接弹出年月面板（12 宫格选月，当前月高亮、今天所在月带圆点标记），面板内点击「2026年」可切换为年份宫格（12 年一页整页翻动、选中年高亮、今天所在年带圆点、范围 1900–2100 与农历数据表一致），选年后回月份宫格完成「选年 → 选月」两级跳转，比逐月翻页更快。面板通过 portal 渲染到 body——标题栏表面会重定义前景色变量（`.surface-header` 覆盖 `.text-foreground` 为红/金色系），面板留在 header 内会在浅色皮肤（如新年中国红）上出现文字不可读，portal 后所有皮肤文字对比度恢复正常；全部 6 套皮肤深浅实测核验。涉及文件：`src/components/calendar/CalendarHeader.tsx`、`src/store/useCalendarStore.ts`（新增 `goToMonth`）。

## [0.7.0] — 2026-09-20

### 新增
- 月视图日历格子展示法定节假日与调休安排：每个放假日日期旁显示红色「休」角标、调休补班的周末显示蓝色「班」角标；假期代表日（如除夕/春节、国庆节/中秋节，及各假期首日）额外显示红色节日名；鼠标悬浮角标弹出说明气泡（节日名、放假区间天数、补班日期）。数据为内置静态表（`src/lib/holidays.ts`，依据国办发明电〔2024〕7 号与〔2025〕7 号，覆盖 2025–2026 年，离线可用，新年度通知发布后追加规则即可）。角标与节日名颜色走新增主题令牌（`--holiday-bg/fg`、`--makeup-bg/fg`），全部 6 套皮肤深浅 12 个主题块逐一适配。涉及文件：`src/lib/holidays.ts`（新增）、`src/styles/globals.css`、`src/components/calendar/DayCell.tsx`。
- 日历模式（纯日历视图）：标题栏右侧新增切换按钮，点击后整页变为纯日历展示——月视图格子只保留日期、休/班角标与农历信息，不再显示任务/打卡日程，右侧任务侧边栏同步隐藏；再次点击（或点击「月/周」切换）退出并恢复原视图。格子副行展示农历日期、农历传统节日（春节/元宵/端午/七夕/中秋/重阳/腊八/除夕等）、公历节日（元旦/劳动节/国庆节等）与二十四节气，节日为红色、节气走各皮肤专属的节气色（新增 `--term-fg` 令牌，6 套皮肤深浅 12 个主题块逐一适配：中国红配铜绿、温暖原木配橄榄绿、蒸汽波配青绿等），主行为节日/节气时下方补一行农历日期。
- 农历/节气数据层：新增 `src/lib/lunar.ts` 与 `src/lib/lunar-data.ts`（内置 1900–2100 年历法表，构建期提取自开源项目 solarlunar 的权威数据并固化，MIT 许可已注明，不引入运行时依赖、离线可用）。换算结果已与 solarlunar 全量比对（1901–2099 共 72,000+ 天，农历月日/闰月/大小月 0 不一致，4,776 个节气日期全部正确）。原月视图与日历模式共用的休/班角标及其悬浮说明气泡抽取为 `HolidayBadge` 组件。

## [0.6.2] — 2026-09-14

### 新增
- 主界面完成任务与悬浮窗逻辑对齐：勾选完成任务（含循环任务与编辑弹窗等所有走 store 的入口）时，子任务一并划掉显示完成，与桌面悬浮窗行为一致。实现为 store 展示层联动（`useTaskStore` 的 `updateTask`/`updateOccurrence` 在完成时把本地子任务置为完成，不改动数据库子任务状态）；取消完成时非循环任务由 `updateTask` 返回数据库真实子任务状态自动恢复，循环任务由调用方（日历页 `loadData` / 任务总览 `fetchTasks`）重新拉取恢复。涉及文件：`src/store/useTaskStore.ts`、`src/pages/CalendarPage.tsx`、`src/components/sidebar/TaskOverviewPanel.tsx`。
- 沉淀仓库规范：`AGENTS.md` 通用开发规范新增第 11 条「待办完成逻辑全端一致」，后续涉及完成行为的改动必须逐界面核对全部入口并在 store/数据层收敛实现。

### 构建
- 版本号由 0.6.1 升级至 0.6.2（`package.json` / `package-lock.json` / `src-tauri/tauri.conf.json` / `src-tauri/Cargo.toml` / `src-tauri/Cargo.lock` 同步）。
- 同步发布用户端更新公告（`src/data/whatsNew.ts`），首次启动 0.6.2 自动弹出。

## [0.6.1] — 2026-09-14

### 修复
- 完成带子任务的任务后子任务消失：`updateTask` 返回值经 `getTaskById`/`mapTask` 组装、不含子任务，任务总览（store）会直接用该对象整体替换本地任务；而 Tauri 下数据变更通知只发给另一个窗口（避免当前窗口自身重复加载），主窗口不会重新拉取，导致周视图、日期详情弹窗、任务总览中勾选完成**非循环任务**后子任务整体消失且不恢复（月视图格子为紧凑模式本就不展示子任务；循环任务走 `updateOccurrence` 本地合并不受影响；悬浮窗本地合并子任务也不受影响）。现 `updateTask` 返回值附带子任务并按（子任务，截止日期）注入完成状态（SQLite 新增 `loadSubtasksWithState`，与 list 组装口径一致；内存实现同步刷新，改期迁移后状态不再过期）。涉及文件：`src/lib/db.ts`。

### 构建
- 版本号由 0.6.0 升级至 0.6.1（`package.json` / `package-lock.json` / `src-tauri/tauri.conf.json` / `src-tauri/Cargo.toml` / `src-tauri/Cargo.lock` 同步）。
- 同步发布用户端更新公告（`src/data/whatsNew.ts`），首次启动 0.6.1 自动弹出。

## [0.6.0] — 2026-09-14

### 新增
- 任务完成反馈动画：主界面与桌面悬浮窗勾选完成任务时，复选框对勾弹跳放大、任务行播放一圈绿色脉冲光晕，明确确认完成动作，不再是瞬间无反馈地消失/沉底。具体表现：月视图/周视图/日期详情弹窗的任务行完成瞬间播放动画后沉底；任务总览（待完成列表）中刚完成的任务原地保留 1.2 秒播完动画后再从列表移除；悬浮窗中刚完成的任务原地停留 1.2 秒后再沉底，且当日任务全部完成时在悬浮窗内撒花庆祝（与主窗口一致）。涉及文件：`src/lib/use-completion-feedback.ts`（新增）、`src/lib/confetti.ts`、`src/styles/globals.css`、`src/components/calendar/DayCellItem.tsx`、`src/components/sidebar/TaskOverviewPanel.tsx`、`src/widget/WidgetShell.tsx`、`src/widget/WidgetTaskList.tsx`。
- 子任务完成反馈动画：与母任务一致，各界面勾选子任务完成时对勾弹跳放大、子任务行播放绿色脉冲，宽限期内（1.2 秒）保持原位后再沉底到已完成分组；编辑弹窗内已保存子任务的勾选框同样有对勾弹跳反馈（初始已勾选的不重放）。涉及文件：`src/lib/use-completion-feedback.ts`（新增 `useJustCompletedMap`）、`src/components/calendar/DayCellItem.tsx`、`src/components/sidebar/TaskOverviewPanel.tsx`（抽出 `TaskSubtaskList` 组件）、`src/widget/WidgetTaskList.tsx`、`src/components/tasks/SubtaskInputList.tsx`。

### 构建
- 版本号由 0.5.1 升级至 0.6.0（`package.json` / `package-lock.json` / `src-tauri/tauri.conf.json` / `src-tauri/Cargo.toml` / `src-tauri/Cargo.lock` 同步）。
- 同步发布用户端更新公告（`src/data/whatsNew.ts`），首次启动 0.6.0 自动弹出。

## [0.5.1] — 2026-09-07

### 修复
- 任务改期后子任务完成状态被重置：子任务完成记录按（子任务，日期）存储，此前编辑弹窗把任务挪到其他日期（如昨天未完成任务挪到今天）时仅更新 `tasks.dueDate`，历史完成记录遗留在旧日期，新日期渲染查不到即显示为全部未完成。现 `updateTask` 在非循环任务改期时把该任务子任务的完成记录一并迁移到新日期（SQLite 与内存实现一致）；编辑弹窗内勾选状态变化也改写入新日期而非原截止日期，避免改期保存时勾选丢失。涉及文件：`src/lib/db.ts`、`src/components/tasks/TaskEditDialog.tsx`。

### 构建
- 版本号由 0.5.0 升级至 0.5.1（`package.json` / `package-lock.json` / `src-tauri/tauri.conf.json` / `src-tauri/Cargo.toml` / `src-tauri/Cargo.lock` 同步）。
- 同步发布用户端更新公告（`src/data/whatsNew.ts`），首次启动 0.5.1 自动弹出。

## [0.5.0] — 2026-09-04

### 新增
- 循环打卡支持按范围删除：打卡本质是循环任务，删除时与循环任务一样弹出范围选择（仅限此日程 / 此日程及此前所有 / 此日程及未来所有），不再直接整条删除。入口两处：打卡值编辑弹窗（日历格子点击打卡项弹出，四种类型共用）的「删除打卡」按钮；日历详情弹窗内打卡行悬停垃圾桶。数据层：`checkin_definitions` 新增 `skipDates` 列（迁移 v2）实现「仅此日程」单日跳过；「此前/未来所有」复用 `startDate`/`endDate` 前移，覆盖为空则整条归档；各界面按天过滤打卡统一收敛到 `checkinActiveOn`（含 skipDates 判定）。涉及文件：`src/components/checkins/CheckinValueDialog.tsx`、`BooleanCheckin.tsx`、`NumericCheckin.tsx`、`TimeCheckin.tsx`、`TextCheckin.tsx`、`src/components/calendar/DayDetailPopup.tsx`、`WeekView.tsx`、`DayCell.tsx`、`src/components/sidebar/TaskOverviewPanel.tsx`、`src/widget/WidgetShell.tsx`、`src/lib/utils.ts`、`src/lib/db.ts`、`src/store/useCheckinStore.ts`、`src/api/index.ts`、`src/lib/ipc-bridge.ts`、`src/shared/ipc-channels.ts`、`src/shared/types.ts`、`docs/schema.md`。

### 修复
- 任务总览「新增」改为弹出居中新建弹窗：此前点击侧栏「+ 新增」在任务总览面板内内联展开新建表单，宽度受限、信息展示不全。现与编辑弹窗一致，统一弹出居中「新建任务」弹窗（含标题、截止日期、优先级、重复规则、子任务与备注），每次打开重置表单并预填侧栏当前选中日期，并移除侧栏内联新建表单相关代码。涉及文件：`src/components/tasks/TaskCreateDialog.tsx`（新增）、`src/components/sidebar/TaskOverviewPanel.tsx`。

### 构建
- 版本号由 0.4.1 升级至 0.5.0（`package.json` / `package-lock.json` / `src-tauri/tauri.conf.json` / `src-tauri/Cargo.toml` / `src-tauri/Cargo.lock` 同步）。
- 同步发布用户端更新公告（`src/data/whatsNew.ts`），首次启动 0.5.0 自动弹出。

## [0.4.1] — 2026-09-02

### 修复
- 任务总览编辑按钮改为弹出居中编辑弹窗：此前非循环任务点击铅笔按钮在侧边栏内展开行内编辑表单，宽度受限、信息展示不全。现与循环任务一致，统一弹出居中「编辑任务」弹窗（含标题、截止日期、优先级、重复规则、子任务拖拽排序与备注），并移除行内编辑表单相关代码。涉及文件：`src/components/sidebar/TaskOverviewPanel.tsx`。

### 构建
- 版本号由 0.4.0 升级至 0.4.1（`package.json` / `package-lock.json` / `src-tauri/tauri.conf.json` / `src-tauri/Cargo.toml` / `src-tauri/Cargo.lock` 同步）。
- 同步发布用户端更新公告（`src/data/whatsNew.ts`），首次启动 0.4.1 自动弹出。

## [0.4.0] — 2026-09-02

### 新增
- 循环任务删除新增「此日程及此前所有」范围：删除范围弹窗（仅删除模式）在「仅限此日程」与「此日程及未来所有」之间新增该选项，选中后删除该日期（含）之前的所有循环，之后的循环保持不变。因循环规则以 `dueDate` 为锚点（weekly/monthly 依赖锚日星期/日期），实现为把此前循环日批量标记 `isSkipped`（展开与统计均不再生成/计入），若所选日期已覆盖序列末尾则整条任务移入回收站。涉及文件：`src/components/tasks/RecurringChangeDialog.tsx`、`src/components/tasks/TaskEditDialog.tsx`、`src/store/useTaskStore.ts`、`src/api/index.ts`、`src/lib/ipc-bridge.ts`、`src/shared/ipc-channels.ts`、`src/lib/db.ts`（新增 `deleteBeforeDate`，SQLite 与内存实现）。

### 修复
- 点击循环任务的删除按钮误开编辑弹窗：任务总览侧栏与日历详情弹窗中，循环任务的垃圾桶按钮此前与编辑按钮共用同一处理（打开「编辑循环任务」弹窗），需再点弹窗内「删除」才能进入删除流程。现垃圾桶直接弹出「删除重复任务」范围选择（仅限此日程 / 此日程及此前所有 / 此日程及未来所有），确认即删；任务总览删除后按当前可见范围刷新列表。三处删除入口（编辑弹窗内删除、侧栏垃圾桶、日历详情垃圾桶）统一走 `applyRecurringDelete` 助手，范围→动作映射单一来源。涉及文件：`src/components/tasks/recurringActions.ts`（新增）、`src/components/tasks/TaskEditDialog.tsx`、`src/components/sidebar/TaskOverviewPanel.tsx`、`src/components/calendar/DayDetailPopup.tsx`。
- 删除范围弹窗日期兜底值为空串导致启动白屏：`DayDetailPopup` 向 `RecurringChangeDialog` 传入的 `occurrenceDate` 兜底为空字符串，弹窗组件渲染期无条件 `format(parseISO(...))` 抛 `Invalid time value`，整树渲染失败。现调用方兜底为当天日期，组件内对日期解析增加 `isValid` 守卫。涉及文件：`src/components/calendar/DayDetailPopup.tsx`、`src/components/tasks/RecurringChangeDialog.tsx`。

### 构建
- 版本号由 0.3.11 升级至 0.4.0（`package.json` / `package-lock.json` / `src-tauri/tauri.conf.json` / `src-tauri/Cargo.toml` / `src-tauri/Cargo.lock` 同步）。本版本起版本规则明确：带新功能的发布进位次版本（x.Y.0），纯修复进位修订号（x.y.Z）。
- 同步发布用户端更新公告（`src/data/whatsNew.ts`），首次启动 0.4.0 自动弹出。

## [0.3.11] — 2026-09-02

### 修复
- 拖拽排序无法直达列表首尾位置：此前拖拽位移钳制在首/末行中线处，而落点判定要求行中线严格越过阈值，导致拖到最上/最下时永远差一点触发不了——其余行不让位（无排序动画）且被拖行与首/末行重合。现改为按行边缘钳制并留 2px 越界余量，首尾落点可正常触发，被拖行贴合目标槽位。涉及文件：`src/components/tasks/SubtaskInputList.tsx`。

### 构建
- 版本号由 0.3.10 升级至 0.3.11（`package.json` / `package-lock.json` / `src-tauri/tauri.conf.json` / `src-tauri/Cargo.toml` / `src-tauri/Cargo.lock` 同步）。
- 同步发布用户端更新公告（`src/data/whatsNew.ts`），首次启动 0.3.11 自动弹出。
- 说明：该修复此前曾以 0.3.10 二次交付（见 `docs/build-notes.md`），现随 0.3.11 正式发布。

## [0.3.10] — 2026-09-02

### 新增
- 子任务支持拖拽排序：子任务列表每行新增拖拽手柄（竖向握把图标），按住上下拖动即可调整顺序，拖拽中被拖行跟手移动、其余子任务平滑让位；松开后立即生效并随保存写入 `sortOrder`，日历详情、悬浮窗等展示处同步生效。任务编辑弹窗、任务创建侧栏、侧边栏任务面板、任务总览的新建/编辑、日历详情弹窗与悬浮窗共 7 处入口全部生效。基于指针事件自实现（拖拽开始缓存行矩形，期间不读 DOM），无新增依赖。涉及文件：`src/components/tasks/SubtaskInputList.tsx`。

### 修复
- 编辑循环任务时不显示子任务：`TaskEditDialog` 此前在循环任务模式下隐藏了子任务区块，且循环保存路径（仅此次/此后全部）不处理子任务。现循环任务编辑弹窗同样展示子任务列表（可勾选、可拖拽排序），保存时随所选范围应用：「仅此次」拆出的单次任务带上编辑后的子任务及当天勾选状态；「此后全部」新序列带上子任务，并按原子任务 id 把起始日期之后的完成记录迁移到新序列（保留历史进度，当天以弹窗状态为准）；起始日当天选「此后全部」时为同序列原地更新（按 id 保留完成记录）。涉及文件：`src/components/tasks/TaskEditDialog.tsx`、`src/store/useTaskStore.ts`、`src/api/index.ts`、`src/lib/db.ts`、`src/shared/types.ts`（新增 `SubtaskPatchItem`）。

### 构建
- 版本号由 0.3.9 升级至 0.3.10（`package.json` / `package-lock.json` / `src-tauri/tauri.conf.json` / `src-tauri/Cargo.toml` / `src-tauri/Cargo.lock` 同步）。
- 同步发布用户端更新公告（`src/data/whatsNew.ts`），首次启动 0.3.10 自动弹出。

## [0.3.9] — 2026-09-01

### 修复
- 编辑任务弹窗中子任务不展示完成状态：子任务项前新增勾选框（绿色勾选 + 删除线置灰，样式与日历/侧边栏一致），可点击切换，保存时通过 `toggleSubtask` 按任务原截止日期同步到 `subtask_occurrences`；新建任务时的子任务因尚未持久化不显示勾选框。涉及文件：`src/components/tasks/SubtaskInputList.tsx`、`src/components/tasks/TaskEditDialog.tsx`。

### 构建
- 版本号由 0.3.8 升级至 0.3.9（`package.json` / `package-lock.json` / `src-tauri/tauri.conf.json` / `src-tauri/Cargo.toml` / `src-tauri/Cargo.lock` 同步）。
- 同步发布用户端更新公告（`src/data/whatsNew.ts`），首次启动 0.3.9 自动弹出。

## [0.3.8] — 2026-08-28

### 新增
- 皮肤列表新增「蒸汽波 Vaporwave」（`skin-vapor`，取自 UI 画廊风格 35，含浅色/深色）：浅色为马卡龙粉紫青 pastel 色盘 + 三处柔光；深色为霓虹深紫夜色 + 电光蓝网格地平线 + 粉青渐变点缀（进度条与图表渐变同步粉青化）。
- 涉及文件：`src/styles/globals.css`（新增 `.skin-vapor` / `.dark.skin-vapor` 两组变量）、`src/lib/skin.ts`（注册 `vapor`）、`src/components/layout/SkinSwitcher.tsx`（新增预览色卡）、`src/lib/skin.test.ts`（断言更新为 6 款皮肤）。

### 构建
- 版本号由 0.3.7 升级至 0.3.8（`package.json` / `package-lock.json` / `src-tauri/tauri.conf.json` / `src-tauri/Cargo.toml` / `src-tauri/Cargo.lock` 同步）。
- 同步发布用户端更新公告（`src/data/whatsNew.ts`），首次启动 0.3.8 自动弹出。

## [0.3.7] — 2026-08-28

### 新增
- 皮肤列表新增两款（均含浅色/深色双模式，取自 UI 画廊风格 13「新年中国红」与风格 30「报纸印刷」）：
  - 新年中国红（`skin-cny`）：浅色为象牙纸底 + 朱红鎏金、宋体标题、红金渐变标题栏；深色为朱漆夜宴檀木黑底，页面带朱红/鎏金氛围光。
  - 报纸印刷（`skin-press`）：浅色为新闻纸米白 + 衬线字体 + 墨黑主色、锐利小圆角，红色仅作点缀；深色为油墨黑纸面 + 象牙白铅字、象牙色标题栏分割线。
- 涉及文件：`src/styles/globals.css`（新增 `.skin-cny` / `.dark.skin-cny` / `.skin-press` / `.dark.skin-press` 四组变量）、`src/lib/skin.ts`（注册 `cny`、`press`）、`src/components/layout/SkinSwitcher.tsx`（新增两张预览色卡）、`src/lib/skin.test.ts`（断言更新为 5 款皮肤）。

### 构建
- 版本号由 0.3.6 升级至 0.3.7（`package.json` / `package-lock.json` / `src-tauri/tauri.conf.json` / `src-tauri/Cargo.toml` / `src-tauri/Cargo.lock` 同步）。
- 同步发布用户端更新公告（`src/data/whatsNew.ts`），首次启动 0.3.7 自动弹出。

## [0.3.6] — 2026-08-28

### 优化
- 升级安装默认直接覆盖：检测到已安装旧版本时，安装页面选项调整为第一行"覆盖旧版本并升级"（默认选中，直接覆盖安装、自动停止旧进程并清理安装目录，用户数据目录不受影响），第二行"安装前卸载"（仍可手动选择）；同版本重装页保持原默认（"添加/重新安装组件"）。

### 构建
- 版本号由 0.3.5 升级至 0.3.6（`package.json` / `package-lock.json` / `src-tauri/tauri.conf.json` / `src-tauri/Cargo.toml` / `src-tauri/Cargo.lock` 同步）。
- 引入自定义 NSIS 模板 `src-tauri/windows/installer.nsi`（基于 `tauri-cli-v2.11.4` 官方模板最小改动，经 `bundle.windows.nsis.template` 启用）：仅调整重装选择页的默认勾选项；升级 `@tauri-apps/cli` 时必须用对应 tag 重新同步模板，并通过构建后 diff 生成脚本核验。
- 同步发布用户端更新公告（`src/data/whatsNew.ts`），首次启动 0.3.6 自动弹出。

## [0.3.5] — 2026-08-28

### 修复
- 修复新建任务后子任务不显示的问题：`createTask` 写入子任务后返回的任务对象此前不携带 `subtasks`，主窗口 store 直接使用该对象渲染且当前窗口不会重新加载数据，导致新建任务在下次整体刷新前看不到子任务；现在返回值附带子任务列表（SQLite 与浏览器降级两套实现同步修复），数据库中的历史数据未受影响。
- 修复在子任务输入框按回车触发整个表单隐式提交的问题：子任务框回车现在只确认当前条目，若该行有内容且是最后一行则自动追加下一行并聚焦，不再误创建任务；任务标题框的回车提交行为保持不变。

### 构建
- 版本号由 0.3.4 升级至 0.3.5（`package.json` / `package-lock.json` / `src-tauri/tauri.conf.json` / `src-tauri/Cargo.toml` / `src-tauri/Cargo.lock` 同步）。
- 同步发布用户端更新公告（`src/data/whatsNew.ts`），首次启动 0.3.5 自动弹出。

## [0.3.4] — 2026-08-27

### 修复
- 修复重启后桌面悬浮窗缩放尺寸恢复默认值的问题：启动时重新应用用户保存的悬浮窗宽度与高度。
- 修复悬浮窗点击“打开主窗口”无法恢复已最小化主窗口的问题：调用窗口取消最小化并补充 `core:window:allow-unminimize` 权限。
- 修复主窗口日历待办悬停气泡在鼠标移出后偶发残留的问题：增加指针位置、离开窗口与窗口失焦时的兜底清理。

### 构建
- 版本号由 0.3.3 升级至 0.3.4（`package.json` / `package-lock.json` / `src-tauri/tauri.conf.json` / `src-tauri/Cargo.toml` / `src-tauri/Cargo.lock` 同步）。
- 同步发布用户端更新公告（`src/data/whatsNew.ts`），首次启动 0.3.4 自动弹出。

## [0.3.3] — 2026-08-26

### 工具
- 新增旧版 daily-calendar 数据迁移脚本 `scripts/migrate-daily-calendar.ps1` 与根目录入口 `迁移数据.cmd`：直接读取 `%APPDATA%\daily-calendar\calendar.db`，支持任务、重复任务记录、打卡定义/记录、备注、成就与配置迁移；使用 Windows 自带 `winsqlite3.dll`，无需 Node.js、npm 或第三方依赖。
- 目标库已有数据时会询问覆盖或合并导入：覆盖前自动备份并输出 SHA256，合并导入按源数据 ID 防止重复追加。

### 优化
- 日历格子的快捷新建任务改为屏幕居中弹出，不再从右侧滑出。

### 修复
- 修复迁移脚本的交互输入等待方式，输入 Y/N 后回车现在可正常响应。
- 修复温暖原木浅色模式下高优先级任务完成按钮对比度不足的问题：未完成方框改用高优先级前景色描边与浅色填充，日历和悬浮窗同步调整。
- 修复温暖原木浅色模式下子任务完成框与“打卡任务”Tab 对比度不足的问题，主界面与悬浮窗子任务同步调整。
- 修复新拟态、极简黑白浅色模式下悬浮窗待办任务完成按钮不明显的问题：按任务优先级前景色显示描边和浅色填充。

### 构建
- 版本号由 0.3.2 升级至 0.3.3（`package.json` / `package-lock.json` / `src-tauri/tauri.conf.json` / `src-tauri/Cargo.toml` / `src-tauri/Cargo.lock` 同步）。
- 同步发布用户端更新公告（`src/data/whatsNew.ts`），首次启动 0.3.3 自动弹出。

## [0.3.2] — 2026-08-25

### 优化
- 完成当天所有任务时恢复多波彩带庆祝效果（约 200 粒子、5 波爆发），成就解锁保留小号彩带。
- 测试窗口启动脚本自动检测源码/配置/dist 是否新于 release exe；过期时自动执行 `npm run tauri build -- --no-bundle` 并启动最新测试版，不生成安装包。

### 修复
- 开关型打卡只保留右侧 Switch 开关，移除左侧重复勾选框。

### 构建
- 版本号由 0.3.1 升级至 0.3.2（`package.json` / `package-lock.json` / `src-tauri/tauri.conf.json` / `src-tauri/Cargo.toml` / `src-tauri/Cargo.lock` 同步）。
- 同步发布用户端更新公告（`src/data/whatsNew.ts`），首次启动 0.3.2 自动弹出。
- 新增 `canvas-confetti` 依赖用于复刻源项目完成效果，安装包体积保持 5~10 MB 目标内。
- 新增 `scripts/check-test-build-stale.mjs`，测试窗口脚本自动确保打开最新测试版。

## [0.3.1] — 2026-08-25

### 修复
- 修复测试数据误写正式库的问题：测试模式与正式模式彻底分离，测试模式使用独立 `test-calendar.db`，正式模式使用 `calendar.db`；主窗口与悬浮窗统一按当前模式选择数据库，示例数据只由主窗口写入一次，避免悬浮窗并发重复；测试模式不注册单实例，可与正式版并行运行。
- 正式库启动时自动清理历史测试数据：检测到旧版测试标记 `testDataSeededAt` 后，删除对应测试任务、子任务、打卡定义与记录、示例备注及标记，正式用户任务、打卡、备注和设置不受影响。

### 构建
- 版本号由 0.3.0 升级至 0.3.1（`package.json` / `package-lock.json` / `src-tauri/tauri.conf.json` / `src-tauri/Cargo.toml` / `src-tauri/Cargo.lock` 同步）。
- 同步发布用户端更新公告（`src/data/whatsNew.ts`），首次启动 0.3.1 自动弹出。
- 安装包不再捆绑任何数据库或用户数据；新旧版本迭代升级时，安装器会先停止旧进程、清空安装目录再写入新版本文件，应用数据目录中的正式库保留不变。

## [0.3.0] — 2026-08-25

### 换肤（参考稿适配，不改功能）
- 极简留白：浅色为近纯白留白 + 极细灰边；深色采用参考稿 02 纯黑 OLED，黑色表面 + 蓝色强调。
- 新拟态：浅色为灰蓝拟态双阴影；深色为深灰蓝底，卡片和控件保留凹凸软阴影，任务卡片使用 0.75rem 圆角。
- 温暖原木：浅色为米白纸张 + 原木纹理；深色为深咖啡背景；标题栏、侧栏与主区沿用参考稿 15 的暖棕层级与楷体标题。
- 顶部换肤入口保留衣服图标，使用非模态 Popover；浅色 / 深色 / 跟随系统与三套皮肤在同一弹层内切换，主窗口与悬浮窗通过既有主题 / 皮肤推送实时同步。

### 新增
- 按 `styles-gallery` 参考稿将皮肤收敛为 3 套：极简留白（`minimal`）、新拟态（`neu`）、温暖原木（`warm-wood`）；每套支持浅色/深色，并同步适配主窗口与桌面悬浮窗，默认皮肤为极简留白（`skin.ts` / `SkinSwitcher.tsx` / `theme.tsx` / `globals.css`）。
- 新增语义化皮肤令牌与工具类：覆盖表面、边框、日历格子、任务优先级、打卡、控件、阴影、纹理、字体与圆角，组件不再写死颜色，切换皮肤无需修改业务代码（`globals.css` / `DayCell` / `DayCellItem` / `WidgetShell` 等）。
- 悬浮窗支持边缘/角部拖动缩放：`src-tauri/src/floating.rs` 开启 `resizable`，前端 `WidgetShell` 增加 8 个透明缩放手柄（四边 + 四角），缩放尺寸通过 `onResized` 持久化；新增 `core:window:allow-start-resize-dragging` 权限。
- 导入旧版数据工具（`导入旧版数据.exe`）交互升级：新版数据库已有数据（或检测到已导入过）时，交互式终端下会提示“是否确认清空新版数据并覆盖导入？”，确认（Y）后直接清空并导入，取消（N）则中止且不修改任何数据；`--force` 仍可跳过确认。
- 测试模式新增完整示例数据：通过 `启动测试窗口.bat` 启动时，首次自动写入高/中/低/无优先级任务、已完成/失败任务、子任务、每日/每周/每月重复任务，以及布尔/数值/文字/时间打卡、近 14 天记录和每日备注（`db.ts` / `commands.rs` / `启动测试窗口.bat`）。

### 优化
- 换肤弹层改为非模态 Popover：不再渲染全屏遮罩，打开后仍可操作主界面，点击外部自动收起（`SkinSwitcher.tsx`）。
- 非本月日期统一改为中性灰底并移除额外透明度；选中日期弱化为 25% 淡底 + 1px 细边，日期数字不再使用独立底色（`DayCell` / `WeekView` / `globals.css`）。
- 日历格子三态视觉重新定义：非本月灰底且内容弱化、当天主题浅底 + 顶部渐变条、选中主题色底 + 2px 内圈；状态优先级为 选中 > 今天 > 非本月（`dayCellState.ts` / `DayCell` / `WeekView`）。
- 日历格子三种底色重新区分且保持浅色：非当月灰 `bg-muted/10`、当天极浅靛蓝 `bg-primary/5`、选中改为浅靛蓝 `bg-primary/10` + 1px 靛蓝内圈线（`DayCell`），选中不再与当天同色。
- 低优先级（蓝色）任务行底色与优先级点/文字由 `blue` 改为天蓝 `sky` 色系，与靛蓝主题底色拉开色相距离、更易区分（`DayCellItem` / `constants`）。
- 透明度滑块改为可拖动：修复滑块圆形把手遮挡 range 输入导致无法拖动的问题（`src/components/ui/slider.tsx` 把手增加 `pointer-events-none`）。
- 开关型打卡增加 Switch 开关交互：`BooleanCheckin` 右侧新增可见的开关按钮，整卡点击仍可切换，用户不再需要猜测“可以点击”这件事。
- 开关型打卡在日历格子内改为“圆圈开关”交互（`CheckinPreviewRow`）：未打卡为空心圆，点击后变为薄荷绿实心圆加对勾，可直接在月/周视图格子中打卡或取消，无需进入弹窗。
- 非当月日期的数字颜色透明度从 40% 降为 20%（更淡，`DayCell`）；格子内待办溢出时，左下角新增醒目的“N 更多”胶囊按钮（固定在格子左下角，不再被裁剪）。
- 非当月格子的背景色从 `bg-muted/40` 再减淡一半为 `bg-muted/20`（`DayCell`）。
- 开关型打卡改为“点开再完成”：日历格子上点击布尔打卡不再直接切换，而是打开打卡弹窗（含 Switch 开关）在弹窗内完成（`CalendarPage` / `DayCellItem`）。
- 日历格子上的待办事项与打卡任务样式区分：待办为优先级彩色底 + 复选框，打卡为靛蓝描边胶囊 + CalendarCheck 图标 + 浅靛蓝底（`DayCellItem`）。
- 日历格子的选中/当天效果重做（`DayCell`）：选中格子去掉内圈线，改为纯靛蓝淡底 + 日期数字浅靛蓝圆底；当天日期徽章去掉渐变与光晕，改为纯靛蓝实心圆白字；非当月格子底色再浅 40%（`bg-muted/20` → `bg-muted/12`）。
- 日历格子三种底色进一步区分且更浅：非当月灰 `bg-muted/10`、当天靛蓝 `bg-primary/5`、选中靛蓝 `bg-primary/15`（`DayCell`）。
- 低优先级（蓝色）任务行底色由 `bg-blue-100/80` 加深为 `bg-blue-200/70`，与格子底色/打卡行明显区分（`DayCellItem`）。
- 修复日历格子“满格堆叠”：事项行数按格子实际可用高度动态计算（ResizeObserver），溢出“更多”按钮改回流内布局、固定在左下角，窗口缩放时不再压住最后一行或产生重叠（`DayCell`）。
- 修复温暖原木浅色主题标题栏与侧栏深色面板上的深色文字无法辨认问题：为标题栏、侧栏与悬浮窗补充独立前景色，并重新校准强调色与弱化文字对比度（`globals.css`）。
- 修复悬浮窗低透明度时待办卡片仍保持不透明的问题：透明度现在作用于整个悬浮窗内容；同时移除窗口外阴影与原生阴影（`WidgetShell.tsx` / `floating.rs`）。

### 改版（纯 UI 样式，不改变任何功能）
- 整体视觉按参考稿（Focusday 风格）调整：主色由紫罗兰改为靛蓝（`#5060F0` 系），成功色改为薄荷绿，亮色底改为灰蓝 `#F5F7FB` + 白色卡片，阴影由紫色光晕改为柔和中性；暗色主题改为深邃蓝黑底 + 靛蓝点缀（`src/styles/globals.css` 全部设计令牌）。
- 日历月视图改为“扁平、挨着的白色格子”：去掉圆角、阴影与格子间距，用 1px 发丝分隔线划分，网格占满整个日历区域（不再留左右边距），星期表头同步对齐（`MonthView` / `DayCell`）；“今天”按钮改为浅靛蓝胶囊（`CalendarHeader`）。

### 工具
- `启动测试窗口.bat` 改为优先直接启动已构建好的 `calendar-tauri.exe`（秒开）；未构建时自动执行 `npm run tauri build -- --no-bundle`，并使用项目内 `src-tauri/target` 作为缓存，避免依赖已失效的 F 盘构建缓存。

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
- 修复三套皮肤的细节配色：深色极简留白周选项卡复选框边框更醒目、待办底色由椭圆改回长方形圆角、温暖原木浅色任务卡文字改为配套前景色；日历、侧栏与悬浮窗同步使用同一套任务底色和前景色。
- 打卡值弹窗支持回车直接确认并关闭；数值/文字型输入回车会立即提交（不再受防抖延迟影响）；打卡组件表单的单位输入框回车可直接保存。
- 修复时间型打卡无法调出时间选择器：时间输入框点击时主动调用 `showPicker`，并增加时钟按钮，主界面与悬浮窗统一生效。
- 开关型打卡可直接在日历格子上点击切换完成状态，无需再打开弹窗。
- 更新公告措辞简化：调整为与常规 App 更新公告一致的简短描述。
- 修复数值型打卡（如体重）输入数值后界面白屏卡死：`checkins:upsertEntry` 桥接层未返回写入结果，store 把 `undefined` 写进打卡记录导致渲染崩溃；现桥接层返回最新打卡记录，并在 store 增加空结果防御。
- 数值型打卡输入不允许负值：主界面与悬浮窗的数值输入框均禁止以 `-` 开头的输入，并设置 `min=0`。
- 修复悬浮窗置顶状态失效：之前悬浮窗创建和托盘/快捷键重新显示时都会无条件置顶，且前端启动时只更新按钮状态、未应用到窗口，导致“没有开置顶却仍然置顶”。现将置顶偏好同步到 Rust 状态，创建、显示、启动、切换时统一按保存的偏好应用。

### 构建
- 版本号统一升级至 0.3.0（`package.json` / `package-lock.json` / `src-tauri/tauri.conf.json` / `src-tauri/Cargo.toml` / `src-tauri/Cargo.lock` 同步）。
- 同步发布用户端更新公告（`src/data/whatsNew.ts`），首次启动新版本自动弹出。
- 新增安装包交付规范：构建产物统一复制到项目根目录 `安装包/`，不自动启动安装包或测试窗口。

### 规划中
- 任务提醒（系统通知）
- 数据导出/导入（JSON/CSV）

## [0.2.0] — 2026-08-23

### 换肤（参考稿适配，不改功能）
- 极简留白：浅色为近纯白留白 + 极细灰边；深色采用参考稿 02 纯黑 OLED，黑色表面 + 蓝色强调。
- 新拟态：浅色为灰蓝拟态双阴影；深色为深灰蓝底，卡片和控件保留凹凸软阴影，任务卡片使用 0.75rem 圆角。
- 温暖原木：浅色为米白纸张 + 原木纹理；深色为深咖啡背景；标题栏、侧栏与主区沿用参考稿 15 的暖棕层级与楷体标题。
- 顶部换肤入口保留衣服图标，使用非模态 Popover；浅色 / 深色 / 跟随系统与三套皮肤在同一弹层内切换，主窗口与悬浮窗通过既有主题 / 皮肤推送实时同步。

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

### 换肤（参考稿适配，不改功能）
- 极简留白：浅色为近纯白留白 + 极细灰边；深色采用参考稿 02 纯黑 OLED，黑色表面 + 蓝色强调。
- 新拟态：浅色为灰蓝拟态双阴影；深色为深灰蓝底，卡片和控件保留凹凸软阴影，任务卡片使用 0.75rem 圆角。
- 温暖原木：浅色为米白纸张 + 原木纹理；深色为深咖啡背景；标题栏、侧栏与主区沿用参考稿 15 的暖棕层级与楷体标题。
- 顶部换肤入口保留衣服图标，使用非模态 Popover；浅色 / 深色 / 跟随系统与三套皮肤在同一弹层内切换，主窗口与悬浮窗通过既有主题 / 皮肤推送实时同步。

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

[0.3.2]: 完成特效复刻与开关型打卡修复版（2026-08-25）
[0.3.1]: 数据隔离与安装包交付修正版（2026-08-25）
[0.3.0]: 三套皮肤系统与悬浮窗体验版（2026-08-25）
[0.2.0]: 体验优化与问题修复版（2026-08-23）
[0.1.0]: 初始版本（2026-08-23）
