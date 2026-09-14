import { useState, useMemo } from 'react'
import { Plus, Pencil, Trash2, Check, X, RotateCcw, Clock, Archive } from 'lucide-react'
import { RecycleBinDialog } from '@/components/tasks/RecycleBinDialog'
import { Button } from '@/components/ui/button'
import { TaskCreateDialog } from '@/components/tasks/TaskCreateDialog'
import { TaskEditDialog } from '@/components/tasks/TaskEditDialog'
import { RecurringChangeDialog } from '@/components/tasks/RecurringChangeDialog'
import { applyRecurringDelete } from '@/components/tasks/recurringActions'
import { NumericCheckin } from '@/components/checkins/NumericCheckin'
import { BooleanCheckin } from '@/components/checkins/BooleanCheckin'
import { TextCheckin } from '@/components/checkins/TextCheckin'
import { TimeCheckin } from '@/components/checkins/TimeCheckin'
import { useTaskStore } from '@/store/useTaskStore'
import { useCheckinStore } from '@/store/useCheckinStore'
import { useCalendarStore } from '@/store/useCalendarStore'
import { toDateString, checkinActiveOn } from '@/lib/utils'
import { TASK_FEEDBACK_MS, useJustCompletedMap } from '@/lib/use-completion-feedback'
import { PRIORITY_CONFIG, RECURRENCE_LABELS } from '@shared/constants'
import { cn } from '@/lib/utils'
import { format, parseISO } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import type { Task, CheckinDefinition } from '@shared/types'

type FilterType = 'pending' | 'completed'

interface DateGroup {
  label: string
  dateStr: string
  isToday: boolean
  tasks: Task[]
  checkins: CheckinDefinition[]
}

// 完成反馈宽限期的任务标识（同一任务在不同日期的发生互不影响）
const taskFeedbackKey = (t: Task) => `${t.id}-${t.dueDate}`

