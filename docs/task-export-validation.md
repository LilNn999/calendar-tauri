# 未完成任务导出：验证记录

- 功能：从任务总览导出全部未完成任务及全部子任务为 PDF，循环任务可选（默认不导出）。
- 依据：[需求设计](../superpowers/specs/2026-10-14-task-export-design.md) · [实施计划](../superpowers/plans/2026-10-14-task-export.md) · [快速交接](../handoffs/2026-10-14-task-export.md)。
- 当前发布版本：**0.12.0**（新增项目筛选与皮肤预览，沿用 0.11.1 的导出闪退修复，见 §8、§9）。
- 状态：0.11.1 原生导出已由用户在测试窗口实测成功；**0.12.0 的项目筛选与皮肤预览待用户安装复验**，循环任务原生导出仍待实机确认。

## 1. 0.11.1 基线检查结论

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 前端测试 | `npm test` | 通过：117 个用例，0 失败 |
| 前端构建（含类型检查） | `npm run build` | 通过，退出码 0 |
| Rust 格式 | `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | 通过，退出码 0 |
| Rust 单元测试 | `cargo test --manifest-path src-tauri/Cargo.toml` | 通过：18 个用例，0 失败 |
| Rust 编译 | `cargo check --manifest-path src-tauri/Cargo.toml` | 通过，无警告 |
| 桌面 release 构建（不含安装包） | `npm run tauri build -- --no-bundle` | 通过，退出码 0，见 §5 |
| NSIS 安装包打包 | `npm run tauri build` | 通过，退出码 0，产物 `安装包/日历_0.11.1_x64-setup.exe`，见 §5 |
| 测试版过期检查 | `node scripts/check-test-build-stale.mjs` | 输出 `0`（测试版为最新），见 §5 |
| 浏览器渲染与分页核对 | `node scripts/verify-task-export-render.mjs` + 无头 Chrome 打印 | 通过，见 §4 |
| 原生保存、弹窗与实机 PDF | 用户在测试窗口实测 | **已通过**（0.11.1，2 页 A4、中文与页码正常） |
| 勾选「包含循环任务」的原生导出 | 用户在测试窗口实测 | **未覆盖**（测试库当时没有未完成的循环任务） |
| 安装 0.11.1 正式包后复验 | 用户操作 | **待用户确认** |

## 2. 自动测试覆盖（已通过）

### 2.1 统一选择器 `src/lib/task-export-model.test.ts`（21 个用例）

- 默认不勾选循环任务时循环母子组完全不出现；勾选后每条循环母任务只保留一个最近的有效发生。
- 计划指定的基线：`today=2026-10-14`，普通任务 10/11/12/13 与循环任务 20/21，结果为
  `taskCount=2, subtaskCount=4, completedSubtaskCount=3`。
- 循环发生选择：已完成/失败/跳过逐日跳过、`recurrenceEnd` 为包含边界、结束日期后无候选不导出、
  月循环 31 日在缺失该日期的月份不夹成月底、跨年日期带完整年份。
- 模板 `isCompleted`/`isFailed` 不代表整个序列，纳入与否只看所选发生日期的真实状态。
- 子任务读取所选发生日期的状态（不串日），母任务未完成但子任务全完成仍纳入。
- 项目缺失时使用「项目 #id」占位名，不静默丢任务；非法日期与非法选项抛明确错误。
- 冻结 raw 后选择器仍可运行，输出改动不影响 raw。

### 2.2 全量只读查询 `src/lib/db-task-export.test.ts`（16 个用例，SQLite 与浏览器内存双实现）

- 当前月份看不到的远期普通任务、逾期普通任务、跨项目任务都在导出快照内。
- 不勾选循环任务时循环 `taskId` 完全不存在；勾选后只出现一个发生且日期正确。
- 导出前后 `tasks`/`subtasks`/`task_occurrences`/`subtask_occurrences`/`settings` 逐项一致；
  导出不写 `lastFailedCheckDate`，也不把逾期任务标记为失败（对照既有 `listTasks` 仍保留该副作用）。
- 两个实现的 `tasks`/`summary`/`today` 完全一致（`capturedAt` 为各自捕获时间）。

### 2.3 文档渲染 `src/lib/task-export-document.test.ts`（10 个用例）

- 4 母任务 / 11 子任务 / 4 已完成样例的全部标题与完成状态都存在，统计一致。
- `<script>`、`&`、引号、换行、emoji 全部转义或保留（`pre-wrap`），正文不产生可执行节点。
- 文档无外链、无 `@import`、无图片、无 base64、无示例 PDF 引用；带 CSP `default-src 'none'`。
- 分页约束：日期标题与任务标题 `break-after: avoid`，子任务行与页脚 `break-inside: avoid`，
  超长任务使用允许分页的例外类，不裁切内容、不锁死整份清单高度。
- 空清单显示空态且无任务块；无子任务的母任务不显示 `0/0` 进度。
- 100 条母任务、单母任务 100 项子任务、500 字中文备注、emoji 全部完整输出。

### 2.4 只读数据入口 `src/lib/project-store.test.ts`（新增 2 个用例）

- `fetchExportSnapshot` 原样传递选项、返回 DTO，不覆盖可见任务列表、不改当前项目选择、
  不触发任何数据变更通知（悬浮窗刷新/完成事件）。

### 2.5 原生适配器 `src-tauri/src/task_export/tests.rs`（14 个用例）

- 拒绝非主窗口调用，且不弹保存对话框、不留任何文件。
- 默认文件名校验：`../a.pdf`、`..\a.pdf`、子目录路径、`C:文件夹`、无扩展名、`.txt`、
  `清单.pdf.exe`、空串、以句点结尾全部被拒绝；`清单.PDF` 被接受。
- 取消保存返回 `cancelled` 且创建文件数为 0。
- 单作业守卫：并发第二次请求被拒绝；作业失败后守卫释放，可重试。
- 打印失败/超时/空文件/非 `%PDF-` 内容：不替换已有目标文件、不留下临时文件与目标文件。
- 成功导出返回真实保存路径，临时 HTML 与临时 PDF 全部清理；覆盖已有文件时无残余。
- 临时 PDF 与目标同目录且带作业标记；作业 id 单调递增；打印窗标签不与 `main`/`floating` 冲突。

## 3. 实现与原计划的差异（已核对，均为等价或更稳妥）

| 项 | 计划写法 | 实际实现 | 原因 |
| --- | --- | --- | --- |
| 循环搜索上界 | `max(起点, 已记录的未来发生)+62 天` | `max(今天, 开始日期)+62 天`，按候选日期跳转 | 已记录的历史状态不会让窗口变窄；跳转后每个循环类型最多前进 31 天，因此窗口足够且搜索量恒定 |
| 循环模板状态 | 未明确 | `isCompleted`/`isFailed` 不参与循环任务的纳入判断 | 模板标记只代表某一次记录，不代表整个序列（与设计 §5 一致） |
| 保存对话框调用线程 | 未明确 | `spawn_blocking` 内等待对话框回调 | 遵守「busy 守卫不能锁住 UI 线程」 |
| 打印边距 | 「若运行时覆盖 CSS 就统一交给原生」 | 原生边距设为 0，页面边距完全由 CSS `@page` 控制 | 已在浏览器同版引擎核对边距无叠加，见 §4 |
| 打印窗标签 | `task-export-pdf-<id>` | 固定 `task-export-pdf-job` | 单作业守卫下标签唯一即可，window-state 过滤前缀不变 |
| 依赖 | webview2-com / windows-core / tokio | 额外新增 `url = "2"`（已在依赖树中） | 打印窗需要 `file://` 地址加载本作业静态文档 |

