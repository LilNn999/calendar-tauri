import { useState } from 'react'
import { CalendarDays, BarChart3, Settings, CalendarRange } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isTauri } from '@/lib/db'
import { useUIStore } from '@/store/useUIStore'
import { SettingsDialog } from './SettingsDialog'
import { SkinSwitcher } from './SkinSwitcher'
import { WindowControls } from './WindowControls'
import { ProjectSwitcher } from '@/components/projects/ProjectSwitcher'

type TabId = 'calendar' | 'analytics'

interface TabBarProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
}

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { calendarMode, setCalendarMode } = useUIStore()

  // 无边框窗口：点击标题栏区域拖动窗口（排除按钮/输入框等交互元素）
  const handleTitlebarMouseDown = (e: React.MouseEvent) => {
    if (!isTauri) return
    if ((e.target as HTMLElement).closest('button, input, textarea, select, a')) return
    import('@tauri-apps/api/window')
      .then(({ getCurrentWindow }) => getCurrentWindow().startDragging())
      .catch(() => {})
  }

  // 双击标题栏区域最大化 / 还原
  const handleTitlebarDoubleClick = (e: React.MouseEvent) => {
    if (!isTauri) return
    if ((e.target as HTMLElement).closest('button, input, textarea, select, a')) return
    import('@tauri-apps/api/window')
      .then(({ getCurrentWindow }) => getCurrentWindow().toggleMaximize())
      .catch(() => {})
  }

  return (
    <>
      <div className="surface-header relative flex items-center h-14 pl-6 pr-5 border-b border-border-subtle backdrop-blur-xl shrink-0"
        style={{ boxShadow: 'var(--shadow-sm)' }}
        onMouseDown={handleTitlebarMouseDown}
        onDoubleClick={handleTitlebarDoubleClick}
      >
        {/* 左侧：应用名 */}
        <div className="flex-1 flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-primary shadow-raised inline-block" />
          <span className="font-skin-display text-sm font-extrabold tracking-wide select-none text-foreground">日历</span>
          <span aria-hidden="true" className="mx-2 h-4 w-px shrink-0 bg-current opacity-25" />
          <ProjectSwitcher />
        </div>

        {/* 中间：Tab 导航 */}
        <div className="control-inset absolute left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-2xl p-1"
          style={{ boxShadow: 'inset 0 1px 3px rgb(0 0 0 / 0.05)' }}>
          <TabButton
            active={activeTab === 'calendar'}
            icon={<CalendarDays className="h-3.5 w-3.5" />}
            label="日历"
            onClick={() => onTabChange('calendar')}
          />
          <TabButton
            active={activeTab === 'analytics'}
            icon={<BarChart3 className="h-3.5 w-3.5" />}
            label="数据分析"
            onClick={() => onTabChange('analytics')}
          />
        </div>

        {/* 右侧：日历模式 + 换肤 + 设置按钮 */}
        <div className="flex-1 flex items-center justify-end gap-1">
          <button
            onClick={() => setCalendarMode(!calendarMode)}
            className={cn(
              'h-8 w-8 flex items-center justify-center rounded-full transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0',
              calendarMode
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            )}
            title={calendarMode ? '退出日历模式' : '日历模式（纯日历：农历/节气/节假日）'}
          >
            <CalendarRange className="h-4 w-4" />
          </button>
          <SkinSwitcher />
          <button
            onClick={() => setSettingsOpen(true)}
            className="h-8 w-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
            title="设置"
          >
            <Settings className="h-4 w-4" />
          </button>
          <WindowControls />
        </div>
      </div>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  )
}

function TabButton({
  active, icon, label, onClick,
}: {
  active: boolean
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-sm font-medium transition-all duration-200',
        active
          ? 'control-raised text-primary'
          : 'text-muted-foreground hover:text-foreground hover:bg-card/60'
      )}
    >
      {icon}
      {label}
    </button>
  )
}
