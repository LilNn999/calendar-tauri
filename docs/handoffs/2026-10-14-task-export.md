# 未完成任务导出：快速交接

> 从本文件开始接手。工作目录：E:/原生日历项目。
> 用户已经接受导出 UI 和 PDF 样式；此次仅完成规划，业务功能尚未开发。

## 先读什么

1. [AGENTS.md](../../AGENTS.md)：任务完成联动、体积、测试窗口与打包规范。
2. [需求设计](../superpowers/specs/2026-10-14-task-export-design.md)：导出范围、循环选项、数据接口、PDF方案、验收矩阵。
3. [实施计划](../superpowers/plans/2026-10-14-task-export.md)：7项任务、准确文件路径、接口和验证步骤。
4. [交互预览](../mockups/task-export.html)与[PDF排版](../mockups/task-export-pdf.png)：已接受的样式基线。
5. 若处理桌面构建或发布，再读[构建记录](../build-notes.md)。

## 用户原意与最新补充

导出所有未完成母任务及其全部子任务。只要母任务未完成，已完成子任务也保留勾选和划线。格式PDF；样式已接受，实施时不重新设计。

用户最新明确要求：循环任务提供勾选项，不勾选时完全不导出。计划默认不勾选；勾选后每条循环任务只保留今天/未来最近一次未完成、未失败、未跳过的有效发生。这一开启口径是基于现有任务总览的规划默认，用户未要求导出无限未来或全部历史。

全部项目、普通任务不限日期，不受当前日历月份/项目筛选限制。逾期普通任务只要未完成也保留。打卡、每日备注、回收箱不在导出范围。

## 已做完与未做完

| 内容 | 状态 |
| --- | --- |
| 导出入口、弹窗、深浅主题、完整文档的独立样式稿 | 已完成并被用户接受 |
| 可离线下载的实际A4示例PDF | 已生成，4母任务/11子任务/4已完成子任务 |
| 浏览器28项样式/规则/下载检查、当时的npm run build | 上一阶段已通过；属于样式稿验证 |
| 本轮需求设计、7项实施计划、交接文档 | 已保存，待实施 |
| 循环复选框的正式UI | 未实现；原HTML样式稿尚无该复选框 |
| 全量数据库查询、新IPC/store方法、正式弹窗 | 未实现 |
| Rust保存对话框、WebView2原生打印、错误恢复 | 未实现；方案有API依据，尚未实测 |
| 正式测试窗口、原生PDF、安装包 | 本功能尚未构建或验收；不得用旧release exe证明新功能 |

## 立即开始的工作

先检查git状态和锁文件，再按实施计划任务1做原生PDF适配器的编译与生命周期测试；任务2/3落实选择器和全量只读数据查询。不要从“复制整个HTML到src”或“把示例PDF下载按钮搬进正式页面”开始。

公开接口以需求设计§6为准。数据选择只实现一份，SQLite/MemoryDb共用；预览/PDF共用同一个renderer。循环开关改变候选任务，不能改变数据库里的任务或子任务状态。

参考本地事实：

- src/lib/db.ts：Db接口、SqliteDb/MemoryDb、TaskListRaw、buildTaskList及日期发生状态。
- src/components/sidebar/TaskOverviewPanel.tsx：现有工具区、最近循环发生选择、母子任务状态与反馈。
- src/store/useTaskStore.ts：当前tasks仅覆盖可见日期/所选项目；不能直接拿来全量导出。
- src/lib/db-projects.test.ts：真实内存SQLite+MemoryDb的测试方法及esbuild别名处理。
- src-tauri/src/lib.rs：命令注册、窗口状态与主窗关闭隐藏行为。
- src/components/ui/dialog.tsx：已有包装器父级限宽512px，正式宽弹窗按计划用现有Radix，不大改生成物。

## 仓库与搬迁注意

检查时：分支codex/release-0.3.4、HEAD 22818c6、应用版本0.10.0。执行时重查；这些是交接基线，不是要求回退的版本。

样式与本次规划文档在当前工作区，尚未Git提交。CHANGELOG.md/PROJECT_MAP.md已有相关未提交改动；.zcode/是原有未跟踪目录，不要删、改或并入本功能。

如果换新克隆、工作树或另一台机器，单靠HEAD拿不到这些设计文件。先复制下列目录/文件，或只提交已核对过的本功能设计文件，再开始：

- 本交接文档、需求设计、实施计划、原始样式说明。
- docs/mockups/task-export*（HTML与截图）。
- output/pdf/task-export-sample.pdf。
- 对应的CHANGELOG/PROJECT_MAP设计记录，避免覆盖其他内容。

不要自动创建新聊天或派发其他模型；用户会自行把本交接交给实施模型。

## 设计资产校验

| 资产 | SHA256 |
| --- | --- |
| docs/mockups/task-export.html | 3C699D88FB1F0120DDE83C67E17989BFD603F59243450E800D66891BF9611211 |
| output/pdf/task-export-sample.pdf | 79D5079BBA0E97C7C6BFEA7AFCE602DB0E0BAD52A10337CA5CC668E11E44098B |

校验值用于识别本次已接受的参考，不用于固定生产导出的PDF。样式稿内嵌PDF约用于示例下载，生产包不能携带它。

## 验证与交付边界

- npm test、npm run build以及原生模块测试必须通过。
- 完成后主动构建 npm run tauri build -- --no-bundle，并确认node scripts/check-test-build-stale.mjs输出0。
- 代理不能自动打开桌面测试窗口或安装包；由用户打开启动测试窗口.bat验证真实保存与PDF。
- 完成记录区分“编译通过/浏览器通过/原生已验证/用户待验证”，不虚报。
- 默认不执行正式发布、git push或NSIS打包；用户另外要求时按仓库规则交付安装包。

## 可直接交给实施模型的指令

~~~text
请在 E:/原生日历项目 实现未完成任务导出功能。
先读 AGENTS.md 和 docs/handoffs/2026-10-14-task-export.md，
再读 docs/superpowers/specs/2026-10-14-task-export-design.md
及 docs/superpowers/plans/2026-10-14-task-export.md，按7项任务推进。

UI和PDF样式已经确认，参考 docs/mockups/task-export.html。
母任务未完成时保留其全部子任务，含已完成项。
循环任务提供勾选项，默认不勾选时完全排除；开启后的发生选择按设计执行。
请落实全量只读查询、同一份预览/导出快照和Windows原生PDF保存，
不要把示例PDF下载当作功能实现，不要重做已确认的样式。

保护现有未提交设计文件和无关改动；不要自动启动测试窗口、安装包或发布。
完成后记录通过的检查、真实PDF验证结果和仍需用户操作的验收项。
~~~
