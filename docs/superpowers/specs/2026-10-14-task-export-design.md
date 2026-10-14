# 未完成任务导出功能设计

- 日期：2026-10-14（Asia/Shanghai）。
- 状态：用户已接受 UI 与 PDF 样式，并要求保存实现计划，交由其他模型开发。
- 本文是正式实现的需求依据；当前应用仍未实现导出功能。
- [实施计划](../plans/2026-10-14-task-export.md) · [快速交接](../../handoffs/2026-10-14-task-export.md) · [原始样式说明](../plans/2026-10-14-task-export-ui.md)。

## 1. 用户已明确的要求

1. 导出当前所有未完成任务，包括子任务。
2. 母任务没有完成时，其全部子任务都要导出；已经完成的子任务也必须保留。
3. 文件格式为 PDF，适合查看和打印。
4. 沿用已经展示并接受的导出弹窗与白底 A4 清单样式。
5. 用户追加原话：“循环任务可设置勾选，如果不勾选的话，循环任务完全不导出。”
6. 本次只规划、保存文档和交接，开发交给其他模型。

## 2. 本计划采用的默认规则

下面的默认值是规划决定，区别于用户直接指定的要求。实施模型可以按此执行，不需要重新征询已确认的样式。

| 项目 | 首版规则 |
| --- | --- |
| 项目范围 | 全部项目，不受当前所选项目限制 |
| 日期范围 | 普通任务不限日期，不受当前浏览月份和选中日期限制 |
| 普通任务 | 未软删除且 isCompleted=false 就纳入；逾期或 isFailed=true 也不能因此被排除 |
| 循环任务选项 | “包含循环任务”，每次打开弹窗默认不勾选，不持久化 |
| 不勾选循环任务 | 排除所有 recurrenceType 非空的母任务及其子任务；不能留下循环任务模板或部分发生 |
| 勾选循环任务 | 每个循环母任务只导出今天或未来最近一次未完成、未失败、未跳过的有效发生 |
| 历史循环记录 | 不批量导出过去失败/未完成记录；与现有任务总览选择下一次待完成发生的方向一致 |
| 已结束循环 | 找不到有效待完成发生就不导出 |
| 已完成母任务 | 不导出；其子任务不作为独立任务导出 |
| 子任务 | 全部保留，按 sortOrder、id 稳定排序，保留选定发生日期的真实完成状态 |
| 排列 | dueDate 升序；同日期依次按高/中/低/无优先级、createdAt、taskId 排序 |
| 内容 | 标题、项目名称、日期、优先级、任务备注、循环标记、全部子任务及完成状态 |
| 其他数据 | 不导出打卡、每日备注、统计报表、回收箱内容 |
| 默认文件名 | 未完成任务清单_yyyy-MM-dd.pdf，以快照的本地日期生成 |

说明：普通任务的“全部未完成”范围比当前侧栏 pending 筛选更完整，因为侧栏还排除了失败任务。只能在导出选择器中落实这个差异，不改变侧栏/月视图/悬浮窗的既有完成或失败逻辑。

## 3. 用户流程与状态

1. 在任务总览顶部，点击回收箱和新增按钮旁的下载图标；提示文案为“导出未完成任务”。
2. 弹窗打开后默认查询不包含循环任务的完整快照，显示“正在读取任务…”；加载期间禁止导出。
3. 左侧保留范围、导出内容、PDF 格式说明，在内容区增加可操作的“包含循环任务”复选框。
4. 复选框说明：“每条循环任务仅导出最近一次待完成（今天或未来）”。其他内容说明属于固定规则，不能提供隐藏已完成子任务的选项。
5. 切换复选框会重新查询完整快照；旧请求结果不能覆盖新选择。期间旧清单不得以新选项的名义被导出。
6. 右侧滚动查看清单；在预览工具栏提供一个小刷新按钮，重新读取当前选项下的快照。显示数据生成时间。
7. 点击“导出 PDF”，保存当前预览对应的同一份快照，打开系统保存对话框。
8. 用户取消保存：返回弹窗，保留预览和选项，不弹错误或成功通知，不写文件。
9. 用户选择位置：按钮显示“正在导出…”，禁止再次导出、切换选项、刷新和关闭弹窗，直到作业结束。
10. 成功：只有 PDF 真正保存完成后才提示“PDF 已导出”，可显示所选路径；不自动打开 PDF 或其他程序。
11. 失败：显示可读错误，保留预览并恢复操作，允许重试。
12. 无符合条件的任务：显示“当前没有可导出的未完成任务”，三个计数均为 0，禁用导出按钮；复选框仍可操作。

