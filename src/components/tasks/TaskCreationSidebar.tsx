import { useState, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from '@/lib/motion'
import { X, Plus, RotateCcw, CheckCheck } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { PrioritySelector } from './PrioritySelector'
import { SubtaskInputList, type SubtaskInputItem } from './SubtaskInputList'
import { useTaskStore } from '@/store/useTaskStore'
import { TaskProjectField, useNewTaskProject, defaultTaskProjectId } from '@/components/projects/TaskProjectField'
import { useUIStore } from '@/store/useUIStore'
import { toDateString } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { PRIORITY_CONFIG } from '@shared/constants'
import type { Priority } from '@shared/types'

export function TaskCreationSidebar() {
  const [projectId, setProjectId] = useNewTaskProject()
  const { sidebarOpen, sidebarDate, setSidebarOpen } = useUIStore()
  const { createTask, tasks, updateOccurrence, updateTask } = useTaskStore()

  const [title, setTitle] = useState('')
  const [date, setDate] = useState(sidebarDate ?? toDateString(new Date()))
  const [priority, setPriority] = useState<Priority>('none')
  const [notes, setNotes] = useState('')
  const [subtasks, setSubtasks] = useState<SubtaskInputItem[]>([])
  const [loading, setLoading] = useState(false)
  const [fillLoading, setFillLoading] = useState<number | null>(null)
  const titleRef = useRef<HTMLTextAreaElement>(null)

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }

  // 当 sidebarDate 变化时同步日期
  if (sidebarDate && sidebarDate !== date) {
    setDate(sidebarDate)
  }

  // 获取当前日期有失败/未完成的循环任务（用于补录）
  const recurringTasksForDate = useMemo(() => {
    const selectedDate = sidebarDate ?? date
    // 取该日期所有循环任务中，尚未完成的（包括失败的，即可以补录的）
    const seen = new Map<number, (typeof tasks)[0]>()
    for (const t of tasks) {
      if (t.isRecurring && t.dueDate === selectedDate && !t.isCompleted) {
        if (!seen.has(t.id)) seen.set(t.id, t)
      }
    }
    return Array.from(seen.values())
  }, [tasks, sidebarDate, date])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setLoading(true)
    try {
      await createTask({
        projectId,
        title: title.trim(),
        priority,
        dueDate: date,
        notes: notes || undefined,
        subtasks: subtasks.map((s) => s.title.trim()).filter(Boolean),
      })
      setTitle('')
      setNotes('')
      setSubtasks([])
      setPriority('none')
      setSidebarOpen(false)
    } finally {
      setLoading(false)
    }
  }

  // 补录：将某循环任务的当天 occurrence 标记为已完成
  const handleFillRecurring = async (taskId: number, taskDate: string, isRecurring: boolean) => {
    setFillLoading(taskId)
    try {
      if (isRecurring) {
        await updateOccurrence(taskId, taskDate, { isCompleted: true, isFailed: false })
      } else {
        await updateTask(taskId, { isCompleted: true, isFailed: false })
      }
      setSidebarOpen(false)
    } finally {
      setFillLoading(null)
    }
  }

  const handleClose = () => {
    setProjectId(defaultTaskProjectId())
    setSidebarOpen(false)
    setTitle('')
    setNotes('')
    setSubtasks([])
    setPriority('none')
  }

  return (
    <AnimatePresence>
      {sidebarOpen && (
        <>
          {/* 居中弹窗 */}
          <motion.div
            className="fixed inset-0 z-40 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute inset-0 bg-black/20"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleClose}
            />
            <motion.div
              className="surface-panel relative z-10 w-full max-w-md max-h-[calc(100vh-2rem)] bg-card/95 backdrop-blur-xl border border-border-subtle shadow-float rounded-2xl flex flex-col overflow-hidden"
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
            {/* 头部 */}
            <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b">
              <h3 className="font-semibold text-sm">新建任务</h3>
              <button
                onClick={handleClose}
                className="h-7 w-7 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex flex-col flex-1 overflow-y-auto">
              {/* 新建任务表单 */}
              <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
                <div>
                  <textarea
                    ref={titleRef}
                    autoFocus
                    placeholder="任务标题…"
                    value={title}
                    rows={1}
                    onChange={(e) => { setTitle(e.target.value); autoResize(e.target) }}
                    className="text-sm font-medium border-0 border-b rounded-none px-0 shadow-none bg-transparent resize-none overflow-hidden w-full focus:outline-none placeholder:text-muted-foreground leading-snug"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSubmit(e as unknown as React.FormEvent)
                      }
                    }}
                  />
                </div>

                <div>
                  <label className="text-xs text-muted-foreground block mb-1">截止日期</label>
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="text-sm"
                  />
                </div>

                <TaskProjectField value={projectId} onChange={setProjectId} />
                <PrioritySelector value={priority} onChange={setPriority} />

                <SubtaskInputList value={subtasks} onChange={setSubtasks} />

                <div>
                  <label className="text-xs text-muted-foreground block mb-1">备注</label>
                  <Textarea
                    placeholder="添加备注…"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={!title.trim() || loading}
                  className="w-full"
                  size="sm"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  添加任务
                </Button>
              </form>

              {/* 循环任务补录区 */}
              {recurringTasksForDate.length > 0 && (
                <div className="px-4 pb-4 flex flex-col gap-2">
                  <div className="flex items-center gap-2 pt-1 pb-0.5">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                      <RotateCcw className="h-3 w-3" />
                      循环任务补录
                    </span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    以下循环任务在该日期尚未完成，可快速补录为已完成：
                  </p>

                  <div className="flex flex-col gap-1.5">
                    {recurringTasksForDate.map((task) => {
                      const priorityCfg = PRIORITY_CONFIG[task.priority]
                      const isFailed = task.isFailed && !task.isCompleted
                      return (
                        <div
                          key={task.id}
                          className={cn(
                            'flex items-center gap-2 rounded-lg px-2 py-2',
                            isFailed ? 'bg-task-failed-bg' : 'bg-task-none-bg'
                          )}
                        >
                          <div className={cn('shrink-0 w-1 h-4 rounded-full', priorityCfg.dot)} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium break-words whitespace-pre-wrap">{task.title}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {isFailed ? '已逾期' : '待完成'} · 循环任务
                            </p>
                          </div>
                          <button
                            disabled={fillLoading === task.id}
                            onClick={() => handleFillRecurring(task.id, task.dueDate, !!task.isRecurring)}
                            className={cn(
                              'shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors',
                              'bg-task-done-bg text-task-done-fg hover:bg-success/20',
                              'hover:text-task-done-fg',
                              fillLoading === task.id && 'opacity-50 cursor-not-allowed'
                            )}
                          >
                            <CheckCheck className="h-3 w-3" />
                            补打卡
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
