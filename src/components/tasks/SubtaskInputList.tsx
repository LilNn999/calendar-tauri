import { useRef } from 'react'
import { Check, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SubtaskInputItem {
  id?: number
  title: string
  /** 打开弹窗时按日期注入的完成状态，可点击切换，保存时同步 */
  isCompleted?: boolean
}

interface SubtaskInputListProps {
  value: SubtaskInputItem[]
  onChange: (items: SubtaskInputItem[]) => void
  placeholder?: string
}

export function SubtaskInputList({ value, onChange, placeholder = '子任务…' }: SubtaskInputListProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const updateAt = (i: number, title: string) => {
    const next = [...value]
    next[i] = { ...next[i], title }
    onChange(next)
  }
  const toggleAt = (i: number) => {
    const next = [...value]
    next[i] = { ...next[i], isCompleted: !next[i].isCompleted }
    onChange(next)
  }
  const removeAt = (i: number) => {
    onChange(value.filter((_, idx) => idx !== i))
  }
  const add = () => onChange([...value, { title: '' }])

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    // 阻止回车触发所在表单的隐式提交（否则会直接创建任务并关闭弹窗）
    e.preventDefault()
    // 当前行已有内容且是最后一行时，回车确认并追加下一行
    if (value[i].title.trim() && i === value.length - 1) {
      onChange([...value, { title: '' }])
      requestAnimationFrame(() => inputRefs.current[i + 1]?.focus())
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-muted-foreground">子任务</label>
      {value.map((item, i) => (
        <div key={i} className="flex items-center gap-1.5">
          {/* 仅已持久化的子任务有完成状态（完成状态按日期记录，新建时不存在） */}
          {item.id != null && (
            <button
              type="button"
              onClick={() => toggleAt(i)}
              title={item.isCompleted ? '标记未完成' : '标记完成'}
              className={cn(
                'shrink-0 h-3.5 w-3.5 rounded-[3px] border flex items-center justify-center transition-colors',
                item.isCompleted
                  ? 'bg-success border-success'
                  : 'border-current bg-current/10 hover:border-primary'
              )}
            >
              {item.isCompleted && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3.5} />}
            </button>
          )}
          <input
            ref={(el) => { inputRefs.current[i] = el }}
            value={item.title}
            onChange={(e) => updateAt(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            placeholder={placeholder}
            className={cn(
              'flex-1 rounded-xl border border-input bg-card/60 px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground transition-colors hover:border-primary/40',
              item.isCompleted && 'line-through text-muted-foreground'
            )}
          />
          <button
            type="button"
            onClick={() => removeAt(i)}
            className="shrink-0 h-6 w-6 flex items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-muted/60 transition-colors"
            title="删除该子任务"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="self-start flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <Plus className="h-3 w-3" /> 添加子任务
      </button>
    </div>
  )
}
