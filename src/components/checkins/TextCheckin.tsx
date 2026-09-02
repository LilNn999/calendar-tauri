import { useState, useRef } from 'react'
import { Trash2 } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import type { CheckinDefinition } from '@shared/types'

interface TextCheckinProps {
  definition: CheckinDefinition
  value: string
  onChange: (value: string) => void
  /** 悬停显示的删除按钮（归档该打卡） */
  onDelete?: () => void
}

export function TextCheckin({ definition, value, onChange, onDelete }: TextCheckinProps) {
  const [local, setLocal] = useState(value)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleChange = (v: string) => {
    setLocal(v)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => onChange(v), 800)
  }

  // 回车立即提交（Shift+回车换行）
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey) return
    e.preventDefault()
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    onChange(local)
  }

  return (
    <div className="group flex flex-col gap-1">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
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
      <Textarea
        value={local}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="记录一下…"
        rows={2}
        className="text-sm"
      />
    </div>
  )
}
