# 构建与安装包记录

> 本文档是项目内部记录，供 Codex 新工作窗口在接手构建、打包和测试窗口任务前阅读。每次打包后必须追加记录。

## 固定约定

- 打包命令：`npm run tauri build`
- 构建产物：`src-tauri/target/release/bundle/nsis/*Setup.exe`
- 交付目录：项目根目录 `安装包/`
- 交付文件名：`日历_<版本>_x64-setup.exe`
- 交付动作：构建后复制到 `安装包/`；不自动运行安装包或测试窗口，由用户自行启动。
- 测试窗口规则：`启动测试窗口.bat` 使用 `scripts/check-test-build-stale.mjs` 自动判断源码/配置/dist 是否新于 release exe；如有更新，先执行 `npm run tauri build -- --no-bundle` 再启动最新测试版，禁止直接启动旧 exe。
- Codex 内部验收必须主动执行 `npm run tauri build -- --no-bundle`，并确认 `node scripts/check-test-build-stale.mjs` 输出 `0`；此后用户直接打开 `启动测试窗口.bat` 应直接启动最新版，不得再次构建。

## 2026-10-14 0.11.1 修复版

- 时间：2026-10-14 17:34（北京时间）
- 分支：`codex/release-0.3.4`（发布目标：码云 `origin/codex/release-0.3.4` 与 `origin/main`）
- 版本：`0.11.1`（纯修复，修订号递增；前端包、锁文件、Tauri 配置、Rust crate 与更新公告同步）
- 命令：`npm test`；`npm run build`；`cargo test`；`cargo fmt -- --check`；`npm run tauri build`。
- 构建结果：成功（退出码 0）；NSIS 打包成功。
- 安装包源文件：`src-tauri/target/release/bundle/nsis/日历_0.11.1_x64-setup.exe`
- 已交付：`安装包/日历_0.11.1_x64-setup.exe`
- 大小：2,318,759 bytes（约 2.21 MiB）
- SHA256：`A8FD3C4527FE0F0142240FA9DB5AE3C677201725ABBDABE25057E1A0D389C31C`（源与副本一致）
- 测试版主程序：5,406,208 bytes，SHA256 `B2944A7099BBDA0C4DA2B4D7671536615D454D41A38F78E84B3D2D6CF8888E86`，文件版本与产品版本均为 0.11.1；过期检查输出 `0`。
- 本次改动：**修复 0.11.0 的两处导出闪退**。①`app.dialog()` 依赖 `tauri-plugin-dialog` 注册的状态，而 `tauri_plugin_dialog::init()` 未在 `lib.rs` 注册，首次调用即 panic；`panic = "abort"` 让进程立即终止，所以表现为“一点导出就闪退”。②打印文档以 `file://` 加载，页面 `postMessage` 会进入 wry 的 IPC 处理器，那里把消息来源当 HTTP URI 解析并 `unwrap()`，`InvalidUri` panic 掉主线程，所以表现为“打印完成后闪退”。现改为导航完成后由原生侧执行就绪脚本、在脚本回调里启动打印，不再使用 `postMessage`；同时修掉 `AddScriptToExecuteOnDocumentCreated` 注册过晚导致就绪脚本被静默丢弃、导出白等 60 秒超时的问题。另加导出结束后清理隐藏临时文件的逻辑（含上次异常退出残留的兜底清理）。
- 本次同时新增崩溃诊断能力：`src-tauri/src/diag.rs` 安装 panic 钩子，把线程、位置与调用链写入 `%APPDATA%\com.calendar.desktop\task-export.log`；release 保留行号表（`debug = 1`）以便回溯可读。**排查线上闪退时先看这个日志文件。**
- 验证：`npm test` 117/117 通过；`cargo test` 18/18 通过（含 3 项诊断模块测试与 1 项临时文件清理测试，后者断言不会误删用户文件）；`npm run build` 通过；`cargo fmt -- --check` 退出码 0。用户在测试窗口实测：系统保存对话框正常弹出、导出成功且无闪退，产物为 2 页 A4 PDF（149,953 bytes），页码、中文、优先级、逾期标记、备注与子任务齐全，无 URL 与本地路径，缓存目录与桌面无临时文件残留。
- 模板校验：生成的 `installer.nsi` 对比打包前保留的 0.11.0 基线，**仅 3 行变化**——`VERSION`（0.11.0 → 0.11.1）、`VERSIONWITHBUILD`（0.11.0.0 → 0.11.1.0）与 `ESTIMATEDSIZE`（5148 → 5279 KB）；946 行文件其余部分完全一致，自定义覆盖升级选项、带版本窗口标题与 `NSIS_HOOK_PREINSTALL` 均保持。
- 数据检查：`dist` 不含数据库文件，`bundle.resources` 未配置；安装包不携带用户数据。
- 体积说明：安装包由 2.18 MiB 增至 2.21 MiB（`debug = 1` 与诊断钩子），仍远低于仓库 5~10 MB 目标，属全系列一贯水平。
- 注意事项：打包前测试窗口（PID 29852）仍在运行并锁住 release exe，经确认后结束该进程再打包；安装包与测试窗口均未由代理启动，由用户自行双击安装。
- **待用户确认**：本轮修复由用户在测试窗口实测通过，但**尚未由用户安装 0.11.1 正式包复验**；另外测试库当时没有未完成的循环任务，勾选「包含循环任务」的导出路径本轮未被实际覆盖。

## 2026-10-14 0.11.0 正式版

