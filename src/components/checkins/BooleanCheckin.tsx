import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import type { CheckinDefinition } from '@shared/types'

interface BooleanCheckinProps {
  definition: CheckinDefinition
  value: string
  onChange: (value: string) => void
}

export function BooleanCheckin({ definition, value, onChange }: BooleanCheckinProps) {
  const checked = value === 'true'
  const toggle = () => onChange(checked ? 'false' : 'true')

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          toggle()
        }
      }}
      className={cn(
        'w-full flex items-center gap-3 rounded-xl px-3 py-2.5 border-2 transition-all duration-150 text-left cursor-pointer',
        checked
          ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
          : 'border-border bg-background hover:border-primary/40 hover:bg-accent/50'
      )}
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
      {/* 开关：让用户明确知道这是可交互的开关型打卡 */}
      <span onClick={(e) => e.stopPropagation()} className="shrink-0">
        <Switch
          checked={checked}
          onCheckedChange={toggle}
          aria-label={`切换打卡：${definition.name}`}
        />
      </span>
    </div>
  )
}
