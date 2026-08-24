import { cn } from '@/lib/utils'
import type { RecurrenceType } from '@shared/types'

interface RecurrenceSelectorProps {
  value: RecurrenceType | ''
  onChange: (v: RecurrenceType | '') => void
  endDate: string
  onEndDateChange: (v: string) => void
  startDate: string
}

const OPTIONS: { value: RecurrenceType | ''; label: string }[] = [
  { value: '', label: '不重复' },
  { value: 'daily', label: '每天' },
  { value: 'weekday', label: '工作日' },
  { value: 'weekend', label: '周末' },
  { value: 'weekly', label: '每周' },
  { value: 'monthly', label: '每月' },
]

export function RecurrenceSelector({ value, onChange, endDate, onEndDateChange, startDate }: RecurrenceSelectorProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-medium text-muted-foreground">重复</label>
      <div className="grid grid-cols-3 gap-1">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'px-2 py-1.5 rounded-xl text-xs font-medium border transition-all duration-150',
              value === opt.value
                ? 'border-primary/40 bg-primary/15 text-primary shadow-sm'
                : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {value && (
        <div className="flex flex-col gap-1.5 mt-1">
          <label className="text-xs font-medium text-muted-foreground">重复截止日期（选填）</label>
          <input
            type="date"
            value={endDate}
            min={startDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className="w-full h-9 px-3 text-sm rounded-xl border border-input bg-card/60 focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {!endDate && (
            <p className="text-[10px] text-muted-foreground">不填则永久重复</p>
          )}
        </div>
      )}
    </div>
  )
}
