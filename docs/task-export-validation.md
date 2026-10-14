# 未完成任务导出：验证记录

- 功能：从任务总览导出全部未完成任务及全部子任务为 PDF，循环任务可选（默认不导出）。
- 依据：[需求设计](../superpowers/specs/2026-10-14-task-export-design.md) · [实施计划](../superpowers/plans/2026-10-14-task-export.md) · [快速交接](../handoffs/2026-10-14-task-export.md)。
- 本轮实现范围：任务 1~7 的代码全部落地。**原生保存与视觉验收仍需用户在桌面测试窗口确认**，见文末。

## 1. 检查结论一览

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 前端测试 | `npm test` | 通过：117 个用例，0 失败 |
| 前端构建（含类型检查） | `npm run build` | 通过，退出码 0 |
| Rust 格式 | `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | 通过，退出码 0 |
| Rust 单元测试 | `cargo test --manifest-path src-tauri/Cargo.toml task_export` | 通过：14 个用例，0 失败 |
| Rust 编译 | `cargo check --manifest-path src-tauri/Cargo.toml` | 通过，无警告 |
| 桌面 release 构建（不含安装包） | `npm run tauri build -- --no-bundle` | 通过，退出码 0，见 §5 |
| NSIS 安装包打包 | `npm run tauri build` | 通过，退出码 0，产物 `安装包/日历_0.11.0_x64-setup.exe`，见 §5 |
| 测试版过期检查 | `node scripts/check-test-build-stale.mjs` | 输出 `0`（测试版为最新），见 §5 |
| 浏览器渲染与分页核对 | `node scripts/verify-task-export-render.mjs` + 无头 Chrome 打印 | 通过，见 §4 |
| 原生 WebView2 保存与弹窗操作 | 用户在测试窗口操作 | **待用户实机确认** |

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

### 测试版主程序

| 项 | 值 |
| --- | --- |
| 产物 | `src-tauri/target/release/calendar-tauri.exe` |
| 大小 | 5,271,552 字节（约 5.03 MB） |
| SHA256 | `879C1CE97B8B7B5B025F6263DA25DD54D225425767DC83B016F70FF8AE884D79` |
| 版本 | 文件版本与产品版本均为 0.11.0 |
| 过期检查 | `0`，测试版为最新 |

### NSIS 安装包（0.11.0）

| 项 | 值 |
| --- | --- |
| 源文件 | `src-tauri/target/release/bundle/nsis/日历_0.11.0_x64-setup.exe` |
| 已交付 | `安装包/日历_0.11.0_x64-setup.exe` |
| 大小 | 2,280,804 字节（约 2.18 MiB） |
| SHA256 | `4456A84D072D230C03FFB39A0807EBAD33DE2A55EE0C3A53DD8F5380F1B58D2B`（源与副本一致） |
| 版本 | 文件版本与产品版本均为 0.11.0 |

- 模板校验：生成的 `installer.nsi` 对比打包前保留的 0.10.0 基线，**仅 3 行变化**——
  `VERSION`、`VERSIONWITHBUILD`、`ESTIMATEDSIZE`（5064 → 5148 KB）；946 行文件其余部分完全一致，
  自定义覆盖升级选项、带版本窗口标题与 `NSIS_HOOK_PREINSTALL` 均保持。
- 数据检查：`dist` 不含任何数据库文件，`bundle.resources` 未配置，安装包不携带用户数据。
- 代理没有运行生成的 release exe，也没有启动 `启动测试窗口.bat`：这两步按仓库规范由用户完成。
- 打包时测试窗口正在运行并锁住 release exe（首次构建报 `failed to remove file`，退出码 1），
  经用户确认后结束该测试版进程再打包成功；正式版进程未受影响。
- 安装包体积约 2.18 MiB，低于仓库「5~10 MB」的目标区间；这是全系列安装包一贯水平
  （0.9.1 为 2.14 MiB、0.10.0 为 2.14 MiB），未因此调整目标或改变打包配置。
- 构建日志中唯一的警告是 `linker_messages`（MSVC 生成导入库的提示），与本功能无关，历史上同样存在。
- 另有一处与功能无关的既有格式问题：`src-tauri/src/commands.rs` 此前未按 rustfmt 格式化，
  使仓库级 `cargo fmt -- --check` 在本次开发前就返回非 0。已单独提交 `dea3c03`
  只为该文件补格式（仅换行与缩进），不改逻辑，本功能文件未受影响。

## 6. 用户待实机确认项（代理不能自动执行）

请在测试窗口按以下步骤确认，并把结果补记到本文档：

1. 打开 `启动测试窗口.bat`（自动使用 `CALENDAR_TEST_MODE=1` 与 `test-calendar.db`，不影响正式库）。
2. 任务总览标题右侧的下载图标可打开导出弹窗；文案与样式应与
   [`task-export-dialog-light.png`](task-export-dialog-light.png) /
   [`task-export-dialog-dark.png`](task-export-dialog-dark.png) 一致。
3. **默认不勾选循环任务**：预览里完全没有循环任务；勾选后预览增多一条「最近一次待完成」的循环任务，
   底部计数同步变化。
4. 点击「导出 PDF」弹出系统保存对话框，标题「导出未完成任务」，筛选「PDF 文档」。
5. **取消保存**：回到弹窗，预览与选项都保留，没有错误或成功提示，没有写出文件。
6. 选择位置保存成功：提示「PDF 已导出：<路径>」；导出的 PDF 是 A4，
   含页码页脚、中文正常、已完成子任务有勾选与划线。
7. 覆盖已存在的同名文件：旧文件被新文件替换，不残留临时文件。
8. 导出期间：按钮显示「正在导出…」，选项、刷新与关闭被禁用；重复点击不会产生第二个作业。
9. 观察导出过程：没有额外窗口闪现、不抢焦点、不进入任务栏；主窗口与悬浮窗保持正常。
10. 完成状态核对：导出前后在月视图、周视图、日期详情、任务总览、悬浮窗五个入口抽查同一任务，
    状态与「完成母任务再取消后子任务恢复各自真实状态」的行为均不变。
11. 确认测试模式使用的是 `test-calendar.db`，正式库 `calendar.db` 未被打开或改写。

## 7. 未验证与已知限制

- **原生 WebView2 打印未实机验证**：`PrintToPdf`、隐藏打印窗、作业超时与清理只有编译与单元测试证据。
- **CSS `@page` 页码在 WebView2 内核下的表现未实机确认**：若内核过旧会丢失页脚页码，
  此时应在 §6 记录，并考虑把页码改为原生侧负责。
- **原生与 CSS 边距是否叠加未实机确认**：已把原生边距设为 0 以避免叠加，仍需实机量取。
- 浏览器开发模式下导出按钮点击后显示「PDF 导出请在桌面版使用」，不会伪造成功，
  也不会用 Blob 或示例 PDF 冒充当前任务导出。
- 循环任务的搜索窗口为 `max(今天, 开始日期)+62 天`：开始日期在更远的未来时，
  该循环任务本轮不导出（与「只导出最近一次待完成」的口径一致）。
- 安装包已打包并交付（`安装包/日历_0.11.0_x64-setup.exe`，2.18 MiB），但**体积低于仓库
  「5~10 MB」目标区间**：这是全系列安装包的一贯水平（0.9.1 与 0.10.0 均为 2.14 MiB），
  未在本轮为此调整打包配置或目标。新增依赖为 `tauri-plugin-dialog 2.3.3`
  （含 `rfd`、`tauri-plugin-fs`）、`webview2-com`、`windows-core`、`tokio(sync/time)`、`url`，
  均在原依赖树内或为小体积 crate（主程序 5.19 MB → 5.27 MB，增加约 86 KB）。
