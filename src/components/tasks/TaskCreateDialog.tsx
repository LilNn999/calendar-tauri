import { useState, useEffect, useRef } from 'react'
import { Plus, RefreshCw } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { PrioritySelector } from './PrioritySelector'
import { RecurrenceSelector } from './RecurrenceSelector'
import { SubtaskInputList, type SubtaskInputItem } from './SubtaskInputList'
import { useTaskStore } from '@/store/useTaskStore'
import { useCalendarStore } from '@/store/useCalendarStore'
import { toDateString } from '@/lib/utils'
import type { Priority, RecurrenceType } from '@shared/types'
import { TaskProjectField, useNewTaskProject, defaultTaskProjectId } from '@/components/projects/TaskProjectField'

interface TaskCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 打开时预填的截止日期（如侧栏当前选中的日期） */
  defaultDate?: string
}

export function TaskCreateDialog({ open, onOpenChange, defaultDate }: TaskCreateDialogProps) {
  const { createTask, fetchTasks } = useTaskStore()
  const [projectId, setProjectId] = useNewTaskProject()
  const { getVisibleRange } = useCalendarStore()

  const [title, setTitle] = useState('')
  const [date, setDate] = useState(defaultDate ?? toDateString(new Date()))
  const [priority, setPriority] = useState<Priority>('none')
  const [notes, setNotes] = useState('')
  const [subtasks, setSubtasks] = useState<SubtaskInputItem[]>([])
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType | ''>('')
  const [recurrenceEnd, setRecurrenceEnd] = useState('')
  const [loading, setLoading] = useState(false)
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const autoResize = (el: HTMLTextAreaElement) => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' }

  // 每次打开时重置表单并预填默认日期
  useEffect(() => {
    if (open) {
      setProjectId(defaultTaskProjectId())
      setTitle('')
      setDate(defaultDate ?? toDateString(new Date()))
      setPriority('none')
      setNotes('')
      setSubtasks([])
      setRecurrenceType('')
      setRecurrenceEnd('')
    }
  }, [open, defaultDate, setProjectId])

  const handleCreate = async () => {
    if (!title.trim()) return
    setLoading(true)
    try {
      await createTask({
        projectId,
        title: title.trim(),
        priority,
        dueDate: date,
        notes: notes || undefined,
        recurrenceType: recurrenceType || undefined,
        recurrenceEnd: recurrenceEnd || undefined,
        subtasks: subtasks.map((s) => s.title.trim()).filter(Boolean),
      })
      if (recurrenceType) {
        const range = getVisibleRange()
        await fetchTasks(range.start, range.end)
      }
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>新建任务</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-6 py-2">
          <textarea
            ref={titleRef}
            autoFocus
            value={title}
            rows={1}
            onChange={(e) => { setTitle(e.target.value); autoResize(e.target) }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleCreate() } }}
            placeholder="任务标题"
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none overflow-hidden hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground leading-snug transition-colors"
          />
          <div>
            <label className="text-xs text-muted-foreground block mb-1">截止日期</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <TaskProjectField value={projectId} onChange={setProjectId} />
          <PrioritySelector value={priority} onChange={setPriority} />
          <RecurrenceSelector
            value={recurrenceType}
            onChange={setRecurrenceType}
            endDate={recurrenceEnd}
            onEndDateChange={setRecurrenceEnd}
            startDate={date}
          />
          <SubtaskInputList value={subtasks} onChange={setSubtasks} />
          <Textarea
            placeholder="备注（选填）"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>取消</Button>
          <Button size="sm" onClick={handleCreate} disabled={loading || !title.trim()}>
            {loading ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
            添加
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