// 子任务列表：勾选完成瞬间播放反馈动画（弹跳 + 脉冲），宽限期内保持原位再沉底
function TaskSubtaskList({ subtasks, date, onToggle }: {
  subtasks: NonNullable<Task['subtasks']>
  date: string
  onToggle: (subtaskId: number, date: string, isCompleted: boolean) => void
}) {
  const celebrating = useJustCompletedMap(subtasks)
  // 未完成子任务置顶，已完成沉底；宽限期内保持原位
  const sorted = [...subtasks].sort((a, b) => {
    const aDone = a.isCompleted && !celebrating.has(a.id) ? 1 : 0
    const bDone = b.isCompleted && !celebrating.has(b.id) ? 1 : 0
    if (aDone !== bDone) return aDone - bDone
    return a.sortOrder - b.sortOrder
  })
  return (
    <div className="flex flex-col gap-0.5 pl-5 pr-1 pb-0.5">
      {sorted.map((st) => (
        <button
          key={st.id}
          onClick={() => onToggle(st.id, date, !st.isCompleted)}
          className={cn(
            'group/sub flex items-center gap-1.5 rounded-lg px-1.5 py-0.5 text-left hover:bg-muted/50 transition-colors',
            celebrating.has(st.id) && 'task-complete-pulse'
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
            {st.isCompleted && <Check className={cn('h-2 w-2 text-white', celebrating.has(st.id) && 'task-check-pop')} strokeWidth={3} />}
          </span>
          <span className={cn('text-[11px] leading-snug break-words whitespace-pre-wrap', st.isCompleted && 'line-through text-muted-foreground')}>
            {st.title}
          </span>
        </button>
      ))}
    </div>
  )
}

export function TaskOverviewPanel({ selectedDate }: { selectedDate: string | null }) {
  const { tasks, updateTask, updateOccurrence, deleteTask, skipOccurrence, deleteFromDate, deleteBeforeDate, fetchTasks, loading, toggleSubtask } = useTaskStore()
  const { definitions, getEntriesForDate, upsertEntry } = useCheckinStore()
  const { getVisibleRange } = useCalendarStore()
  const [filter, setFilter] = useState<FilterType>('pending')
  // 新增任务统一走居中弹窗（与编辑弹窗一致），不再在侧栏内联展开
  const [showCreate, setShowCreate] = useState(false)
  // 循环任务删除范围选择（垃圾桶直接进入删除流程，不经过编辑弹窗）
  const [deleteDialogTask, setDeleteDialogTask] = useState<Task | null>(null)
  // 完成反馈宽限期：刚勾选完成的任务短暂保留在待完成列表播放动画，再正常消失
  const [justCompleted, setJustCompleted] = useState<Set<string>>(new Set())

  const [editingCheckinId, setEditingCheckinId] = useState<number | null>(null)
  // 重复任务编辑/删除使用 TaskEditDialog（含范围选择）
  const [editDialogTask, setEditDialogTask] = useState<Task | null>(null)
  const [showRecycleBin, setShowRecycleBin] = useState(false)

  const today = toDateString(new Date())

  // 今日有效的打卡定义
  const activeTodayDefs = useMemo(() => {
    return definitions.filter((d) => checkinActiveOn(d, today))
  }, [definitions, today])

  const todayEntries = getEntriesForDate(today)

  // 判断某个打卡是否已完成
  const isCheckinDone = (def: CheckinDefinition) => {
    const entry = todayEntries.find((e) => e.definitionId === def.id)
    if (!entry || entry.value === '') return false
    if (entry.value === 'false') return false
    return true
  }

  // 按日期分组
  const dateGroups = useMemo((): DateGroup[] => {
    // 待完成中的重复任务：每个任务只取"最近一次未完成的发生"（今天或最近的未来日期）
    // 避免同一重复任务在列表中出现多条。
    let tasksForFilter = tasks
    if (filter === 'pending') {
      const nextOcc = new Map<number, Task>()
      for (const t of tasks) {
        if (!t.isRecurring || t.isCompleted || t.isFailed || t.dueDate < today) continue
        const cur = nextOcc.get(t.id)
        if (!cur || t.dueDate < cur.dueDate) nextOcc.set(t.id, t)
      }
      const pendingList = [
        ...tasks.filter((t) => !t.isRecurring),
        ...nextOcc.values(),
      ]
      // 完成反馈宽限期：刚勾选完成的任务短暂保留在待完成列表，播完动画再移除
      const seen = new Set(pendingList.map(taskFeedbackKey))
      for (const t of tasks) {
        const key = taskFeedbackKey(t)
        if (justCompleted.has(key) && !seen.has(key)) {
          pendingList.push(t)
          seen.add(key)
        }
      }
      tasksForFilter = pendingList
    }

    const filteredTasks = tasksForFilter.filter((t) => {
      if (filter === 'pending') {
        return (!t.isCompleted && !t.isFailed) || justCompleted.has(taskFeedbackKey(t))
      }
      // completed
      return t.isCompleted
    })

    const dateMap = new Map<string, Task[]>()
    for (const t of filteredTasks) {
      if (!dateMap.has(t.dueDate)) dateMap.set(t.dueDate, [])
      dateMap.get(t.dueDate)!.push(t)
    }

    const groups: DateGroup[] = []

    // 今日待打卡 / 已打卡
    const todayCheckins =
      filter === 'pending'
        ? activeTodayDefs.filter((d) => !isCheckinDone(d))
        : activeTodayDefs.filter((d) => isCheckinDone(d))

    const todayTasks = dateMap.get(today) ?? []
    if (todayTasks.length > 0 || todayCheckins.length > 0) {
      groups.push({ label: '今日', dateStr: today, isToday: true, tasks: todayTasks, checkins: todayCheckins })
    }

    // 其他日期（排序）
    const otherDates = [...dateMap.keys()].filter((k) => k !== today).sort()
    for (const d of otherDates) {
      const isPast = d < today
      const label = isPast
        ? format(parseISO(d), 'M月d日 已过期', { locale: zhCN })
        : format(parseISO(d), 'M月d日', { locale: zhCN })
      groups.push({ label, dateStr: d, isToday: false, tasks: dateMap.get(d)!, checkins: [] })
    }

    return groups
  }, [tasks, filter, today, activeTodayDefs, todayEntries, justCompleted])

  const pendingCount = useMemo(() => {
    // 重复任务：每个任务只计一次（有今天或未来的未完成发生即算待完成）
    const recurringPendingIds = new Set(
      tasks.filter((t) => t.isRecurring && t.dueDate >= today && !t.isCompleted && !t.isFailed).map((t) => t.id)
    )
    const nonRecurringPending = tasks.filter((t) => !t.isRecurring && !t.isCompleted && !t.isFailed).length
    const pendingCheckins = activeTodayDefs.filter((d) => !isCheckinDone(d)).length
    return recurringPendingIds.size + nonRecurringPending + pendingCheckins
  }, [tasks, today, activeTodayDefs, todayEntries])

  const completedCount = useMemo(() => {
    const seen = new Set<number>()
    let count = 0
    for (const t of tasks) {
      if (t.isCompleted && !seen.has(t.id)) { seen.add(t.id); count++ }
    }
    return count
  }, [tasks])

  const handleToggle = async (task: Task) => {
    const nextCompleted = !task.isCompleted
    if (task.isRecurring) {
      await updateOccurrence(task.id, task.dueDate, {
        isCompleted: nextCompleted,
        isFailed: nextCompleted ? false : undefined,
      })
    } else {
      await updateTask(task.id, {
        isCompleted: nextCompleted,
        isFailed: nextCompleted ? false : undefined,
      })
    }
    const key = taskFeedbackKey(task)
    if (nextCompleted) {
      // 宽限期内保留该行播放完成动画，到期后从待完成列表自然消失
      setJustCompleted((prev) => new Set(prev).add(key))
      window.setTimeout(() => {
        setJustCompleted((prev) => {
          const next = new Set(prev)
          next.delete(key)
          return next
        })
      }, TASK_FEEDBACK_MS)
    } else {
      // 取消完成：立即结束反馈状态
      setJustCompleted((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }

  const renderTaskItem = (task: Task) => {
    const priorityCfg = PRIORITY_CONFIG[task.priority]
    const celebrate = justCompleted.has(taskFeedbackKey(task))


    return (
      <div key={`${task.id}-${task.dueDate}`} className="flex flex-col">
        <div
          className={cn(
            'flex items-center gap-2 rounded-xl px-2 py-1.5 transition-colors',
            task.isCompleted ? 'bg-task-done-bg'
              : task.isFailed ? 'bg-task-failed-bg'
              : 'bg-task-none-bg',
            celebrate && 'task-complete-pulse'
          )}
        >
          <div className={cn('shrink-0 w-1 h-4 rounded-full', priorityCfg.dot)} />
          <button
            className={cn(
              'shrink-0 h-4 w-4 rounded-md border-[1.5px] flex items-center justify-center transition-colors',
              task.isCompleted ? 'bg-success border-success'
                : task.isFailed ? 'bg-task-failed-bg border-task-failed-bar text-task-failed-fg'
                : 'border-muted-foreground/40 dark:border-muted-foreground/80 dark:bg-muted/25 hover:border-primary'
            )}
            onClick={() => handleToggle(task)}
          >
            {task.isCompleted && <Check className={cn('h-2.5 w-2.5 text-white', celebrate && 'task-check-pop')} strokeWidth={3} />}
            {task.isFailed && !task.isCompleted && <X className="h-2.5 w-2.5 text-task-failed-fg" strokeWidth={3} />}
          </button>
          <div className="flex flex-col min-w-0 flex-1">
            <span className={cn(
              'text-xs font-medium break-words whitespace-pre-wrap',
              task.isCompleted && 'line-through text-muted-foreground',
              task.isFailed && !task.isCompleted && 'line-through text-task-failed-fg'
            )}>
              {task.title}
            </span>
            {task.isRecurring && task.recurrenceType && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <RotateCcw className="h-2.5 w-2.5" />
                {(RECURRENCE_LABELS as Record<string, string>)[task.recurrenceType]}
              </span>
            )}
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={() => setEditDialogTask(task)}
              className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              onClick={() => task.isRecurring ? setDeleteDialogTask(task) : deleteTask(task.id)}
              className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
        {task.subtasks && task.subtasks.length > 0 && (
          <TaskSubtaskList subtasks={task.subtasks} date={task.dueDate} onToggle={toggleSubtask} />
        )}
      </div>
    )
  }

  const renderCheckinItem = (def: CheckinDefinition) => {
    const done = isCheckinDone(def)
    const isEditing = editingCheckinId === def.id
    const entry = todayEntries.find((e) => e.definitionId === def.id)
    const value = entry?.value ?? ''
    const onChange = (v: string) => upsertEntry(def.id, today, v)

    if (isEditing) {
      return (
        <div key={`checkin-edit-${def.id}`} className="control-inset rounded-2xl p-3 flex flex-col gap-2 bg-checkin-bg/70">
          <div className="flex items-center gap-1.5">
            <Clock className="shrink-0 h-3.5 w-3.5 text-checkin-fg" />
            <span className="text-xs font-medium text-checkin-fg flex-1">{def.name}</span>
            <button
              onClick={() => setEditingCheckinId(null)}
              className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          {def.type === 'numeric' && <NumericCheckin definition={def} value={value} onChange={onChange} />}
          {def.type === 'boolean' && <BooleanCheckin definition={def} value={value} onChange={onChange} />}
          {def.type === 'time' && <TimeCheckin definition={def} value={value} onChange={onChange} />}
          {def.type === 'text' && <TextCheckin definition={def} value={value} onChange={onChange} />}
        </div>
      )
    }

    return (
      <div
        key={`checkin-${def.id}`}
        className={cn(
          'flex items-center gap-2 rounded-xl px-2 py-1.5',
          done ? 'bg-task-done-bg' : 'bg-checkin-bg/70'
        )}
      >
        <div className="shrink-0 w-1 h-4 rounded-full bg-checkin-fg" />
        <Clock className={cn('shrink-0 h-3.5 w-3.5', done ? 'text-success' : 'text-checkin-fg')} />
        <span className={cn('text-xs flex-1 break-words whitespace-pre-wrap', done ? 'text-muted-foreground line-through' : 'text-checkin-fg')}>
          {def.name}
        </span>
        <span className="text-[10px] text-muted-foreground">{done ? '已打卡' : '待打卡'}</span>
        <button
          onClick={() => setEditingCheckinId(def.id)}
          className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
        >
          <Pencil className="h-3 w-3" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold">任务总览</h4>
          <span className="text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
            {pendingCount}待 · {completedCount}完
          </span>
        </div>
        <div className="flex items-center gap-1">
        <button
          onClick={() => setShowRecycleBin(true)}
          className="h-7 w-7 flex items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          title="回收箱"
        >
          <Archive className="h-3.5 w-3.5" />
        </button>
        <Button size="sm" variant="outline" className="h-7 text-xs rounded-xl"
          onClick={() => setShowCreate(true)}>
          <Plus className="h-3 w-3 mr-1" />新增
        </Button>
        </div>
      </div>

      {/* 状态切换 */}
      <div className="flex gap-1">
        <button
          onClick={() => setFilter('pending')}
          className={cn(
            'flex-1 py-1.5 rounded-full text-[11px] font-medium transition-all duration-200',
            filter === 'pending' ? 'control-raised text-primary' : 'text-muted-foreground hover:text-foreground bg-surface-inset/60'
          )}
        >
          待完成 {pendingCount > 0 && <span className="ml-1 opacity-70">{pendingCount}</span>}
        </button>
        <button
          onClick={() => setFilter('completed')}
          className={cn(
            'flex-1 py-1.5 rounded-full text-[11px] font-medium transition-all duration-200',
            filter === 'completed' ? 'bg-success text-white shadow-raised' : 'text-muted-foreground hover:text-foreground bg-surface-inset/60'
          )}
        >
          已完成 {completedCount > 0 && <span className="ml-1 opacity-70">{completedCount}</span>}
        </button>
      </div>

      {/* 任务列表 */}
      <div className="flex flex-col gap-3">
        {loading && <p className="text-xs text-muted-foreground text-center py-4">加载中…</p>}
        {!loading && dateGroups.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">
            {filter === 'pending' ? '今日已完成所有任务 🎉' : '没有已完成记录'}
          </p>
        )}

        {dateGroups.map((group) => (
          <div key={group.dateStr}>
            <div className="flex items-center gap-2 mb-1.5">
              <span className={cn(
                'text-[10px] font-semibold whitespace-nowrap',
                group.isToday ? 'text-primary' : 'text-muted-foreground'
              )}>
                {group.label}
              </span>
              <div className={cn('flex-1 h-px', group.isToday ? 'bg-primary/20' : 'bg-border/60')} />
            </div>
            <div className="flex flex-col gap-1">
              {group.tasks.map((t) => renderTaskItem(t))}
              {group.checkins.map((d) => renderCheckinItem(d))}
            </div>
          </div>
        ))}
      </div>

      {/* 新建任务居中弹窗（预填侧栏选中日期） */}
      <TaskCreateDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        defaultDate={selectedDate ?? today}
      />

      {/* 重复任务编辑对话框（含范围选择） */}
      {editDialogTask && (
        <TaskEditDialog
          task={editDialogTask}
          open={!!editDialogTask}
          onOpenChange={(open) => { if (!open) setEditDialogTask(null) }}
          occurrenceDate={editDialogTask.isRecurring ? editDialogTask.dueDate : undefined}
          onAfterChange={() => {
            const range = getVisibleRange()
            fetchTasks(range.start, range.end)
          }}
        />
      )}

      {/* 重复任务删除范围选择（垃圾桶直达，不经过编辑弹窗） */}
      <RecurringChangeDialog
        open={!!deleteDialogTask}
        mode="delete"
        taskTitle={deleteDialogTask?.title ?? ''}
        occurrenceDate={deleteDialogTask?.dueDate ?? toDateString(new Date())}
        onConfirm={async (scope) => {
          if (!deleteDialogTask) return
          await applyRecurringDelete({ skipOccurrence, deleteBeforeDate, deleteFromDate }, deleteDialogTask.id, deleteDialogTask.dueDate, scope)
          setDeleteDialogTask(null)
          const range = getVisibleRange()
          fetchTasks(range.start, range.end)
        }}
        onCancel={() => setDeleteDialogTask(null)}
      />

      {/* 回收箱对话框 */}
      <RecycleBinDialog
        open={showRecycleBin}
        onOpenChange={setShowRecycleBin}
        onRestored={() => {
          const range = getVisibleRange()
          fetchTasks(range.start, range.end)
        }}
      />
    </div>
  )
}
