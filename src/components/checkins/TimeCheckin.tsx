import { useState, useRef } from 'react'
import { Clock, Trash2 } from 'lucide-react'
import type { CheckinDefinition } from '@shared/types'

interface TimeCheckinProps {
  definition: CheckinDefinition
  value: string
  onChange: (value: string) => void
  /** 悬停显示的删除按钮（归档该打卡） */
  onDelete?: () => void
}

export function TimeCheckin({ definition, value, onChange, onDelete }: TimeCheckinProps) {
  const [local, setLocal] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleChange = (v: string) => {
    setLocal(v)
    onChange(v)
  }

  // 部分 WebView 环境点击时间框不会自动弹出选择器，主动调用 showPicker
  const openPicker = () => {
    try {
      inputRef.current?.showPicker?.()
    } catch {
      inputRef.current?.focus()
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="group flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" />
        <span className="flex-1">{definition.name}</span>
        {onDelete && (
          <button
            onClick={onDelete}
            title="删除该打卡"
            className="shrink-0 h-5 w-5 flex items-center justify-center rounded-full text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>
      <div className="relative">
        <input
          ref={inputRef}
          type="time"
          value={local}
          onChange={(e) => handleChange(e.target.value)}
          onClick={openPicker}
          className="w-full h-9 px-3 pr-9 text-sm rounded-xl border border-input bg-background hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
        />
        <button
          type="button"
          onClick={openPicker}
          title="选择时间"
          className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
        >
          <Clock className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
