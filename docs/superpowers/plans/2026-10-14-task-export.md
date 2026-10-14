# 未完成任务导出 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. 如用户明确选择并行代理，可用 superpowers:subagent-driven-development；本交接不自行授权启动其他模型。Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按已确认样式，在主窗口导出所有符合规则的未完成任务及全部子任务为真实 PDF，并支持可选循环任务。

**Architecture:** 全量只读查询经统一选择器生成快照；弹窗预览和 PDF 共用一个 HTML/CSS 渲染器。Rust 通过保存对话框与 Windows WebView2 输出 PDF，单作业处理取消、错误与临时文件清理。

**Tech Stack:** Tauri v2、React 19、TypeScript、Vite 6、Tailwind CSS v4、现有 Radix/Zustand/date-fns、SQLite、WebView2。

**Spec:** [2026-10-14-task-export-design.md](../specs/2026-10-14-task-export-design.md)。执行前读完该设计与[快速交接](../../handoffs/2026-10-14-task-export.md)，不要只看任务标题。

## Global Constraints

- 工作目录 E:/原生日历项目；遵守根 AGENTS.md 及内层指令。
- 数据全部本地存储（SQLite），无后端服务，隐私优先。
- “任务/子任务的完成状态是联动语义”，本功能只读，不能修改数据库完成状态或现有五个界面的完成逻辑。
- UI 文案使用简体中文，代码注释/提交说明用中文。
- 优先 Tailwind 工具类与语义令牌；禁止在组件中散落固定颜色值，不大改 src/components/ui 生成物。
- 安装包目标体积 5~10 MB；新增依赖先评估；不捆绑数据库、用户数据、示例 PDF、Chromium 或完整 CJK 字库。
- 正式模式 calendar.db；测试模式 test-calendar.db，由 CALENDAR_TEST_MODE=1 触发；打印窗不得初始化数据库。
- “禁止由代理自动运行安装包或启动测试窗口”；完整 UI 原生操作由用户在测试窗口执行。
- 不直接在 main 分支 git push；本任务不包含推送和正式发布。
- 无表结构变化，无需迁移或 user_version 递增；不得顺手重构无关模块。

## Review Focus

1. 默认不勾选循环任务时，排除整个循环任务，而非仅隐藏重复标记；任务 2/3/6 覆盖。
2. 全量导出不能漏掉当前 store 未加载的项目、月份、远期和逾期普通任务；任务 3 覆盖。
3. 同一个循环任务在不同日期的子任务状态不能串日，母任务未完成但子任务全完成仍须纳入；任务 2/3 覆盖。
4. 原生打印尚未实测，隐藏页空白、字体未就绪、重复点击和超时迟到回调不能被当作成功；任务 1/6/7 覆盖。
5. 长清单、单母任务跨页、跨年和特殊字符不能裁切、漏项、产生额外页脚页或执行任务文本；任务 4/7 覆盖。

---

## 0. 基线与文件职责

交接检查时分支为 codex/release-0.3.4，HEAD 为 22818c6，应用版本 0.10.0。执行前重查，不用历史值覆盖当前状态。样式稿、PDF、说明及 CHANGELOG/PROJECT_MAP 改动尚未提交；.zcode/ 为既有未跟踪目录，不属于本需求。

