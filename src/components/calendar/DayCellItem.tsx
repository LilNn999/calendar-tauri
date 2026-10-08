import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Check, X, RotateCcw, Pencil, Trash2, CheckCheck, CalendarCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useJustCompleted, useJustCompletedMap } from '@/lib/use-completion-feedback'
import { PRIORITY_CONFIG, RECURRENCE_LABELS } from '@shared/constants'
import type { Task, CheckinDefinition, CheckinEntry } from '@shared/types'
import { TaskProjectBadge } from '@/components/projects/TaskProjectField'

// ── 优先级 × 状态 → 背景色 ──────────────────────────────────
function getTaskBg(task: Task): string {
  if (task.isCompleted) {
    // 已完成：淡绿色，降低透明度
    return 'bg-task-done-bg'
  }
  if (task.isFailed) {
    // 失败/逾期：深红色底色，与高优先级浅红明显区分
    return 'bg-task-failed-bg'
  }
  // 待完成：按优先级渲染底色
  switch (task.priority) {
    case 'high':   return 'bg-task-high-bg'
    case 'medium': return 'bg-task-medium-bg'
    case 'low':    return 'bg-task-low-bg'
    default:       return 'bg-task-none-bg'
  }
}

// 左侧优先级竖条颜色
function getBarColor(task: Task): string {
  if (task.isCompleted) return 'bg-task-done-bar'
  if (task.isFailed)    return 'bg-task-failed-bar'
  return PRIORITY_CONFIG[task.priority].dot
}

// 与背景色配套的前景色，确保深色任务底上的标题/备注可读
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

// ── TaskItemRow ────────────────────────────────────────────
interface TaskItemRowProps {
  task: Task
  onToggle: (id: number, completed: boolean) => void
  onClick: () => void
  compact?: boolean
  /** 逾期任务"补打卡"回调 */
  onMarkComplete?: () => void
  /** "删除此项"回调（非循环直接删，循环走 edit dialog） */
  onDelete?: () => void
  /** 切换子任务完成状态（subtaskId, 完成） */
  onSubtaskToggle?: (subtaskId: number, completed: boolean) => void
}

