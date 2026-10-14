# 日历 · Calendar

本地优先的桌面日历应用：日历视图、任务/子任务、每日打卡、备注、统计，集成系统托盘、置顶悬浮窗与开机自启。基于 **Tauri v2 + React + Vite + Tailwind CSS v4 + Shadcn/ui**，数据全部存储在本机 SQLite。

## 功能一览

- 🗓️ **日历**：月视图、任务圆点、当日详情、逾期标记
- 📈 **月度天数统计**：悬停月历标题旁的小图标，查看当月工作日、休息日、法定节假日天数与本月假期、调休补班安排；普通月视图与纯日历模式通用，未收录当年放假安排的年份会标注为按周末估算。
- ✅ **任务**：优先级、状态流转、日期/时间、标记色、搜索筛选
- 📁 **项目**：点击标题栏的项目名，在轻量菜单里切换、新建、重命名或查看「全部项目」；普通与循环任务均按项目区分，新建/编辑时可调整归属。旧任务归入「默认项目」，打卡与每日备注共享，悬浮窗与任务统计跟随当前项目。
- 📋 **子任务**：任务内嵌清单，勾选进度自动同步
- 🔥 **打卡**：每日心情打卡、连续天数、当月打卡日历、历史记录
- 📝 **备注**：按日期关联的笔记卡片
- 📊 **统计**：完成率、近 7 天趋势、优先级/心情分布（自绘 SVG，无图表库）
- 🪟 **系统集成**：托盘菜单、`Alt+Q` 置顶悬浮窗、`Ctrl+Shift+M` 显隐主窗、开机自启、单实例、窗口状态记忆
- 🌓 **深浅双主题**：跟随系统 / 手动切换，偏好持久化

## 技术栈

| 层 | 选型 |
| --- | --- |
| 桌面壳 | Tauri v2（Rust） |
| 前端 | React 19 + TypeScript + Vite |
| 样式 | Tailwind CSS v4（CSS-first 主题令牌） |
| 组件 | Shadcn/ui（Radix UI + CVA） |
| 状态 | Zustand |
| 存储 | SQLite（`tauri-plugin-sql`，正式 `calendar.db` / 测试 `test-calendar.db`，位于应用数据目录） |
| 打包 | NSIS 安装包（目标 5~10 MB） |

## 环境要求

| 依赖 | 版本 | 用途 |
| --- | --- | --- |
| Node.js | ≥ 20 | 前端构建 |
| Rust 工具链 | stable（≥ 1.77） | Tauri 后端编译 |
| Visual Studio Build Tools | 2022（含"使用 C++ 的桌面开发"） | Windows MSVC 链接器 |
| WebView2 Runtime | 已随 Win10/11 预装 | 渲染 WebView |

