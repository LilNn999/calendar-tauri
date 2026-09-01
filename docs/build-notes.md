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