## 4. 浏览器渲染与分页核对（已通过，非原生验收）

用 `scripts/verify-task-export-render.mjs` 把 `renderTaskExportHtml` 的真实输出交给无头 Chrome
（Skia/PDF，与 WebView2 同源引擎）打印，再用 `scripts/verify-pdf-text.mjs` 按页解析 CMap 还原文字。

- 4 母任务 / 11 子任务 / 4 已完成样例：`docs/mockups/task-export-live-4-11-4.png`，版式与已确认的
  [`task-export-pdf.png`](task-export-pdf.png) 一致（统计摘要、日期分组、优先级标签、
  已完成子任务绿色勾选+划线、页脚说明）。
- 100 条母任务：13 页，每页都有页码「第 N 页 / 共 13 页」，第 1 与第 100 条母任务、
  第 1 与第 100 条子任务都在输出中，没有缺项、没有空白尾页、没有本地路径或 URL。
  产物：`docs/mockups/task-export-live-long.pdf`。
- 单母任务跨页核对：样例第 1 页装不下最后一条任务时整块移到第 2 页，未出现标题孤立在页底。

> 说明：以上是 Chromium 打印引擎的验证，**不能替代 WebView2 原生导出验收**。原生侧的
> `PrintToPdf`、保存对话框、隐藏窗口与超时清理仍需在桌面测试窗口实机确认。

