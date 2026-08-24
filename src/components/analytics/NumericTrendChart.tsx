import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import type { TrendPoint, TimeRange } from '@shared/types'

interface NumericTrendChartProps {
  name: string
  unit?: string | null
  data: TrendPoint[]
  range: TimeRange
  isTimeSeries?: boolean
}

const W = 720
const H = 190
const PAD_L = 44
const PAD_B = 24
const PAD_T = 12
const CHART_W = W - PAD_L - 14
const CHART_H = H - PAD_T - PAD_B

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24
  const m = Math.round(minutes % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function NumericTrendChart({ name, unit, data, range, isTimeSeries }: NumericTrendChartProps) {
  const [hover, setHover] = useState<number | null>(null)

  const chartData = data.map((d) => ({
    ...d,
    label: range === 'year'
      ? format(parseISO(d.date), 'M月', { locale: zhCN })
      : format(parseISO(d.date), 'M/d', { locale: zhCN }),
  }))

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-28 text-sm text-muted-foreground">
        暂无数据
      </div>
    )
  }

  // 计算 Y 轴动态范围：基于实际数值波动，不从 0 开始，突出曲线变化
  const values = chartData.map((d) => d.value)
  const minVal = Math.min(...values)
  const maxVal = Math.max(...values)
  const spread = maxVal - minVal

  // 如果所有值相同，给一个固定上下浮动，避免折线变直线
  const padding = spread > 0 ? spread * 0.3 : Math.max(Math.abs(minVal) * 0.1, 1)
  const yMin = Math.floor((minVal - padding) * 10) / 10
  const yMax = Math.ceil((maxVal + padding) * 10) / 10

  // 平均值：时间型使用循环平均（处理跨午夜问题，如 23:30 与 00:30 均值应是 00:00）
  const avg = (() => {
    if (!isTimeSeries) return values.reduce((a, b) => a + b, 0) / values.length
    const NOON = 12 * 60
    // 凌晨时间（< 正午）视为次日，加 1440 后再平均
    const adjusted = values.map((m) => m < NOON ? m + 1440 : m)
    const mean = adjusted.reduce((a, b) => a + b, 0) / adjusted.length
    return mean % 1440
  })()

  const formatTick = (v: number) => {
    if (isTimeSeries) return minutesToTime(v)
    if (Math.abs(v) >= 10000) return `${(v / 1000).toFixed(0)}k`
    if (Number.isInteger(v)) return String(v)
    return v.toFixed(1)
  }

  const formatValue = (v: number) => (isTimeSeries ? minutesToTime(v) : `${v}${unit ?? ''}`)

  const x = (i: number) => PAD_L + (chartData.length === 1 ? CHART_W / 2 : (i / (chartData.length - 1)) * CHART_W)
  const yRange = yMax - yMin || 1
  const yAt = (v: number) => PAD_T + CHART_H - ((v - yMin) / yRange) * CHART_H

  const ticks = 4
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => yMin + ((yMax - yMin) * i) / ticks)
  const points = chartData.map((d, i) => `${x(i)},${yAt(d.value)}`).join(' ')
  const hovered = hover !== null ? chartData[hover] : null
  const showXLabels = chartData.length <= 1 || CHART_W / chartData.length > 44

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium">{name}</span>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {unit && !isTimeSeries && <span>{unit}</span>}
          <span>均值 {isTimeSeries ? minutesToTime(avg) : `${avg.toFixed(1)}${unit ?? ''}`}</span>
        </div>
      </div>
      {/* 最大/最小值统计 */}
      <div className="flex gap-3 mb-2 text-[10px] text-muted-foreground">
        <span>{isTimeSeries ? '最晚' : '最高'} <span className="text-primary font-medium">{formatValue(maxVal)}</span></span>
        <span>{isTimeSeries ? '最早' : '最低'} <span className="text-destructive font-medium">{formatValue(minVal)}</span></span>
        {!isTimeSeries && <span>波动 <span className="font-medium">{spread.toFixed(1)}{unit ?? ''}</span></span>}
      </div>

      <div className="relative">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} className="select-none">
          <defs>
            <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="hsl(var(--primary))" />
              <stop offset="100%" stopColor="hsl(var(--accent-2))" />
            </linearGradient>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.25" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* 网格线 + Y 轴刻度 */}
          {yTicks.map((v) => (
            <g key={v}>
              <line
                x1={PAD_L}
                x2={W - 12}
                y1={yAt(v)}
                y2={yAt(v)}
                stroke="hsl(var(--border))"
                strokeOpacity={0.6}
                strokeDasharray="3 3"
                strokeWidth={1}
              />
              <text x={PAD_L - 6} y={yAt(v) + 3} textAnchor="end" fontSize={10} fill="hsl(var(--muted-foreground))">
                {formatTick(v)}
              </text>
            </g>
          ))}

          {/* 均值参考线 */}
          <line
            x1={PAD_L}
            x2={W - 12}
            y1={yAt(avg)}
            y2={yAt(avg)}
            stroke="hsl(var(--muted-foreground))"
            strokeDasharray="4 2"
            strokeOpacity={0.5}
            strokeWidth={1}
          />

                    {/* 折线下渐变面积 */}
          <polygon
            points={`${points} ${x(chartData.length - 1)},${PAD_T + CHART_H} ${x(0)},${PAD_T + CHART_H}`}
            fill="url(#areaGrad)"
          />

          {/* 折线 */}
          <polyline
            points={points}
            fill="none"
            stroke="url(#lineGrad)"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* 数据点 */}
          {chartData.map((d, i) => (
            <g key={d.date}>
              <circle
                cx={x(i)}
                cy={yAt(d.value)}
                r={hover === i ? 5 : 3}
                fill={hover === i ? 'hsl(var(--primary))' : 'hsl(var(--primary))'}
              />
              {/* 透明热区 */}
              <rect
                x={x(i) - CHART_W / chartData.length / 2}
                y={PAD_T}
                width={chartData.length === 1 ? CHART_W : CHART_W / chartData.length}
                height={CHART_H}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
              {(i === 0 || i === chartData.length - 1 || showXLabels) && (
                <text
                  x={x(i)}
                  y={H - 8}
                  textAnchor="middle"
                  fontSize={10}
                  fill="hsl(var(--muted-foreground))"
                >
                  {d.label}
                </text>
              )}
            </g>
          ))}
        </svg>

        {/* 悬浮提示 */}
        {hovered && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border bg-card px-2.5 py-1.5 text-xs shadow-lg"
            style={{
              left: `${(x(hover ?? 0) / W) * 100}%`,
              top: `${(yAt(hovered.value) - 8) / H * 100}%`,
            }}
          >
            <span className="font-medium">{hovered.label}</span>
            <span className="ml-2 text-primary">{formatValue(hovered.value)}</span>
          </div>
        )}
      </div>
    </div>
  )
}