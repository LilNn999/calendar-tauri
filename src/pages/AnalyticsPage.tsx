import { useState, useEffect } from 'react'
import { format, startOfWeek, startOfMonth, startOfYear, subMonths } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { analyticsApi } from '@/api'
import { useCheckinStore } from '@/store/useCheckinStore'
import { TimeFilterBar } from '@/components/analytics/TimeFilterBar'
import { CompletionPieChart } from '@/components/analytics/CompletionPieChart'
import { CompletionBarChart } from '@/components/analytics/CompletionBarChart'
import { NumericTrendChart } from '@/components/analytics/NumericTrendChart'
import { TaskTrendPanel } from '@/components/analytics/TaskTrendPanel'
import { StreakBadge } from '@/components/streaks/StreakBadge'
import type { CompletionStats, TrendPoint, TimeRange, StreakData } from '@shared/types'

export function AnalyticsPage() {
  const { definitions, fetchDefinitions } = useCheckinStore()
  const [range, setRange] = useState<TimeRange>('month')
  const [stats, setStats] = useState<CompletionStats | null>(null)
  const [trendData, setTrendData] = useState<Record<number, TrendPoint[]>>({})
  const [streak, setStreak] = useState<StreakData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchDefinitions()
    analyticsApi.streakSummary().then(setStreak)
  }, [fetchDefinitions])

  useEffect(() => {
    setLoading(true)
    // 支持数值型和时间型打卡趋势
    const numericDefs = definitions.filter((d) => d.type === 'numeric' || d.type === 'time')

    Promise.all([
      analyticsApi.completion(range),
      ...numericDefs.map((d) =>
        analyticsApi.numericTrend(d.id, range).then((data) => ({ id: d.id, data }))
      ),
    ]).then(([completionStats, ...trends]) => {
      setStats(completionStats as CompletionStats)
      const trendMap: Record<number, TrendPoint[]> = {}
      for (const t of trends as Array<{ id: number; data: TrendPoint[] }>) {
        trendMap[t.id] = t.data
      }
      setTrendData(trendMap)
    }).finally(() => setLoading(false))
  }, [range, definitions])

  const numericDefs = definitions.filter((d) => d.type === 'numeric' || d.type === 'time')

  // 与后端 getDateRange 保持一致，用于界面展示当前统计区间
  function getRangeLabel(r: typeof range): string {
    const now = new Date()
    const today = format(now, 'MM/dd', { locale: zhCN })
    switch (r) {
      case 'week': {
        const mon = startOfWeek(now, { weekStartsOn: 1 })
        return `${format(mon, 'MM/dd')} — ${today}`
      }
      case 'month': {
        const first = startOfMonth(now)
        return `${format(first, 'MM/dd')} — ${today}`
      }
      case 'quarter': {
        const first = startOfMonth(subMonths(now, 2))
        return `${format(first, 'MM/dd')} — ${today}`
      }
      case 'year': {
        const first = startOfYear(now)
        return `${format(first, 'MM/dd')} — ${today}`
      }
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* 顶部：标题 + 筛选 */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 border-b border-border-subtle bg-surface-subtle/85 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-bold">数据统计</h2>
          {streak && <StreakBadge streak={streak.currentStreak} />}
          <span className="text-[11px] text-muted-foreground bg-secondary px-2.5 py-0.5 rounded-full">{getRangeLabel(range)}</span>
        </div>
        <TimeFilterBar value={range} onChange={setRange} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
          加载中…
        </div>
      ) : (
        <div className="p-4 flex flex-col gap-4">
          {/* 第一行：完成率概览 + 每日完成率 */}
          {stats && (
            <div className="grid grid-cols-2 gap-4">
              <div className="card-raised p-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">完成率概览</h3>
                <CompletionPieChart stats={stats} />
              </div>
              <div className="card-raised p-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">每日完成率</h3>
                <CompletionBarChart stats={stats} range={range} />
              </div>
            </div>
          )}

          {/* 第二行：连续打卡 + 任务分析 */}
          <div className="grid grid-cols-2 gap-4">
            {streak && (
              <div className="card-raised p-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">连续打卡</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col items-center rounded-xl bg-warning/10 border border-warning/25 p-4">
                    <span className="text-3xl font-black text-warning">{streak.currentStreak}</span>
                    <span className="text-xs text-muted-foreground mt-1">当前连续（天）</span>
                  </div>
                  <div className="flex flex-col items-center rounded-xl bg-primary/5 border border-primary/20 p-4">
                    <span className="text-3xl font-black text-primary">{streak.longestStreak}</span>
                    <span className="text-xs text-muted-foreground mt-1">历史最长（天）</span>
                  </div>
                </div>
              </div>
            )}

            {/* 任务完成趋势 */}
            <div className="card-raised p-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">任务趋势</h3>
              <TaskTrendPanel range={range} />
            </div>
          </div>

          {/* 数值型打卡趋势图 */}
          {numericDefs.length > 0 && (
            <div className="grid grid-cols-2 gap-4">
              {numericDefs.map((def) => (
                <div key={def.id} className="card-raised p-4">
                  <NumericTrendChart
                    name={def.name}
                    unit={def.unit}
                    data={trendData[def.id] ?? []}
                    range={range}
                    isTimeSeries={def.type === 'time'}
                  />
                </div>
              ))}
            </div>
          )}

          {!stats && !loading && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              暂无数据，去日历页添加任务吧
            </div>
          )}
        </div>
      )}
    </div>
  )
}