| 文件 | 动作 | 职责 |
| --- | --- | --- |
| src/lib/task-export-model.ts | 新建 | 设计中的 DTO、选择函数、循环候选与统计 |
| src/lib/task-recurrence.ts | 新建 | 提取现有 matchesRecurrence，不改行为 |
| src/lib/task-export-query.ts | 新建 | 单条 SQL 原始快照读取和类型规范化 |
| src/lib/db.ts | 修改 | Db/SqliteDb/MemoryDb 的全量导出入口；保留原完成逻辑 |
| src/lib/task-export-document.ts | 新建 | 唯一的静态 HTML 文档渲染器与文本转义 |
| src/styles/task-export-document.css | 新建 | 文档固定浅色令牌、A4 和分页样式 |
| src/components/tasks/TaskExportDialog.tsx | 新建 | Radix 弹窗、循环选项、快照预览、刷新和状态 |
| src/components/sidebar/TaskOverviewPanel.tsx | 修改 | 下载图标和新弹窗挂载，不改原筛选/完成处理 |
| src/store/useTaskStore.ts | 修改 | fetchExportSnapshot 返回快照，不覆盖 tasks |
| src/api/index.ts | 修改 | tasksApi.exportSnapshot、systemApi.exportTaskPdf |
| src/shared/ipc-channels.ts | 修改 | TASKS_EXPORT_SNAPSHOT / SYSTEM_EXPORT_TASK_PDF |
| src/lib/ipc-bridge.ts | 修改 | 数据查询路由和桌面保存路由，浏览器正确降级 |
| src-tauri/src/task_export.rs | 新建 | 命令、主窗校验、保存对话框、作业与结果 |
| src-tauri/src/task_export/windows.rs | 新建 | WebView2 就绪、打印与回调适配 |
| src-tauri/src/lib.rs | 修改 | 注册插件/命令/作业状态、过滤打印窗状态记忆 |
| src-tauri/Cargo.toml、Cargo.lock | 修改 | 同版本 COM/异步依赖、保存对话框，记录体积评估 |
| src-tauri/capabilities/default.json | 检查 | Rust 内调用通常无需新增权限，禁止扩大为全量 fs/dialog |
| src/lib/task-export-model.test.ts | 新建 | 纯选择规则与日期/统计测试 |
| src/lib/db-task-export.test.ts | 新建 | 真实内存 SQLite 与 MemoryDb 对照 |
| src/lib/task-export-document.test.ts | 新建 | 特殊文本、内容完整性与页码/静态性 |
| docs/task-export-validation.md | 新建 | 原生输出、分页、用户操作结果及未验证项 |
| CHANGELOG.md、PROJECT_MAP.md | 修改 | 实现后登记真实功能，保留设计史 |

以上新源文件现在不存在。当前阶段只交付文档；不要误以为接口已经实现。

建议按任务单独形成中文提交，只提交该任务文件。对于已有未提交改动先核对来源，不用 git add . 把 .zcode/ 或其他功能一起纳入；未提交的设计资产必须保留下来或随交接复制。

## Task 1: 原生 PDF 输出适配器

**Files:** 创建两个 task_export Rust 文件；修改 Cargo.toml/lock、lib.rs；记录 docs/task-export-validation.md。Rust 测试放在本模块中。

**Interfaces:**
- 消费设计中的 TaskPdfRequest：html、defaultFileName。
- 产出命令 export_task_pdf(app, window, request, state) -> Result<TaskPdfResult, String>，serde camelCase 字段、status=saved/cancelled。
- Windows 内部函数 render_html_to_pdf(app, html, temporary_pdf_path) -> Future<Result<(), String>>，只在回调成功后返回。
- 后续任务使用同一命令，不直接传入任意最终保存路径。

