# 日历 · Calendar

本地优先的桌面日历应用：日历视图、任务/子任务、每日打卡、备注、统计，集成系统托盘、置顶悬浮窗与开机自启。基于 **Tauri v2 + React + Vite + Tailwind CSS v4 + Shadcn/ui**，数据全部存储在本机 SQLite。

## 功能一览

- 🗓️ **日历**：月视图、任务圆点、当日详情、逾期标记
- ✅ **任务**：优先级、状态流转、日期/时间、标记色、搜索筛选
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
| 存储 | SQLite（`tauri-plugin-sql`，本地 `calendar.db`） |
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
│   └── tauri.conf.json
└── scripts/gen-icons.ps1                       # 图标生成脚本
```

## 常见问题

- **`cargo` 不是内部或外部命令**：未安装 Rust 工具链，见上文环境要求。
- **链接失败 / 找不到 `link.exe`**：未安装 VS Build Tools 的 C++ 桌面开发负载。
- **`npm run tauri dev` 白屏**：确认 `npm run dev` 先行启动或端口 1420 未被占用。
- **托盘不显示**：Windows 需重新登录或等待 Explorer 刷新托盘图标。

## 数据与隐私

- 所有数据保存在应用数据目录下的 `calendar.db`（SQLite），无任何云服务。
- 卸载即清除本地数据（如需保留，请先备份数据库文件）。
