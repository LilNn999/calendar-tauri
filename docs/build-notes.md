# 构建与安装包记录

> 本文档是项目内部记录，供 Codex 新工作窗口在接手构建、打包和测试窗口任务前阅读。每次打包后必须追加记录。

## 固定约定

- 打包命令：`npm run tauri build`
- 构建产物：`src-tauri/target/release/bundle/nsis/*Setup.exe`
- 交付目录：项目根目录 `安装包/`
- 交付文件名：`日历_<版本>_x64-setup.exe`
- 交付动作：构建后复制到 `安装包/`；不自动运行安装包或测试窗口，由用户自行启动。
- 测试窗口规则：`启动测试窗口.bat` 使用 `scripts/check-test-build-stale.mjs` 自动判断源码/配置/dist 是否新于 release exe；如有更新，先执行 `npm run tauri build -- --no-bundle` 再启动最新测试版，禁止直接启动旧 exe。
- 用户端更新公告：已同步写入 src/data/whatsNew.ts，首次启动 0.3.2 自动弹出。
- 0.3.2 为当前正式发布版本，包含完成特效复刻、开关型修复与测试窗口自动构建升级。
- 耗时：前端约 3.5 秒；Cargo release 约 1 分 16 秒；NSIS 打包成功。
- 注意事项：
  1. 本次构建前项目已将 Rust target 缓存从 F 盘改为项目内 `src-tauri/target`，首次会完整编译；后续未改依赖时使用增量缓存。
  2. release 与 debug 使用独立缓存，不要为了打开窗口额外运行 `npm run tauri dev`。
  3. 沙箱环境无法把 GUI 窗口推到用户桌面，因此代理不能“代开”测试窗口；构建后由用户双击 `启动测试窗口.bat`。
  4. 本次安装包已复制到 `安装包/`，后续新窗口默认沿用此流程。

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
