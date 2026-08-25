import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Check, X, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PRIORITY_CONFIG, RECURRENCE_LABELS } from '@shared/constants'
import type { Task } from '@shared/types'

// 与主界面日历格保持相同的任务状态/优先级底色
function getTaskBg(task: Task): string {
  if (task.isCompleted) return 'bg-task-done-bg'
  if (task.isFailed)    return 'bg-task-failed-bg'
  switch (task.priority) {
    case 'high':   return 'bg-task-high-bg'
    case 'medium': return 'bg-task-medium-bg'
    case 'low':    return 'bg-task-low-bg'
    default:       return 'bg-task-none-bg'
  }
}

// 与背景色配套的前景色，确保深色任务底上的标题可读
function getTaskFg(task: Task): string {
  if (task.isCompleted) return 'text-task-done-fg'
  if (task.isFailed)    return 'text-task-failed-fg'
  switch (task.priority) {
    case 'high':   return 'text-task-high-fg'
    case 'medium': return 'text-task-medium-fg'
    case 'low':    return 'text-task-low-fg'
    default:       return 'text-task-none-fg'
  }
}

interface WidgetTaskListProps {
  tasks: Task[]
  onToggle: (id: number, completed: boolean, dueDate: string, isRecurring?: boolean) => void
  onSubtaskToggle: (subtaskId: number, date: string, completed: boolean) => void
}

export function WidgetTaskList({ tasks, onToggle, onSubtaskToggle }: WidgetTaskListProps) {
  const [tooltip, setTooltip] = useState<{ id: number; style: React.CSSProperties } | null>(null)
  const titleRefs = useRef<Map<number, HTMLSpanElement>>(new Map())

  if (tasks.length === 0) {
    return (
      <div className="text-[11px] text-muted-foreground text-center py-4">
        今天没有任务 🎉
      </div>
    )
  }

  const hoveredTask = tooltip ? tasks.find((t) => t.id === tooltip.id) : null

  return (
    <>
    <div className="flex flex-col gap-1.5">
      {tasks.map((task) => {
        const dot = PRIORITY_CONFIG[task.priority].dot
        return (
          <div
            key={task.id}
            className="flex flex-col"
          >
            <div
              className={cn(
                'card-elevated relative flex items-center gap-2 rounded-xl px-2 py-1.5 group',
                getTaskBg(task)
              )}
              onMouseEnter={(e) => {
                const span = titleRefs.current.get(task.id)
                if (!span || span.scrollWidth <= span.clientWidth) return
                const rect = e.currentTarget.getBoundingClientRect()
                const TOOLTIP_EST_H = 120
                const above = rect.bottom + TOOLTIP_EST_H > window.innerHeight
                const style: React.CSSProperties = {
                  position: 'fixed', zIndex: 9999,
                  left: rect.left, right: window.innerWidth - rect.right,
                  ...(above ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
                }
                setTooltip({ id: task.id, style })
              }}
              onMouseLeave={() => setTooltip(null)}
            >
              <div className={cn('shrink-0 w-1 h-3.5 rounded-full', dot)} />
              <button
                className={cn(
                  'shrink-0 h-4 w-4 rounded-md border flex items-center justify-center transition-all',
                  task.isCompleted
                    ? 'bg-success border-success'
                    : task.isFailed
                    ? 'bg-task-failed-bg border-task-failed-bar text-task-failed-fg'
                    : 'border-input dark:border-muted-foreground/80 dark:bg-muted/25 group-hover:border-primary'
                )}
                onClick={() => !task.isFailed && onToggle(task.id, !task.isCompleted, task.dueDate, task.isRecurring)}
              >
                {task.isCompleted && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                {task.isFailed && !task.isCompleted && <X className="h-2.5 w-2.5 text-task-failed-fg" strokeWidth={3} />}
              </button>
              <span
                ref={(el) => { if (el) titleRefs.current.set(task.id, el); else titleRefs.current.delete(task.id) }}
                className={cn(
                  'text-xs flex-1 truncate',
                  getTaskFg(task),
                  (task.isCompleted || task.isFailed) && 'line-through opacity-75',
                )}
              >
                {task.title}
              </span>
            </div>

            {task.subtasks && task.subtasks.length > 0 && (() => {
              // 未完成子任务置顶，已完成沉底
              const sorted = [...task.subtasks].sort((a, b) => {
                const aDone = a.isCompleted ? 1 : 0
                const bDone = b.isCompleted ? 1 : 0
                if (aDone !== bDone) return aDone - bDone
                return a.sortOrder - b.sortOrder
              })
              return (
              <div className="flex flex-col gap-0.5 pl-6 pr-1 pb-0.5">
                {sorted.map((st) => (
                  <button
                    key={st.id}
                    onClick={() => onSubtaskToggle(st.id, task.dueDate, !st.isCompleted)}
                    className="group/sub flex items-center gap-1.5 rounded px-1 py-0.5 text-left hover:bg-surface-hover transition-colors"
                    title={st.isCompleted ? '标记未完成' : '标记完成'}
                  >
                    <span
                      className={cn(
                        'shrink-0 h-3 w-3 rounded-[3px] border flex items-center justify-center transition-colors',
                        st.isCompleted
                          ? 'bg-success border-success'
                          : 'border-muted-foreground/40 dark:border-muted-foreground/80 dark:bg-muted/25 group-hover/sub:border-primary'
                      )}
                    >
                      {st.isCompleted && <Check className="h-2 w-2 text-white" strokeWidth={3} />}
                    </span>
                    <span className={cn('text-[11px] flex-1 truncate', st.isCompleted && 'line-through text-muted-foreground')}>
                      {st.title}
                    </span>
                  </button>
                ))}
              </div>
              )
            })()}
          </div>
        )
      })}
    </div>
    {hoveredTask && tooltip && createPortal(
      <div
        className="p-2.5 rounded-xl bg-popover border border-border-subtle text-xs pointer-events-none"
        style={{ ...tooltip.style, boxShadow: 'var(--shadow-float)' }}
      >
        <p className="font-semibold text-foreground leading-snug break-words">{hoveredTask.title}</p>
        {hoveredTask.notes && (
          <p className="mt-1.5 text-muted-foreground leading-relaxed break-words">{hoveredTask.notes}</p>
        )}
        {(hoveredTask.priority !== 'none' || hoveredTask.isRecurring) && (
          <div className="flex flex-wrap items-center gap-2 mt-1.5 pt-1.5 border-t border-border-subtle">
            {hoveredTask.priority !== 'none' && (
              <span className={cn('font-medium', PRIORITY_CONFIG[hoveredTask.priority].color)}>
                {PRIORITY_CONFIG[hoveredTask.priority].label}优先级
              </span>
            )}
            {hoveredTask.isRecurring && hoveredTask.recurrenceType && (
              <span className="text-muted-foreground flex items-center gap-0.5">
                <RotateCcw className="h-2.5 w-2.5" />
                {(RECURRENCE_LABELS as Record<string, string>)[hoveredTask.recurrenceType]}
              </span>
            )}
          </div>
        )}
      </div>,
      document.body
    )}
    </>
  )
}