快照生成时确定 capturedAt 和 today；预览和 PDF 始终使用这两个值。用户在悬浮窗修改任务后，可点击刷新获取最新状态，保存时不偷偷换成另一份数据。取消或失败后不能把用户选择重置。

## 4. UI 与 PDF 排版

样式依据：

- [交互稿](../../mockups/task-export.html)。
- [浅色弹窗](../../mockups/task-export-dialog-light.png)、[深色弹窗](../../mockups/task-export-dialog-dark.png)。
- [入口位置](../../mockups/task-export-entry.png)、[窄窗口](../../mockups/task-export-mobile.png)。
- [PDF 外观](../../mockups/task-export-pdf.png)、[文档源样式](../../mockups/task-export-sample.html)。
- [实际 PDF 示例](../../../output/pdf/task-export-sample.pdf)。

原样式稿没有新追加的循环复选框；正式 UI 在原布局内补上该选项，不需要推翻已经接受的设计。原稿内嵌的 PDF 只用于离线展示，不能复制进正式导出实现。

弹窗宽度参考 990px，最大高度限制在视口内，标题、关闭与底部操作固定可见。已有 src/components/ui/dialog.tsx 的外层限宽为 max-w-lg，不能仅给内部内容加宽解决；本功能使用已经安装的 Radix Dialog 的 Portal/Content，复用现有 Button，不大改 UI 生成物。弹窗必须支持焦点约束、Escape、取消、窄窗口滚动。

文档白底与界面主题解耦；使用固定的文档语义令牌，不在渲染组件中散落颜色值。母任务保持清晰可读，已完成子任务显示绿色勾选、划线和“已完成”；未完成子任务显示空框和“待完成”，均不可点击。

PDF 为 A4 竖版，页边距上 14mm、左右 15mm、下 16mm；字体沿用系统中文字体，不下载字体、不打包完整 CJK 字库。任务多时自然分页，母任务标题不能孤立在页底；单个任务超过一页时允许拆分，但一个子任务行不得被裁掉。跨年日期必须带年份，避免“不限日期”清单中的年份歧义。

三个统计值分别为纳入的母任务数、其子任务总数、其中真实已完成子任务数。勾选循环任务后即时按新快照更新；没有子任务的母任务也保留，不显示 0/0 进度。

页脚使用页码与总页数，不能出现本地临时 HTML 路径或 URL。CSS 页边距与原生打印设置必须验证没有叠加。

## 5. 数据架构

采用以下数据流：

~~~text
TaskOverviewPanel
  -> TaskExportDialog（局部加载/选项/快照/导出状态）
  -> useTaskStore.fetchExportSnapshot(options)
  -> tasksApi.exportSnapshot(options)
  -> IPC.TASKS_EXPORT_SNAPSHOT
  -> Db.getTaskExportSnapshot(options)
  -> SqliteDb 或 MemoryDb
  -> buildTaskExportSnapshot(raw, options)
  -> renderTaskExportHtml(snapshot)
     -> 预览 iframe
     -> systemApi.exportTaskPdf({ html, defaultFileName })
     -> IPC.SYSTEM_EXPORT_TASK_PDF
     -> Rust export_task_pdf
     -> 系统保存对话框 + Windows WebView2 打印
~~~

禁止用 useTaskStore.tasks、getVisibleRange 或 tasksApi.list(start,end) 代替全量查询。现有 listTasks 会调用 checkAndMarkFailed，导出不能复用它并引入写库副作用。