## 5. 桌面构建与测试版

```
npm run tauri build -- --no-bundle     # 退出码 0
npm run tauri build                    # 退出码 0，产出 NSIS 安装包
node scripts/check-test-build-stale.mjs # 输出 0
```

### 测试版主程序（0.11.1）

| 项 | 值 |
| --- | --- |
| 产物 | `src-tauri/target/release/calendar-tauri.exe` |
| 大小 | 5,406,208 字节（约 5.16 MB） |
| SHA256 | `B2944A7099BBDA0C4DA2B4D7671536615D454D41A38F78E84B3D2D6CF8888E86` |
| 版本 | 文件版本与产品版本均为 0.11.1 |
| 过期检查 | `0`，测试版为最新 |

### NSIS 安装包（0.11.1）

| 项 | 值 |
| --- | --- |
| 源文件 | `src-tauri/target/release/bundle/nsis/日历_0.11.1_x64-setup.exe` |
| 已交付 | `安装包/日历_0.11.1_x64-setup.exe` |
| 大小 | 2,318,759 字节（约 2.21 MiB） |
| SHA256 | `A8FD3C4527FE0F0142240FA9DB5AE3C677201725ABBDABE25057E1A0D389C31C`（源与副本一致） |
| 版本 | 文件版本与产品版本均为 0.11.1 |

- 模板校验：生成的 `installer.nsi` 对比打包前保留的 0.11.0 基线，**仅 3 行变化**——
  `VERSION`、`VERSIONWITHBUILD`、`ESTIMATEDSIZE`（5148 → 5279 KB）；946 行文件其余部分完全一致，
  自定义覆盖升级选项、带版本窗口标题与 `NSIS_HOOK_PREINSTALL` 均保持。
- 数据检查：`dist` 不含任何数据库文件，`bundle.resources` 未配置，安装包不携带用户数据。
- 代理没有运行生成的 release exe，也没有启动 `启动测试窗口.bat`：这两步按仓库规范由用户完成。
- 打包时测试窗口正在运行并锁住 release exe（首次构建报 `failed to remove file`，退出码 1），
  经用户确认后结束该测试版进程再打包成功；正式版进程未受影响。
- 安装包体积约 2.21 MiB，低于仓库「5~10 MB」的目标区间；这是全系列安装包一贯水平
  （0.9.1 与 0.10.0 均约 2.14 MiB、0.11.0 约 2.18 MiB），未因此调整目标或改变打包配置。
- 本次为修复 0.11.0 的两处闪退新增了崩溃诊断钩子与 release 行号表（`debug = 1`），
  安装包由 2.18 MiB 增至 2.21 MiB。
