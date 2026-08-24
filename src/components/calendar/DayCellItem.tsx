import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Check, X, RotateCcw, Pencil, Trash2, CheckCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PRIORITY_CONFIG, RECURRENCE_LABELS } from '@shared/constants'
import type { Task, CheckinDefinition, CheckinEntry } from '@shared/types'

// ── 优先级 × 状态 → 背景色 ──────────────────────────────────
function getTaskBg(task: Task): string {
  if (task.isCompleted) {
    // 已完成：淡绿色，降低透明度
    return 'bg-emerald-100/90 dark:bg-emerald-900/25'
  }
  if (task.isFailed) {
    // 失败/逾期：深红色底色，与高优先级浅红明显区分
    return 'bg-red-200 dark:bg-red-900/60'
  }
  // 待完成：按优先级渲染底色
  switch (task.priority) {
    case 'high':   return 'bg-red-100/80 dark:bg-red-900/25'
    case 'medium': return 'bg-amber-100/80 dark:bg-amber-900/25'
    case 'low':    return 'bg-blue-100/80 dark:bg-blue-900/25'
    default:       return 'bg-slate-100  dark:bg-slate-700/40'
  }
}

// 左侧优先级竖条颜色
function getBarColor(task: Task): string {
  if (task.isCompleted) return 'bg-emerald-400/50'
  if (task.isFailed)    return 'bg-red-600/70 dark:bg-red-500/70'
  return PRIORITY_CONFIG[task.priority].dot
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
  const titleRef = useRef<HTMLSpanElement>(null)
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties | null>(null)

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
      className={cn(
        'group relative flex gap-1 rounded-lg px-1 py-0.5 cursor-pointer transition-all duration-150',
        'hover:brightness-[0.96] dark:hover:brightness-110',
        getTaskBg(task),
        compact ? 'text-xs items-center' : 'text-sm items-start'
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
            ? 'bg-emerald-500 border-emerald-500'
            : isFailed
            ? 'bg-red-200 border-red-500 dark:bg-red-800/50 dark:border-red-400 hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20'
            : 'border-muted-foreground/40 dark:border-muted-foreground/80 dark:bg-muted/25 hover:border-primary group-hover:border-primary/70'
        )}
        onClick={handleCheckboxClick}
      >
        {task.isCompleted && <Check className="h-2 w-2 text-white" strokeWidth={3.5} />}
        {isFailed && <X className="h-2 w-2 text-red-600 dark:text-red-300" strokeWidth={3.5} />}
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
            task.isCompleted && 'line-through text-emerald-600 dark:text-emerald-400 font-normal opacity-75',
            isFailed && 'line-through text-red-700 dark:text-red-300 font-normal'
          )}
        >
          {task.title}
        </span>
        {!compact && task.notes && (
          <span className="text-xs text-muted-foreground break-words whitespace-pre-wrap leading-relaxed">
            {task.notes}
          </span>
        )}
      </div>

      {/* 循环标记 */}
      {task.isRecurring && (
        <RotateCcw className={cn('shrink-0 h-2.5 w-2.5 text-muted-foreground/50', !compact && 'mt-1')} />
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
              className="w-full text-left px-3 py-2 text-xs hover:bg-accent flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium"
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
            <div className="flex flex-wrap items-center gap-2 mt-1.5 pt-1.5 border-t border-border/50">
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
          // 未完成子任务置顶，已完成沉底，组内按 sortOrder 保持稳定
          const sorted = [...task.subtasks].sort((a, b) => {
            const aDone = a.isCompleted ? 1 : 0
            const bDone = b.isCompleted ? 1 : 0
            if (aDone !== bDone) return aDone - bDone
            return a.sortOrder - b.sortOrder
          })
          return (
          <div className="flex flex-col gap-px pl-4 pr-1 pb-0.5 pt-px">
            {sorted.map((st) => (
              <button
                key={st.id}
                onClick={(e) => { e.stopPropagation(); onSubtaskToggle?.(st.id, !st.isCompleted) }}
                className="group/sub flex items-center gap-1.5 rounded px-1 py-0.5 text-left hover:bg-muted/50 transition-colors"
                title={st.isCompleted ? '标记未完成' : '标记完成'}
              >
                <span
                  className={cn(
                    'shrink-0 h-3 w-3 rounded-[3px] border flex items-center justify-center transition-colors',
                    st.isCompleted
                      ? 'bg-emerald-500 border-emerald-500'
                      : 'border-muted-foreground/40 dark:border-muted-foreground/80 dark:bg-muted/25 group-hover/sub:border-primary'
                  )}
                >
                  {st.isCompleted && <Check className="h-2 w-2 text-white" strokeWidth={3.5} />}
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
    if (!entry) return <span className="text-[10px] text-muted-foreground/40 font-medium">待打卡</span>
    if (definition.type === 'boolean') {
      const val = entry.value === 'true'
      return (
        <span className={cn('text-[10px] font-bold px-1 py-px rounded', val ? 'text-success' : 'text-muted-foreground')}>
          {val ? '✓' : '✗'}
        </span>
      )
    }
    if (definition.type === 'numeric') {
      return (
        <span className="text-[10px] font-bold text-primary">
          {entry.value}{definition.unit ? <span className="font-normal text-muted-foreground ml-0.5">{definition.unit}</span> : null}
        </span>
      )
    }
    if (definition.type === 'time') return <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400">{entry.value}</span>
    return <span className="text-[10px] text-foreground/70 truncate max-w-[60px]">{entry.value}</span>
  }

  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-md px-1 py-0.5',
        hasValue ? 'bg-primary/5' : '',
        compact ? 'text-xs' : 'text-sm',
        onClick && 'cursor-pointer hover:bg-primary/10 transition-colors'
      )}
      onClick={(e) => { if (onClick) { e.stopPropagation(); onClick() } }}
    >
      <div className={cn('shrink-0 w-[3px] self-stretch rounded-full my-0.5', hasValue ? 'bg-primary/60' : 'bg-muted-foreground/20')} />
      <span className={cn('flex-1 truncate leading-tight', hasValue ? 'text-foreground font-medium' : 'text-muted-foreground')}>
        {definition.name}
      </span>
      {renderValue()}
    </div>
  )
}
