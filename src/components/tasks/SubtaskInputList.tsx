import { useRef, useState } from 'react'
import { Check, GripVertical, Plus, X } from 'lucide-react'
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

/** 拖拽开始时测量一次的几何信息：各行矩形 + 行间距，拖拽期间不再读 DOM，避免 transform 反馈 */
interface DragGeometry {
  rects: DOMRect[]
  gap: number
  startY: number
}

export function SubtaskInputList({ value, onChange, placeholder = '子任务…' }: SubtaskInputListProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const rowRefs = useRef<(HTMLDivElement | null)[]>([])
  const geoRef = useRef<DragGeometry | null>(null)
  // pointermove 里高频更新，落点同时存 ref，pointerup 时读 ref 提交，避免闭包读到过期 state
  const targetRef = useRef(0)
  const [drag, setDrag] = useState<{ from: number; to: number; delta: number } | null>(null)
  // 勾选完成时记录行号 → 递增计数：作为 key 触发对勾重挂载，重放弹跳动画（初始已勾选的不播）
  const [popKeys, setPopKeys] = useState<Map<number, number>>(new Map())

  const updateAt = (i: number, title: string) => {
    const next = [...value]
    next[i] = { ...next[i], title }
    onChange(next)
  }
  const toggleAt = (i: number) => {
    const next = [...value]
    next[i] = { ...next[i], isCompleted: !next[i].isCompleted }
    if (next[i].isCompleted) {
      setPopKeys((prev) => new Map(prev).set(i, (prev.get(i) ?? 0) + 1))
    }
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

  /** 根据指针位移计算被拖行应插入的位置（按行中线判定） */
  const computeTarget = (from: number, delta: number): number => {
    const geo = geoRef.current
    if (!geo) return from
    const { rects } = geo
    const center = rects[from].top + rects[from].height / 2 + delta
    let to = from
    if (delta < 0) {
      for (let i = 0; i < from; i++) {
        if (center < rects[i].top + rects[i].height / 2) { to = i; break }
      }
    } else if (delta > 0) {
      for (let i = rects.length - 1; i > from; i--) {
        if (center > rects[i].top + rects[i].height / 2) { to = i; break }
      }
    }
    return to
  }

  const beginDrag = (from: number, e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    const rects = rowRefs.current.slice(0, value.length).map((el) => el!.getBoundingClientRect())
    const gap = rects.length > 1 ? Math.max(0, rects[1].top - rects[0].bottom) : 0
    geoRef.current = { rects, gap, startY: e.clientY }
    targetRef.current = from
    setDrag({ from, to: from, delta: 0 })

    const onMove = (ev: PointerEvent) => {
      const geo = geoRef.current
      if (!geo) return
      const fromRect = rects[from]
      // 位移按行边缘钳制并留 2px 越界余量：拖动行能贴到首行顶/末行底，行中线才会严格
      // 越过首/末行阈值——否则第一个/最后一个落点永远到不了，会卡在与首末行重合的状态
      const minDelta = rects[0].top - fromRect.top - 2
      const maxDelta = rects[rects.length - 1].bottom - fromRect.bottom + 2
      const delta = Math.min(Math.max(ev.clientY - geo.startY, minDelta), maxDelta)
      const to = computeTarget(from, delta)
      targetRef.current = to
      setDrag({ from, to, delta })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      geoRef.current = null
      setDrag(null)
      const to = targetRef.current
      if (from !== to) {
        const next = [...value]
        const [moved] = next.splice(from, 1)
        next.splice(to, 0, moved)
        onChange(next)
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  return (
    <div className={cn('flex flex-col gap-1.5', drag && 'select-none cursor-grabbing')}>
      <label className="text-xs text-muted-foreground">子任务</label>
      {value.map((item, i) => {
        const isDragging = drag?.from === i
        // 被拖行跟手位移；夹在起点与落点之间的行平滑让位一行
        let shift = 0
        if (drag && !isDragging && geoRef.current) {
          const step = geoRef.current.rects[drag.from].height + geoRef.current.gap
          if (drag.from < drag.to && i > drag.from && i <= drag.to) shift = -step
          else if (drag.to < drag.from && i >= drag.to && i < drag.from) shift = step
        }
        return (
          <div
            key={i}
            ref={(el) => { rowRefs.current[i] = el }}
            className={cn('relative flex items-center gap-1.5', isDragging && 'z-10 opacity-80')}
            style={{
              transform: `translateY(${isDragging ? drag!.delta : shift}px)`,
              transition: drag && !isDragging ? 'transform 150ms ease' : 'none',
            }}
          >
            <button
              type="button"
              onPointerDown={(e) => beginDrag(i, e)}
              title="拖拽调整顺序"
              className="shrink-0 h-5 w-4 flex items-center justify-center rounded cursor-grab touch-none text-muted-foreground/40 hover:text-muted-foreground transition-colors"
            >
              <GripVertical className="h-3 w-3" />
            </button>
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
                {item.isCompleted && (
                  <Check
                    key={popKeys.get(i) ?? 0}
                    className={cn('h-2.5 w-2.5 text-white', popKeys.has(i) && 'task-check-pop')}
                    strokeWidth={3.5}
                  />
                )}
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
        )
      })}
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
