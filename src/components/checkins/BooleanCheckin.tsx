import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CheckinDefinition } from '@shared/types'

interface BooleanCheckinProps {
  definition: CheckinDefinition
  value: string
  onChange: (value: string) => void
}

export function BooleanCheckin({ definition, value, onChange }: BooleanCheckinProps) {
  const checked = value === 'true'

  return (
    <button
      type="button"
      className={cn(
        'w-full flex items-center gap-3 rounded-xl px-3 py-2.5 border-2 transition-all duration-150 text-left',
        checked
          ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
          : 'border-border bg-background hover:border-primary/40 hover:bg-accent/50'
      )}
      onClick={() => onChange(checked ? 'false' : 'true')}
    >
      {/* 打勾图标 */}
      <div className={cn(
        'shrink-0 h-5 w-5 rounded-md border-2 flex items-center justify-center transition-all duration-150',
        checked
          ? 'bg-emerald-500 border-emerald-500'
          : 'border-muted-foreground/40'
      )}>
        {checked && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
      </div>
      <span className={cn(
        'flex-1 text-sm font-medium leading-snug',
        checked
          ? 'text-emerald-700 dark:text-emerald-400 line-through opacity-80'
          : 'text-foreground'
      )}>
        {definition.name}
      </span>
      <span className={cn(
        'text-xs font-medium shrink-0',
        checked ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground/50'
      )}>
        {checked ? '已完成' : '待打卡'}
      </span>
    </button>
  )
}