SqliteDb 建议使用一个 SELECT/CTE + UNION ALL，输出带 kind 标记的任务、项目、子任务及发生记录，payload 用 SQLite JSON 函数构造，统一解析。一个 SELECT 在同一条语句内读取一致的数据，避免分多次查询时跨窗口修改造成母子任务状态错配。所有筛选参数绑定，不能用标题或备注拼 SQL。

查询候选包含全部未删除、未完成的普通任务；只有选项开启时才加入仍可能产生有效发生的循环模板。普通子任务的状态读取 dueDate；循环子任务的状态读取最终选中的发生日期。无需新表、设置持久化或 schema 迁移。

MemoryDb 使用自己的完整私有集合构造同样的 raw 数据，不调用 checkAndMarkFailed；最后和 SQLite 共用纯选择函数，不重写一套循环/子任务规则。快照 DTO 必须与原数据库对象脱离，不能修改源实体。

循环匹配复用现有 matchesRecurrence 的规则。将该小函数提取到 src/lib/task-recurrence.ts，db.ts 继续导入并重新导出，避免现有导入入口失效；不重构其他日期逻辑。月循环的 31 日在不存在该日期的月份跳过，不能变为月底补齐。

循环模板的 tasks.isCompleted/isFailed 不代表整个序列状态，不能因此排除所有未来发生；完成/失败的过滤针对 task_occurrences 中被考虑的具体日期。导出的母任务必须是未完成的普通母任务或未完成的选定循环发生。

循环选择从 max(today, dueDate) 起，跳过完成、失败和 isSkipped 的发生，遵守 recurrenceEnd 的包含边界。没有结束日期时不要展开无限未来；搜索上界可取 max(起点, 此任务已记录的未来发生日期)+62 天，因为合法月循环的下一次有效日期不会超出这个间隔。搜索只用于寻找一条结果，不能生成多年实例数组或使用“当前月底”作为截断条件。

## 6. 统一接口

以下均为计划接口，目前尚不存在。Task、Subtask、Project 沿用现有共享实体；新的导出 DTO 不是新增数据库实体。

定义文件：src/lib/task-export-model.ts。

~~~ts
import type { Priority, RecurrenceType, Project } from '@shared/types'
import type { TaskListRaw } from './db'

export interface TaskExportOptions {
  includeRecurring: boolean
}
export type TaskExportRaw = TaskListRaw & {
  capturedAt: string
  today: string
  projects: Project[]
}
export interface TaskExportItem {
  key: string
  taskId: number
  projectId: number
  projectName: string
  title: string
  priority: Priority
  dueDate: string
  notes: string | null
  recurrenceType: RecurrenceType | null
  isOverdue: boolean
  subtasks: Array<{
    id: number
    title: string
    sortOrder: number
    isCompleted: boolean
  }>
}
export interface TaskExportSnapshot {
  capturedAt: string
  today: string
  includeRecurring: boolean
  tasks: TaskExportItem[]
  summary: {
    taskCount: number
    subtaskCount: number
    completedSubtaskCount: number
  }
}
export interface TaskPdfRequest {
  html: string
  defaultFileName: string
}
export type TaskPdfResult =
  | { status: 'saved'; path: string }
  | { status: 'cancelled' }

export function buildTaskExportSnapshot(
  raw: TaskExportRaw, options: TaskExportOptions
): TaskExportSnapshot

// src/lib/task-export-query.ts
export interface TaskExportSqlReader {
  select<T>(query: string, values?: unknown[]): Promise<T>
}
export function readTaskExportRaw(
  reader: TaskExportSqlReader,
  options: TaskExportOptions,
  capturedAt: Date
): Promise<TaskExportRaw>

// src/lib/task-export-document.ts
export function renderTaskExportHtml(snapshot: TaskExportSnapshot): string

