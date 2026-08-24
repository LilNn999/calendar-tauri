import { useMemo } from 'react'
import { startOfWeek, endOfWeek, eachDayOfInterval, format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useCalendarStore } from '@/store/useCalendarStore'
import { useTaskStore } from '@/store/useTaskStore'
import { useCheckinStore } from '@/store/useCheckinStore'
import { useUIStore } from '@/store/useUIStore'
import { useNotesStore } from '@/store/useNotesStore'
import { TaskItemRow, CheckinPreviewRow } from './DayCellItem'
import { toDateString, matchesCheckinFrequency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Plus, FileText } from 'lucide-react'
import type { CheckinDefinition } from '@shared/types'

interface WeekViewProps {
  definitions: CheckinDefinition[]
  onDayClick: (date: string) => void
  onTaskToggle: (id: number, completed: boolean, occurrenceDate?: string) => void
  onTaskClick: (taskId: number, date: string) => void
  onCheckinClick: (defId: number, date: string) => void
}

export function WeekView({ definitions, onDayClick, onTaskToggle, onTaskClick, onCheckinClick }: WeekViewProps) {
  const { currentDate, selectedDate, setSelectedDate } = useCalendarStore()
  const { tasks: allTasks, deleteTask, toggleSubtask } = useTaskStore()
  const { getEntriesForDate } = useCheckinStore()
  const { setSidebarOpen } = useUIStore()
  const { getNoteForDate } = useNotesStore()
  const today = toDateString(new Date())

  const days = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 })
    const end = endOfWeek(currentDate, { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end })
  }, [currentDate])

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="grid grid-cols-7 flex-1 overflow-y-auto">
        {days.map((date) => {
          const dateStr = toDateString(date)
          const isToday = dateStr === today
          const isSelected = selectedDate === dateStr
          const PRIORITY_WEIGHT: Record<string, number> = { high: 3, medium: 2, low: 1, none: 0 }
          const tasks = allTasks
            .filter((t) => t.dueDate === dateStr)
            .sort((a, b) => {
              // 未完成/未逾期的事项置顶，已完成或已失败的事项沉底
              const aDone = a.isCompleted || a.isFailed
              const bDone = b.isCompleted || b.isFailed
              if (aDone !== bDone) return aDone ? 1 : -1
              const pw = (PRIORITY_WEIGHT[b.priority] ?? 0) - (PRIORITY_WEIGHT[a.priority] ?? 0)
              if (pw !== 0) return pw
              return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            })
          const entries = getEntriesForDate(dateStr)
          const noteContent = getNoteForDate(dateStr)

          // 过滤有效期内的打卡
          const activeDefs = definitions.filter((d) => {
            if (d.startDate && dateStr < d.startDate) return false
            if (d.endDate && dateStr > d.endDate) return false
            if (!matchesCheckinFrequency(dateStr, d.frequency, d.startDate)) return false
            return true
          })

          return (
            <div
              key={dateStr}
              className={cn(
                'flex flex-col border-r last:border-r-0 cursor-pointer group',
                isToday && 'bg-primary/5',
                isSelected && 'ring-2 ring-inset ring-primary/40 bg-primary/5',
                'hover:bg-primary/5 transition-colors'
              )}
              onClick={() => { setSelectedDate(dateStr); onDayClick(dateStr) }}
            >
              {/* 日期头部 */}
              <div className="flex items-center justify-between px-2 py-2 border-b border-border/60 bg-secondary/30">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {format(date, 'EEE', { locale: zhCN })}
                  </span>
                  <span className={cn(
                    'text-sm font-bold h-7 w-7 flex items-center justify-center rounded-full',
                    isToday ? 'bg-gradient-brand text-primary-foreground shadow-glow' : 'text-foreground'
                  )}>
                    {date.getDate()}
                  </span>
                </div>
                <div className="flex items-center gap-0.5">
                  {noteContent && (
                    <div title={noteContent} className="h-5 w-5 flex items-center justify-center rounded-full text-amber-500">
                      <FileText className="h-3 w-3" />
                    </div>
                  )}
                  <button
                    className="opacity-0 group-hover:opacity-100 h-5 w-5 flex items-center justify-center rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                    onClick={(e) => { e.stopPropagation(); setSidebarOpen(true, dateStr) }}
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* 事项列表 */}
              <div className="flex-1 p-1 flex flex-col gap-0.5 overflow-y-auto">
                {tasks.map((task) => (
                  <TaskItemRow
                    key={`${task.id}-${dateStr}`}
                    task={task}
                    onToggle={(id, done) => onTaskToggle(id, done, task.isRecurring ? dateStr : undefined)}
                    onClick={() => onTaskClick(task.id, dateStr)}
                    onMarkComplete={() => onTaskToggle(task.id, true, task.isRecurring ? dateStr : undefined)}
                    onSubtaskToggle={(subtaskId, done) => toggleSubtask(subtaskId, dateStr, done)}
                    onDelete={() => {
                      if (task.isRecurring) {
                        onTaskClick(task.id, dateStr)
                      } else {
                        deleteTask(task.id)
                      }
                    }}
                  />
                ))}
                {activeDefs.map((def) => {
                  const entry = entries.find((e) => e.definitionId === def.id)
                  return (
                    <CheckinPreviewRow
                      key={def.id}
                      definition={def}
                      entry={entry}
                      onClick={() => onCheckinClick(def.id, dateStr)}
                    />
                  )
                })}

                {/* 备注内容直接展示（周视图空间充足） */}
                {noteContent && (
                  <div className="mt-0.5 mx-0.5 px-2 py-1 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200/40 dark:border-amber-700/30">
                    <p className="text-[10px] text-amber-700 dark:text-amber-300 leading-relaxed line-clamp-3">
                      {noteContent}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
