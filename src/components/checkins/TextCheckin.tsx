import { useState, useRef } from 'react'
import { Textarea } from '@/components/ui/textarea'
import type { CheckinDefinition } from '@shared/types'

interface TextCheckinProps {
  definition: CheckinDefinition
  value: string
  onChange: (value: string) => void
}

export function TextCheckin({ definition, value, onChange }: TextCheckinProps) {
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
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{definition.name}</span>
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
