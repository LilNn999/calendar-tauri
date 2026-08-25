# 日历皮肤系统与三套参考稿视觉设计

日期：2026-08-25

状态：已完成（代码已合并至当前工作区，待桌面端实机验收）

## 目标

1. 按照 `styles-gallery` 参考稿实现三套换肤，项目现有功能与主体布局完全不变：
   - 01 极简留白（`minimal`）
   - 04 新拟态（`neu`）
   - 15 温暖原木（`warm-wood`）
2. 每套皮肤同时提供浅色与深色模式，共 6 种主题组合。
3. 主窗口与置顶悬浮窗共享同一皮肤与明暗模式，切换后实时同步。
4. 用语义化 CSS token 承接视觉差异，避免为每套皮肤复制组件代码。

## 非目标

- 不修改任务、子任务、打卡、备注、统计等业务逻辑。
- 不改变顶部 Tab、右侧面板、日历月 / 周视图、弹窗等既有功能布局。
- 不新增 npm 依赖。
- 不改变悬浮窗的透明度、置顶、缩放、位置持久化行为。
- 不追求与参考稿完全逐像素一致；优先复刻色板、材质、层级、圆角、阴影、字体与控件形态。

## 最终皮肤范围

最终只保留三套参考稿皮肤，移除之前的默认靛蓝、极光渐变、macOS 原生、Win11 云母等中间方案：

| 值 | 名称 | 对应参考稿 | 默认 |
| --- | --- | --- | --- |
| `minimal` | 极简留白 | 01 Minimal White + 02 OLED Dark | 是 |
| `neu` | 新拟态 | 04 Neumorphism | 否 |
| `warm-wood` | 温暖原木 | 15 Warm Wood | 否 |

`src/lib/skin.ts` 只导出以上三个选项；未知值由 `normalizeSkin` 回退到 `minimal`。

## 技术方案

### 1. 皮肤 class 与明暗 class

- 根节点同时维护 `light` / `dark` 与 `skin-minimal` / `skin-neu` / `skin-warm-wood`。
- `minimal` 使用 `:root` 与 `.dark` 作为默认皮肤；`neu` 与 `warm-wood` 分别使用 `.skin-neu`、`.dark.skin-neu`、`.skin-warm-wood`、`.dark.skin-warm-wood` 覆盖。
- `ThemeProvider` 默认皮肤为 `minimal`，切换后写 `localStorage` 与 SQLite `settings`，并通过 `PUSH_THEME_CHANGED` / `PUSH_SKIN_CHANGED` 同步另一个窗口。

### 2. 语义 token

`src/styles/globals.css` 为每套主题定义完整语义令牌：

- 基础主题：`--background`、`--card`、`--popover`、`--primary`、`--border`、`--ring` 等。
- 表面与边框：`--surface-raised`、`--surface-subtle`、`--surface-inset`、`--surface-hover`、`--border-subtle`、`--border-strong`、`--header-bg`、`--panel-bg`。
- 日历：`--calendar-grid-bg`、`--calendar-surface`、`--cell-bg`、`--cell-dim-bg`、`--cell-today-bg`、`--day-outside`、`--day-today`、`--day-selected`、`--day-ring`。
- 任务与打卡：`--task-high-*`、`--task-medium-*`、`--task-low-*`、`--task-none-*`、`--task-done-*`、`--task-failed-*`、`--checkin-bg`、`--checkin-border`、`--checkin-fg`。
- 控件与动效：`--control-*`、`--shadow-*`、`--accent-gradient`、`--progress-gradient`、`--scrollbar-thumb`。
- 皮肤特征：`--app-texture`、`--widget-texture`、`--font-display`、`--task-radius`。

`@theme inline` 将主要令牌映射为 Tailwind 工具类，供业务组件直接使用。

### 3. 共享皮肤工具类

