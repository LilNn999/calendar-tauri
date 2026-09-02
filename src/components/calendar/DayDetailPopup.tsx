import { useState, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from '@/lib/motion'
import { X, Plus, FileText, RefreshCw } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { matchesCheckinFrequency, toDateString } from '@/lib/utils'
import { useTaskStore } from '@/store/useTaskStore'
import { useCheckinStore } from '@/store/useCheckinStore'
import { useNotesStore } from '@/store/useNotesStore'
import { TaskItemRow } from './DayCellItem'
import { NumericCheckin } from '@/components/checkins/NumericCheckin'
import { BooleanCheckin } from '@/components/checkins/BooleanCheckin'
import { TextCheckin } from '@/components/checkins/TextCheckin'
import { TimeCheckin } from '@/components/checkins/TimeCheckin'
import { DailyNoteEditor } from '@/components/notes/DailyNoteEditor'
import { Button } from '@/components/ui/button'
import { PrioritySelector } from '@/components/tasks/PrioritySelector'
import { SubtaskInputList, type SubtaskInputItem } from '@/components/tasks/SubtaskInputList'
import { TaskEditDialog } from '@/components/tasks/TaskEditDialog'
import { RecurringChangeDialog } from '@/components/tasks/RecurringChangeDialog'
import { applyRecurringDelete } from '@/components/tasks/recurringActions'
import type { Task, CheckinDefinition, Priority } from '@shared/types'

interface DayDetailPopupProps {
  date: string | null
  definitions: CheckinDefinition[]
  onClose: () => void
  onTaskToggle: (id: number, completed: boolean, occurrenceDate?: string) => void
  onAfterTaskChange?: () => void
}

export function DayDetailPopup({ date, definitions, onClose, onTaskToggle, onAfterTaskChange }: DayDetailPopupProps) {
  const { tasks: allTasks, deleteTask, skipOccurrence, deleteFromDate, deleteBeforeDate, createTask, toggleSubtask } = useTaskStore()
  const { getEntriesForDate, upsertEntry } = useCheckinStore()
  const { upsertNote } = useNotesStore()
  const [editTask, setEditTask] = useState<Task | null>(null)
  const [editOccurrenceDate, setEditOccurrenceDate] = useState<string | undefined>(undefined)
  // 循环任务删除范围选择（垃圾桶直达，不经过编辑弹窗）
  const [deleteScopeTask, setDeleteScopeTask] = useState<Task | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newPriority, setNewPriority] = useState<Priority>('none')
  const [newSubtasks, setNewSubtasks] = useState<SubtaskInputItem[]>([])
  const [creating, setCreating] = useState(false)
  const newTitleRef = useRef<HTMLTextAreaElement>(null)
  const autoResize = (el: HTMLTextAreaElement) => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' }

  const handleCreate = async () => {
    if (!newTitle.trim() || !date) return
    setCreating(true)
    try {
      await createTask({
        title: newTitle.trim(),
        priority: newPriority,
        dueDate: date,
        subtasks: newSubtasks.map((s) => s.title.trim()).filter(Boolean),
      })
      setNewTitle('')
      setNewPriority('none')
      setNewSubtasks([])
      setShowCreate(false)
      onAfterTaskChange?.()
    } finally {
      setCreating(false)
    }
  }

  const tasks = useMemo(() => {
    if (!date) return []
    const PRIORITY_WEIGHT: Record<string, number> = { high: 3, medium: 2, low: 1, none: 0 }
    return allTasks
      .filter((t) => t.dueDate === date)
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
  }, [allTasks, date])
  const entries = date ? getEntriesForDate(date) : []

  const activeDefs = date ? definitions.filter((d) => {
    if (d.startDate && date < d.startDate) return false
    if (d.endDate && date > d.endDate) return false
    if (!matchesCheckinFrequency(date, d.frequency, d.startDate)) return false
    return true
  }) : []

  const dateLabel = date
    ? format(parseISO(date), 'M月d日 EEEE', { locale: zhCN })
    : ''

  return (
    <>
      <AnimatePresence>
        {date && (
          <div className="fixed inset-0 z-40 flex items-start justify-center pt-14 px-4">
            <motion.div
              className="fixed inset-0 bg-black/25 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
            />
            <motion.div
              className="relative z-50 w-full max-w-md bg-card rounded-3xl border border-border-subtle shadow-float overflow-hidden"
              style={{ boxShadow: 'var(--shadow-xl)' }}
              initial={{ opacity: 0, y: -12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.96 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              {/* 头部 */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle bg-surface-subtle/80">
                <span className="font-bold text-sm">{dateLabel}</span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs rounded-full"
                    onClick={(e) => { e.stopPropagation(); setShowCreate(true) }}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    新建任务
                  </Button>
                  <button
                    onClick={onClose}
                    className="h-7 w-7 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="max-h-[68vh] overflow-y-auto p-4 flex flex-col gap-4">
                {/* 内嵌新建表单 */}
                {showCreate && (
                  <section>
                    <div className="control-inset rounded-2xl p-3 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold">新建任务</span>
                        <span className="text-[10px] text-muted-foreground">{dateLabel}</span>
                      </div>
                      <textarea
                        ref={newTitleRef}
                        autoFocus
                        placeholder="任务标题…"
                        value={newTitle}
                        rows={1}
                        onChange={(e) => { setNewTitle(e.target.value); autoResize(e.target) }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleCreate() }
                          if (e.key === 'Escape') setShowCreate(false)
                        }}
                        className="text-sm rounded-xl w-full border border-input bg-background px-3 py-2 resize-none overflow-hidden focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground leading-snug"
                      />
                      <PrioritySelector value={newPriority} onChange={setNewPriority} />
                      <SubtaskInputList value={newSubtasks} onChange={setNewSubtasks} />
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1 text-xs rounded-xl" onClick={() => setShowCreate(false)}>取消</Button>
                        <Button size="sm" className="flex-1 text-xs rounded-xl" onClick={handleCreate} disabled={!newTitle.trim() || creating}>
                          {creating ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : <Plus className="h-3 w-3 mr-1" />}
                          添加
                        </Button>
                      </div>
                    </div>
                  </section>
                )}

                {/* 任务 */}
                {tasks.length > 0 && (
                  <section>
                    <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">任务</h4>
                    <div className="flex flex-col gap-0.5">
                      {tasks.map((task) => (
                        <TaskItemRow
                          key={`${task.id}-${date}`}
                          task={task}
                          onToggle={(id, done) => onTaskToggle(id, done, task.isRecurring ? date! : undefined)}
                          onClick={() => {
                            setEditTask(task)
                            setEditOccurrenceDate(task.isRecurring ? date! : undefined)
                          }}
                          onMarkComplete={() => onTaskToggle(task.id, true, task.isRecurring ? date! : undefined)}
                          onSubtaskToggle={(subtaskId, done) => toggleSubtask(subtaskId, date!, done)}
                          onDelete={() => {
                            if (task.isRecurring) {
                              // 循环任务：直接打开删除范围选择
                              setDeleteScopeTask(task)
                            } else {
                              deleteTask(task.id)
                            }
                          }}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* 打卡 */}
                {activeDefs.length > 0 && (
                  <section>
                    <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">打卡</h4>
                    <div className="flex flex-col gap-2">
                      {activeDefs.map((def) => {
                        const entry = entries.find((e) => e.definitionId === def.id)
                        const value = entry?.value ?? ''
                        const onChange = (v: string) => date && upsertEntry(def.id, date, v)

                        if (def.type === 'numeric') return <NumericCheckin key={def.id} definition={def} value={value} onChange={onChange} />
                        if (def.type === 'boolean') return <BooleanCheckin key={def.id} definition={def} value={value} onChange={onChange} />
                        if (def.type === 'time') return <TimeCheckin key={def.id} definition={def} value={value} onChange={onChange} />
                        return <TextCheckin key={def.id} definition={def} value={value} onChange={onChange} />
                      })}
                    </div>
                  </section>
                )}

                {/* 每日备注 */}
                <section>
                  <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5" />
                    每日备注
                  </h4>
                  {date && <DailyNoteEditor date={date} onSave={(content) => upsertNote(date, content)} />}
                </section>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <TaskEditDialog
        task={editTask}
        open={!!editTask}
        onOpenChange={(open) => {
          if (!open) {
            setEditTask(null)
            setEditOccurrenceDate(undefined)
          }
        }}
        occurrenceDate={editOccurrenceDate}
        onAfterChange={onAfterTaskChange}
      />

      {/* 循环任务删除范围选择（垃圾桶直达，不经过编辑弹窗） */}
      <RecurringChangeDialog
        open={!!deleteScopeTask}
        mode="delete"
        taskTitle={deleteScopeTask?.title ?? ''}
        occurrenceDate={deleteScopeTask?.dueDate ?? date ?? toDateString(new Date())}
        onConfirm={async (scope) => {
          if (!deleteScopeTask) return
          await applyRecurringDelete({ skipOccurrence, deleteBeforeDate, deleteFromDate }, deleteScopeTask.id, deleteScopeTask.dueDate, scope)
          setDeleteScopeTask(null)
          onAfterTaskChange?.()
        }}
        onCancel={() => setDeleteScopeTask(null)}
      />
    </>
  )
}
