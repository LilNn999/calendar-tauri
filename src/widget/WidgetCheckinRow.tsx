import { useRef } from 'react'
import { Clock } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import type { CheckinDefinition, CheckinEntry } from '@shared/types'

interface WidgetCheckinRowProps {
  definitions: CheckinDefinition[]
  entries: CheckinEntry[]
  onChange: (defId: number, value: string) => void
}

// 部分 WebView 环境点击时间框不会自动弹出选择器，主动调用 showPicker
function TimePickerInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  const openPicker = () => {
    try {
      ref.current?.showPicker?.()
    } catch {
      ref.current?.focus()
    }
  }
  return (
    <div className="relative flex items-center">
      <Input
        ref={ref}
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClick={openPicker}
        className="w-20 h-6 text-xs px-1.5 pr-6"
      />
      <button
        type="button"
        onClick={openPicker}
        title="选择时间"
        className="absolute right-1 h-4 w-4 flex items-center justify-center text-muted-foreground hover:text-primary"
      >
        <Clock className="h-3 w-3" />
      </button>
    </div>
  )
}

export function WidgetCheckinRow({ definitions, entries, onChange }: WidgetCheckinRowProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[10px] font-medium text-muted-foreground">今日打卡</span>
      {definitions.map((def) => {
        const entry = entries.find((e) => e.definitionId === def.id)
        const value = entry?.value ?? ''

        return (
          <div key={def.id} className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-muted/60 transition-colors">
            <span className="text-xs flex-1 truncate text-foreground">{def.name}</span>
            {def.type === 'boolean' && (
              <Switch
                checked={value === 'true'}
                onCheckedChange={(v) => onChange(def.id, v ? 'true' : 'false')}
              />
            )}
            {def.type === 'numeric' && (
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={0}
                  value={value}
                  onChange={(e) => {
                    // 数值型打卡不允许负值
                    if (e.target.value.startsWith('-')) return
                    onChange(def.id, e.target.value)
                  }}
                  placeholder="0"
                  className="w-14 h-6 text-xs text-right px-1.5"
                />
                {def.unit && <span className="text-[10px] text-muted-foreground">{def.unit}</span>}
              </div>
            )}
            {def.type === 'text' && (
              <Input
                type="text"
                value={value}
                onChange={(e) => onChange(def.id, e.target.value)}
                placeholder="记录…"
                className="w-24 h-6 text-xs"
              />
            )}
            {def.type === 'time' && (
              <TimePickerInput value={value} onChange={(v) => onChange(def.id, v)} />
            )}
          </div>
        )
      })}
    </div>
  )
}