- 时间：2026-10-14 16:38（北京时间）
- 分支：`codex/release-0.3.4`（发布目标：码云 `origin/codex/release-0.3.4`）
- 发布提交：`a2c7b01`（`release: 0.11.0 未完成任务导出`；功能提交 `47c05d2`…`5c3ff27`，构建记录另行提交）
- 版本：`0.11.0`（新增功能，次版本号递增；`package.json`、`package-lock.json`、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml`、`src-tauri/Cargo.lock` 与更新公告同步）
- 命令：`npm test`；`npm run build`；`cargo fmt -- --check`；`cargo test task_export`；`npm run tauri build -- --no-bundle`；`npm run tauri build`。
- 构建结果：成功（退出码 0）；前端生产构建约 4.6 秒，正式打包 release 编译约 1 分 41 秒，NSIS 打包成功。
- 安装包源文件：`src-tauri/target/release/bundle/nsis/日历_0.11.0_x64-setup.exe`
- 已交付：`安装包/日历_0.11.0_x64-setup.exe`
- 大小：2,280,804 bytes（约 2.18 MiB）
- SHA256：`4456A84D072D230C03FFB39A0807EBAD33DE2A55EE0C3A53DD8F5380F1B58D2B`
- 本次改动：任务总览新增「导出未完成任务」——把全部项目的未完成母任务及其全部子任务导出为 A4 PDF；母任务未完成时保留全部子任务（已完成子任务保留勾选与划线），普通任务不限月份与项目、逾期与远期任务都在清单内；新增可选「包含循环任务」复选框（默认不勾选、不持久化），勾选后每条循环任务只取今天或未来最近一次未完成、未失败、未跳过的有效发生；新增全量只读查询（单条 `SELECT` + `UNION ALL`，不触发失败标记等写库副作用）与统一选择器、唯一静态文档渲染器与分页样式；新增 Rust 原生保存（系统保存对话框 + Windows WebView2 `PrintToPdf`、单作业守卫、60 秒超时、`%PDF-` 签名校验与同目录替换）。新增依赖 `tauri-plugin-dialog =2.3.3`、`webview2-com =0.38.2`、`windows-core =0.61.2`、`tokio =1.53.1`（仅 sync/time）、`url = "2"`；`rust-version` 校正为 1.77.2。
- 验证：`npm test` 117/117 通过；`npm run build` 通过；`cargo fmt -- --check` 退出码 0；`cargo test task_export` 14/14 通过；`cargo check` 无警告。浏览器同源引擎（Skia/PDF）打印 100 条母任务为 13 页，每页有页码、第 1 与第 100 条母任务及子任务都在、无 URL 与本地路径，关键产物见 `docs/mockups/task-export-live-4-11-4.png` 与 `docs/mockups/task-export-live-long.pdf`；详见 `docs/task-export-validation.md`。
- 模板校验：生成的 `installer.nsi` 对比打包前保留的 0.10.0 基线，仅 `VERSION`（0.10.0 → 0.11.0）、`VERSIONWITHBUILD`（0.10.0.0 → 0.11.0.0）与 `ESTIMATEDSIZE`（5064 → 5148 KB）三行变化，共 946 行文件无其他差异；自定义覆盖升级选项、带版本窗口标题及 `NSIS_HOOK_PREINSTALL` 保持。
- 数据检查：`dist` 不含数据库文件，`bundle.resources` 未配置；源安装包与交付副本 SHA256 一致；安装包文件版本与产品版本均为 0.11.0。
- 测试版时效：`node scripts/check-test-build-stale.mjs` 输出 `0`。正式打包后按仓库规范又执行了一次 `npm run tauri build -- --no-bundle` 刷新测试版（`npm test` 会触碰 `src/` 下文件的 mtime，使过期检查一度输出 `1`），最新主程序大小 5,271,552 bytes，SHA256 `CF8F51455BC89BDE631B76DC9AD2F21028D18D90A6EF21637E738238402B7707`，Windows 文件版本及产品版本均为 0.11.0；安装包是完整打包的产物，未受该次重建影响，SHA256 仍为 `4456A84D072D230C03FFB39A0807EBAD33DE2A55EE0C3A53DD8F5380F1B58D2B`。
- 发布推送：`codex/release-0.3.4` 与 `main` 均快进到 `d432e67` 并推送码云（`main` 由 `22818c6` 快进，无合并冲突）；本次无 `git push --force`，未改写任何历史。
- 注意事项：打包过程中测试窗口正在运行并锁住 release exe（首次 `npm run tauri build` 报 `failed to remove file`，退出码 1），经用户确认后结束该测试版进程（PID 25276）再打包成功；正式版进程（`D:\日历\calendar-tauri.exe`）未受影响。安装包与测试窗口均未由代理启动，由用户自行双击安装；安装包按既有规则保存在本地 `安装包/`，不提交编译产物。
- **原生功能仍待用户实机验收**：原生 WebView2 打印、保存对话框、页码页脚与页边距叠加均只有编译与单元测试证据，需在测试窗口按 `docs/task-export-validation.md` §6 逐项确认；在完成前不得视为已通过。

## 2026-10-14 0.10.0 正式版

- 时间：2026-10-14 11:38（北京时间）
- 分支：`codex/release-0.3.4`（发布目标：码云 `origin/main` 与 `origin/codex/release-0.3.4`）
- 发布提交：`641bc0d`（`release: 0.10.0 月度天数统计图标与悬浮信息窗`；构建记录另行提交）
- 版本：`0.10.0`（新增功能，次版本号递增；前端包、锁文件、Tauri 配置、Rust crate 与更新公告同步）
- 命令：`npm test`；`npm run tauri build -- --no-bundle`；`npm run tauri build`。
- 构建结果：成功（退出码 0）；默认前端类型检查及生产构建通过，测试版 release 编译约 1 分 46 秒，正式打包 release 编译约 1 分 43 秒，NSIS 打包成功。
- 安装包源文件：`src-tauri/target/release/bundle/nsis/日历_0.10.0_x64-setup.exe`
- 已交付：`安装包/日历_0.10.0_x64-setup.exe`
- 大小：2,247,650 bytes（约 2.14 MiB）
- SHA256：`9346B5C4ACE84D74F10080B7D7327FF949D23C56C31ADBD566C0AC16C56B0A1F`
- 本次改动：月历标题旁新增月度天数统计图标（悬停展开工作日、休息日、法定节假日与本月假期、调休补班信息）；新增 `monthDayStats` 纯函数与节假日结构化月份查询，补齐 2025—2026 年法定日期并校正 2025 年通知文号；普通月视图与纯日历模式共用入口，与年月选择面板互斥，未收录年度明确标注为按周末估算。
- 验证：`npm test` 40/40 通过（含新增 11 项月度统计回归：验收基线、全年恒等式、法定合计 13 天、跨月切分、未收录年度与文案格式）；`npm run build` 通过；构建产物的浏览器真实界面检查 49 项全部通过（悬停展开与移入保持、移出收起、点击与键盘聚焦、Escape 不反复展开、切月联动、与年月面板互斥、周视图不显示入口、6 套皮肤 × 深浅主题对比度、900×620 窄窗口定位、无控制台错误），关键截图见 `docs/mockups/monthly-day-stats-live-*.png`。
- 模板校验：生成的 `installer.nsi` 对比打包前保留的 0.9.1 基线，仅 `VERSION`、`VERSIONWITHBUILD` 与 `ESTIMATEDSIZE`（5060 → 5064 KB）变化；自定义覆盖升级选项、带版本窗口标题及 `NSIS_HOOK_PREINSTALL` 保持，无其他差异。
- 数据检查：`dist` 不含数据库文件，`bundle.resources` 未配置，`installer.nsi` 文件复制清单不含数据库或用户数据；源安装包与交付副本 SHA256 一致；安装包文件版本与产品版本均为 0.10.0。
- 测试版时效：`node scripts/check-test-build-stale.mjs` 在测试构建及正式打包后均输出 `0`；最新主程序大小 5,185,536 bytes，SHA256 `E1670156AEB508A8CED2B83CFDA7972D40626981D013DAEE364E5CF83A0293BD`，Windows 文件版本及产品版本均为 0.10.0。
- 注意事项：安装包与测试窗口均未由代理启动，由用户自行双击安装；源码及构建记录同步码云，安装包按既有规则保存在本地 `安装包/`，不提交编译产物。

## 2026-10-09 0.9.1 正式版

- 时间：2026-10-09 16:40:22（北京时间）
- 分支：`codex/release-0.3.4`（发布目标：码云 `origin/main` 与 `origin/codex/release-0.3.4`）
- 发布提交：`2ce2079`（`release: 0.9.1 修复待办弹窗越界与无法滚动`；构建记录另行提交）
- 版本：`0.9.1`（纯修复，修订号递增；前端包、锁文件、Tauri 配置、Rust crate 与更新公告同步）
- 命令：`npm test`；`npm run tauri build -- --no-bundle`；`npm run tauri build`。
- 构建结果：成功（退出码 0）；默认前端类型检查及生产构建通过，桌面测试程序 release 编译约 2 分 02 秒，正式打包 release 编译约 1 分 48 秒，NSIS 打包成功。
- 安装包源文件：`src-tauri/target/release/bundle/nsis/日历_0.9.1_x64-setup.exe`
- 已交付：`安装包/日历_0.9.1_x64-setup.exe`
- 大小：2,245,213 bytes（约 2.14 MiB）
- SHA256：`DEF4B8A292C271CBE90A424AC76DC06A5C63BCB4E25C433C85050341130859A9`
- 本次改动：待办编辑、新建弹窗随当前窗口限制高度，长表单可独立滚动，标题、关闭按钮及底部操作按钮保持可见；同步 0.9.1 更新公告。
- 验证：`npm test` 30/30 通过；长列表、小窗口及 12 套深浅主题验证详见下方修复记录。生产构建的浏览器实测从 0.9.0 升级会显示 0.9.1 公告、确认后刷新不重复提示、设置中可再次查看，0.9.0 历史公告保留；980×660 窗口公告显示完整，浏览器无运行异常。
- 模板校验：生成的 `installer.nsi` 对比打包前保留的 0.9.0 基线，仅 `VERSION` 与 `VERSIONWITHBUILD` 变化（0.9.1 / 0.9.1.0）；`ESTIMATEDSIZE` 仍为 5060 KB，自定义覆盖升级选项、带版本窗口标题及 `NSIS_HOOK_PREINSTALL` 保持，无其他差异。
- 数据检查：`dist` 不含数据库文件，`bundle.resources` 未配置；安装器文件复制清单不含数据库或用户数据，WebView2 使用下载引导程序模式。正式 `calendar.db` 与测试 `test-calendar.db` 继续由运行模式选择，升级清理仅作用于安装目录。源安装包与交付副本 SHA256 一致。
- 测试版时效：`node scripts/check-test-build-stale.mjs` 在测试构建及正式打包后均输出 `0`；最新主程序大小 5,181,952 bytes，SHA256 `5C38528F40BF082221CDE96815CF1769E19773586B08C9723D8E7FD7C9305A4C`，Windows 文件版本及产品版本均为 0.9.1。
- 注意事项：安装包与测试窗口均未由代理启动，由用户自行双击安装；源码及构建记录同步码云，安装包按既有规则保存在本地 `安装包/`，不提交编译产物。沙箱内默认配置加载无法解析已安装的 Vite 依赖，在沙箱外按原命令完成构建，未修改构建配置或依赖。

## 2026-10-09 待办弹窗边界与滚动修复（桌面测试构建）

- 时间：2026-10-09 16:29（北京时间，构建后核验）
- 分支：`codex/release-0.3.4`
- 提交基线：`6a9d57c`；本次修复为工作区未提交改动。
- 版本：`0.9.0`（修复记录在 CHANGELOG 的未发布条目）
- 命令：`npm run build`（由 Tauri 构建前置步骤执行）；`npm run tauri build -- --no-bundle`；`node scripts/check-test-build-stale.mjs`。
- 构建结果：成功（退出码 0）；前端类型检查及生产构建通过，Cargo release 编译约 2 分 10 秒。
- 产物：`src-tauri/target/release/calendar-tauri.exe`
- 大小：5,180,928 bytes（约 4.94 MiB）
- SHA256：`DEAFF6413D2CEB46EF46FE0EC5F14ABDE9892BE0BF61A5624BB8579CCD3A55C2`
- 本次改动：待办编辑、新建弹窗高度随窗口限制，表单单独滚动，标题、关闭按钮及底部操作按钮保持可见；仅调整弹窗布局。
- 验证：浏览器内存模式实测编辑 30 个子任务及长备注、鼠标滚轮滚动、底部保存后保留全部子任务与修改后的备注；新建表单 20 个子任务的滚动、末行回车追加及取消。两个弹窗分别覆盖 12 套深浅主题，检查 980×660、1280×820 及 980×440 可用高度，标题与按钮均未越界，浏览器无运行异常。
- 测试版时效：`node scripts/check-test-build-stale.mjs` 输出 `0`，用户打开 `启动测试窗口.bat` 可直接使用本次修复后的测试程序。
- 注意事项：沙箱内默认配置加载无法解析已安装的 Vite 依赖；在沙箱外按原构建命令完成验证，未修改项目构建配置或依赖。本次未生成 NSIS 安装包，现有安装包仍为此前正式版；未启动桌面程序或测试窗口，测试库仍由脚本使用 `CALENDAR_TEST_MODE=1` 与 `test-calendar.db`。

## 2026-10-08 0.9.0 正式版

- 时间：2026-10-08 15:01:47（北京时间）
- 分支：`codex/release-0.3.4`（同步推送码云 `origin/main` 与 `origin/codex/release-0.3.4`）
- 发布提交：`376fc52`（`release: 0.9.0 待办项目分类、轻量菜单与项目重命名`；构建记录另行提交）
- 版本：`0.9.0`（新增功能，按既有版本规则由 0.8.0 升级次版本；前端包、锁文件、Tauri 配置、Rust crate 与更新公告同步）
- 命令：`npm test`；`npm run tauri build -- --no-bundle`；`npm run tauri build`
- 构建结果：成功（退出码 0）；前端类型检查与生产构建通过，测试程序 release 编译约 2 分 08 秒，正式打包 release 编译约 1 分 37 秒，NSIS 打包成功。
- 安装包源文件：`src-tauri/target/release/bundle/nsis/日历_0.9.0_x64-setup.exe`
- 已交付：`安装包/日历_0.9.0_x64-setup.exe`
- 大小：2,244,726 bytes（约 2.14 MiB）
- SHA256：`829E4B23D3C0CC829BB0867529DBAB4CC6F862A13117F0EF577EAEA2C113A74C`
- 本次改动：普通待办、子任务和循环任务按项目管理，支持查看全部及任务所属项目调整；采用 A 版简洁项目菜单，支持新建与重命名（含默认项目），主窗口与悬浮窗同步选择及名称；统计和回收箱跟随项目，打卡与每日备注共享。SQLite v3 将旧任务归入默认项目并保留完成记录，更新公告说明项目功能与升级后的数据保留行为。
- 验证：`npm test` 30/30 通过，覆盖 SQLite 旧库迁移、项目隔离、重命名保留记录、循环任务拆分、回收箱范围及跨窗口/过期请求；项目菜单此前已完成 12 套深浅主题、键盘、最小窗口和悬浮窗验证。本次浏览器实测从 0.8.0 升级会显示 0.9.0 公告、确认后刷新不重复提示、设置中可再次查看，旧版历史保留，980×660 最小窗口显示正常，无运行异常。
- 模板校验：生成的 `installer.nsi` 对比打包前保留的 0.8.0 基线，仅 `VERSION`/`VERSIONWITHBUILD`（0.9.0 / 0.9.0.0）与 `ESTIMATEDSIZE`（5049→5060 KB）变化；自定义升级选项顺序、默认覆盖安装、带版本窗口标题与 `NSIS_HOOK_PREINSTALL` 均保持，无其他差异。
- 数据检查：`dist` 不含数据库文件，`bundle.resources` 未配置；安装器复制主程序的清单无数据库或用户数据，WebView2 使用下载引导程序模式。源安装包与交付副本 SHA256 一致，自动化验证仅使用内存数据库。
- 测试版时效：`node scripts/check-test-build-stale.mjs` 在测试构建及正式打包后均输出 `0`，用户打开 `启动测试窗口.bat` 可直接运行最新 0.9.0 测试程序。
- 注意事项：安装包和测试窗口均未由代理启动，由用户自行双击安装；源码与构建记录推送码云，安装包按仓库既有规则保存在本地 `安装包/` 目录，不提交编译产物。

## 2026-10-08 A 版项目菜单与重命名（桌面测试构建）

- 时间：2026-10-08 14:48（北京时间）
- 分支：`codex/release-0.3.4`
- 提交基线：`2d3ae9d`，本次功能为工作区未提交改动。
- 版本：`0.8.0`（功能记录在 CHANGELOG 的未发布条目）
- 命令：`npm run tauri build -- --no-bundle`
- 构建结果：成功（退出码 0）；前端类型检查与生产构建通过，Cargo release 编译约 1 分 36 秒。
- 产物：`src-tauri/target/release/calendar-tauri.exe`
- 大小：5,181,440 bytes（约 4.94 MiB）
- SHA256：`27C34C2336832FBE491A4F3AE9C74A600DB853263CD261D669BE564799F08396`
- 本次改动：采用用户选定的 A 版标题栏入口，项目名菜单集中提供切换、查看全部、新建和重命名；主窗口与悬浮窗共用，支持键盘、长名称截断及窗口边界避让。默认项目和新项目均可改名，只更新项目名称，保留任务归属、子任务进度和循环完成记录，另一窗口同步显示新名称。
- 验证：`npm test` 30/30 通过，新增 SQLite/内存实现改名后记录保留、重名/空名/长度校验，以及跨窗口刷新和过期请求验证；浏览器实际操作覆盖项目新建、改名、重名修正、查看全部、任务隔离与共享打卡，40 字项目名在最小窗口不遮挡导航；12 套深浅主题、菜单键盘操作与焦点恢复、320×480 悬浮窗改名及长列表边界通过，浏览器无运行异常。
- 测试版时效：`node scripts/check-test-build-stale.mjs` 输出 `0`，源码、配置和 dist 均已包含在最新 exe 中；旧的 13:56 测试构建已被本次产物替换。
- 数据检查：`dist` 不含数据库文件，`bundle.resources` 未配置；自动化验证仅使用内存数据库。改名不涉及表结构变更，SQLite schema 版本仍为 v3。
- 注意事项：首次构建因项目内旧测试程序（PID 11476）占用 exe 失败，核对程序绝对路径后关闭该进程，重新构建通过。本次未生成 NSIS 安装包，未启动桌面程序或测试窗口；由用户自行重新打开 `启动测试窗口.bat`，继续使用 `CALENDAR_TEST_MODE=1` 与 `test-calendar.db`。

## 2026-10-08 待办项目功能（桌面测试构建）

- 时间：2026-10-08 13:56（北京时间）
- 分支：`codex/release-0.3.4`
- 提交基线：`2d3ae9d`，本次功能为工作区未提交改动。
- 版本：`0.8.0`（功能记录在 CHANGELOG 的未发布条目）
- 命令：`npm run tauri build -- --no-bundle`
- 构建结果：成功（退出码 0）；前端类型检查与生产构建通过，Cargo release 编译约 1 分 49 秒。
- 产物：`src-tauri/target/release/calendar-tauri.exe`
- 大小：5,174,272 bytes（约 4.93 MB）
- SHA256：`65772D4E23793B8C5169B91617B5DBAC2E9300198A9D80C0704AE27ECA3577CA`
- 本次改动：项目新建/切换/查看全部；普通任务、子任务与循环任务随所属项目隔离；任务编辑支持移项，循环任务按编辑范围继承或调整归属；统计、回收箱与悬浮窗跟随当前项目。打卡与每日备注共享，原有任务由 SQLite v3 迁移归入默认项目。
- 验证：`npm test` 26/26 通过，包含真实内存 SQLite 旧库迁移、项目隔离、循环任务拆分、回收箱范围及异步切换/跨窗口通知；浏览器实际操作覆盖项目创建、任务新建、全部视图、共享打卡，以及月视图/周视图/日期详情/任务总览/悬浮窗的母子任务完成与撤销联动；6 套皮肤深浅模式和最小窗口布局通过，浏览器无运行异常。
- 测试版时效：`node scripts/check-test-build-stale.mjs` 输出 `0`，源码、配置和 dist 均已包含在最新 exe 中。
- 数据检查：`dist` 不含数据库文件，`bundle.resources` 未配置；自动化验证仅使用内存数据库，未打开正式库或测试库。
- 注意事项：本次仅构建桌面测试程序，未生成 NSIS 安装包，未启动桌面程序或测试窗口。由用户自行打开 `启动测试窗口.bat`，继续使用 `CALENDAR_TEST_MODE=1` 与 `test-calendar.db`。

## 2026-09-20 0.8.0 正式版

- 时间：2026-09-20 15:13
- 分支：`codex/release-0.3.4`（推送 origin main）
- 提交：`92e16a7`（`release: 0.8.0 日历模式年月选择面板（选年选月快速跳转）`）
- 版本：`0.8.0`
- 命令：`npm run tauri build`
- 构建结果：成功（退出码 0；首次尝试因测试窗口进程占用 `calendar-tauri.exe` 报 os error 5，停止运行中的两个日历进程后重试成功）
- 安装包源文件：`src-tauri/target/release/bundle/nsis/日历_0.8.0_x64-setup.exe`
- 已交付：`安装包/日历_0.8.0_x64-setup.exe`
- 大小：2,232,949 bytes（约 2.13 MB）
- SHA256：`FDB2174162E9867A567D4F69531947AB8330FBDA3D7AC1C28C1C18F6F585D8E4`
- 耗时：前端约 3.9 秒；Cargo release 增量编译；NSIS 打包成功。
- 本次改动：日历模式年月选择面板——点击标题「2026年 2月」弹出年月面板，12 宫格选月（当前月高亮、今天所在月带圆点）；面板内点击年份切换为年份宫格（12 年一页整页翻动、选中年高亮、今天所在年带圆点、范围 1900–2100 与农历表一致），完成「选年 → 选月」两级跳转；store 新增 `goToMonth`。面板 portal 到 body 修复了 `.surface-header` 前景色变量覆盖导致新年中国红浅色皮肤下面板文字不可读的问题；6 套皮肤深浅实测核验。
- 模板校验：`installer.nsi` 与 0.7.0 基线 diff 仅 `VERSION`/`VERSIONWITHBUILD`（0.8.0 / 0.8.0.0）与 `ESTIMATEDSIZE`（5048→5049 KB）预期差异，无其他改动。
- 验证：`npm test` 通过（8/8，fail 0）；`npm run build` 通过；`npm run tauri build` 成功；`dist` 无 `*.db`；`bundle.resources` 未配置。年月面板交互（选年/翻页/跳转春节与 2020 年 1 月）已通过浏览器实机核验。
- 其他：构建期 cargo 重新锁定，`Cargo.lock` 中 3 个传递依赖（keyboard-types、pem-rfc7468、radium）由 0.8.0 版本线降级至 0.7.0 版本线，`calendar-tauri` 本身保持 0.8.0，已随 docs 提交入库。
- 注意事项：安装包已交付但未由代理启动；打包前已停止用户开启的测试窗口进程，升级安装或重开 `启动测试窗口.bat` 即可看到 0.8.0。

## 2026-09-20 0.7.0 正式版

- 时间：2026-09-20 11:07
- 分支：`codex/release-0.3.4`（推送 origin main）
- 提交：`9b498c9`（`release: 0.7.0 法定节假日与调休展示、日历模式（农历/节气/节假日纯日历）`）
- 版本：`0.7.0`
- 命令：`npm run tauri build`
- 构建结果：成功（退出码 0）
- 安装包源文件：`src-tauri/target/release/bundle/nsis/日历_0.7.0_x64-setup.exe`
- 已交付：`安装包/日历_0.7.0_x64-setup.exe`
- 大小：2,232,205 bytes（约 2.13 MB）
- SHA256：`264613B90CD3B50115199A191A4EF5B20764990A0852278398DA79E2C7EEC020`
- 耗时：前端约 3.75 秒；Cargo release 增量编译 2 分 15 秒；NSIS 打包成功。
- 本次改动：①月视图格子法定节假日与调休展示（「休/班」角标、假期代表日节日名、悬浮说明气泡，数据内置 `src/lib/holidays.ts`，国办 2025–2026 安排）；②日历模式（标题栏切换按钮，纯日历视图展示农历、二十四节气、农历/公历节日与休/班角标，隐藏任务日程与右侧栏）；③农历数据层 `src/lib/lunar.ts` + `lunar-data.ts`（1900–2100 内置表，提取自 solarlunar 权威数据，与其实现全量比对 1901–2099 每日 0 不一致、4,776 个节气全部正确）；④新增主题令牌 `--holiday-bg/fg`、`--makeup-bg/fg`、`--term-fg`，6 套皮肤深浅 12 个主题块逐一适配；⑤休/班角标与气泡抽取为共用组件 `HolidayBadge`（portal 防裁切）。
- 模板校验：`installer.nsi` 与 0.6.2 基线 diff 仅 `VERSION`/`VERSIONWITHBUILD`（0.7.0 / 0.7.0.0）与 `ESTIMATEDSIZE`（5044→5048 KB）预期差异，无其他改动；`installer-hooks.nsh` 引用与 `NSIS_HOOK_PREINSTALL` 在位。
- 验证：`npm test` 通过（8/8，fail 0）；`npm run build` 通过；农历换算与 solarlunar 全量比对通过；`npm run tauri build` 成功；`dist` 无 `*.db`；`bundle.resources` 未配置。
- 注意事项：安装包已交付但未由代理启动；用户自行双击安装并测试，测试窗口也由用户自行打开。日历模式与节假日角标已另行通过浏览器实机核验（切换/退出/多皮肤）。

## 2026-09-14 0.6.2 正式版

- 时间：2026-09-14 16:59
- 分支：`codex/release-0.3.4`（推送 origin main）
- 提交：`ab22554`（`release: 0.6.2 完成任务联动子任务，主界面与悬浮窗逻辑对齐`）
- 版本：`0.6.2`
- 命令：`npm run tauri build`
- 构建结果：成功（退出码 0）
- 安装包源文件：`src-tauri/target/release/bundle/nsis/日历_0.6.2_x64-setup.exe`
- 已交付：`安装包/日历_0.6.2_x64-setup.exe`
- 大小：2,228,299 bytes（约 2.1 MB）
- SHA256：`B225E90318D6A276A823ACFDCF8888BD600354D12E146EB5A83972D57474FFD0`
- 耗时：前端约 3.3 秒；Cargo release 增量编译；NSIS 打包成功。
- 本次改动：完成任务与悬浮窗逻辑全面对齐——store 层（`updateTask`/`updateOccurrence`）在完成母任务时把本地子任务联动置为完成（仅展示层，不改数据库），取消完成时非循环任务由 `updateTask` 返回值、循环任务由调用方重新拉取恢复真实状态；周视图/月视图/日期详情/任务总览全入口生效。同时沉淀 `AGENTS.md` 规范第 11 条「待办完成逻辑全端一致」。
- 模板校验：`installer.nsi` 与 0.6.1 基线 diff 仅 `VERSION`/`VERSIONWITHBUILD`（0.6.2 / 0.6.2.0）预期差异，无其他改动；`installer-hooks.nsh` 引用与 `NSIS_HOOK_PREINSTALL` 在位。
- 验证：`npm test` 通过（8/8，fail 0）；`npm run build` 通过；`npm run tauri build` 成功；`dist` 无 `*.db`；`bundle.resources` 未配置。
- 注意事项：安装包已交付但未由代理启动；用户自行双击安装并测试，测试窗口也由用户自行打开。

## 2026-09-14 0.6.1 正式版

- 时间：2026-09-14 16:46
- 分支：`codex/release-0.3.4`（推送 origin main）
- 提交：`1aef541`（`release: 0.6.1 修复完成任务后子任务消失`）
- 版本：`0.6.1`
- 命令：`npm run tauri build`
- 构建结果：成功（退出码 0）
- 安装包源文件：`src-tauri/target/release/bundle/nsis/日历_0.6.1_x64-setup.exe`
- 已交付：`安装包/日历_0.6.1_x64-setup.exe`
- 大小：2,227,964 bytes（约 2.1 MB）
- SHA256：`DF9B689696D4E1B51CAE3CB2681B5099253DC8A215278BF74476E73183CCD519`
- 耗时：前端约 3.5 秒；Cargo release 增量编译；NSIS 打包成功。
- 本次改动：修复完成带子任务的非循环任务后子任务消失——`updateTask` 返回值经 `getTaskById`/`mapTask` 组装不含子任务，store 直接用其整体替换本地任务，而 Tauri 下数据变更通知只发给另一窗口、主窗口不重新拉取，导致周视图/日期详情/任务总览中子任务消失且不恢复。现 `updateTask` 返回值附带子任务并按（子任务，截止日期）注入完成状态（SQLite 新增 `loadSubtasksWithState`，内存实现对等刷新）。0.5.0 引入的类似问题曾只修了 `createTask`（0.3.5），本次补齐 `updateTask` 路径。
- 模板校验：`installer.nsi` 与 0.6.0 基线 diff 仅 `VERSION`/`VERSIONWITHBUILD`（0.6.1 / 0.6.1.0）预期差异，无其他改动；`installer-hooks.nsh` 引用与 `NSIS_HOOK_PREINSTALL` 在位。
- 验证：`npm test` 通过（8/8，fail 0）；`npm run build` 通过；`npm run tauri build` 成功；`dist` 无 `*.db`；`bundle.resources` 未配置。
- 注意事项：安装包已交付但未由代理启动；用户自行双击安装并测试，测试窗口也由用户自行打开。

## 2026-09-14 0.6.0 正式版

- 时间：2026-09-14 16:32
- 分支：`codex/release-0.3.4`（与本地 main 同点，推送 origin main）
- 提交：`cbf3027`（`release: 0.6.0 任务与子任务完成反馈动画`）
- 版本：`0.6.0`
- 命令：`npm run tauri build`
- 构建结果：成功（退出码 0）
- 安装包源文件：`src-tauri/target/release/bundle/nsis/日历_0.6.0_x64-setup.exe`
- 已交付：`安装包/日历_0.6.0_x64-setup.exe`
- 大小：2,227,533 bytes（约 2.1 MB）
- SHA256：`811F416D4650B55FA98D7B52D6BBA0B34E915B962C66A713833E1BC2759FA594`
- 耗时：前端约 3.3 秒；Cargo release 约 1 分 39 秒；NSIS 打包成功。
- 本次改动：任务与子任务完成反馈动画——主界面与悬浮窗勾选完成时对勾弹跳放大、任务行绿色脉冲光晕；任务总览待完成列表与悬浮窗中刚完成任务宽限期（1.2 秒）原地展示后再移除/沉底；悬浮窗当日全部完成时小撒花庆祝；编辑弹窗已保存子任务勾选有对勾弹跳（初始已勾选不重放）。新增 `src/lib/use-completion-feedback.ts`（`useJustCompleted` / `useJustCompletedMap`）。按版本规则次版本进位 0.5.1 → 0.6.0，公告与 CHANGELOG 同步。
- 模板校验：`installer.nsi` 与 0.5.1 基线 diff 仅 `VERSION`/`VERSIONWITHBUILD`（0.6.0 / 0.6.0.0）与 `ESTIMATEDSIZE`（5044）预期差异，无其他改动；`installer-hooks.nsh` 引用与 `NSIS_HOOK_PREINSTALL` 在位。
- 验证：`npm test` 通过（8/8，fail 0）；`npm run build` 通过；`npm run tauri build` 成功；`dist` 无 `*.db`；`bundle.resources` 未配置。
- 注意事项：打包前结束了占用 `target/release/calendar-tauri.exe` 的测试窗口进程（PID 3432），用户正在运行的正式版（`D:\日历`，PID 21292）未受影响；安装包已交付但未由代理启动，用户自行双击安装，测试窗口由用户自行打开。

## 2026-09-07 0.5.1 正式版

- 时间：2026-09-07 10:13
- 分支：`codex/release-0.3.4`
- 提交：`d6275d7`（`release: 0.5.1 修复任务改期后子任务完成状态被重置`）
- 版本：`0.5.1`
- 命令：`npm run tauri build`
- 构建结果：成功（退出码 0）
- 安装包源文件：`src-tauri/target/release/bundle/nsis/日历_0.5.1_x64-setup.exe`
- 已交付：`安装包/日历_0.5.1_x64-setup.exe`
- 大小：2,226,600 bytes（约 2.1 MB）
- SHA256：`4c05babb59b069910bc3c908a8e203a95c520c5dd1af6e322a37183403624004`
- 耗时：前端约 3.8 秒；Cargo release 约 2 分 32 秒；NSIS 打包成功。
- 本次改动：修复任务改期后子任务完成状态被重置——非循环任务改期时 `updateTask` 将子任务完成记录（`subtask_occurrences`，按子任务+日期存储）随任务迁移到新日期（SQLite 与内存实现一致），编辑弹窗勾选变化改写入新日期。纯修复，按版本规则修订号进位 0.5.0 → 0.5.1，公告与 CHANGELOG 同步。
- 模板校验：生成模板 `installer.nsi`：`installer-hooks.nsh` 引用与 `NSIS_HOOK_PREINSTALL` 在位，`VERSION`/`VERSIONWITHBUILD` 为 0.5.1 / 0.5.1.0。
- 验证：`npm test` 通过（8/8，fail 0）；`npm run build` 通过；`npm run tauri build` 成功；`dist` 与 bundle 目录无 `*.db`；`bundle.resources` 未配置。
- 注意事项：安装包已交付但未由代理启动；用户自行双击安装并测试，测试窗口也由用户自行打开。

## 2026-09-04 0.5.0 正式版

- 时间：2026-09-04
- 分支：`codex/release-0.3.4`
- 提交：见下（`feat: 循环打卡支持按范围删除（仅限此日程/此前所有/未来所有，skipDates 迁移 v2）` + `fix: 任务总览新增按钮统一弹出居中新建弹窗，移除侧栏内联新建` + `release: 0.5.0 循环打卡范围删除与任务总览居中新建弹窗` + `docs: 记录 0.5.0 构建信息`）
- 版本：`0.5.0`
- 命令：`npm run tauri build`
- 构建结果：成功（退出码 0）
- 安装包源文件：`src-tauri/target/release/bundle/nsis/日历_0.5.0_x64-setup.exe`
- 已交付：`安装包/日历_0.5.0_x64-setup.exe`
- 大小：2,226,174 bytes（约 2.1 MB）
- SHA256：`94cc59b8d3a92499d2406cf87e200075ac3d2462da6612302bf21615d60529a6`
- 耗时：前端约 3.9 秒；Cargo release 约 2 分 07 秒；NSIS 打包成功。
- 本次改动：循环打卡支持按范围删除（仅限此日程/此前所有/未来所有，`checkin_definitions` 新增 `skipDates` 列，迁移 v2，各界面按天过滤打卡收敛到 `checkinActiveOn`）；任务总览「新增」统一弹出居中新建弹窗（新增 `TaskCreateDialog`），移除侧栏内联新建表单。含新功能，按版本规则次版本进位 0.4.1 → 0.5.0，公告与 CHANGELOG 同步。
- 模板校验：仓库未存官方基线文件，本次核验生成模板 `installer.nsi`：`installer-hooks.nsh` 引用与 `NSIS_HOOK_PREINSTALL` 在位，自定义升级页文案（第一行「覆盖旧版本并升级」默认勾选）在位，`VERSION`/`VERSIONWITHBUILD` 为 0.5.0 / 0.5.0.0。
- 验证：`npm test` 通过（fail 0）；`npm run build` 通过；`npm run tauri build` 成功；`dist` 无 `*.db`；`bundle.resources` 未配置。
- 注意事项：安装包已交付但未由代理启动，由用户自行安装；本次发布同步推送码云 `main`。

## 2026-09-02 0.4.1 正式版

- 时间：2026-09-02
- 分支：`codex/release-0.3.4`
- 提交：见下（`fix: 任务总览编辑按钮统一弹出居中编辑弹窗，移除侧栏行内编辑` + `release: 0.4.1 任务总览编辑统一弹出居中弹窗` + `docs: 记录 0.4.1 构建信息`）
- 版本：`0.4.1`
- 命令：`npm run tauri build`
- 构建结果：成功（退出码 0）
- 安装包源文件：`src-tauri/target/release/bundle/nsis/日历_0.4.1_x64-setup.exe`
- 已交付：`安装包/日历_0.4.1_x64-setup.exe`
- 大小：2,225,471 bytes（约 2.1 MB）
- SHA256：`73a4c1dc5279237883916a7e0e32ba4aeee1816042860f3feb23fe40966b48e3`
- 耗时：前端约 4.1 秒；Cargo release 增量编译；NSIS 打包成功。
- 本次改动：任务总览编辑按钮统一弹出居中编辑弹窗（此前非循环任务在侧栏内行内编辑，宽度受限信息展示不全），移除行内编辑表单相关代码（净删 56 行）；纯修复批次，按版本规则修订号进位 0.4.0 → 0.4.1，公告与 CHANGELOG 同步。
- 模板校验：`diff --strip-trailing-cr` 对比 0.3.5 官方基线共 55 行差异，与历史构建完全一致（均为既有自定义改动与版本号/ESTIMATEDSIZE 行），无新增差异；`NSIS_HOOK_PREINSTALL` 在位。
- 验证：`npm test` 8/8；`npm run build` 通过；`npm run tauri build` 成功；`dist` 无 `*.db`；`bundle.resources` 未配置。
- 注意事项：打包前测试窗口 `calendar-tauri.exe`（PID 28984）仍在运行，已结束进程后一次构建成功；安装包未由代理启动，用户自行双击安装测试；本次发布完成后合并 main 并推送码云。

## 2026-09-02 0.4.0 正式版

- 时间：2026-09-02
- 分支：`codex/release-0.3.4`
- 提交：见下（`feat: 循环任务删除新增「此日程及此前所有」范围` + `fix: 循环任务删除按钮直达删除范围选择，不再误开编辑弹窗` + `fix: 修复删除范围弹窗空日期兜底导致启动白屏（format 抛 Invalid time value）` + `release: 0.4.0 循环任务删除范围与删除入口优化` + `docs: 记录 0.4.0 构建信息`）
- 版本：`0.4.0`
- 命令：`npm run tauri build`
- 构建结果：成功（退出码 0）
- 安装包源文件：`src-tauri/target/release/bundle/nsis/日历_0.4.0_x64-setup.exe`
- 已交付：`安装包/日历_0.4.0_x64-setup.exe`
- 大小：2,226,009 bytes（约 2.1 MB）
- SHA256：`fd514ac180ae68a3408263ccf7515031814445b7ae2521291115e1087cc1d49b`
- 耗时：前端约 4.3 秒；Cargo release 增量编译；NSIS 打包成功。
- 本次改动：循环任务删除新增「此日程及此前所有」范围（此前循环日批量标记 `isSkipped`，覆盖序列末尾则整条任务进回收站）；循环任务垃圾桶直达删除范围选择（侧栏/日历详情/编辑弹窗三处入口统一 `applyRecurringDelete`）；修复删除范围弹窗空日期兜底导致的启动白屏。版本号 0.3.11 → 0.4.0——本版本起版本规则明确：带新功能的发布进位次版本（x.Y.0），纯修复进位修订号（x.y.Z），公告与 CHANGELOG 同步。
- 模板校验：`diff --strip-trailing-cr` 对比 0.3.5 官方基线共 55 行差异，与历史构建完全一致（均为既有自定义改动与版本号/ESTIMATEDSIZE 行），无新增差异；`NSIS_HOOK_PREINSTALL` 在位。
- 验证：`npm test` 8/8；`npm run build` 通过；`npm run tauri build` 成功；`dist` 无 `*.db`；`bundle.resources` 未配置。
- 注意事项：打包前无运行中的旧进程，一次构建成功；白屏问题仅在未发布的测试构建中出现过，未影响任何已交付安装包；安装包未由代理启动，用户自行双击安装测试；本次发布完成后合并 main 并推送码云。

## 2026-09-02 0.3.11 正式版

- 时间：2026-09-02
- 分支：`codex/release-0.3.4`
- 提交：见下（`fix: 修复子任务拖拽无法直达列表首尾位置（无让位动画且与首末行重合）` + `release: 0.3.11 修复子任务拖拽首尾落点` + `docs: 记录 0.3.11 构建信息`）
- 版本：`0.3.11`
- 命令：`npm run tauri build`
- 构建结果：成功（退出码 0）
- 安装包源文件：`src-tauri/target/release/bundle/nsis/日历_0.3.11_x64-setup.exe`
- 已交付：`安装包/日历_0.3.11_x64-setup.exe`
- 大小：2,225,974 bytes（约 2.1 MB）
- SHA256：`a191fe222ad5bbccb68dc6f612d6cbe51dfdcc588545543f1ff6151384b1b951`
- 耗时：前端约 3.4 秒；Cargo release 增量编译；NSIS 打包成功。
- 本次改动：修复子任务拖拽无法直达列表首尾位置的问题（位移钳制从首/末行中线改为按行边缘 + 2px 余量，首尾落点可正常触发让位动画，被拖行贴合目标槽位）；版本号 0.3.10 → 0.3.11，公告与 CHANGELOG 同步。该修复曾以 0.3.10 二次交付，现随 0.3.11 正式发布，0.3.10 二次交付安装包作废。
- 模板校验：`diff --strip-trailing-cr` 对比 0.3.5 官方基线共 55 行差异，与历史构建完全一致（均为既有自定义改动与版本号/ESTIMATEDSIZE 行），无新增差异；`NSIS_HOOK_PREINSTALL` 在位。
- 验证：`npm test` 8/8；`npm run build` 通过；`npm run tauri build` 成功；`dist` 无 `*.db`；`bundle.resources` 未配置。
- 注意事项：打包前无运行中的旧进程，一次构建成功；安装包未由代理启动，用户自行双击安装测试；本次发布完成后合并 main 并推送码云。

## 2026-09-02 0.3.10 正式版

- 时间：2026-09-02（打包时刻见本节首行日期）
- 分支：`codex/release-0.3.4`
- 提交：见下（`feat: 子任务支持拖拽排序，循环任务编辑弹窗展示并保存子任务` + `release: 0.3.10 新增子任务拖拽排序` + `docs: 记录 0.3.10 构建信息`）
- 版本：`0.3.10`
- 命令：`npm run tauri build`
- 构建结果：成功（退出码 0）
- 安装包源文件：`src-tauri/target/release/bundle/nsis/日历_0.3.10_x64-setup.exe`
- 已交付：`安装包/日历_0.3.10_x64-setup.exe`
- 大小：2,226,180 bytes（约 2.1 MB）
- SHA256：`b7cb60ab0fa2750dc989c9777c66d8ceffafc7084c639cbee7ccfc36b9828a7b`
- 耗时：前端约 3.3 秒；Cargo release 约 1 分 40 秒；NSIS 打包成功。
- 本次改动：子任务支持拖拽排序（`SubtaskInputList` 每行新增握把手柄，指针事件自实现，7 处编辑/新建入口全部生效，顺序随保存写入 `sortOrder`）；修复编辑循环任务时子任务不显示的问题——循环任务编辑弹窗现在展示子任务列表（可勾选/增删改/拖拽），保存时随所选范围应用（仅此次落到拆出的单次任务，此后全部落到新序列并按原子任务 id 迁移起始日期后的完成记录，保留历史进度）；版本号 0.3.9 → 0.3.10，公告与 CHANGELOG 同步。
- 模板校验：`diff --strip-trailing-cr` 对比 0.3.5 官方基线共 55 行差异，与 0.3.8/0.3.9 构建完全一致（均为既有自定义改动与版本号/ESTIMATEDSIZE 行，`ESTIMATEDSIZE` 5038→5042 正常波动），无新增差异；`NSIS_HOOK_PREINSTALL` 在位。
- 验证：`npm test` 8/8；`npm run build` 通过；`npm run tauri build` 成功；`dist` 无 `*.db`；`bundle.resources` 未配置。
- 注意事项：打包前旧版 `calendar-tauri.exe` 正在运行，已结束进程后构建一次成功；安装包未由代理启动，用户自行双击安装测试；本次发布完成后合并 main 并推送码云。
- **二次交付（2026-09-02）**：用户实测反馈子任务拖拽无法直达列表最上/最下位置（无让位动画且与首/末行重合）。根因：拖拽位移钳制在首/末行中线处，而落点判定要求行中线严格越过阈值，钳制极限恰等于阈值导致首尾落点永远无法触发。修复：位移改按行边缘钳制并留 2px 越界余量（`SubtaskInputList.tsx`）。`npm run build` 通过、`npm test` 8/8；模板校验仍为 55 行既有差异；`dist` 无 `*.db`。重新打包覆盖交付：大小 2,225,264 bytes，SHA256 `2b2464fb2d4b904a73dcf39288fb35be4bad0b4d1446a8eb0e05ffd734f98045`，覆盖 `安装包/日历_0.3.10_x64-setup.exe`（首版 SHA256 `b7cb60ab0fa2750dc989c9777c66d8ceffafc7084c639cbee7ccfc36b9828a7b` 作废）。**后该修复随 0.3.11 正式发布，本二次交付安装包作废，以 `安装包/日历_0.3.11_x64-setup.exe` 为准。**

## 2026-09-01 0.3.9 正式版

- 时间：2026-09-01 09:04:00
- 分支：`codex/release-0.3.4`
- 提交：见下（`fix: 编辑任务弹窗展示子任务完成状态并可切换` + `release: 0.3.9 修复编辑任务弹窗子任务完成状态展示` + `docs: 记录 0.3.9 构建信息`）
- 版本：`0.3.9`
- 命令：`npm run tauri build`
- 构建结果：成功（退出码 0）
- 安装包源文件：`src-tauri/target/release/bundle/nsis/日历_0.3.9_x64-setup.exe`
- 已交付：`安装包/日历_0.3.9_x64-setup.exe`
- 大小：2,223,990 bytes（约 2.1 MB）
- SHA256：`2c37c67dbaca1b5fd7ad8d299dc3e0f952fdc7133ca0b47970226cf97fe59377`
- 耗时：前端约 3.9 秒；Cargo release 约 1 分 52 秒；NSIS 打包成功。
- 本次改动：修复编辑任务弹窗中子任务不展示完成状态的问题——子任务项前新增勾选框（绿色勾选 + 删除线置灰，与日历/侧边栏样式一致），可点击切换，保存时经 `toggleSubtask` 按任务原截止日期同步 `subtask_occurrences`；新建任务时子任务未持久化不显示勾选框；版本号 0.3.8 → 0.3.9，公告与 CHANGELOG 同步。
- 模板校验：`diff --strip-trailing-cr` 对比 0.3.5 官方基线共 55 行差异，与 0.3.8 构建完全一致（均为既有自定义改动与版本号/ESTIMATEDSIZE 行，`ESTIMATEDSIZE` 5041 正常波动），无新增差异；`NSIS_HOOK_PREINSTALL` 在位。
- 验证：`npm test` 8/8；`npm run build` 通过；`npm run tauri build` 成功；`dist` 无 `*.db`；`bundle.resources` 未配置。
- 注意事项：打包前旧版 `calendar-tauri.exe`（主窗口 + 悬浮窗两个进程）正在运行导致首次构建失败（os error 5 拒绝访问），已结束进程后重试成功；安装包未由代理启动，用户自行双击安装测试；本次发布完成后分支与 main 同步合并并推送码云。

## 2026-08-28 0.3.8 正式版

- 时间：2026-08-28 16:30:50
- 分支：`codex/release-0.3.4`
- 提交：`3aaf63f`（`release: 0.3.8 新增蒸汽波皮肤`，前置功能提交 `64a67a2`）
- 版本：`0.3.8`
- 命令：`npm run tauri build`
- 构建结果：成功（退出码 0）
- 安装包源文件：`src-tauri/target/release/bundle/nsis/日历_0.3.8_x64-setup.exe`
- 已交付：`安装包/日历_0.3.8_x64-setup.exe`
- 大小：2,224,282 bytes（约 2.1 MB）
- SHA256：`9BA3FF4D99517FB4633F4686DAA5B4D5DE7C8499BBE30C4D94A53BCA262454FA`
- 耗时：前端约 3.4 秒；Cargo release 增量编译；NSIS 打包成功。
- 本次改动：皮肤列表新增「蒸汽波 Vaporwave」（含浅色/深色，取自 UI 画廊风格 35）——浅色马卡龙粉紫青 pastel + 三处柔光，深色霓虹深紫 + 电光蓝网格地平线 + 粉青渐变；皮肤总数达 6 款；版本号 0.3.7 → 0.3.8，公告与 CHANGELOG 同步。
- 模板校验：`diff --strip-trailing-cr` 对比 0.3.5 官方基线共 55 行差异，与 0.3.7 构建完全一致（均为既有自定义改动与版本号/ESTIMATEDSIZE 行），无新增差异；`NSIS_HOOK_PREINSTALL` 在位。
- 验证：`npm test` 8/8；`npm run build` 通过；`npm run tauri build` 成功；`dist` 无 `*.db`；`bundle.resources` 未配置。
- 注意事项：安装包已交付但未由代理启动，用户自行双击安装测试；本次发布完成后分支与 main 同步合并并推送码云。

## 2026-08-28 0.3.7 正式版

- 时间：2026-08-28 15:52:38
- 分支：`codex/release-0.3.4`
- 提交：`43329b3`（`release: 0.3.7 新增新年中国红与报纸印刷皮肤`，前置功能提交 `02a96f0`）
- 版本：`0.3.7`
- 命令：`npm run tauri build`
- 构建结果：成功（退出码 0）
- 安装包源文件：`src-tauri/target/release/bundle/nsis/日历_0.3.7_x64-setup.exe`
- 已交付：`安装包/日历_0.3.7_x64-setup.exe`
- 大小：2,223,422 bytes（约 2.1 MB）
- SHA256：`B8901E643901DB835BE1ECA3B79A21EF1F2FCBE7225A6C96BB530C99995D61C3`
- 耗时：前端约 3.9 秒；Cargo release 约 1 分 58 秒；NSIS 打包成功。
- 本次改动：皮肤列表新增两款（含浅色/深色）——新年中国红（`skin-cny`，象牙纸底 + 朱红鎏金，深色朱漆夜宴）与报纸印刷（`skin-press`，新闻纸米白 + 衬线墨黑，深色油墨夜报），取自 UI 画廊风格 13 与风格 30；版本号 0.3.6 → 0.3.7，公告与 CHANGELOG 同步。
- 模板校验：`diff --strip-trailing-cr` 对比 0.3.5 官方基线（`src-tauri/target/installer-baseline-0.3.5.nsi`），共 55 行差异，全部为既有自定义改动（模板头注释、版本号 define、窗口标题带版本、`coverUpgrade` 文案、升级/降级页选项对调与默认勾选逻辑、降级禁用项 $R3→$R2）及 `ESTIMATEDSIZE` 5038→5039（体积正常波动），无其他差异；生成脚本仍含 `installer-hooks.nsh` include 与 `NSIS_HOOK_PREINSTALL`。
- 验证：`npm test` 8/8；`npm run build` 通过；`npm run tauri build` 成功；`dist` 无 `*.db`；`bundle.resources` 未配置。
- 注意事项：安装包已交付但未由代理启动，用户自行双击安装测试（可在设置→换肤中查看 5 款皮肤的浅色/深色效果）；测试窗口由用户自行打开；本次随发布一并推送码云（含 0.3.6 遗留未推送提交 `f0a9c8a`）。

## 2026-08-28 0.3.6 正式版

- 时间：2026-08-28 12:16:36
- 分支：`codex/release-0.3.4`
- 提交：`6edadbf`（`release: 0.3.6 升级安装默认直接覆盖，不再默认卸载旧版`）
- 版本：`0.3.6`
- 命令：`npm run tauri build`
- 构建结果：成功（退出码 0）
- 安装包源文件：`src-tauri/target/release/bundle/nsis/日历_0.3.6_x64-setup.exe`
- 已交付：`安装包/日历_0.3.6_x64-setup.exe`
- 大小：2,221,576 bytes（约 2.1 MB）
- SHA256：`7FC693018D86E0F9A8CA1063FE6FFA733F59E6CBDC47A168CC766EC6933A16AF`
- 耗时：前端约 3.7 秒；Cargo release 约 1 分 30 秒；NSIS 打包成功。
- 本次改动：引入自定义 NSIS 模板 `src-tauri/windows/installer.nsi`（基于 `tauri-cli-v2.11.4` 官方模板，经 jsDelivr CDN 下载，`bundle.windows.nsis.template` 启用），重装选择页在升级/降级时默认勾选"不卸载直接安装"（同版本重装保持原默认）；旧进程停止与安装目录清理仍由 `installer-hooks.nsh` 的 `NSIS_HOOK_PREINSTALL` 完成；版本号 0.3.5 → 0.3.6，公告与 CHANGELOG 同步。
- 模板校验：`diff --strip-trailing-cr` 对比 0.3.5 基线（`src-tauri/target/installer-baseline-0.3.5.nsi`），差异仅为模板头注释、版本号行与默认勾选逻辑三处，证明模板与 CLI 2.11.4 内嵌版本完全一致；生成脚本仍含 `Page custom PageReinstall`（L187）、`installer-hooks.nsh` include（L36）与 `NSIS_HOOK_PREINSTALL`（L647）。
- 验证：`npm test` 7/7；`npm run build` 通过；`npm run tauri build` 成功；`dist` 无 `*.db`；`bundle.resources` 未配置。
- 注意事项：GitHub raw 直连超时，模板改用 jsDelivr CDN（`cdn.jsdelivr.net/gh/tauri-apps/tauri@tauri-cli-v2.11.4/...`）下载；安装包已交付但未由代理启动，用户需在装有 0.3.5 的机器上实测升级流程（应默认勾选"不卸载直接安装"），测试窗口由用户自行打开。
- **二次交付（2026-08-28 12:45）**：用户反馈升级页默认仍勾选"安装前卸载"。经三重实证排查（生成脚本 diff、静默探针实测 SemverCompare 返回 1 且分支判定 UPG:R3、页面控件探针实测 R3 勾选生效），确认首版 0.3.6 安装包逻辑正确，所截页面应来自旧版安装包运行实例。为彻底消除版本歧义，模板 `Name` 增加版本号（窗口标题显示"日历 0.3.6 安装"），同版本重新打包交付：大小 2,221,192 bytes，SHA256 `BE2E628A6BF0906B147BBC4D81A7DBC397AB2892438F4F321BD128753FD8213D`，覆盖 `安装包/日历_0.3.6_x64-setup.exe`（首版 SHA256 `7FC693018D86E0F9A8CA1063FE6FFA733F59E6CBDC47A168CC766EC6933A16AF` 作废）。升级页默认勾选行为两次交付一致。
- **三次交付（2026-08-28 12:55，应用户要求）**：升级/降级页两个选项位置与文案对调——第一行改为"覆盖旧版本并升级"（自定义 LangString `coverUpgrade`，默认勾选，选中后直接覆盖安装不卸载），第二行"安装前卸载"；`PageLeaveReinstall` 升级/降级分支同步对调（第一行选中 → reinst_done），禁止降级时禁用项由 $R3 改为 $R2；同版本重装页保持原样。再次以探针实测新布局（第一行文案与默认勾选正确）。本机注册表确认用户已通过此前交付成功升级至 0.3.6。大小 2,221,263 bytes，SHA256 `FCCFD702D9532FFF5972C266849B5DACC76DF32C5467752AEEAC246175B4CBCB`，覆盖 `安装包/日历_0.3.6_x64-setup.exe`（二次交付哈希作废）。本次改动仅本地提交，未推送码云。

## 2026-08-28 0.3.5 正式版

- 时间：2026-08-28 11:33:07
- 分支：`codex/release-0.3.4`
- 提交：`8650547`（`release: 0.3.5 修复新建任务子任务不显示与回车误提交`）
- 版本：`0.3.5`
- 命令：`npm run tauri build`
- 构建结果：成功（退出码 0）
- 安装包源文件：`src-tauri/target/release/bundle/nsis/日历_0.3.5_x64-setup.exe`
- 已交付：`安装包/日历_0.3.5_x64-setup.exe`
- 大小：2,221,137 bytes（约 2.1 MB）
- SHA256：`3D7C520940E1929523B73567880CEA6F302197519AD8BF62B8E6AEFEB301DEE6`
- 耗时：前端约 3.4 秒；Cargo release 约 1 分 38 秒；NSIS 打包成功。
- 本次改动：修复新建任务后子任务不显示的问题（`createTask` 返回值补带 `subtasks`，SQLite 与内存降级实现同步修复）；修复子任务输入框按回车误提交整个表单的问题，回车改为确认当前条目并自动追加下一行；应用公告与版本号同步更新至 0.3.5。
- 验证：`npm test` 7/7；`npm run build` 通过；`npm run tauri build` 成功；`dist` 无 `*.db`；`bundle.resources` 未配置。
- 注意事项：安装包已交付但未由代理启动，用户自行双击安装并测试，测试窗口也由用户自行打开。

## 2026-08-27 0.3.4 正式版

- 时间：2026-08-27 17:24:59
- 分支：`codex/release-0.3.4`
- 提交：`bb91cdb`（`release: 0.3.4 完成悬浮窗尺寸记忆与窗口恢复修复`）
- 版本：`0.3.4`
- 命令：`npm run tauri build -- --bundles nsis --verbose`
- 构建结果：成功（退出码 0）
- 安装包源文件：`src-tauri/target/release/bundle/nsis/日历_0.3.4_x64-setup.exe`
- 已交付：`安装包/日历_0.3.4_x64-setup.exe`
- 大小：2,220,209 bytes（约 2.1 MB）
- SHA256：`69FFB82A95552A92FE4E254A247DA0C68714443A18DF8E08F2F8A9A493811510`
- 耗时：前端约 3.6 秒；Cargo release 约 1 分 58 秒；NSIS 打包成功。
- 本次改动：悬浮窗启动时恢复用户保存的位置与缩放尺寸，解决重启后缩放被重置的问题；完善窗口恢复逻辑；应用公告与版本号同步更新至 0.3.4。
- 验证：`npm test` 7/7；`npm run build` 通过；`npm run tauri build` 成功；`dist` 无 `*.db`；`bundle.resources` 未配置；NSIS 已包含 `installer-hooks.nsh` 与 `NSIS_HOOK_PREINSTALL`。
- 注意事项：首次打包在 Tauri 重建 NSIS 缓存时遇到系统临时权限错误，复查本地缓存完整后直接重跑成功；安装包已交付但未由代理启动，用户自行双击安装并测试，测试窗口也由用户自行打开。

## 2026-08-26 0.3.3 正式版

- 时间：2026-08-26 11:56:48
- 分支：`chore/sync-lockfile`
- 提交：`3444d52`（版本升级与发布内容尚未提交）
- 版本：`0.3.3`
- 命令：`npm run tauri build`
- 构建结果：成功（退出码 0）
- 安装包源文件：`src-tauri/target/release/bundle/nsis/日历_0.3.3_x64-setup.exe`
- 已交付：`安装包/日历_0.3.3_x64-setup.exe`
- 大小：2,220,825 bytes（约 2.1 MB）
- SHA256：`94299B995C0CEBB1B25998EB0D7CFEC39BF0A36D6BE6B07C44D7CE4C74C9D567`
- 耗时：前端约 3.7 秒；Cargo release 约 1 分 46 秒；NSIS 打包成功。
- 本次改动：新增旧版 daily-calendar 数据迁移工具；日历格子快捷新建任务改为居中弹窗；优化温暖原木、新拟态和极简黑白浅色模式下子任务、打卡 Tab 与悬浮窗完成按钮的对比度。
- 验证：`npm test` 7/7；`npm run build` 通过；`npm run tauri build` 成功；`dist` 无 `*.db`；`bundle.resources` 未配置；NSIS 已包含 `installer-hooks.nsh` 与 `NSIS_HOOK_PREINSTALL`。
- 注意事项：安装包已交付但未由代理启动；用户自行双击安装并测试，测试窗口也由用户自行打开。

## 2026-08-25 0.3.2 正式版

- 时间：2026-08-25 23:17:28
- 分支：`chore/sync-lockfile`
- 提交：本发布提交（详见 Git 历史）
- 版本：`0.3.2`
- 命令：`npm run tauri build`
- 构建结果：成功（退出码 0）
- 安装包源文件：`src-tauri/target/release/bundle/nsis/日历_0.3.2_x64-setup.exe`
- 已交付：`安装包/日历_0.3.2_x64-setup.exe`
- 大小：2,219,841 bytes（约 2.1 MB）
- SHA256：`6748F170F7F8BB4E5EE4EBD9FFB99F4045FB6695F0F8303E8E2EEC248F9049F5`
- 本次改动：完成当天任务恢复多波彩带庆祝效果；开关型打卡只保留右侧 Switch；测试窗口脚本自动检测并构建最新测试版；数据隔离与安装器钩子一并纳入正式版。
- 验证：`npm run build` 通过；`npm test` 7/7；`npm run tauri build` 成功；`dist` 无 `*.db`；`bundle.resources` 未配置；NSIS 已包含 `installer-hooks.nsh` 与 `NSIS_HOOK_PREINSTALL`。
- 注意事项：安装包已交付但未由代理启动；用户自行双击安装并测试，测试窗口也由用户自行打开。

## 2026-08-25 0.3.1

- 分支：`chore/sync-lockfile`
- 提交：`ae8e3e2`（基础代码；本次版本升级与数据隔离改动尚未提交）
- 版本：`0.3.1`
- 命令：`npm run tauri build`
- 构建结果：成功（退出码 0）
- 安装包源文件：`src-tauri/target/release/bundle/nsis/日历_0.3.1_x64-setup.exe`
- 已交付：`安装包/日历_0.3.1_x64-setup.exe`
- 大小：2,217,832 bytes（约 2.1 MB）
- SHA256：`142E81695C628325C32F80FFE686BF530CEEFA631396DD52D801BDF2DA0E23D6`
- 耗时：前端约 3.3 秒；Cargo release 约 1 分 16 秒；NSIS 打包成功。
- 本次改动：正式库 `calendar.db` 与测试库 `test-calendar.db` 彻底分离；测试模式跳过单实例、全局快捷键与窗口状态持久化，可与正式版并行；正式版启动自动清理旧测试数据；安装器通过 `src-tauri/windows/installer-hooks.nsh` 覆盖安装目录，不删除 AppData 正式库。
- 验证：`npm run build` 通过；`npm test` 7/7；`src-tauri/target/release/nsis/x64/installer.nsi` 已包含 `installer-hooks.nsh` 与 `NSIS_HOOK_PREINSTALL`；`dist` 无 `*.db`，`bundle.resources` 未配置。
- 注意事项：安装包已交付但未由代理启动；正式库清理需用户安装并启动 0.3.1 后首次运行自动执行；测试窗口由用户自行启动，禁止代理代开。

## 2026-08-25 完成待办特效复刻（0.3.1）
- 时间：2026-08-25 22:57:12
- 分支：`chore/sync-lockfile`
- 提交：`ae8e3e2`（基础代码；本次特效替换与依赖变更尚未提交）
- 版本：`0.3.1`
- 命令：`npm run tauri build`
- 构建结果：成功（退出码 0）
- 安装包源文件：`src-tauri/target/release/bundle/nsis/日历_0.3.1_x64-setup.exe`
- 已交付：`安装包/日历_0.3.1_x64-setup.exe`
- 大小：2,219,800 bytes（约 2.1 MB）
- SHA256：`7C5DC2A3640265848E52A8D246D5FEFE891E10DB4EFC5B6FAEFC861523C34969`
- 本次改动：完成待办效果由自绘单发礼炮替换为源项目同款 `canvas-confetti` 多波彩带（约 200 粒子、5 波爆发）；成就解锁保留 60 粒小号彩带；新增依赖 `canvas-confetti` 与 `@types/canvas-confetti`。
- 验证：`npm run build` 通过；`npm test` 7/7；`npm run tauri build` 成功；`dist` 未发现 `*.db`，`bundle.resources` 未配置。
- 注意事项：安装包已交付但未由代理启动；测试窗口由用户自行启动，禁止代理代开。

## 2026-10-14 导出项目筛选与皮肤预览（测试版）

- 时间：2026-10-14 18:24:54（北京时间）。
- 分支：`main`；基线提交：`b837f98`，本轮工作区实现尚未提交或推送。
- 版本：包与测试主程序仍为 `0.11.1`；新增功能记录于 CHANGELOG 的未发布部分。
- 命令：`npm test`；`npm run build`；`npm run tauri build -- --no-bundle`；`node scripts/check-test-build-stale.mjs`。
- 构建结果：成功，退出码 0；Rust release 编译耗时约 2 分 02 秒，没有生成 NSIS 安装包。
- 测试主程序：`src-tauri/target/release/calendar-tauri.exe`，5,407,232 bytes（约 5.16 MiB）。
- SHA256：`EE4ECDBCD299C36002C71AB50765862EDDC1BE08CB656A63ACF11D4F4A9A79A9`。
- 测试版过期检查：输出 `0`；用户自行打开 `启动测试窗口.bat` 可启动本轮最新测试版。
- 改动：导出弹窗新增全部/单个项目选择，默认当前项目；查询、快照、统计及 PDF 范围同步筛选；预览适配六套皮肤与深浅主题，PDF 保留白底 A4 样式。
- 验证：前端 131/131 用例通过；21 项浏览器检查通过（含 12 种皮肤/主题组合、项目选择、空态、循环筛选、统计及窄窗口）；内部样例实际打印为 1 页 A4 PDF，Poppler 渲染确认白底、中文与 1/1 页码正常。只读代码审查未发现本轮引入的可行动问题。
- 环境说明：首次受限构建环境的 Vite 依赖解析失败；在正常本地环境运行相同构建命令通过，未修改构建工具或依赖。
- 数据与窗口：`dist` 无数据库文件，未打开或修改正式库/测试库；正式应用进程未操作，测试窗口及安装包未启动。Windows 原生交互由用户自行打开测试窗口复验。

## 2026-10-15 0.12.0 正式版

- 时间：2026-10-15 09:30:58（北京时间，完成安装包与测试版校验）。
- 分支：`codex/release-0.12.0`；发布目标：码云 `origin/main` 与 `origin/codex/release-0.12.0`。
- 发布提交：`241d194bc720825fdd529c5c79b900b86661bb45`（`release: 0.12.0 项目导出与皮肤预览，精简版本公告`）；构建记录另行提交。
- 版本：`0.12.0`；前端包与锁文件、Tauri 配置、Rust crate 与锁文件、应用更新公告保持一致；无新增或升级依赖。
- 命令：`npm test`；`cargo test --manifest-path src-tauri/Cargo.toml`；`cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`；`npm run tauri build`；`npm run tauri build -- --no-bundle`；`node scripts/check-test-build-stale.mjs`。
- 构建结果：前端类型检查与生产构建通过；正式打包退出码 0，release 编译约 2 分 42 秒；测试版重建退出码 0，release 编译约 2 分 46 秒。
- 安装包源文件：`src-tauri/target/release/bundle/nsis/日历_0.12.0_x64-setup.exe`。
- 已交付：`安装包/日历_0.12.0_x64-setup.exe`。
- 大小：2,316,122 bytes（约 2.21 MiB）。
- SHA256：`0E5863F962D5F9B8F371260246ACF512A57927B4D9226CA36D54BC911F604BAA`；源文件与交付副本一致，测试版重建后安装包校验值不变。
- 本次改动：导出支持全部或单个项目，默认当前项目；预览适配六套皮肤与深浅主题，PDF 保持白底 A4；导出预览统一使用本地时区；逐条精简历史公告并新增本版内容。
- 公告校验：29 个版本、97 条内容，最长 33 字；原有 28 个版本的版本号、日期与条目数全部保留。浏览器 6 项检查通过，覆盖本版内容、发布日期、历史展开、弹窗边界、版本记忆及运行时异常检查；截图人工复核通过。
- 测试：前端 131/131、Rust 18/18 通过，Rust 格式检查通过；沿用本轮功能实现的 21 项浏览器检查及实际白底 A4 PDF 渲染结果，详见 `docs/task-export-validation.md` §9、§10。
- 模板校验：生成的 `installer.nsi` 与打包前保留的 0.11.1 基线相比，仅 `VERSION`（0.11.1 → 0.12.0）、`VERSIONWITHBUILD`（0.11.1.0 → 0.12.0.0）与 `ESTIMATEDSIZE`（5279 → 5277 KiB）三行变化；其余内容完全一致，覆盖升级默认项、版本标题与 `NSIS_HOOK_PREINSTALL` 保持。
- 数据检查：`dist` 不含 `.db`、`.sqlite`、`.sqlite3` 或其附属文件，`bundle.resources` 未配置；NSIS 文件负载仅为应用主程序与条件 WebView2 安装器，无数据库或用户数据；安装包文件版本与产品版本均为 0.12.0。
- 测试版时效：`node scripts/check-test-build-stale.mjs` 输出 `0`；最新测试主程序为 0.12.0，5,404,160 bytes，SHA256 `7530E380E2599887992760ADE51F60E8E707765B4E05114F46F7AC7F64A13D49`。用户自行打开 `启动测试窗口.bat` 使用最新测试版。
- 发布同步：从发布分支推送码云，`origin/main` 与 `origin/codex/release-0.12.0` 已核对包含发布源码提交 `241d194`；快进更新，未强推或改写历史。安装包按既有规则保存在本地 `安装包/`，不提交编译产物。
- 注意事项：安装包与测试窗口均未由代理启动，正式应用进程未操作；公告检查只使用隔离浏览器，未访问桌面数据库，辅助进程已关闭。0.12.0 项目筛选、皮肤预览及循环任务原生导出由用户安装后复验。构建保留既有动态导入、前端分块体积及链接器提示，无构建错误。

## 2026-11-05 2027 年节假日角标补录（测试版）

- 校验时间：2026-11-05 20:32（北京时间，用户恢复工作后完成收尾）。
- 分支：`codex/release-0.12.0`；基线提交：`638f891b00175b24ee10f17e3b66c802079ebe34`，本轮修改尚未提交或推送。
- 版本：仍为 `0.12.0`，本轮只更新测试主程序，没有生成或替换 NSIS 安装包。
- 数据来源：[国务院办公厅关于2027年部分节假日安排的通知](https://www.gov.cn/zhengce/content/202611/content_7085101.htm)，2026-11-05 发布，国办发明电〔2026〕10号。
- 改动：补录 2027 年 7 个假期、5 个补班日、法定日期与年度来源；普通月视图、纯日历和月度统计共用新数据，沿用原有「休/班」角标，未修改 UI 组件或样式。
- 命令：`npm test`；`npm run tauri build -- --no-bundle`；`node scripts/check-test-build-stale.mjs`；`git diff --check`。
- 构建结果：成功，退出码 0，release 编译约 2 分 47 秒，包含前端类型检查及生产构建。构建在暂停前已完成，恢复后确认源码无新增变动，没有重复构建。
- 测试主程序：`src-tauri/target/release/calendar-tauri.exe`，5,405,696 bytes（约 5.16 MiB）；Windows 文件版本与产品版本均为 `0.12.0`。
- SHA256：`72ED94436BF8F0CC52156FA47E175416F5392BC9A54CEAA7D4DFD0D395D40C44`。
- 测试版时效：恢复后过期检查输出 `0`，用户自行打开 `启动测试窗口.bat` 即可使用本轮最新测试版。
- 验证：补录前 4 项相关测试按预期失败，补录后前端 132/132 通过；独立审查无可行动问题，月度统计 11/11 通过；两种模式共 78 个日期断言通过，涵盖全部假期月份、休假边界、5 个补班日、角标尺寸、春节名称及补班悬浮说明。浅色与最终深色截图均已复核。
- 数据与窗口：未访问桌面正式库或测试库，未操作正式应用，未启动测试窗口或安装包；本轮后台浏览器与预览服务已关闭。保留既有构建提示，无新增依赖、Rust 行为或数据库迁移。
- 交接：[2027 年节假日角标补录](handoffs/2026-11-05-2027-holidays.md)；源码与测试版已就绪，正式安装包仍为此前 0.12.0 发布产物，不包含本轮补录。

## 2026-11-05 0.12.1 正式版

- 时间：2026-11-05 20:48:24（北京时间，正式包与测试版校验完成）。
- 分支：`codex/release-0.12.1`；发布源码提交：`61d0f69d2cfa01d12a45936c7dfee76111bbc388`（`release: 0.12.1 补齐2027年假期并精简版本公告`），构建记录另行提交。
- 版本：`0.12.1`，按数据缺失修复递增修订号；前端包、锁文件、Tauri 配置、Rust crate 及公告版本一致，无依赖变更。
- 命令：`npm test`；`cargo test --manifest-path src-tauri/Cargo.toml`；`cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`；`npm run tauri build`；`npm run tauri build -- --no-bundle`；`node scripts/check-test-build-stale.mjs`。
- 正式构建：成功，退出码 0，release 编译约 2 分 36 秒，前端类型检查及生产构建通过；NSIS 打包成功。
- 测试版更新：`npm run tauri build -- --no-bundle` 成功，退出码 0，release 编译约 2 分 26 秒；过期检查输出 `0`。最新主程序 5,405,696 bytes，文件版本与产品版本均为 0.12.1，SHA256 `8FBEA16458B5506B1E8848FAC91A9EEC811F01F0F71164DDB24DF87E527C9174`。该次重建后交付安装包 SHA256 保持不变。
- 安装包源文件：`src-tauri/target/release/bundle/nsis/日历_0.12.1_x64-setup.exe`。
- 已交付：`安装包/日历_0.12.1_x64-setup.exe`，2,317,785 bytes（约 2.21 MiB）。
- SHA256：`A2C784E4224CFC66170B3B89BAD2A7C39C61320E545F57DDE86DBD48C65E02A6`；源文件与交付副本一致，Windows 文件版本与产品版本均为 0.12.1。
- 本次改动：补齐 2027 年 7 个假期、5 个补班日及法定日期；普通月历与纯日历继续显示原有「休/班」角标，月度统计共用数据。官方依据为国办发明电〔2026〕10号，详情见本日补录记录。
- 公告：新增本版 3 条修复说明，逐条精简历史内容；30 个版本、100 条内容，最长 28 字；原 29 版的版本号、日期及各类条目数全部保留。发布审查未发现功能语义丢失。
- 验证：前端 132/132、Rust 18/18、Rust 格式检查及版本一致性检查通过；公告浏览器 6 项检查通过，覆盖版本、日期、历史展开、100 条内容、版本记忆及运行时异常；沿用本轮两种月历 78 个日期检查及深浅截图的验证结果。
- 模板校验：生成的 `installer.nsi` 与 0.12.0 基线仅三行变化：`VERSION`（0.12.0 → 0.12.1）、`VERSIONWITHBUILD`（0.12.0.0 → 0.12.1.0）、`ESTIMATEDSIZE`（5277 → 5279 KiB）。其余内容完全一致，覆盖升级默认项、版本标题和 `NSIS_HOOK_PREINSTALL` 保持。
- 数据检查：`dist` 无数据库及附属文件，`bundle.resources` 未配置；NSIS 文件复制清单仅有应用主程序与条件 WebView2 安装器，不携带数据库或用户数据。
- 源码同步：从发布分支将 `origin/main` 与 `origin/codex/release-0.12.1` 快进至发布源码提交 `61d0f69`，已通过远端引用核对；未强推或改写历史。构建记录随后继续同步，安装包按既有规则留在本地交付目录，不提交编译产物。
- 注意事项：没有启动安装包或测试窗口，未操作正式日历应用与桌面数据库；公告验证辅助进程已关闭。受限环境首次拒绝本机调试端口连接，在正常本地环境执行相同验收脚本通过，无产品代码调整；构建保留既有动态导入、分块大小及链接器提示。
