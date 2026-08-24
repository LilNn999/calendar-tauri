import { useState, useEffect, useRef } from 'react'
import { notesApi } from '@/api'

interface DailyNoteEditorProps {
  date: string
  onSave?: (content: string) => void
}

export function DailyNoteEditor({ date, onSave }: DailyNoteEditorProps) {
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loadedDate = useRef<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }

  useEffect(() => {
    if (loadedDate.current === date) return
    loadedDate.current = date
    notesApi.get(date).then((note) => {
      setContent(note?.content ?? '')
      // 等 DOM 更新后再调整高度
      requestAnimationFrame(adjustHeight)
    })
  }, [date])

  // 内容变化时同步撑高
  useEffect(() => { adjustHeight() }, [content])

  const handleChange = (v: string) => {
    setContent(v)
    if (timerRef.current) clearTimeout(timerRef.current)
    setSaving(true)
    timerRef.current = setTimeout(async () => {
      await notesApi.upsert(date, v)
      onSave?.(v)
      setSaving(false)
    }, 800)
  }

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="记录今天的感受或复盘…"
        rows={1}
        className="w-full min-h-[72px] resize-none overflow-hidden rounded-2xl border border-input bg-card/60 px-3 py-2 text-sm placeholder:text-muted-foreground hover:border-primary/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
      />
      {saving && (
        <span className="absolute right-2.5 bottom-2.5 text-[10px] text-muted-foreground">保存中…</span>
      )}
    </div>
  )
}
