# AGENTS.md — 日历 Tauri 重构项目

本文件是面向 AI 编码代理（Codex 等）的仓库级指令。所有在仓库内改动文件的操作，都必须遵守本文档；若与更内层目录的 `AGENTS.md` 冲突，以更内层为准。

## 项目定位

- 用 **Tauri v2 + React + Vite + Tailwind CSS v4 + Shadcn/ui** 重构一款本地日历/待办应用。
- 核心形态：桌面日历 + 任务管理 + 子任务 + 每日打卡 + 备注 + 数据统计。
- 系统能力：系统托盘、置顶悬浮窗、开机自启、单实例、全局快捷键。
- 数据全部本地存储（SQLite），无后端服务，隐私优先。
- 安装包目标体积 **5~10 MB**。

## 技术栈与版本红线

| 层 | 技术 | 说明 |
| --- | --- | --- |
| 壳 | Tauri v2 | 主窗口 + 悬浮窗 + 托盘 |
| 前端 | React 18/19 + TypeScript | 严格模式 |
| 构建 | Vite 6 | 生产构建 `npm run build` |
| 样式 | Tailwind CSS v4 | CSS-first 配置，`@theme` 定义设计令牌 |
| 组件 | Shadcn/ui | 基于 Radix UI + CVA，组件放在 `src/components/ui` |
| 状态 | Zustand | 轻量全局状态 |
| 日期 | date-fns | 统一处理日期 |
| 存储 | SQLite | 通过 `@tauri-apps/plugin-sql` 访问 |

## 目录结构

```
日历-tauri/
├── AGENTS.md            # 本文件
├── PROJECT_MAP.md       # 项目地图（模块说明）
├── CHANGELOG.md         # 变更记录（新增功能必须更新）
├── docs/                # 补充文档（schema.md 等）
├── src/                 # React 前端（布局与源项目 1:1）
│   ├── api/             #   类型化 IPC 封装
│   ├── shared/          #   类型 / 常量 / IPC 通道（源项目原样）
│   ├── components/      #   UI 组件（calendar/sidebar/tasks/checkins/analytics/...）
│   │   └── ui/          #    shadcn 组件（勿手改生成物）
│   ├── lib/             #   db.ts / ipc-bridge.ts / theme / motion / utils
│   ├── store/           #   Zustand store（calendar/task/checkin/notes/ui）
│   ├── pages/           #   CalendarPage / AnalyticsPage
│   ├── styles/          #   globals.css（主题令牌）
│   ├── widget/          #   悬浮窗组件（WidgetShell）
│   └── main.tsx / App.tsx / FloatingApp.tsx
└── src-tauri/           # Rust 后端
    ├── src/             #   main.rs / lib.rs / commands / tray / floating
    ├── capabilities/    #   权限声明
    ├── icons/           #   应用图标
    ├── tauri.conf.json
    └── Cargo.toml
```

## 通用开发规范

1. **改动最小化**：只改与任务直接相关的文件；不顺手重构无关代码。
2. **命名**：组件 PascalCase，工具函数 camelCase，常量 UPPER_SNAKE；Rust 用 snake_case。
3. **类型**：前端数据实体定义在 `src/lib/types.ts`，与 SQLite 表结构一一对应。
4. **样式**：优先使用 Tailwind 工具类 + 主题变量（`bg-background`、`text-foreground`、`border-border` 等）；禁止写死颜色值；暗色模式用 `.dark` class 切换。
5. **状态**：跨组件共享数据走 Zustand store；组件内部状态用 `useState`。
6. **SQL**：所有表结构变更必须同时更新 `src/lib/db.ts` 的迁移脚本（`PRAGMA user_version` 递增）与 `docs/schema.md`。
7. **错误处理**：SQL 操作一律 try/catch 并给用户可读提示；Rust 命令返回 `Result`。
8. **国际化**：UI 文案使用简体中文，代码注释/提交说明用中文。
9. **体积意识**：任何新增 npm 依赖都先评估对安装包体积的影响；图表等重库优先用自绘 SVG 替代。
10. **禁止**：在 `src/components/ui` 之外依赖 `class-variance-authority` 组件生成物被手工大改；不要在 `main` 分支直接 `git push`。

