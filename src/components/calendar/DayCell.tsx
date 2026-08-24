import { useState, useRef, useMemo, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toDateString, matchesCheckinFrequency } from '@/lib/utils'
import { getDayCellState } from '@/lib/dayCellState'
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
  const listRef = useRef<HTMLDivElement>(null)
  const [rowLimit, setRowLimit] = useState(CELL_MAX_ITEMS)

  // 按格子实际可用高度动态计算可显示行数：保证“更多”按钮不压住最后一行，
  // 窗口缩放时也能自动适配，不产生堆叠/遮挡
  useEffect(() => {
    const el = listRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const measure = () => {
      // 每行约 19px 高 + 2px 间距 ≈ 21px
      const n = Math.max(1, Math.floor(el.clientHeight / 21))
      setRowLimit(Math.min(CELL_MAX_ITEMS, n))
    }
    const ob = new ResizeObserver(measure)
    ob.observe(el)
    measure()
    return () => ob.disconnect()
  }, [])

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

  const visibleItems = allItems.slice(0, rowLimit)
  const overflow = allItems.length - rowLimit
  const isSelected = selectedDate === dateStr
  const dayState = getDayCellState({ isSelected, isToday, isCurrentMonth })
  // 三种格子状态互不相同：
  // 选中=极淡底色 + 1px 细边；当天=强调色浅底 + 顶部渐变条；非本月=中性灰底
  const cellBg = dayState === 'selected'
    ? 'bg-day-selected/25 ring-1 ring-inset ring-day-ring/35'
    : dayState === 'today'
      ? 'bg-day-today'
      : dayState === 'outside'
        ? 'bg-day-outside'
        : ''

  return (
    <div
      className={cn(
        'relative flex flex-col p-1.5 bg-card overflow-hidden transition-colors cursor-pointer group',
        'min-h-[76px]',
        cellBg,
        'hover:brightness-105 dark:hover:brightness-110',
      )}
      onClick={() => { setSelectedDate(dateStr); onDayClick(dateStr) }}
    >
      {isToday && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-brand opacity-90" />
      )}

      {/* 日期数字 + 备注指示器 */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1">
          <span
            className={cn(
              'text-xs font-medium h-5 w-5 flex items-center justify-center rounded-full transition-all duration-200',
              isToday
                ? 'bg-primary text-primary-foreground font-bold'
                : isSelected
                ? 'text-primary font-semibold'
                : dayState === 'outside'
                ? 'text-muted-foreground/50'
                : 'text-foreground'
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

      {/* 事项列表 + 溢出“更多”按钮：在流内布局，天然不与行重叠 */}
      <div className="flex flex-col flex-1 min-h-0">
        <div ref={listRef} className="flex flex-col gap-0.5 flex-1 min-h-0 overflow-hidden">
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

        {/* 溢出提示：左下角“更多”按钮 */}
        {overflow > 0 && (
          <button
            className="shrink-0 mt-0.5 self-start inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/20 transition-colors"
            onClick={(e) => { e.stopPropagation(); onDayClick(dateStr) }}
            title={`还有 ${overflow} 项待办`}
          >
            {overflow} 更多
          </button>
        )}
      </div>
    </div>
  )
}