- [ ] **Step 1: 写失败用例。** 测试名称与断言：拒绝非 main 调用；默认名 ../a.pdf、目录路径或非 PDF 扩展名无效；取消返回 cancelled 且创建文件数为 0；单作业重复请求返回忙碌；模拟错误/超时释放守卫；打印失败不替换已有文件。给保存/打印结果注入测试边界，不能在单元测试里弹系统窗口。
- [ ] **Step 2: 验证失败。** 运行 cargo test --manifest-path src-tauri/Cargo.toml task_export；新接口缺失导致失败，避免预先写假成功适配器。
- [ ] **Step 3: 配置必要依赖。** Windows 直接引用 webview2-com =0.38.2、windows-core =0.61.2、tokio =1.53.1（sync/time），复用现有锁版本；保存插件先固定 tauri-plugin-dialog =2.3.3，仅 Rust 注册。现 Cargo.toml 的 rust-version=1.77，已锁 Tauri 的真实声明是 1.77.2；若调整声明，只校正为 1.77.2，不能顺便升到 1.90 或升级 CLI/NSIS 模板。用 cargo tree 核对版本与依赖新增，记录不能据此保证整个现有依赖树的 MSRV。
- [ ] **Step 4: 实现保存与作业生命周期。** 使用 Rust FileDialogBuilder 的 set_parent、set_title、set_file_name、add_filter、save_file 回调；标题“导出未完成任务”，筛选“PDF 文档”/pdf。busy 守卫覆盖保存与打印流程，但不能锁住 UI 线程；结果用异步通道通知。
- [ ] **Step 5: 实现 Windows 打印。** 按设计 §7 加载专属缓存静态 HTML，hidden/不抢焦点/不进任务栏，验证就绪消息和字体。通过 with_webview 和 PrintToPdfCompletedHandler 处理 A4/背景/回调、60 秒超时。关闭默认引擎页眉页脚，检查内核支持 CSS 页码，成功后验证签名并同目录替换。
- [ ] **Step 6: 注册与清理。** lib.rs 注册自有命令与状态，window-state.with_filter 排除 task-export-pdf- 前缀。取消/异常/超时/成功都关闭自己的打印窗、解绑监听、清理文件；平台不支持返回中文错误。核对不需要前端 dialog/fs 权限，不给打印窗 SQL 权限。
- [ ] **Step 7: 验证并记录。** cargo fmt --manifest-path src-tauri/Cargo.toml -- --check；cargo test --manifest-path src-tauri/Cargo.toml task_export；cargo check --manifest-path src-tauri/Cargo.toml。期待退出码 0。编译通过只证明适配器可构建，原生视觉验收留到任务 7，不允许代理启动测试窗口。

## Task 2: 统一导出选择器与类型

**Files:** 新建 task-export-model.ts、task-recurrence.ts 和 task-export-model.test.ts；修改 db.ts 中 matchesRecurrence 的位置及导入/重新导出。

**Interfaces:**
- 消费 TaskListRaw 与 Project[]，以及 capturedAt/today/options。
- 产出设计 §6 的所有 DTO 和 buildTaskExportSnapshot(raw, options)。
- task-recurrence.ts 产出 matchesRecurrence(date: Date, startDate: Date, type: string): boolean；db.ts 保持这个导出入口兼容。

- [ ] **Step 1: 写固定数据的失败测试。** today 固定 2026-10-14；用本地测试工厂建立下面的 raw 记录，不依赖机器今天：
  - 普通任务 10：dueDate=2026-10-13，未完成、失败，子任务 1 完成/1 未完成。
  - 普通任务 11：dueDate=2027-01-05，未完成，两个子任务都完成。
  - 普通任务 12：已完成；普通任务 13：已软删除。
  - 循环任务 20：2026-10-14 起每日重复，当天完成，10月15日跳过，10月16日有效；其子任务在15日完成、16日未完成。单独将模板 isFailed=true 验证未来发生仍纳入，不能使用模板标记代替每日状态。
  - 月循环任务 21：2026-01-31 起，today 单独设为2026-02-01时应选2026-03-31；重复截止边界单独测试。
- [ ] **Step 2: 写准确断言。** 默认结果 taskId 数组为 [10,11]，统计为 {taskCount:2,subtaskCount:4,completedSubtaskCount:3}；开启循环后任务20只有 2026-10-16 一条，子任务状态为 false；任务12/13不出现；冻结 raw 后选择器不抛修改错误，输出改动不影响 raw；非法日期返回明确错误而非循环搜索。
- [ ] **Step 3: 验证失败。** 运行 npm test，确认新模块缺失/断言失败。新测试解析路径别名可采用既有 esbuild 测试方式，不安装新测试框架。
- [ ] **Step 4: 实现选择器。** 采用设计的全量普通任务与可选循环规则；未来查询不受当前月限制，依 recurrenceEnd 和有限搜索上界终止。子任务仅按对应日期查状态，全部保留；无子任务任务仍纳入；排序稳定；缺失项目时显示“项目 #id”，不静默丢任务。
- [ ] **Step 5: 通过验证。** npm test 与 npm run build 退出码 0；特别核对提取 matchesRecurrence 后原有循环展开测试没有改变。为选择器补充“无结束日期且未来多次已完成”“有效日期恰好等于截止日”“截止后无候选”“future failed 发生跳过”“同名跨项目”用例。

