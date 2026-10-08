import { useState, useEffect } from 'react'
import { Plus, RefreshCw } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { PrioritySelector } from '@/components/tasks/PrioritySelector'
import { RecurrenceSelector } from '@/components/tasks/RecurrenceSelector'
import { SubtaskInputList, type SubtaskInputItem } from '@/components/tasks/SubtaskInputList'
import { useTaskStore } from '@/store/useTaskStore'
import { useCalendarStore } from '@/store/useCalendarStore'
import { toDateString } from '@/lib/utils'
import type { Priority, RecurrenceType } from '@shared/types'
import { TaskProjectField, useNewTaskProject } from '@/components/projects/TaskProjectField'

interface TaskPanelProps {
  selectedDate: string | null
}

export function TaskPanel({ selectedDate }: TaskPanelProps) {
  const [projectId, setProjectId] = useNewTaskProject()
  const { createTask, fetchTasks, loading } = useTaskStore()
  const { getVisibleRange } = useCalendarStore()

  const defaultDate = selectedDate ?? toDateString(new Date())
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(defaultDate)
  const [priority, setPriority] = useState<Priority>('none')
  const [notes, setNotes] = useState('')
  const [subtasks, setSubtasks] = useState<SubtaskInputItem[]>([])
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType | ''>('')
  const [recurrenceEnd, setRecurrenceEnd] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // 当外部选中日期变化时，同步日期输入
  useEffect(() => {
    if (selectedDate) setDate(selectedDate)
  }, [selectedDate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setSubmitting(true)
    try {
      await createTask({
        projectId,
        title: title.trim(),
        priority,
        dueDate: date,
        notes: notes || undefined,
        recurrenceType: (recurrenceType as RecurrenceType) || undefined,
        recurrenceEnd: recurrenceEnd || undefined,
        subtasks: subtasks.map((s) => s.title.trim()).filter(Boolean),
      })
      // 重复任务需要重新 fetch 才能展开显示
      if (recurrenceType) {
        const range = getVisibleRange()
        await fetchTasks(range.start, range.end)
      }
      setTitle('')
      setNotes('')
      setSubtasks([])
      setPriority('none')
      setRecurrenceType('')
      setRecurrenceEnd('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
      {/* 标题区域 */}
      <div className="card-elevated p-3 rounded-2xl">
        <Input
          autoFocus
          placeholder="任务标题…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="text-sm font-medium border-0 shadow-none focus-visible:ring-0 bg-transparent px-0"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) handleSubmit(e as unknown as React.FormEvent)
          }}
        />
      </div>

      {/* 日期 */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">开始日期</label>
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="text-sm rounded-xl"
        />
      </div>

      {/* 重复 */}
      <RecurrenceSelector
        value={recurrenceType as RecurrenceType | ''}
        onChange={setRecurrenceType}
        endDate={recurrenceEnd}
        onEndDateChange={setRecurrenceEnd}
        startDate={date}
      />

      {/* 优先级 */}
      <TaskProjectField value={projectId} onChange={setProjectId} />
      <PrioritySelector value={priority} onChange={setPriority} />

      {/* 子任务 */}
      <SubtaskInputList value={subtasks} onChange={setSubtasks} />

      {/* 备注 */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">备注</label>
        <Textarea
          placeholder="添加备注…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="text-sm rounded-xl resize-none"
        />
      </div>

      <Button
        type="submit"
        disabled={!title.trim() || submitting || loading}
        className="w-full rounded-full"
        size="sm"
      >
        {submitting ? <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" /> : <Plus className="h-4 w-4 mr-1.5" />}
        添加任务
      </Button>
    </form>
  )
}