## 构建与验证

```bash
# 前端依赖
npm install

# 前端构建（必须通过）
npm run build

# 本地预览（浏览器调试，Tauri API 会降级为空实现）
npm run dev

# 完整桌面开发（需 Rust 工具链）
npm run tauri dev

# 打包 NSIS 安装包
npm run tauri build
```

### 测试窗口构建规范

- `启动测试窗口.bat` 必须自动检测 `src/`、`src-tauri/`、`dist/` 与前端/配置入口文件是否新于 `src-tauri/target/release/calendar-tauri.exe`；发现更新时先执行 `npm run tauri build -- --no-bundle`，再启动最新测试窗口。
- 禁止直接运行旧 release exe；Codex 修改代码后不能只执行 `npm run build` 就声称测试版已更新，必须以 `启动测试窗口.bat` 的自动流程为准。
- 测试窗口始终使用 `CALENDAR_TEST_MODE=1` 与 `test-calendar.db`，自动重建不得生成 NSIS 安装包。
### 安装包交付规范

1. 打包固定使用 `npm run tauri build`，构建后将 `src-tauri/target/release/bundle/nsis/` 下的安装包复制到项目根目录 `安装包/`，文件名保持 `产品名_版本_平台-setup.exe` 不变。
2. 禁止由代理自动运行安装包或启动测试窗口；构建完成后只报告产物路径、大小、SHA256，窗口由用户自行启动。
3. 每次打包后向 `docs/build-notes.md` 追加记录：时间、分支、版本、提交、命令、产物、SHA256、注意事项。
4. 新工作窗口处理打包任务前，先查看 `AGENTS.md` 与 `docs/build-notes.md`，避免遗漏安装包交付与测试窗口约定。
5. 安装包内禁止捆绑数据库、测试数据或任何用户数据：不要配置 `bundle.resources` 复制 `*.db`，构建后确认 `dist` 与安装包内不含数据库文件。
6. 数据库必须分离：正式模式使用 `calendar.db`，测试模式使用 `test-calendar.db`，测试模式由 `CALENDAR_TEST_MODE=1` 触发，主窗口与悬浮窗必须使用同一选择逻辑，示例数据只由主窗口写入；测试模式不注册单实例，允许与正式版并行。
7. 迭代升级安装包需停止旧进程并清空安装目录后写入新版本，避免残留旧版本文件；升级/卸载不得删除应用数据目录中的正式库。旧进程停止与目录清理由 `src-tauri/windows/installer-hooks.nsh` 的 `NSIS_HOOK_PREINSTALL` 完成，升级默认直接覆盖安装、不先卸载旧版（默认勾选项由自定义模板控制）。
8. `src-tauri/windows/installer.nsi` 是基于官方 `tauri-cli-v2.11.4` tag 的自定义 NSIS 模板（仅改动重装选择页默认勾选项），经 `bundle.windows.nsis.template` 启用。升级 `@tauri-apps/cli` 时必须用对应 tag 重新拉取模板并重新应用改动；每次打包后 diff `src-tauri/target/release/nsis/x64/installer.nsi` 与上一版本基线，确认除预期改动外无其他差异。

## Rust 后端规范

- Rust 代码放在 `src-tauri/src`；`lib.rs` 暴露 `run()`，`main.rs` 调用它（利于集成测试）。
- 系统能力优先使用官方插件：`tauri-plugin-sql`、`tauri-plugin-autostart`、`tauri-plugin-single-instance`、`tauri-plugin-global-shortcut`。
- 托盘、窗口、自启等逻辑集中在 `src-tauri/src/tray.rs` / `window.rs` / `setup.rs`，保持 `lib.rs` 精简。
- 权限遵循最小化原则：`capabilities/default.json` 只声明真正用到的权限。

## 验收标准

- `npm run build` 无错误、无类型错误。
- 深浅双主题均可正常切换并持久化。
- 任务 → 子任务 → 打卡 → 备注 → 统计的完整数据链路可用。
- 托盘可显示/隐藏主窗口；悬浮窗可置顶显示当日任务。
- NSIS 安装包体积落在 5~10 MB。