## Task 3: 全量只读查询与前端数据入口

**Files:** 新建 task-export-query.ts、db-task-export.test.ts；修改 db.ts、api/index.ts、shared/ipc-channels.ts、ipc-bridge.ts、useTaskStore.ts。

**Interfaces:**
- 消费任务 2 的 DTO/纯选择器。
- 产出 readTaskExportRaw(reader, options, capturedAt)、Db.getTaskExportSnapshot(options)、tasksApi.exportSnapshot(options)、useTaskStore.fetchExportSnapshot(options)。
- IPC.TASKS_EXPORT_SNAPSHOT 的值固定为 tasks:exportSnapshot，参数固定为一个 options 对象。

- [ ] **Step 1: 建立双实现的失败测试。** 参考 db-projects.test.ts 用真实 :memory: SQLite adapter 和 MemoryDb；不打开 calendar.db 或 test-calendar.db。创建两个项目、当前/其他月份/2027 年普通任务及一条循环任务，设置母子状态，并软删除一个任务。
- [ ] **Step 2: 断言范围与只读。** 当前项目/可见月筛选下 listTasks 不含远期任务，但 getTaskExportSnapshot 必须包含；不开循环时循环 taskId 完全不存在；开启后每条只一发生；原始 tasks/subtasks/occurrences/settings 导出前后的数据逐项一致，特别是 lastFailedCheckDate 不能被修改。
- [ ] **Step 3: 运行 npm test 验证新查询尚不存在时失败。**
- [ ] **Step 4: 实现一个 SELECT 快照。** 验证 options.includeRecurring 必须为 boolean；readTaskExportRaw 的 reader 只提供 select。CTE 限定候选，UNION ALL 的 kind 固定为 task/project/subtask/taskOccurrence/subtaskOccurrence，payload 为参数化查询中的 JSON；规范化 0/1，捕获一次 Date 得到 capturedAt 与 today。普通子记录读取母 dueDate；循环记录读取 today 及之后的有限已存状态。排序交给任务 2。不使用超长 IN 参数列表，不调用 checkAndMarkFailed，不展开多年日期。
- [ ] **Step 5: 接入双 Db 实现和 IPC。** MemoryDb 从完整私有集合构造同样 raw，再调用同一选择器；SqliteDb 调用只读 reader。tasksApi 类型化调用新 IPC，store 的 fetchExportSnapshot 直接返回 DTO、不 set tasks、不修改 selectedProjectId、不通知完成或成就事件。SQL 异常向上抛，由弹窗转成用户提示。
- [ ] **Step 6: 验证。** npm test、npm run build。断言两实现结果相等（capturedAt 可统一注入/归一化比较）；导出前后五个任务入口的状态来源仍是既有 store/数据层。

## Task 4: 共用文档渲染与分页样式

**Files:** 新建 task-export-document.ts、styles/task-export-document.css、task-export-document.test.ts。

**Interfaces:**
- 消费 TaskExportSnapshot。
- 产出 renderTaskExportHtml(snapshot): string，包含文档 CSS 的完整静态 HTML。
- 预览和 native request.html 必须使用同一个返回值，不能维护两份排版。

