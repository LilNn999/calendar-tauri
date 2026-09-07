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