export function TaskItemRow({ task, onToggle, onClick, compact, onMarkComplete, onDelete, onSubtaskToggle }: TaskItemRowProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const rowRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLSpanElement>(null)
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties | null>(null)
  // 勾选完成瞬间播放反馈动画（弹跳 + 绿色脉冲）
  const justCompleted = useJustCompleted(task.isCompleted)
  // 子任务同样有完成反馈，宽限期内保持原位再沉底
  const subCelebrating = useJustCompletedMap(task.subtasks)

  const [menuStyle, setMenuStyle] = useState<React.CSSProperties | null>(null)

  // 点击外部关闭菜单
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  // WebView 下离开行/窗口时 onMouseLeave 偶发不触发，这里做全局兜底
  useEffect(() => {
    if (!compact || !tooltipStyle) return

    const clearTooltip = () => setTooltipStyle(null)
    const handlePointerMove = (event: PointerEvent) => {
      const rect = rowRef.current?.getBoundingClientRect()
      if (!rect) return
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      ) {
        clearTooltip()
      }
    }

    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerleave', clearTooltip)
    document.addEventListener('mouseleave', clearTooltip)
    window.addEventListener('blur', clearTooltip)

    return () => {
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerleave', clearTooltip)
      document.removeEventListener('mouseleave', clearTooltip)
      window.removeEventListener('blur', clearTooltip)
    }
  }, [compact, tooltipStyle])

  const isFailed = task.isFailed && !task.isCompleted
  const isHighPending = task.priority === 'high' && !task.isCompleted && !task.isFailed

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isFailed) {
      // 逾期任务：点击打叉图标展开上下文菜单（portal，避免overflow截断）
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      setMenuStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        zIndex: 9999,
      })
      setMenuOpen((v) => !v)
    } else if (!task.isFailed) {
      onToggle(task.id, !task.isCompleted)
    }
  }

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!compact) return
    // 仅当标题实际被截断（出现省略号）时才显示气泡
    const isTruncated = titleRef.current
      ? titleRef.current.scrollWidth > titleRef.current.clientWidth
      : false
    if (!isTruncated) return

    const TOOLTIP_W = 224
    const TOOLTIP_EST_H = 150
    const rect = e.currentTarget.getBoundingClientRect()
    const above = rect.bottom + TOOLTIP_EST_H > window.innerHeight
    const alignRight = rect.left + TOOLTIP_W > window.innerWidth - 8

    const style: React.CSSProperties = { position: 'fixed', zIndex: 9999, width: TOOLTIP_W }
    if (above) style.bottom = window.innerHeight - rect.top + 6
    else        style.top    = rect.bottom + 6
    if (alignRight) style.right = window.innerWidth - rect.right
    else            style.left  = rect.left

    setTooltipStyle(style)
  }

  const row = (
    <div
      ref={rowRef}
      className={cn(
        'group relative flex gap-1 rounded-[var(--task-radius)] px-1 py-0.5 cursor-pointer transition-all duration-150',
        'hover:brightness-[0.96] dark:hover:brightness-110',
        getTaskBg(task),
        getTaskFg(task),
        compact ? 'text-xs items-center' : 'text-sm items-start',
        justCompleted && 'task-complete-pulse'
      )}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setTooltipStyle(null)}
    >
      {/* 左侧优先级竖条 */}
      <div className={cn('shrink-0 w-[3px] self-stretch rounded-full my-0.5', getBarColor(task))} />

      {/* 复选框 / 状态图标 */}
      <button
        title={isFailed ? '点击查看操作' : undefined}
        className={cn(
          'shrink-0 h-3.5 w-3.5 rounded-[5px] border-[1.5px] flex items-center justify-center transition-all duration-150',
          !compact && 'mt-0.5',
          task.isCompleted
            ? 'bg-success border-success'
            : isFailed
            ? 'bg-task-failed-bg border-task-failed-bar text-task-failed-fg hover:border-warning hover:bg-warning/10'
            : isHighPending
            ? 'border-task-high-fg/70 bg-task-high-fg/10 hover:border-task-high-fg group-hover:border-task-high-fg'
            : 'border-muted-foreground/40 dark:border-muted-foreground/80 dark:bg-muted/25 hover:border-primary group-hover:border-primary/70'
        )}
        onClick={handleCheckboxClick}
      >
        {task.isCompleted && <Check className={cn('h-2 w-2 text-white', justCompleted && 'task-check-pop')} strokeWidth={3.5} />}
        {isFailed && <X className="h-2 w-2 text-task-failed-fg" strokeWidth={3.5} />}
      </button>

      {/* 标题 + 备注（非 compact 时全量展开） */}
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span
          ref={titleRef}
          className={cn(
            'leading-tight',
            compact ? 'truncate' : 'break-words whitespace-pre-wrap',
            isHighPending && 'font-bold',
            !isHighPending && 'font-medium',
            task.isCompleted && 'line-through text-task-done-fg font-normal opacity-75',
            isFailed && 'line-through text-task-failed-fg font-normal'
          )}
        >
          {task.title}
        </span>
        {!compact && task.notes && (
          <span className={cn('text-xs break-words whitespace-pre-wrap leading-relaxed', getTaskFg(task))}>
            {task.notes}
          </span>
        )}
      </div>

      {/* 循环标记 */}
      <TaskProjectBadge projectId={task.projectId} compact={compact} />
      {task.isRecurring && (
        <RotateCcw className={cn('shrink-0 h-2.5 w-2.5 opacity-60', getTaskFg(task), !compact && 'mt-1')} />
      )}

      {/* 占位符，菜单通过 portal 渲染到 body，避免 overflow 截断 */}

    </div>
  )

  // 逾期任务上下文菜单通过 portal 挂到 body，避免 overflow 截断
  const menuPortal = menuOpen && isFailed && menuStyle
    ? createPortal(
        <div
          ref={menuRef}
          className="min-w-[148px] bg-popover border rounded-2xl overflow-hidden"
          style={{ ...menuStyle, boxShadow: 'var(--shadow-lg)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {onMarkComplete && (
            <button
              className="w-full text-left px-3 py-2 text-xs hover:bg-accent flex items-center gap-2 text-task-done-fg font-medium"
              onClick={() => { setMenuOpen(false); onMarkComplete() }}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              补打卡（已完成）
            </button>
          )}
          <button
            className="w-full text-left px-3 py-2 text-xs hover:bg-accent flex items-center gap-2 text-foreground"
            onClick={() => { setMenuOpen(false); onClick() }}
          >
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            编辑任务
          </button>
          <button
            className="w-full text-left px-3 py-2 text-xs hover:bg-accent flex items-center gap-2 text-destructive"
            onClick={() => { setMenuOpen(false); (onDelete ?? onClick)() }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            删除此项
          </button>
        </div>,
        document.body
      )
    : null

  // 气泡通过 portal 挂到 body，彻底脱离任何层叠上下文
  const tooltipPortal = compact && tooltipStyle && !menuOpen
    ? createPortal(
        <div
          className="p-2.5 rounded-2xl bg-popover border text-xs pointer-events-none"
          style={{ ...tooltipStyle, boxShadow: 'var(--shadow-lg)' }}
        >
          <p className="font-semibold text-foreground leading-snug break-words">{task.title}</p>
          {task.notes && (
            <p className="mt-1.5 text-muted-foreground leading-relaxed break-words">{task.notes}</p>
          )}
          {(task.priority !== 'none' || task.isRecurring) && (
            <div className="flex flex-wrap items-center gap-2 mt-1.5 pt-1.5 border-t border-border-subtle">
              {task.priority !== 'none' && (
                <span className={cn('font-medium', PRIORITY_CONFIG[task.priority].color)}>
                  {PRIORITY_CONFIG[task.priority].label}优先级
                </span>
              )}
              {task.isRecurring && task.recurrenceType && (
                <span className="text-muted-foreground flex items-center gap-0.5">
                  <RotateCcw className="h-2.5 w-2.5" />
                  {(RECURRENCE_LABELS as Record<string, string>)[task.recurrenceType]}
                </span>
              )}
            </div>
          )}
        </div>,
        document.body
      )
    : null

  return (
    <>
      <div className="flex flex-col">
        {row}
        {!compact && task.subtasks && task.subtasks.length > 0 && (() => {
          // 未完成子任务置顶，已完成沉底；完成反馈宽限期内保持原位，播完动画再沉底
          const sorted = [...task.subtasks].sort((a, b) => {
            const aDone = a.isCompleted && !subCelebrating.has(a.id) ? 1 : 0
            const bDone = b.isCompleted && !subCelebrating.has(b.id) ? 1 : 0
            if (aDone !== bDone) return aDone - bDone
            return a.sortOrder - b.sortOrder
          })
          return (
          <div className="flex flex-col gap-px pl-4 pr-1 pb-0.5 pt-px">
            {sorted.map((st) => (
              <button
                key={st.id}
                onClick={(e) => { e.stopPropagation(); onSubtaskToggle?.(st.id, !st.isCompleted) }}
                className={cn(
                  'group/sub flex items-center gap-1.5 rounded px-1 py-0.5 text-left hover:bg-muted/50 transition-colors',
                  subCelebrating.has(st.id) && 'task-complete-pulse'
                )}
                title={st.isCompleted ? '标记未完成' : '标记完成'}
              >
                <span
                  className={cn(
                    'shrink-0 h-3 w-3 rounded-[3px] border flex items-center justify-center transition-colors',
                    st.isCompleted
                      ? 'bg-success border-success'
                      : 'border-current bg-current/10 group-hover/sub:border-current'
                  )}
                >
                  {st.isCompleted && <Check className={cn('h-2 w-2 text-white', subCelebrating.has(st.id) && 'task-check-pop')} strokeWidth={3.5} />}
                </span>
                <span
                  className={cn(
                    'text-xs leading-snug break-words whitespace-pre-wrap',
                    st.isCompleted && 'line-through text-muted-foreground'
                  )}
                >
                  {st.title}
                </span>
              </button>
            ))}
          </div>
          )
        })()}
      </div>
      {menuPortal}
      {tooltipPortal}
    </>
  )
}