- [ ] **Step 1: 写失败测试。** 对设计的示例构造快照，断言全部4个母标题、11个子标题、4个完成状态存在；输入 <script>、&、引号、换行不能生成执行节点；包含循环时输出正确日期及循环标签；跨年2027-01-05文案带2027年；HTML没有外链字体、用户脚本或示例 PDF 的 base64。
- [ ] **Step 2: npm test，确认 renderer 尚未定义导致失败。**
- [ ] **Step 3: 从已确认的 task-export-sample.html 提取文档样式。** 颜色作为专属文档语义令牌集中定义；字体系统化；A4 与边距遵守设计。CSS 用 Vite 的 ?inline 引入并封装入 HTML，避免外部资源路径。显示“数据生成时间”与循环范围说明，统计使用 snapshot.summary。
- [ ] **Step 4: 实现纯 HTML renderer。** 全量转义文本，项目/备注不解释为富文本；无子任务不显示0/0；文档内容不带界面的操作按钮或示例标签；日期标题在跨年时明确年份。@page 添加 page/pages 页码，关闭默认URL页眉页脚交给原生适配器。
- [ ] **Step 5: 处理分页。** 标题 break-after:avoid；普通任务块尽量 break-inside:avoid，超过一页时允许内容分页，子任务单行不能断裂或裁掉；不能强制固定一页高度、overflow:hidden 或对整个清单避分页。
- [ ] **Step 6: 验证静态内容与长清单。** npm test、npm run build；浏览器渲染4/11/4样例、100个母任务、单母任务100项子任务、500字中文备注及emoji。截图检查后保存验证素材到 docs/mockups/task-export-live-*，测试生成工具仅用于验证，不成为运行时依赖。

## Task 5: 正式弹窗、循环选项与入口

**Files:** 新建 TaskExportDialog.tsx；修改 TaskOverviewPanel.tsx。复用现有 Button、Radix、Toast；不修改 UI 生成物。

**Interfaces:**
- 消费 fetchExportSnapshot(options)、renderTaskExportHtml(snapshot)。
- 产出 TaskExportDialog({open,onOpenChange})，通过局部 state 管理 includeRecurring/loading/error/snapshot/exporting。
- 任务 6 接入导出事件；本任务 UI 先实现可读预览。

- [ ] **Step 1: 核对并实现入口。** 仅在现有任务总览标题工具区增加 Download 图标和中文 aria-label/title，挂载新弹窗，不调整侧栏 pending/completed 计数、日期分组、完成回调或子任务交互。
- [ ] **Step 2: 实现已确认布局。** Radix Portal/Content 避免既有 Dialog 的512px父限宽；约990px，视口适配，标题与底部固定可见，右侧独立滚动。预览 iframe srcDoc 使用 renderer 输出，sandbox 禁止脚本，固定打印配色。
- [ ] **Step 3: 加循环选项。** 用真正的复选框，默认false，中文标签和说明与设计一致；其他子任务内容规则不可关闭。每次打开重置默认选项；切换选项清除旧可导出快照、重新加载，状态更新有请求序号/取消保护。
- [ ] **Step 4: 实现读取、刷新与空/错误状态。** 加载禁用导出；读失败显示“无法读取任务，请重试”并提供重试；空态计数0；生成时间取快照。关闭后不更新已销毁状态。
- [ ] **Step 5: 浏览器真实内存数据验证。** 预设包含普通/循环任务的MemoryDb；不开循环缺少整个循环母子组，开启后增加一个发生且计数正确；快速连点不出现旧响应；深浅主题和木纹等现有皮肤的文字可读；键盘焦点/Escape/取消、长清单滚动及缩小窗口正常。
- [ ] **Step 6: npm run build。** 只读UI和样式无需为每个类名编写测试；交互验证关注循环选择、异步竞态和用户可操作性，保存关键截图。

## Task 6: UI 到原生保存的完整链路

**Files:** 修改 api/index.ts、shared/ipc-channels.ts、ipc-bridge.ts、TaskExportDialog.tsx；原生接口沿用任务 1。

**Interfaces:**
- 消费 TaskPdfRequest/TaskPdfResult 与任务 1 的 export_task_pdf。
- 产出 systemApi.exportTaskPdf(request)、IPC.SYSTEM_EXPORT_TASK_PDF=system:exportTaskPdf。
- desktop bridge 调用 invokeCore('export_task_pdf',{request})，不自行另开一个PDF生成入口。