- 构建日志中唯一的警告是 `linker_messages`（MSVC 生成导入库的提示），与本功能无关，历史上同样存在。
- 另有一处与功能无关的既有格式问题：`src-tauri/src/commands.rs` 此前未按 rustfmt 格式化，
  使仓库级 `cargo fmt -- --check` 在本次开发前就返回非 0。已单独提交 `dea3c03`
  只为该文件补格式（仅换行与缩进），不改逻辑，本功能文件未受影响。

## 6. 仍需用户确认的项（代理不能自动执行）

已在测试窗口实测通过（0.11.1）：下载图标能打开弹窗、系统保存对话框正常弹出、导出成功且不闪退，
产物为 2 页 A4 PDF，中文、页码、优先级、逾期标记、备注与子任务齐全，桌面与缓存无临时文件残留。

仍需确认：

1. 安装 `安装包/日历_0.11.1_x64-setup.exe`（正式包）后重跑一次导出，确认正式环境同样正常。
2. **勾选「包含循环任务」再导出**：测试库当时没有未完成的循环任务，这条路径还没被实际跑过。
   勾选后预览应多出一条「最近一次待完成」的循环任务，且计数同步变化。
3. 取消保存后回到弹窗，预览与选项保留、无错误或成功提示、不写文件。
4. 覆盖已存在的同名文件：旧文件被新文件替换，不残留临时文件。
5. 导出期间按钮显示「正在导出…」，选项、刷新与关闭被禁用；重复点击不会产生第二个作业。
6. 导出过程没有额外窗口闪现、不抢焦点、不进入任务栏；主窗口与悬浮窗保持正常。
7. 导出前后在月视图、周视图、日期详情、任务总览、悬浮窗五个入口抽查同一任务，
   状态与「完成母任务再取消后子任务恢复各自真实状态」的行为均不变。
8. 确认测试模式使用的是 `test-calendar.db`，正式库 `calendar.db` 未被打开或改写。

## 7. 未验证与已知限制

- **勾选「包含循环任务」的原生导出未实测**：其余原生路径已实测通过，这一条分支还缺一次实跑。
- **0.11.1 正式包未复验**：本轮实测是在测试版上完成的。
- **原生与 CSS 边距是否叠加**：已把原生边距设为 0 以避免叠加，实测排版正常，
  但未用工具量取具体毫米数。
- 浏览器开发模式下导出按钮点击后显示「PDF 导出请在桌面版使用」，不会伪造成功，
  也不会用 Blob 或示例 PDF 冒充当前任务导出。
- 循环任务的搜索窗口为 `max(今天, 开始日期)+62 天`：开始日期在更远的未来时，
  该循环任务本轮不导出（与「只导出最近一次待完成」的口径一致）。
- 安装包已打包并交付（`安装包/日历_0.11.1_x64-setup.exe`，2.21 MiB），但**体积低于仓库
  「5~10 MB」目标区间**：这是全系列安装包的一贯水平（0.9.1 与 0.10.0 均约 2.14 MiB、
  0.11.0 约 2.18 MiB），未因此调整打包配置或目标。新增依赖为 `tauri-plugin-dialog 2.3.3`
  （含 `rfd`、`tauri-plugin-fs`）、`webview2-com`、`windows-core`、`tokio(sync/time)`、`url`，
  均在原依赖树内或为小体积 crate。

## 8. 0.11.0 的两处闪退：根因与修复

0.11.0 上线后用户实测「一点导出就闪退」，修复过程中又暴露出第二处「打印完成后闪退」。
两处都是 **panic → `panic = "abort"` → 进程立即终止**，所以前端收不到任何错误提示。
定位手段是新增的崩溃诊断钩子（`src-tauri/src/diag.rs`），它把 panic 位置与调用链写进
`%APPDATA%\com.calendar.desktop\task-export.log`。

### 8.1 点击导出即闪退：插件未注册

