import { cn } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import { Trash2 } from 'lucide-react'
import type { CheckinDefinition } from '@shared/types'

interface BooleanCheckinProps {
  definition: CheckinDefinition
  value: string
  onChange: (value: string) => void
  /** 悬停显示的删除按钮（归档该打卡） */
  onDelete?: () => void
}

export function BooleanCheckin({ definition, value, onChange, onDelete }: BooleanCheckinProps) {
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
        'group w-full flex items-center gap-3 rounded-xl px-3 py-2.5 border-2 transition-all duration-150 text-left cursor-pointer',
        checked
          ? 'border-success bg-success/10'
          : 'border-border-subtle bg-surface-raised hover:border-primary/40 hover:bg-surface-hover'
      )}
    >
      <span className={cn(
        'flex-1 text-sm font-medium leading-snug',
        checked
          ? 'text-success line-through opacity-80'
          : 'text-foreground'
      )}>
        {definition.name}
      </span>
      {onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          title="删除该打卡"
          className="shrink-0 h-6 w-6 flex items-center justify-center rounded-full text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
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
