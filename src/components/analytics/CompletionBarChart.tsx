import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import type { CompletionStats, TimeRange } from '@shared/types'

interface CompletionBarChartProps {
  stats: CompletionStats
  range: TimeRange
}

const W = 720
const H = 200
const PAD_L = 40
const PAD_B = 24
const PAD_T = 10
const CHART_W = W - PAD_L - 10
const CHART_H = H - PAD_T - PAD_B

export function CompletionBarChart({ stats, range }: CompletionBarChartProps) {
  const [hover, setHover] = useState<number | null>(null)

  const data = stats.byDay
    .filter((d) => d.total > 0)
    .map((d) => ({
      ...d,
      label:
        range === 'year'
          ? format(parseISO(d.date), 'M月', { locale: zhCN })
          : format(parseISO(d.date), 'M/d', { locale: zhCN }),
    }))

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
        暂无数据
      </div>
    )
  }

  const slot = CHART_W / data.length
  const barW = Math.min(32, slot * 0.55)
  const y = (rate: number) => PAD_T + CHART_H - (rate / 100) * CHART_H
  const gridValues = [0, 25, 50, 75, 100]
  const hovered = hover !== null ? data[hover] : null

  return (
    <div className="relative">
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} className="select-none">\n        <defs>\n          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">\n            <stop offset="0%" stopColor="hsl(var(--primary))" />\n            <stop offset="100%" stopColor="hsl(var(--accent-2))" />\n          </linearGradient>\n        </defs>
        {/* 网格线 + Y 轴刻度 */}
        {gridValues.map((v) => (
          <g key={v}>
            <line
              x1={PAD_L}
              x2={W - 8}
              y1={y(v)}
              y2={y(v)}
              stroke="hsl(var(--border))"
              strokeDasharray="3 3"
              strokeWidth={1}
            />
            <text x={PAD_L - 6} y={y(v) + 3} textAnchor="end" fontSize={10} fill="hsl(var(--muted-foreground))">
              {v}%
            </text>
          </g>
        ))}

        {/* 柱体 */}
        {data.map((d, i) => {
          const x = PAD_L + slot * i + (slot - barW) / 2
          const bh = (d.rate / 100) * CHART_H
          const isActive = hover === i
          return (
            <g key={d.date}>
              <rect
                x={x}
                y={y(d.rate)}
                width={barW}
                height={Math.max(bh, 1)}
                rx={6}
                fill='url(#barGrad)'
                opacity={hover !== null && !isActive ? 0.45 : 1}
              />
              {/* 透明热区 */}
              <rect
                x={PAD_L + slot * i}
                y={PAD_T}
                width={slot}
                height={CHART_H}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
              {/* X 轴标签：间距不足时只显示首尾 */}
              {(i === 0 || i === data.length - 1 || slot > 52) && (
                <text
                  x={PAD_L + slot * i + slot / 2}
                  y={H - 8}
                  textAnchor="middle"
                  fontSize={10}
                  fill="hsl(var(--muted-foreground))"
                >
                  {d.label}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {/* 悬浮提示 */}
      {hovered && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border bg-card px-2.5 py-1.5 text-xs shadow-lg"
          style={{
            left: `${(PAD_L + slot * (hover ?? 0) + slot / 2) / W * 100}%`,
            top: `${(y(hovered.rate) - 8) / H * 100}%`,
          }}
        >
          <span className="font-medium">{hovered.label}</span>
          <span className="ml-2 text-primary">{hovered.rate}%</span>
        </div>
      )}
    </div>
  )
}