- `surface-header`：顶栏、标题栏与弹层标题表面。
- `control-raised`：凸起按钮、标签页、Tab、选中项。
- `control-inset`：内凹输入、进度条底、打卡行。
- `card-elevated`：任务卡、列表卡片。
- `calendar-shell` / `calendar-grid`：日历外框与格子网格。
- `progress-fill`：任务与打卡进度填充。
- `sidebar-panel`：右侧面板与悬浮窗面板。
- `shadow-raised` / `shadow-raised-hover` / `shadow-inset` / `shadow-float` / `shadow-soft`：皮肤级阴影。

## 三套皮肤视觉方向

| 皮肤 | 浅色 | 深色 | 关键特征 |
| --- | --- | --- | --- |
| 极简留白 | 近纯白背景、卡片白、极细灰边、黑白强调 | 纯黑 OLED、深灰层级、蓝色强调 | 克制阴影、药丸任务边、无纹理 |
| 新拟态 | 灰蓝背景 `#fbfdff` 到 `#cbd3e0`、双光源软阴影 | 深灰蓝背景、双光源暗阴影 | 凹凸卡片、无明显描边、0.75rem 圆角 |
| 温暖原木 | 米白纸张、原木纹理、暖棕边框、深棕标题栏 | 深咖啡背景、奶油卡片、金色强调 | 木纹、楷体标题、暖色任务条 |

## 业务组件皮肤化

- `MonthView` / `DayCell` / `DayCellItem` 使用 `calendar-shell`、`calendar-grid` 与 `bg-cell-*`，保留原有状态优先级。
- `WeekView`、`DayDetailPopup` 使用同一套日历与任务令牌。
- `PRIORITY_CONFIG` 从 Tailwind 直写颜色改为 `bg-task-*` / `text-task-*`，三套皮肤共用同一套业务代码。
- `TabBar`、`RightSidebar`、`SkinSwitcher` 使用 `surface-header` / `control-raised` / `shadow-float`。
- 输入框、按钮、Select、Switch、Slider、Badge、Toast、Dialog 等 shadcn 生成物统一改为语义类，不写死颜色。

## 悬浮窗适配

- `WidgetShell` 根容器使用皮肤背景、`--widget-texture` 与语义边框；标题条使用 `bg-day-ring/40`。
- 任务进度条使用 `progress-fill`，按钮与新增表单使用 `control-raised` / `control-inset` / `card-elevated`。
- `WidgetTaskList` 与 `WidgetCheckinRow` 完整继承任务、打卡、优先级语义。
- 悬浮窗通过 `body.floating-window` 在正常页面中隐藏主窗口纹理，避免浏览器预览出现条纹伪影。

## 涉及文件

- `src/lib/skin.ts`
- `src/lib/skin.test.ts`
- `src/lib/theme.tsx`
- `src/styles/globals.css`
- `src/components/layout/SkinSwitcher.tsx`
- `src/components/layout/TabBar.tsx`
- `src/components/calendar/DayCell.tsx`、`DayCellItem.tsx`、`MonthView.tsx`、`WeekView.tsx`、`DayDetailPopup.tsx`
- `src/components/sidebar/RightSidebar.tsx` 及相关面板
- `src/widget/WidgetShell.tsx`、`WidgetTaskList.tsx`、`WidgetCheckinRow.tsx`
- `src/shared/constants.ts` 与 `src/components/ui/*` 的语义类统一
- `CHANGELOG.md`、`PROJECT_MAP.md`

## 验证方式

1. `npm test`：皮肤归一化与皮肤选项测试共 7 项通过。
2. `npm run build`：TypeScript 与 Vite 构建通过。
3. 浏览器截图检查三套皮肤 × 浅色 / 深色共 6 种主窗口组合，以及 6 种悬浮窗组合。
4. 检查今天、选中、非本月、任务优先级、完成 / 失败、打卡等视觉状态在每套皮肤下均可读。
5. 桌面端使用 `npm run tauri dev` 实机确认主窗口与悬浮窗同步、皮肤持久化、置顶与透明度功能正常。

## 验收标准

- 功能与布局不变，仅样式层换肤。
- 三套皮肤均提供浅色与深色，默认皮肤为极简留白。
- 主窗口与悬浮窗皮肤、明暗模式实时同步。
- 业务组件使用语义 token，不残留 Tailwind 直写颜色。
- `npm test` 与 `npm run build` 通过。