import { useState, useRef, useMemo } from 'react'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toDateString, matchesCheckinFrequency } from '@/lib/utils'
import { CELL_MAX_ITEMS } from '@shared/constants'
import { useTaskStore } from '@/store/useTaskStore'
import { useCheckinStore } from '@/store/useCheckinStore'
import { useUIStore } from '@/store/useUIStore'
import { useCalendarStore } from '@/store/useCalendarStore'
import { useNotesStore } from '@/store/useNotesStore'
import { TaskItemRow, CheckinPreviewRow } from './DayCellItem'
import type { CheckinDefinition } from '@shared/types'

// 供 DayCell 调用：onMarkComplete 透传给 CalendarPage 的 handleTaskToggle(id, true, ...)
// onDelete：非循环任务直接删除，循环任务走 onTaskClick（打开编辑对话框）

interface DayCellProps {
  date: Date
  isCurrentMonth?: boolean
  definitions: CheckinDefinition[]
  onDayClick: (date: string) => void
  onTaskToggle: (id: number, completed: boolean, occurrenceDate?: string) => void
  onTaskClick: (taskId: number, date: string) => void
  onCheckinClick: (defId: number, date: string) => void
}

export function DayCell({
  date,
  isCurrentMonth = true,
  definitions,
  onDayClick,
  onTaskToggle,
  onTaskClick,
  onCheckinClick,
}: DayCellProps) {
  const dateStr = toDateString(date)
  const today = toDateString(new Date())
  const isToday = dateStr === today

  const { tasks: allTasks, deleteTask } = useTaskStore()
  const { getEntriesForDate } = useCheckinStore()
  const { setSidebarOpen } = useUIStore()
  const { selectedDate, setSelectedDate } = useCalendarStore()
  const { getNoteForDate } = useNotesStore()

  const [showNoteTooltip, setShowNoteTooltip] = useState(false)
  const [tooltipFlip, setTooltipFlip] = useState(false)
  const noteIndicatorRef = useRef<HTMLDivElement>(null)

  const tasks = useMemo(() => {
    const PRIORITY_WEIGHT: Record<string, number> = { high: 3, medium: 2, low: 1, none: 0 }
    return allTasks
      .filter((t) => t.dueDate === dateStr)
      .sort((a, b) => {
        const aGroup = (a.isCompleted || a.isFailed) ? 1 : 0
        const bGroup = (b.isCompleted || b.isFailed) ? 1 : 0
        if (aGroup !== bGroup) return aGroup - bGroup
        if (aGroup === 0) {
          const pw = (PRIORITY_WEIGHT[b.priority] ?? 0) - (PRIORITY_WEIGHT[a.priority] ?? 0)
          if (pw !== 0) return pw
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        }
        return 0
      })
  }, [allTasks, dateStr])
  const entries = getEntriesForDate(dateStr)
  const noteContent = getNoteForDate(dateStr)

  // 过滤掉有效期之外 / 不匹配周期的打卡定义
  const activeDefs = definitions.filter((d) => {
    if (d.startDate && dateStr < d.startDate) return false
    if (d.endDate && dateStr > d.endDate) return false
    if (!matchesCheckinFrequency(dateStr, d.frequency, d.startDate)) return false
    return true
  })

  type Item = { kind: 'task'; id: number } | { kind: 'checkin'; defId: number }
  const allItems: Item[] = [
    ...tasks.map((t) => ({ kind: 'task' as const, id: t.id })),
    ...activeDefs.map((d) => ({ kind: 'checkin' as const, defId: d.id })),
  ]

  const visibleItems = allItems.slice(0, CELL_MAX_ITEMS)
  const overflow = allItems.length - CELL_MAX_ITEMS
  const isSelected = selectedDate === dateStr

  return (
    <div
      className={cn(
        'relative flex flex-col p-1.5 border-r border-b border-border/60 transition-all cursor-pointer group',
        'min-h-[90px]',
        !isCurrentMonth && 'bg-muted/20',
        isToday && 'bg-primary/5',
        isSelected && 'ring-2 ring-inset ring-primary/40 bg-primary/5',
        'hover:bg-primary/5',
      )}
      onClick={() => { setSelectedDate(dateStr); onDayClick(dateStr) }}
    >
      {/* 日期数字 + 备注指示器 */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1">
          <span
            className={cn(
              'text-xs font-medium h-5 w-5 flex items-center justify-center rounded-full transition-all duration-200',
              isToday
                ? 'bg-gradient-brand text-primary-foreground font-bold shadow-glow'
                : isCurrentMonth
                ? 'text-foreground'
                : 'text-muted-foreground/40'
            )}
          >
            {date.getDate()}
          </span>

          {/* 备注指示点 + hover tooltip（智能定位，防超出边界） */}
          {noteContent && (
            <div
              ref={noteIndicatorRef}
              className="relative"
              onMouseEnter={() => {
                if (noteIndicatorRef.current) {
                  const rect = noteIndicatorRef.current.getBoundingClientRect()
                  setTooltipFlip(rect.left + 200 > window.innerWidth - 16)
                }
                setShowNoteTooltip(true)
              }}
              onMouseLeave={() => setShowNoteTooltip(false)}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="h-1.5 w-1.5 rounded-full bg-amber-400 ring-1 ring-amber-400/30 cursor-help" />
              {showNoteTooltip && (
                <div
                  className={cn(
                    'absolute top-0 z-50 w-48 p-2.5 text-xs bg-popover border rounded-2xl text-muted-foreground leading-relaxed',
                    tooltipFlip ? 'right-3' : 'left-3'
                  )}
                  style={{ boxShadow: 'var(--shadow-lg)' }}
                >
                  <p className="font-medium text-foreground mb-1 text-[11px]">每日备注</p>
                  <p className="line-clamp-4">{noteContent}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 快速新建 */}
        <button
          className="opacity-0 group-hover:opacity-100 h-4 w-4 flex items-center justify-center rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
          onClick={(e) => { e.stopPropagation(); setSidebarOpen(true, dateStr) }}
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>

      {/* 事项列表 */}
      <div className="flex flex-col gap-0.5 flex-1">
        {visibleItems.map((item) => {
          if (item.kind === 'task') {
            const task = tasks.find((t) => t.id === item.id)!
            return (
              <TaskItemRow
                key={`task-${item.id}-${dateStr}`}
                task={task}
                compact
                onToggle={(id, done) => onTaskToggle(id, done, task.isRecurring ? dateStr : undefined)}
                onClick={() => onTaskClick(item.id, dateStr)}
                onMarkComplete={() => onTaskToggle(task.id, true, task.isRecurring ? dateStr : undefined)}
                onDelete={() => {
                  if (task.isRecurring) {
                    // 循环任务：打开编辑对话框（含范围选择的删除流程）
                    onTaskClick(task.id, dateStr)
                  } else {
                    deleteTask(task.id)
                  }
                }}
              />
            )
          } else {
            const def = activeDefs.find((d) => d.id === item.defId)!
            const entry = entries.find((e) => e.definitionId === item.defId)
            return (
              <CheckinPreviewRow
                key={`checkin-${item.defId}`}
                definition={def}
                entry={entry}
                compact
                onClick={() => onCheckinClick(item.defId, dateStr)}
              />
            )
          }
        })}
      </div>

      {/* 溢出提示 */}
      {overflow > 0 && (
        <button
          className="mt-0.5 text-[10px] text-muted-foreground hover:text-primary px-1.5 py-0.5 rounded-full hover:bg-primary/10 transition-colors self-start"
          onClick={(e) => { e.stopPropagation(); onDayClick(dateStr) }}
        >
          +{overflow} 更多
        </button>
      )}
    </div>
  )
}