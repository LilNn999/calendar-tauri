import { cn } from '@/lib/utils'
import type { TimeRange } from '@shared/types'

interface TimeFilterBarProps {
  value: TimeRange
  onChange: (range: TimeRange) => void
}

const OPTIONS: { label: string; value: TimeRange }[] = [
  { label: '本周', value: 'week' },
  { label: '本月', value: 'month' },
  { label: '季度', value: 'quarter' },
  { label: '全年', value: 'year' },
]

export function TimeFilterBar({ value, onChange }: TimeFilterBarProps) {
  return (
    <div className="control-inset flex items-center gap-1 p-1 rounded-full">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'flex-1 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200',
            value === opt.value
              ? 'control-raised text-primary'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
