import { cn } from '@/lib/utils'
import { PRIORITY_CONFIG } from '@shared/constants'
import type { Priority } from '@shared/types'

interface PrioritySelectorProps {
  value: Priority
  onChange: (p: Priority) => void
}

const PRIORITIES: Priority[] = ['none', 'low', 'medium', 'high']

export function PrioritySelector({ value, onChange }: PrioritySelectorProps) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">优先级</span>
      <div className="flex flex-1 items-center gap-1">
        {PRIORITIES.map((p) => {
          const cfg = PRIORITY_CONFIG[p]
          return (
            <button
              key={p}
              type="button"
              title={cfg.label}
              onClick={() => onChange(p)}
              className={cn(
                'relative flex flex-1 items-center justify-center py-1.5 rounded-xl text-xs font-medium transition-all duration-150 border',
                value === p
                  ? 'border-current bg-current/15 shadow-sm ' + cfg.color
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              )}
            >
              <span className={cn('absolute left-1.5 h-1.5 w-1.5 rounded-full', cfg.dot)} />
              {cfg.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