// ── CheckinPreviewRow ──────────────────────────────────────
interface CheckinPreviewRowProps {
  definition: CheckinDefinition
  entry?: CheckinEntry
  compact?: boolean
  onClick?: () => void
}

export function CheckinPreviewRow({ definition, entry, compact, onClick }: CheckinPreviewRowProps) {
  const hasValue = !!entry

  const renderValue = () => {
    if (definition.type === 'boolean') {
      const val = entry?.value === 'true'
      return (
        <span
          className={cn(
            'shrink-0 h-[18px] w-[18px] rounded-full border-2 flex items-center justify-center',
            val
              ? 'bg-success border-success text-white'
              : 'border-muted-foreground/40'
          )}
          title={val ? '已打卡' : '未打卡'}
        >
          {val && <Check className="h-2.5 w-2.5" strokeWidth={3.5} />}
        </span>
      )
    }
    if (!entry) return <span className="text-[10px] text-muted-foreground/40 font-medium">待打卡</span>
    if (definition.type === 'numeric') {
      return (
        <span className="text-[10px] font-bold text-primary">
          {entry.value}{definition.unit ? <span className="font-normal text-muted-foreground ml-0.5">{definition.unit}</span> : null}
        </span>
      )
    }
    if (definition.type === 'time') return <span className="text-[10px] font-bold text-checkin-fg">{entry.value}</span>
    return <span className="text-[10px] text-foreground/70 truncate max-w-[60px]">{entry.value}</span>
  }

  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-md border bg-checkin-bg border-checkin-border px-1 py-0.5',
        hasValue ? 'border-checkin-border' : 'border-checkin-border/60',
        compact ? 'text-xs' : 'text-sm',
        onClick && 'cursor-pointer hover:bg-primary/10 transition-colors'
      )}
      onClick={(e) => { if (onClick) { e.stopPropagation(); onClick() } }}
    >
      <CalendarCheck className="shrink-0 h-2.5 w-2.5 text-primary/70" />
      <span className={cn('flex-1 truncate leading-tight', hasValue ? 'text-foreground font-medium' : 'text-muted-foreground')}>
        {definition.name}
      </span>
      {renderValue()}
    </div>
  )
}
