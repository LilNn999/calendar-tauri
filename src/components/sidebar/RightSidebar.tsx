import { useState, useEffect } from 'react'
import { ListTodo, CheckSquare, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { TaskOverviewPanel } from './TaskOverviewPanel'
import { CheckinPanel } from './CheckinPanel'
import { useUIStore } from '@/store/useUIStore'
import { useCalendarStore } from '@/store/useCalendarStore'
import type { CheckinDefinition } from '@shared/types'

type PanelTab = 'task' | 'checkin'

interface RightSidebarProps {
  definitions: CheckinDefinition[]
  onDefinitionsChange: () => void
}

export function RightSidebar({ definitions, onDefinitionsChange }: RightSidebarProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>('task')
  const { sidebarOpen, sidebarDate, sidebarCollapsed, toggleSidebar } = useUIStore()
  const { selectedDate, setSelectedDate } = useCalendarStore()

  // 当外部触发 setSidebarOpen 时，自动切换到任务 Tab 并展开侧边栏
  // 注意：不调用 setSidebarOpen(false)，让 TaskCreationSidebar 自己管理关闭
  useEffect(() => {
    if (sidebarOpen) {
      setActiveTab('task')
      if (sidebarDate) setSelectedDate(sidebarDate)
      // 如果折叠中，自动展开
      if (sidebarCollapsed) toggleSidebar()
    }
  }, [sidebarOpen, sidebarDate])

  const effectiveDate = selectedDate

  return (
    <div className="relative flex shrink-0">
      {/* 折叠/展开切换按钮 */}
      <button
        onClick={toggleSidebar}
        className={cn(
          'absolute -left-4 top-1/2 -translate-y-1/2 z-20',
          'h-8 w-8 flex items-center justify-center rounded-full',
          'bg-card border border-border-subtle text-muted-foreground shadow-float',
          'hover:text-primary hover:border-primary/50 hover:scale-110',
          'active:scale-95 transition-all duration-150'
        )}
        style={{ boxShadow: 'var(--shadow-float)' }}
        title={sidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'}
      >
        <motion.div animate={{ rotate: sidebarCollapsed ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronRight className="h-4 w-4" />
        </motion.div>
      </button>

      {/* 侧边栏主体 */}
      <AnimatePresence initial={false}>
        {!sidebarCollapsed && (
          <motion.div
            key="sidebar"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 288, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="overflow-hidden flex flex-col sidebar-panel"
          >
            <div className="w-72 flex flex-col h-full">
              {/* Tab 切换头 */}
              <div className="flex items-center gap-1 p-2 border-b border-border-subtle bg-surface-subtle/80 shrink-0">
                <SideTab
                  active={activeTab === 'task'}
                  icon={<ListTodo className="h-3.5 w-3.5" />}
                  label="任务总览"
                  onClick={() => setActiveTab('task')}
                />
                <SideTab
                  active={activeTab === 'checkin'}
                  icon={<CheckSquare className="h-3.5 w-3.5" />}
                  label="打卡任务"
                  onClick={() => setActiveTab('checkin')}
                />
              </div>

              {/* 面板内容 */}
              <div className="flex-1 overflow-y-auto">
                {activeTab === 'task'
                  ? <TaskOverviewPanel selectedDate={effectiveDate} />
                  : <CheckinPanel definitions={definitions} onDefinitionsChange={onDefinitionsChange} />
                }
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function SideTab({ active, icon, label, onClick }: {
  active: boolean
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-xl text-xs font-medium transition-all duration-200',
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