```
payload: state() called before manage() for tauri_plugin_dialog::desktop::Dialog<...>
  13: tauri_plugin_dialog::impl$0::dialog      tauri-plugin-dialog-2.3.3\src\lib.rs:70
  14: calendar_tauri_lib::task_export::impl$3::select   task_export.rs:282
```

`DialogExt::dialog()` 的实现是 `app.state::<Dialog<R>>()`，取的是插件注册时 `app.manage()`
塞进去的状态。实现时误把设计文档的「Rust 内调用、通常不需要新增前端权限」理解为
「不需要注册插件」，于是 `lib.rs` 漏了 `tauri_plugin_dialog::init()`，首次调用 `app.dialog()`
直接 panic。

修复：在 `lib.rs` 注册 `tauri_plugin_dialog::init()`。插件本体注册会顺带注册 IPC 命令，
但 `capabilities/default.json` 未授予任何 `dialog:*` 权限，前端仍然调不到，权限面没有扩大。

### 8.2 打印完成后闪退：`file://` 页面的 IPC 处理器

```
payload: called `Result::unwrap()` on an `Err` value: http::Error(InvalidUri(InvalidFormat))
  11: wry::webview2::attach_ipc_handler::closure$0     wry-0.55.1\src\webview2\mod.rs:910
thread: ThreadId(1)     ← 主线程
```

wry 的 IPC 处理器里执行 `Request::builder().uri(url).body(js).unwrap()`，其中 `url` 取自
`args.Source()`。打印文档用 `file://` 加载，来源是 `file:///C:/...`，不是合法 HTTP URI，
`unwrap()` 直接 panic 掉主线程。**只要页面 origin 是 `file://`，`postMessage` 就必然崩主线程。**

修复：不再用 `postMessage` 汇报就绪，改为导航完成后由原生侧执行就绪脚本，并在脚本回调里启动打印。
顺带修掉一个隐蔽问题：`AddScriptToExecuteOnDocumentCreated` 在窗口已开始加载之后再注册会被
静默丢弃，不能作为就绪检测的主路径——这曾导致导出白等 60 秒后超时。

## 9. 2026-10-14 项目筛选与皮肤预览（随 0.12.0 发布）

- 导出弹窗新增「导出项目」，默认当前项目，可选择全部项目或任一项目；选择只影响导出，不修改主界面或悬浮窗的项目选择。
- 导出选项增加可选 `projectId`，快照增加 `project` 范围信息；SQLite、浏览器内存与统一选择器按同一范围筛选母子任务、循环发生和统计。未传项目保持原有全部项目语义，空项目保留项目名并返回零统计。
- 预览 iframe 从应用读取白名单皮肤令牌，跟随根 class 的皮肤与深浅主题变化；PDF 调用仍不传预览参数。新增皮肤规则限定于 `@media screen`，默认文档与打印保留白底 A4 排版。
- `npm test`：131/131 通过。新增项目过滤、空项目、非法范围、只读双实现、项目名转义与预览/PDF 内容一致性用例，均先确认失败再实施。
- `npm run build`：通过；首次受限环境的依赖解析失败，在正常本地构建环境运行相同命令后通过，无构建工具或依赖改动。
- 浏览器实际界面检查：21 项通过，覆盖六套皮肤 × 深浅主题（正文对比度最低 5.78）、打开默认当前项目、全部/单个/空项目、循环选项、真实子任务完成状态、统计重算、主界面选择不变、900×620 窄窗口及运行时异常检查。
- 实际打印样式检查：使用产品渲染器生成所选工作项目的文档，经浏览器打印为 1 页 A4 PDF 并用 Poppler 渲染检查；白底、黑字、中文、子任务勾选划线与 1/1 页码完整，文本解析无 URL 或本地路径。测试内容只存在于浏览器内存，没有读取或修改桌面数据库。
- 桌面测试窗口与系统保存对话框不由代理启动；本轮 Windows 原生交互由用户自行打开最新测试窗口确认。