- [ ] **Step 1: 加类型化系统路由。** Tauri 环境真实调用 Rust；普通浏览器返回明确不可用，不以 Blob/示例PDF冒充当前任务导出。API名字和request/status字段与设计一致。
- [ ] **Step 2: 保存已展示快照。** 点击时保留当前snapshot和由它生成的HTML，不重新查库；defaultFileName由snapshot.today生成。导出状态阻止选项切换、刷新、重复点击和关闭；保存对话框取消后恢复UI。
- [ ] **Step 3: 用可控系统API结果验证三种分支。** saved 时只通知真实路径；cancelled 不通知也不清空快照；rejected/timeout 显示错误、恢复操作，再次调用可成功。保留跨日快照的生成日期和状态一致性。
- [ ] **Step 4: 验证竞态。** loading时不能调用系统导出；模拟两次点击只有一次调用；组件仍保持正确的主窗状态。浏览器按钮禁用并说明需要桌面版；屏幕预览仍可查看。
- [ ] **Step 5: npm test、npm run build、cargo test --manifest-path src-tauri/Cargo.toml task_export。** 期待退出码0；记录原生人工验收尚未执行，不能用模拟API替代最后验收。

## Task 7: 桌面构建、原生样例与最终交接

**Files:** docs/task-export-validation.md、CHANGELOG.md、PROJECT_MAP.md；截图/输出PDF仅作为验证产物，不加入应用资源。正式打包另行授权后再更新 docs/build-notes.md。

- [ ] **Step 1: 完成自动检查。** npm test；npm run build；cargo fmt --manifest-path src-tauri/Cargo.toml -- --check；cargo test --manifest-path src-tauri/Cargo.toml task_export。不得忽略失败后继续宣称完成。
- [ ] **Step 2: 编译用户将打开的最新测试版。** npm run tauri build -- --no-bundle；node scripts/check-test-build-stale.mjs。期待编译退出码0、过期检查输出0。不要运行生成的release exe或启动测试窗口.bat；正式/测试库隔离遵守现有脚本。
- [ ] **Step 3: 交给用户做原生操作验证。** 请用户自行打开启动测试窗口.bat，从UI选择目录，分别测试不开/开启循环、取消保存、重复目标及导出失败；观察没有额外窗口闪现、主窗/悬浮窗保持正常。未完成这一项时在验证文档中保留“待用户实机确认”，不能打勾。
- [ ] **Step 4: 检查用户生成的PDF。** 有实际PDF后，用pdfinfo/Poppler/PDF文本提取检查A4、中文、全部标题、所有已完成子任务、页码、边距与无本地URL。4/11/4样例对照已确认截图；再检查大量母任务与单母任务跨页，不能只有截图PDF或只生成固定样例。
- [ ] **Step 5: 核对数据没有写回。** 不直接操作用户正式库；在自动测试的内存SQLite比较导出前后数据，用户测试模式核对同一任务在月/周/详情/总览/悬浮窗的状态，特别是完成母任务再取消后子任务恢复各自真实状态。
- [ ] **Step 6: 更新真实功能记录。** CHANGELOG记录导出及循环可选规则；PROJECT_MAP指向代码/验证文档。报告新增依赖和构建体积实测范围；不在未打包时声称安装包大小达标。任务是否全部验证以记录为准。
- [ ] **Step 7: 留下接续信息。** 按代码范围形成中文提交，说明已通过检查、用户待验项和产物路径。发布版本由实际发布范围决定，本计划不提前修改0.10.0，也不要求推送或启动安装包。

## 自检与任务对应

- 设计要求1/2（全量及全部子任务）由任务2/3/4落实。
- 设计要求3/4（PDF与已确认样式）由任务1/4/5/6/7落实。
- 新追加循环复选框由任务2/3/5/6落实，默认值和开启口径已明确。
- 快照一致、只读、取消/失败、分页与五入口联动由对应测试/任务7覆盖。
- 本文所有新接口名称和返回值以设计§6为准；PDF适配仍待任务1编译与任务7实机核验。
- 此计划保存完成不等于功能开发完成；实施时逐项勾选，未验证项不能标成通过。
