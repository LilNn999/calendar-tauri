# 日历皮肤系统与日历状态视觉设计

日期：2026-08-25

状态：待用户审阅

## 目标

1. 修复日历格子三种状态的视觉区分：非本月、今天、选中。
2. 在保留现有功能和布局的前提下，新增 5 款皮肤：
   - 极光渐变（Aurora Gradient）
   - 温暖原木（Warm Wood）
   - macOS 原生（macOS Native）
   - Win11 云母（Fluent Mica）
   - 极简留白（Minimal White）
3. 每款皮肤同时支持浅色与深色，并同步适配主窗口与桌面悬浮窗。
4. 在顶部标题栏新增独立“换肤”按钮，位于设置按钮左侧。
5. 换肤按钮使用衣服图标。
6. 将设置页的浅色、深色、跟随系统按钮移入换肤弹层。

## 非目标

- 不改任务、子任务、打卡、备注、统计等业务逻辑。
- 不改主窗口顶部 Tab、右侧面板、弹窗等现有主体布局。
- 不引入新 npm 依赖。
- 不改变悬浮窗的透明度、置顶、缩放与位置持久化行为。

## 技术方案

采用“CSS 变量皮肤层”：

- 保留现有 `light` / `dark` class，继续控制明暗模式。
- 在根节点增加皮肤 class：`skin-aurora`、`skin-warm-wood`、`skin-macos`、`skin-win11`、`skin-minimal`。
- 默认使用现有靛蓝主题，不挂任何皮肤 class。
- 每款皮肤只覆盖现有语义 token，如 `--background`、`--card`、`--primary`、`--accent-2`、`--border`、`--bg-glow-*`、`--shadow-*` 和新增的日历状态 token。
- 组件继续使用现有 Tailwind 语义类，避免为每款皮肤复制组件代码。

## 皮肤模型与持久化

在 `src/lib/theme.tsx` 中扩展：

```ts
export type Skin =
  | 'default'
  | 'aurora'
  | 'warm-wood'
  | 'macos'
  | 'win11'
  | 'minimal'
```

`ThemeProvider` 新增：

- `skin: Skin`
- `setSkin: (skin: Skin) => void`
- 从 `localStorage` 与 `settings` 表读取 `skin`
- 切换时同时写入 `localStorage` 与 `settings` 表
- 向另一个窗口发送 `PUSH_SKIN_CHANGED`，实现主窗口与悬浮窗实时同步

新增 IPC：

- `system:getSkin`
- `system:setSkin`
- `push:skinChanged`

对应修改：

- `src/shared/ipc-channels.ts`
- `src/api/index.ts`
- `src/lib/ipc-bridge.ts`
- `src/lib/theme.tsx`

无需数据库迁移：`settings` 表已存在，只新增 `skin` key。

## 顶部换肤入口

在 `src/components/layout/TabBar.tsx` 的右上角操作区新增一个换肤按钮：

- 位置：紧邻设置按钮左侧。
- 图标：使用衣服图标（Shirt）。
- 点击行为：打开紧凑的换肤弹层，不打开设置窗口。
- 弹层包含两个区域：
  1. **显示模式**：浅色、深色、跟随系统。
  2. **皮肤**：默认靛蓝、极光渐变、温暖原木、macOS 原生、Win11 云母、极简留白。
- 选中项使用主色边框与光晕。
- 选择后即时生效，并通过 `PUSH_SKIN_CHANGED` 同步悬浮窗。
- 设置页不再保留浅色、深色、跟随系统按钮，仅保留系统、窗口、关于等设置项。

新增或修改：

- `src/components/layout/TabBar.tsx`
- `src/components/layout/SkinSwitcher.tsx`（换肤与显示模式弹层）
- `src/components/layout/SettingsDialog.tsx`（移除外观模式区域）

## 皮肤视觉方向

每款皮肤均提供浅色与深色两套 token：