// 现有接口中的新增方法
// Db: getTaskExportSnapshot(options): Promise<TaskExportSnapshot>
// tasksApi: exportSnapshot(options): Promise<TaskExportSnapshot>
// useTaskStore: fetchExportSnapshot(options): Promise<TaskExportSnapshot>
// systemApi: exportTaskPdf(request): Promise<TaskPdfResult>
~~~

key 由 taskId 和实际 dueDate 组成。JSON 的 SQLite 0/1 需要规范化为 boolean。实体引用不能泄漏到 DTO。所有计数由同一个选择结果生成，不从现有统计 API 或侧栏计数拼接。

## 7. PDF 技术方案与实现边界

**主方案：Windows 上复用 WebView2 PrintToPdf，Rust 负责保存对话框和输出。**这是根据官方 API 和本地依赖选择的实现方向，尚未完成原生适配或实测，实施任务 1 必须先确认能编译并落实作业生命周期。

Microsoft 提供将当前文档异步写入 PDF 的 API；同一 WebView 不能同时运行多个打印作业，完成回调才意味着写入结束。采用单作业锁并等待回调。参考 [WebView2 打印指南](https://learn.microsoft.com/en-us/microsoft-edge/webview2/how-to/print) 和 [PrintToPdf 接口](https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/win32/icorewebview2_7?view=webview2-1.0.3650.58)。

保存对话框在 Rust 内使用官方插件，不需要新增 npm dialog/fs 依赖；取消返回 cancelled。为控制依赖兼容性，先选固定 tauri-plugin-dialog 2.3.3，其声明的 Rust 最低版本为 1.77.2；不要直接跟随要求更高 Rust 版本的最新插件。参考 [该插件版本信息](https://docs.rs/crate/tauri-plugin-dialog/2.3.3) 和 [FileDialogBuilder](https://docs.rs/tauri-plugin-dialog/2.3.3/tauri_plugin_dialog/struct.FileDialogBuilder.html)。

本地 Cargo.lock 已含 tauri 2.11.5、webview2-com 0.38.2、windows-core 0.61.2、tokio 1.53.1；需要直接引用时声明同一版本，避免 COM 类型来自不同版本。本地源码已确认 WebviewWindow.with_webview、PlatformWebview.controller/environment、PrintToPdfCompletedHandler，以及 window-state 的 with_filter 可用。

具体流程：

1. 命令仅接受主窗口调用，后端也检查 window.label()，不授予悬浮窗或打印窗导出能力。
2. 单作业守卫在保存对话框前取得；取消、失败、超时均释放，不能持锁阻塞主线程。
3. 用户选定路径后，为作业生成唯一 id。在应用缓存的专属 task-export/<id>/ 目录写临时 HTML，避免 NavigateToString 的尺寸限制；在目标目录创建唯一临时 PDF，成功后替换最终目标。
4. 创建不显示、不抢焦点、不进入任务栏的 task-export-pdf-<id> WebviewWindow，仅加载该作业的本地静态 HTML，不加载主应用入口，也不初始化数据库、项目 store 或示例数据。
5. 导出 HTML 不包含用户脚本或外部资源；任务文本全量转义。主预览 iframe 使用 sandbox。打印窗导航只允许自己的文档，页内资源用 CSP 限制。
6. 通过原生 NavigationCompleted/执行脚本/作业专属 ready 消息等待 document.fonts.ready 和布局就绪；消息验证作业身份和当前文档。隐藏窗口不能依赖 requestAnimationFrame 作为唯一就绪条件。
7. 在 with_webview 所在的正确线程取得 COM 接口，设置 A4、缩放 1、背景打印、关闭引擎默认 URL/日期页眉页脚，再调用 PrintToPdf。COM 对象不要跨线程搬运。
8. 自定义页码使用 CSS @page 的页边距内容；[Chrome 官方说明](https://developer.chrome.com/blog/print-margins)记录了 Chromium 131 起对页边距内容及 page/pages 计数的支持。检查 WebView2 内核版本；不支持时返回可操作的更新提示，不默默承诺页码正确。
9. 60 秒超时从用户选定路径后、开始就绪/打印时计时，不限制用户在保存对话框里选择位置的时间；回调检查 HRESULT 与成功标记。成功后检查非空、%PDF- 文件签名，然后使用同目录替换保护已有目标。
10. 最终关闭本作业窗口、移除事件处理器、清理自己的临时文件。超时先终止本作业窗口，再清理；不让迟到回调重写状态或补报成功。window-state 的 with_filter 排除打印窗标签，不能污染主窗/悬浮窗状态记忆。

权限配置通常不需要新增 dialog/fs 的前端权限，因为调用发生在 Rust。若实现方式变更，只给主窗必要权限，不加入 dialog:default、fs:default 或给打印窗 SQL 权限。

CSS 与原生打印边距的优先关系必须以原生输出验证；目标仍是上 14mm、左右 15mm、下 16mm。初始按 CSS @page 控制边距，原生不加额外默认边距；若运行时覆盖 CSS，就将同一组边距统一交给原生设置，避免两边叠加，记录验证方式。

不得打包 Chromium、Python、Playwright、完整中文字体、示例 PDF 或用户数据。浏览器开发模式可查看真实内存数据的排版，导出按钮禁用并提示“PDF 导出请在桌面版使用”；不伪造成功。首版实际 PDF 保存只实现 Windows，其他平台返回明确不支持的结果。

## 8. 验收矩阵

| 场景 | 必须得到的结果 |
| --- | --- |
| 跨项目、跨月份、远期普通任务 | 全部未完成项都在清单内，即使当前只查看一个项目/月份 |
| 母任务未完成，子任务部分完成 | 所有子任务保留，已完成数量、勾选和划线正确 |
| 所有子任务完成，母任务仍未完成 | 母任务及全部子任务仍纳入，进度 n/n |
| 母任务完成或在回收箱 | 不导出，也不将其子任务单独纳入 |
| 逾期且未完成的普通任务 | 保留并标明已逾期，标题不能因失败而不可读 |
| 默认不勾选循环任务 | 循环模板、发生和子任务全部排除 |
| 勾选循环任务 | 每个循环母任务只出现一个符合条件的最近发生，读取该日子任务状态 |
| 今日已完成/失败/被跳过的循环发生 | 跳过该日，寻找后续有效发生，不能读错子任务日期 |
| 月循环 31 日、无限循环、已结束循环 | 遵循已有匹配语义，不夹成月底、不无限展开、不漏掉下月候选 |
| 快速切换复选框、刷新或关闭 | 旧响应不覆盖新状态，不在已关闭弹窗里报错 |
| 保存取消、无权限、目标存在、超时 | 取消无文件；失败可重试；旧 PDF 不损坏；作业与临时数据被清理 |
| 中文、emoji、换行、HTML 特殊字符 | 文案完整、可读，任务文本不能成为 HTML/脚本 |
| 4 母任务/11 子任务/4 已完成示例 | 统计一致，A4 排版对照已确认样式 |
| 大量任务、单母任务超长、跨年日期 | 多页无缺项、裁切或页脚空白页；年份明确 |
| 主窗月/周/详情/总览与悬浮窗 | 导出前后完成状态与恢复行为均不变 |
| 用户在测试窗口操作 | 使用 test-calendar.db；正式 calendar.db 不被打开或改写 |

## 9. 交付与非目标

交付实现代码、测试结果、主窗截图、原生 PDF 样例与实际验证说明。完成前端后还需无安装包的桌面构建和测试版过期检查；禁止代理自动启动测试窗口。

本功能实现不默认包含发布、推送、安装包运行或重做 UI。用户另行要求正式打包时，遵循 AGENTS.md 与 docs/build-notes.md 的版本、NSIS 模板比对、安装包复制、大小/SHA256 和构建记录约定。

本次规划没有打开数据库、安装新依赖、实现业务代码或运行桌面程序。已确认设计的样例校验是浏览器生成 PDF 的验证，不能当作 WebView2 原生导出功能的验收。
