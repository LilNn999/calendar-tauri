import { useState, useEffect, useRef } from 'react'
import { Trash2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { PrioritySelector } from './PrioritySelector'
import { RecurrenceSelector } from './RecurrenceSelector'
import { RecurringChangeDialog } from './RecurringChangeDialog'
import { SubtaskInputList, type SubtaskInputItem } from './SubtaskInputList'
import { applyRecurringDelete } from './recurringActions'
import type { RecurringChangeScope } from './RecurringChangeDialog'
import { useTaskStore } from '@/store/useTaskStore'
import type { Task, Priority, RecurrenceType } from '@shared/types'

interface TaskEditDialogProps {
  task: Task | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 日历中点击时传入，指定当前是哪一天的 occurrence */
  occurrenceDate?: string
  /** 操作（编辑/删除）完成后的回调，用于触发外层重新拉取数据 */
  onAfterChange?: () => void
}

type PendingAction = { type: 'edit' } | { type: 'delete' }

export function TaskEditDialog({
  task,
  open,
  onOpenChange,
  occurrenceDate,
  onAfterChange,
}: TaskEditDialogProps) {
  const { updateTask, deleteTask, skipOccurrence, deleteFromDate, deleteBeforeDate, detachOccurrence, splitFromDate, updateSubtasks, toggleSubtask } = useTaskStore()

  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [priority, setPriority] = useState<Priority>('none')
  const [notes, setNotes] = useState('')
  const [subtasks, setSubtasks] = useState<SubtaskInputItem[]>([])
  // 打开弹窗时的子任务完成状态快照，保存时仅同步发生变化的项
  const initialCompletedRef = useRef<Map<number, boolean>>(new Map())
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType | ''>('')
  const [recurrenceEnd, setRecurrenceEnd] = useState('')
  const [loading, setLoading] = useState(false)
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const autoResize = (el: HTMLTextAreaElement) => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' }

  // 等待用户选择影响范围的动作
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)

  const isRecurringOccurrence = !!task?.isRecurring && !!occurrenceDate

  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setDate(task.dueDate)
      setPriority(task.priority as Priority)
      setNotes(task.notes ?? '')
      setSubtasks(task.subtasks?.map((s) => ({ id: s.id, title: s.title, isCompleted: s.isCompleted ?? false })) ?? [])
      initialCompletedRef.current = new Map(task.subtasks?.map((s) => [s.id, s.isCompleted ?? false]) ?? [])
      setRecurrenceType((task.recurrenceType as RecurrenceType | '') ?? '')
      setRecurrenceEnd(task.recurrenceEnd ?? '')
    }
  }, [task])

  const closeMain = () => {
    onOpenChange(false)
    setPendingAction(null)
  }

  // ── 编辑保存 ──────────────────────────────────────────────
  const handleSaveClick = () => {
    if (!task || !title.trim()) return
    if (isRecurringOccurrence) {
      // 弹出范围选择对话框
      setPendingAction({ type: 'edit' })
    } else {
      doSaveNormal()
    }
  }

  const doSaveNormal = async () => {
    if (!task || !title.trim()) return
    setLoading(true)
    try {
      await updateTask(task.id, {
        title: title.trim(),
        dueDate: date,
        priority,
        notes: notes || undefined,
        isFailed: false,
        recurrenceType: recurrenceType || null,
        recurrenceEnd: recurrenceEnd || null,
      })
      // 同步子任务列表（增删改）
      await updateSubtasks(
        task.id,
        subtasks
          .map((s) => ({ id: s.id, title: s.title.trim() }))
          .filter((s) => s.title.length > 0)
      )
      // 同步子任务完成状态变化（完成状态按日期记录；任务改期时 updateTask 已把历史记录迁移到新日期，此处一并写入新日期）
      for (const s of subtasks) {
        if (!s.id || !initialCompletedRef.current.has(s.id)) continue
        const now = !!s.isCompleted
        if (initialCompletedRef.current.get(s.id) !== now) {
          await toggleSubtask(s.id, date, now)
        }
      }
      closeMain()
      onAfterChange?.()
    } finally {
      setLoading(false)
    }
  }

  // ── 删除 ──────────────────────────────────────────────────
  const handleDeleteClick = () => {
    if (!task) return
    if (isRecurringOccurrence) {
      setPendingAction({ type: 'delete' })
    } else {
      doDeleteNormal()
    }
  }

  const doDeleteNormal = async () => {
    if (!task) return
    await deleteTask(task.id)
    closeMain()
    onAfterChange?.()
  }

  // ── 范围选择确认 ──────────────────────────────────────────
  const handleScopeConfirm = async (scope: RecurringChangeScope, newRecurrenceEnd?: string) => {
    if (!task || !occurrenceDate || !pendingAction) return
    setPendingAction(null)
    setLoading(true)
    try {
      if (pendingAction.type === 'delete') {
        // 范围删除统一走 applyRecurringDelete（与侧栏/日历详情的删除入口共用）
        await applyRecurringDelete({ skipOccurrence, deleteBeforeDate, deleteFromDate }, task.id, occurrenceDate, scope)
      } else {
        // edit：子任务（顺序 + 当天勾选状态）随范围选择一并应用
        // —— 仅此次：落到拆出的单次任务上；此后全部：落到新序列（date 之前的原序列不受影响）
        const subtaskItems = subtasks
          .map((s) => ({ id: s.id, title: s.title.trim(), isCompleted: !!s.isCompleted }))
          .filter((s) => s.title.length > 0)
        const patch = {
          title: title.trim(),
          priority,
          notes: notes || '',
          recurrenceEnd: newRecurrenceEnd,
          subtasks: subtaskItems,
        }
        if (scope === 'this') {
          await detachOccurrence(task.id, occurrenceDate, patch)
        } else {
          await splitFromDate(task.id, occurrenceDate, patch)
        }
      }
      closeMain()
      onAfterChange?.()
    } finally {
      setLoading(false)
    }
  }

  const handleScopeCancel = () => {
    setPendingAction(null)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && closeMain()}>
        <DialogContent onClose={closeMain}>
          <DialogHeader>
            <DialogTitle>
              {isRecurringOccurrence ? '编辑循环任务' : '编辑任务'}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 px-6 py-2">
            <textarea
              ref={titleRef}
              autoFocus
              value={title}
              rows={1}
              onChange={(e) => { setTitle(e.target.value); autoResize(e.target) }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveClick() } }}
              placeholder="任务标题"
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none overflow-hidden hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground leading-snug transition-colors"
            />
            {/* 非循环实例才允许修改日期（循环任务日期由重复规则决定） */}
            {!isRecurringOccurrence && (
              <div>
                <label className="text-xs text-muted-foreground block mb-1">截止日期</label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            )}
            <PrioritySelector value={priority} onChange={setPriority} />
            {/* 非循环 occurrence 才允许修改重复规则 */}
            {!isRecurringOccurrence && (
              <RecurrenceSelector
                value={recurrenceType}
                onChange={setRecurrenceType}
                endDate={recurrenceEnd}
                onEndDateChange={setRecurrenceEnd}
                startDate={date}
              />
            )}
            {/* 子任务（循环 occurrence 同样可编辑，保存时随所选范围应用：仅此次落到拆出的单次任务，此后全部落到新序列） */}
            <SubtaskInputList value={subtasks} onChange={setSubtasks} />
            <Textarea
              placeholder="备注（选填）"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDeleteClick}
              className="text-destructive hover:text-destructive mr-auto"
              disabled={loading}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              删除
            </Button>
            <Button variant="outline" size="sm" onClick={closeMain}>取消</Button>
            <Button size="sm" onClick={handleSaveClick} disabled={loading || !title.trim()}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 范围选择弹窗（编辑 or 删除均使用同一个） */}
      {task && occurrenceDate && pendingAction && (
        <RecurringChangeDialog
          open={!!pendingAction}
          mode={pendingAction.type}
          taskTitle={task.title}
          occurrenceDate={occurrenceDate}
          currentRecurrenceEnd={task.recurrenceEnd ?? ''}
          onConfirm={handleScopeConfirm}
          onCancel={handleScopeCancel}
        />
      )}
    </>
  )
}