| 皮肤 | 浅色方向 | 深色方向 | 强调色 |
| --- | --- | --- | --- |
| 极光渐变 | 淡紫蓝渐变、半透明卡片 | 深靛紫渐变、紫色/青色光晕 | 紫罗兰至青色 |
| 温暖原木 | 米白纸张、暖棕边框 | 深咖啡背景、奶油色卡片 | 焦糖/琥珀 |
| macOS 原生 | 浅灰白、细边框、柔和阴影 | 石墨黑、深灰卡片 | 系统蓝 |
| Win11 云母 | 冰白半透明、细腻玻璃感 | 深灰云母、微弱蓝色环境光 | 云母蓝 |
| 极简留白 | 近纯白、极细灰边框、克制阴影 | 近纯黑、深灰层级 | 极简蓝 |

现有“默认靛蓝”保持不变，作为第 6 个可选皮肤。

## 日历状态视觉

在 `src/styles/globals.css` 新增语义 token：

```css
--day-outside
--day-today
--day-selected
--day-ring
```

并通过 `@theme inline` 暴露为 Tailwind 颜色：

```css
--color-day-outside
--color-day-today
--color-day-selected
--color-day-ring
```

`DayCell` 状态优先级：

1. 选中：`--day-selected` 底色 + `--day-ring` 2px 内圈。
2. 今天：`--day-today` 底色 + 顶部渐变强调条 + 日期徽章。
3. 非本月：`--day-outside` 底色，数字与事项降低对比度，但保持可读和可点击。
4. 普通当月：透明/卡片底色。

规则：

- 选中日期始终最醒目。
- 今天与选中重叠时，同时保留渐变徽章与选中内圈。
- 非本月被选中时，选中背景优先，数字仍保持弱化但可读。
- 周视图使用同一套 token，保持与月视图一致。

## 悬浮窗适配

- 悬浮窗共享 `ThemeProvider`，自动应用当前皮肤与明暗模式。
- `WidgetShell` 继续使用现有透明度滑块；将背景改为由 `--widget-bg` 和 `--bg-glow-*` 驱动的皮肤级玻璃质感。
- 顶部进度条继续使用 `--primary` 到 `--accent-2` 的渐变。
- 悬浮窗收到 `PUSH_SKIN_CHANGED` 后即时切换，不重启窗口。

## 涉及文件

- `src/lib/theme.tsx`
- `src/shared/ipc-channels.ts`
- `src/api/index.ts`
- `src/lib/ipc-bridge.ts`
- `src/styles/globals.css`
- `src/components/layout/TabBar.tsx`
- `src/components/layout/SkinSwitcher.tsx`
- `src/components/layout/SettingsDialog.tsx`
- `src/components/calendar/DayCell.tsx`
- `src/components/calendar/WeekView.tsx`
- `src/widget/WidgetShell.tsx`
- `CHANGELOG.md`
- `PROJECT_MAP.md`

## 验证方式

1. `npm run build` 无类型错误和构建错误。
2. 浏览器预览逐款检查 6 款皮肤 × 浅色/深色共 12 种组合。
3. 检查换肤按钮是否位于设置按钮左侧，图标是否为衣服。
4. 检查设置页不再显示浅色、深色、跟随系统按钮，且换肤弹层内可切换。
5. 检查月视图与周视图的今天、选中、非本月状态。
6. 检查悬浮窗与主窗口主题同步、透明度滑块与置顶功能不受影响。

## 验收标准

- 现有业务功能与主体布局完全不变。
- 换肤按钮位于顶部设置按钮左侧，图标为衣服。
- 浅色、深色、跟随系统按钮已从设置页移至换肤弹层。
- 6 款皮肤可选，浅色/深色均可用。
- 非本月、今天、选中三种日历状态在普通尺寸下清晰可辨。
- 桌面悬浮窗正确继承皮肤。
- `npm run build` 通过。
