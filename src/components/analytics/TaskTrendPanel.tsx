import { useState, useEffect } from 'react'
import { BarChart2, CheckCircle, XCircle, Flame, ChevronDown } from 'lucide-react'
import { analyticsApi } from '@/api'
import type { TaskTrendStats, TimeRange } from '@shared/types'
import { cn } from '@/lib/utils'

interface TaskTrendPanelProps {
  range: TimeRange
}

export function TaskTrendPanel({ range }: TaskTrendPanelProps) {
  const [stats, setStats] = useState<TaskTrendStats[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    setLoading(true)
    analyticsApi.taskTrend(range)
      .then((data) => {
        setStats(
          data
            .filter((t) => t.isRecurring)
            .sort((a, b) => b.completedCount - a.completedCount)
        )
      })
      .finally(() => setLoading(false))
  }, [range])

  const RANGE_LABEL: Record<TimeRange, string> = {
    week: '近7天', month: '近30天', quarter: '近90天', year: '近1年',
  }

  const displayed = showAll ? stats : stats.slice(0, 6)

  if (loading) {
    return <div className="text-xs text-muted-foreground text-center py-4">加载中…</div>
  }
  if (stats.length === 0) {
    return <div className="text-xs text-muted-foreground text-center py-4">暂无重复任务数据</div>
  }

  const selected = stats.find((s) => s.taskId === selectedId)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <BarChart2 className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">任务完成情况 · {RANGE_LABEL[range]}</span>
        </div>
      </div>

      {/* 详情卡片（选中状态） */}
      {selected && (
        <div className="card-elevated rounded-2xl p-3 border-l-4 border-primary shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold truncate">{selected.title}</span>
            {selected.isRecurring && (
              <span className="text-[10px] bg-primary/10 text-primary rounded-full px-2 py-0.5">重复任务</span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col items-center rounded-xl bg-success/10 dark:bg-success/20 p-2">
              <CheckCircle className="h-4 w-4 text-success mb-0.5" />
              <span className="text-lg font-black text-success">{selected.completedCount}</span>
              <span className="text-[10px] text-muted-foreground">完成次数</span>
            </div>
            <div className="flex flex-col items-center rounded-xl bg-destructive/10 p-2">
              <XCircle className="h-4 w-4 text-destructive mb-0.5" />
              <span className="text-lg font-black text-destructive">{selected.failedCount}</span>
              <span className="text-[10px] text-muted-foreground">失败次数</span>
            </div>
            <div className="flex flex-col items-center rounded-xl bg-warning/10 dark:bg-warning/20 p-2">
              <Flame className="h-4 w-4 text-warning mb-0.5" />
              <span className="text-lg font-black text-warning">{selected.streak}</span>
              <span className="text-[10px] text-muted-foreground">连续完成</span>
            </div>
          </div>
          {selected.totalCount > 0 && (
            <div className="mt-2">
              <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                <span>完成率</span>
                <span>{Math.round((selected.completedCount / selected.totalCount) * 100)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className="progress-fill h-full rounded-full transition-all"
                  style={{ width: `${Math.round((selected.completedCount / selected.totalCount) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 任务列表 */}
      <div className="flex flex-col gap-1">
        {displayed.map((task) => {
          const rate = task.totalCount > 0 ? Math.round((task.completedCount / task.totalCount) * 100) : 0
          const isSelected = selectedId === task.taskId
          return (
            <button
              key={task.taskId}
              onClick={() => setSelectedId(isSelected ? null : task.taskId)}
              className={cn(
                'flex items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-all duration-150',
                isSelected
                  ? 'bg-primary/10 border border-primary/30 shadow-sm'
                  : 'bg-secondary/50 hover:bg-secondary border border-transparent'
              )}
            >
              {/* 完成率色条 */}
              <div className="shrink-0 w-1 h-6 rounded-full bg-muted overflow-hidden flex flex-col-reverse">
                <div
                  className="progress-fill w-full rounded-full transition-all"
                  style={{ height: `${rate}%` }}
                />
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-xs font-medium truncate">{task.title}</span>
                <span className="text-[10px] text-muted-foreground">
                  {task.completedCount}完 · {task.failedCount}失 · {rate}%
                </span>
              </div>
              {task.isRecurring && (
                <span className="shrink-0 text-[10px] text-muted-foreground/60">重复</span>
              )}
            </button>
          )
        })}
      </div>

      {stats.length > 6 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
        >
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showAll && 'rotate-180')} />
          {showAll ? '收起' : `查看全部 ${stats.length} 项`}
        </button>
      )}
    </div>
  )
}
