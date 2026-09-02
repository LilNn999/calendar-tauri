import { useState, useRef } from 'react'
import { Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import type { CheckinDefinition } from '@shared/types'

interface NumericCheckinProps {
  definition: CheckinDefinition
  value: string
  onChange: (value: string) => void
  /** 悬停显示的删除按钮（归档该打卡） */
  onDelete?: () => void
}

export function NumericCheckin({ definition, value, onChange, onDelete }: NumericCheckinProps) {
  const [local, setLocal] = useState(value)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleChange = (v: string) => {
    // 数值型打卡不允许负值
    if (v.startsWith('-')) return
    setLocal(v)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      if (v.trim() !== '') onChange(v.trim())
    }, 600)
  }

  // 回车立即提交，避免防抖未触发时丢失输入
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (local.trim() !== '') onChange(local.trim())
  }

  return (
    <div className="group flex items-center gap-2">
      <span className="text-sm flex-1 text-foreground">{definition.name}</span>
      <div className="flex items-center gap-1">
        <Input
          type="number"
          min={0}
          value={local}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="0"
          className="w-20 h-8 text-sm text-right"
        />
        {definition.unit && (
          <span className="text-xs text-muted-foreground w-6">{definition.unit}</span>
        )}
      </div>
      {onDelete && (
        <button
          onClick={onDelete}
          title="删除该打卡"
          className="shrink-0 h-6 w-6 flex items-center justify-center rounded-full text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
