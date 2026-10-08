import { useState, useEffect } from 'react'
import { Trash2, RotateCcw, X, AlertTriangle } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { tasksApi } from '@/api'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { PRIORITY_CONFIG } from '@shared/constants'
import type { Task } from '@shared/types'
import { useProjectStore } from '@/store/useProjectStore'
import { TaskProjectBadge } from '@/components/projects/TaskProjectField'

interface RecycleBinDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onRestored?: () => void  // 恢复后回调，用于刷新日历
}

export function RecycleBinDialog({ open, onOpenChange, onRestored }: RecycleBinDialogProps) {
  const selectedProjectId = useProjectStore((state) => state.selectedProjectId)
  const [deletedTasks, setDeletedTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  const loadDeleted = async () => {
    setLoading(true)
    try {
      const tasks = await tasksApi.listDeleted(selectedProjectId)
      setDeletedTasks(tasks)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) loadDeleted()
  }, [open, selectedProjectId])

  const handleRestore = async (id: number) => {
    setActionLoading(id)
    try {
      await tasksApi.restore(id)
      setDeletedTasks((prev) => prev.filter((t) => t.id !== id))
      onRestored?.()
    } finally {
      setActionLoading(null)
    }
  }

  const handlePurge = async (id: number) => {
    setActionLoading(id)
    try {
      await tasksApi.purgeTrashed(id)
      setDeletedTasks((prev) => prev.filter((t) => t.id !== id))
    } finally {
      setActionLoading(null)
    }
  }

  const handleEmptyTrash = async () => {
    setLoading(true)
    try {
      await tasksApi.emptyTrash(selectedProjectId)
      setDeletedTasks([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)} className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-muted-foreground" />
            回收箱
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-2">
          <p className="text-[11px] text-muted-foreground mb-3">
            最近30天内删除的任务。恢复后将重新出现在日历中。
          </p>

          {loading && (
            <p className="text-sm text-muted-foreground text-center py-6">加载中…</p>
          )}

          {!loading && deletedTasks.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
              <Trash2 className="h-8 w-8 opacity-30" />
              <p className="text-sm">回收箱为空</p>
            </div>
          )}

          {!loading && deletedTasks.length > 0 && (
            <div className="flex flex-col gap-1.5 max-h-[50vh] overflow-y-auto pr-1">
              {deletedTasks.map((task) => {
                const priorityCfg = PRIORITY_CONFIG[task.priority]
                const deletedLabel = task.deletedAt
                  ? format(new Date(task.deletedAt), 'M月d日 HH:mm', { locale: zhCN })
                  : ''
                return (
                  <div
                    key={task.id}
                    className="flex items-center gap-2 rounded-xl px-2 py-2 bg-secondary/60"
                  >
                    <div className={cn('shrink-0 w-1 h-4 rounded-full', priorityCfg.dot)} />
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-xs font-medium truncate">{task.title}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {task.dueDate}
                        {task.recurrenceType && ' · 重复任务'}
                        {deletedLabel && ` · 删除于 ${deletedLabel}`}
                      </span>
                    </div>
                    <TaskProjectBadge projectId={task.projectId} />
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        disabled={actionLoading === task.id}
                        onClick={() => handleRestore(task.id)}
                        className={cn(
                          'h-6 w-6 flex items-center justify-center rounded-full transition-colors',
                          'text-muted-foreground hover:text-success hover:bg-success/10',
                          actionLoading === task.id && 'opacity-50 cursor-not-allowed'
                        )}
                        title="恢复"
                      >
                        <RotateCcw className="h-3 w-3" />
                      </button>
                      <button
                        disabled={actionLoading === task.id}
                        onClick={() => handlePurge(task.id)}
                        className={cn(
                          'h-6 w-6 flex items-center justify-center rounded-full transition-colors',
                          'text-muted-foreground hover:text-destructive hover:bg-destructive/10',
                          actionLoading === task.id && 'opacity-50 cursor-not-allowed'
                        )}
                        title="彻底删除"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {deletedTasks.length > 0 && !loading && (
          <div className="px-6 pb-4 flex items-center gap-2 text-[11px] text-muted-foreground border-t pt-3">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            <span>彻底删除后无法恢复</span>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-6 text-[11px] text-destructive hover:text-destructive px-2"
              onClick={handleEmptyTrash}
              disabled={loading}
            >
              清空当前范围
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
