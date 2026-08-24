import { useState } from 'react'
import type { CompletionStats } from '@shared/types'

interface CompletionPieChartProps {
  stats: CompletionStats
}

const SIZE = 200
const R = 67.5
const STROKE = 25
const CIRCUMFERENCE = 2 * Math.PI * R

export function CompletionPieChart({ stats }: CompletionPieChartProps) {
  const { overall } = stats
  const [hover, setHover] = useState<number | null>(null)

  if (overall.total === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
        暂无数据
      </div>
    )
  }

  const data = [
    { name: '已完成', value: overall.completed, color: 'hsl(var(--success))' },
    { name: '失败', value: overall.failed, color: 'hsl(var(--destructive))' },
    { name: '进行中', value: overall.pending, color: 'hsl(var(--muted-foreground))' },
  ].filter((d) => d.value > 0)

  const total = data.reduce((s, d) => s + d.value, 0)
  let acc = 0
  const segments = data.map((d) => {
    const frac = d.value / total
    const seg = { ...d, frac, offset: acc }
    acc += frac
    return seg
  })

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">整体完成率</span>
        <span className="text-2xl font-bold text-primary">{overall.rate}%</span>
      </div>

      <div className="flex items-center justify-center py-2">
        <svg width="100%" height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="max-w-[200px] select-none">
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="hsl(var(--secondary))" strokeWidth={STROKE} />
          {segments.map((d, i) => {
            const len = d.frac * CIRCUMFERENCE
            return (
              <circle
                key={d.name}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={R}
                fill="none"
                stroke={d.color}
                strokeWidth={STROKE}
                strokeDasharray={`${Math.max(len - 1.5, 0)} ${CIRCUMFERENCE}`}
                strokeDashoffset={-d.offset * CIRCUMFERENCE}
                transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
                opacity={hover !== null && hover !== i ? 0.45 : 1}
                style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                <title>{`${d.name}：${d.value}`}</title>
              </circle>
            )
          })}
          <text
            x={SIZE / 2}
            y={SIZE / 2 - 4}
            textAnchor="middle"
            fontSize={22}
            fontWeight={700}
            fill="hsl(var(--foreground))"
          >
            {overall.rate}%
          </text>
          <text x={SIZE / 2} y={SIZE / 2 + 14} textAnchor="middle" fontSize={10} fill="hsl(var(--muted-foreground))">
            完成率
          </text>
        </svg>
      </div>

      {/* 图例 */}
      <div className="flex items-center justify-center gap-4">
        {segments.map((d, i) => (
          <span
            key={d.name}
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
            {d.name}
            <span className="font-medium text-foreground">{d.value}</span>
          </span>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StatCard label="已完成" value={overall.completed} color="text-success" />
        <StatCard label="失败" value={overall.failed} color="text-destructive" />
        <StatCard label="待完成" value={overall.pending} color="text-muted-foreground" />
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col items-center rounded-xl bg-secondary/50 p-2">
      <span className={`text-lg font-bold ${color}`}>{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}