> 尚未安装 Rust / VS Build Tools 时，请先完成安装：
> 1. 安装 [Rust](https://rustup.rs)：`winget install Rustlang.Rustup`，重启终端
> 2. 安装 VS Build Tools：`winget install Microsoft.VisualStudio.2022.BuildTools`，勾选 *使用 C++ 的桌面开发* 工作负载
> 3. 验证：`rustc -V && cargo -V` 可用

## 快速开始

```bash
# 1. 安装前端依赖
npm install

# 2. 浏览器预览（数据走内存模拟，可完整体验 UI）
npm run dev          # http://localhost:1420

# 3. 桌面开发模式（需 Rust 工具链）
npm run tauri dev

# 4. 打包 NSIS 安装包（产物在 src-tauri/target/release/bundle/nsis/）
npm run tauri build
```

## 打包体积优化（5~10 MB 目标）

- `Cargo.toml`：release 开启 `lto = true`、`opt-level = "s"`、`strip = true`、`codegen-units = 1`
- `tauri.conf.json`：仅 NSIS 目标、LZMA 压缩、`installMode: currentUser`
- WebView2 采用 `downloadBootstrapper`：安装器不再内嵌运行时（大幅减小体积）
- 前端不引入图表等重依赖，统计图表全部自绘 SVG
- 若安装器仍需减重，可将 `bundle.windows.nsis.compression` 保持 LZMA 并移除多余语言

## 项目结构

```
├── AGENTS.md / PROJECT_MAP.md / CHANGELOG.md   # AI 文档体系
├── docs/schema.md                              # 数据表结构
├── src/                                        # React 前端
│   ├── components/                             #   shadcn UI + 功能组件
│   ├── lib/                                    #   db / stores / stats / utils
│   └── pages/                                  #   日历/任务/打卡/备注/统计/设置
├── src-tauri/                                  # Rust 后端
│   ├── src/                                    #   lib.rs / tray.rs / floating.rs / commands.rs
│   ├── capabilities/                           #   最小权限集
│   ├── windows/installer-hooks.nsh             #   NSIS 安装器覆盖清理钩子
│   └── tauri.conf.json
└── scripts/gen-icons.ps1                       # 图标生成脚本
```

## 常见问题

- **`cargo` 不是内部或外部命令**：未安装 Rust 工具链，见上文环境要求。
- **链接失败 / 找不到 `link.exe`**：未安装 VS Build Tools 的 C++ 桌面开发负载。
- **`npm run tauri dev` 白屏**：确认 `npm run dev` 先行启动或端口 1420 未被占用。
- **托盘不显示**：Windows 需重新登录或等待 Explorer 刷新托盘图标。

## 旧版 daily-calendar 数据迁移

根目录的 `迁移数据.cmd` 可直接导入旧版 daily-calendar（旧“日历”）数据。脚本使用 Windows 自带的 SQLite 组件，**不需要 Node.js、npm 或第三方依赖**。

1. 完全退出旧版 daily-calendar 和当前“日历”（含托盘图标，右键退出）。
2. 双击 `迁移数据.cmd`。
3. 若当前库已有数据，输入 `Y` 覆盖并导入（会先自动备份），输入 `N` 合并导入（不覆盖现有数据），其他输入取消。
4. 按提示再次输入 `Y` 确认执行；迁移完成后重启当前“日历”。

说明：

- 默认旧数据源为 `%APPDATA%\daily-calendar\calendar.db`。请勿使用安装目录 `...\resources\prisma\dev.db`，那是空模板库。
- 覆盖模式会备份后清空当前任务、子任务、打卡、备注和已解锁成就，再写入旧数据；不会删除成就定义，并会迁移旧版悬浮窗设置、主题和最近失败打卡日期。
- 合并模式按旧数据源任务/打卡 ID 记录已导入项，重复运行不会再次追加相同数据；若两版存在同名任务或打卡，仍可能显示两份，希望完全以旧数据为准时请选择覆盖模式。
- 迁移前自动备份到 `%APPDATA%\com.calendar.desktop\migration-backups\`，脚本会显示备份路径与 SHA256。
- 旧版数据库不在默认位置时可直接指定：`powershell -NoProfile -ExecutionPolicy Bypass -File scripts\migrate-daily-calendar.ps1 -SourceDb "数据库文件路径"`。
- 高级参数：`-SourceDb`、`-TargetDb`、`-BackupDir`、`-Overwrite`、`-Merge`、`-Force`、`-Yes`。

## 数据与隐私

- 正式模式数据保存在应用数据目录 `com.calendar.desktop\calendar.db`（SQLite），无任何云服务。测试模式由 `启动测试窗口.bat` 启动，使用独立的 `test-calendar.db`，不会写入正式库。
- 安装包不捆绑数据库或用户数据；卸载/升级不会删除应用数据目录中的正式库，如需彻底清除请先备份后再手动删除对应数据库。
- 版本升级时安装器会停止旧进程、清空安装目录后写入新版本文件，应用数据目录中的正式数据保留不变。
