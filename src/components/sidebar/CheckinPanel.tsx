import { useState, useRef } from 'react'
import { Plus, Trash2, CalendarRange, Repeat, Pencil, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectItem } from '@/components/ui/select'
import { useCheckinStore } from '@/store/useCheckinStore'
import type { CheckinType, CheckinDefinition, CheckinFrequency } from '@shared/types'
import { CHECKIN_TYPE_LABELS, CHECKIN_FREQUENCY_LABELS } from '@shared/constants'
import { cn } from '@/lib/utils'
import { format, parseISO } from 'date-fns'
import { zhCN } from 'date-fns/locale'

interface CheckinPanelProps {
  definitions: CheckinDefinition[]
  onDefinitionsChange: () => void
}

// 解析日期字符串为本地时间（避免 UTC 时区偏移导致日期显示错误）
function parseLocalDate(dateStr: string) {
  return parseISO(dateStr)
}

export function CheckinPanel({ definitions, onDefinitionsChange }: CheckinPanelProps) {
  const { createDefinition, updateDefinition, archiveDefinition } = useCheckinStore()
  const [name, setName] = useState('')
  const [type, setType] = useState<CheckinType>('boolean')
  const [unit, setUnit] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [frequency, setFrequency] = useState<CheckinFrequency>('daily')
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const nameRef = useRef<HTMLTextAreaElement>(null)
  const autoResize = (el: HTMLTextAreaElement) => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' }

  const resetForm = () => {
    setName('')
    setType('boolean')
    setUnit('')
    setStartDate('')
    setEndDate('')
    setFrequency('daily')
    setShowForm(false)
    setEditingId(null)
  }

  const startEditing = (def: CheckinDefinition) => {
    setEditingId(def.id)
    setName(def.name)
    setType(def.type as CheckinType)
    setUnit(def.unit ?? '')
    setStartDate(def.startDate ?? '')
    setEndDate(def.endDate ?? '')
    setFrequency((def.frequency as CheckinFrequency) ?? 'daily')
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!name.trim()) return
    setLoading(true)
    try {
      const payload = {
        name: name.trim(),
        type,
        unit: type === 'numeric' ? unit : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        frequency,
      }
      if (editingId !== null) {
        await updateDefinition(editingId, payload)
      } else {
        await createDefinition(payload)
      }
      onDefinitionsChange()
      resetForm()
    } finally {
      setLoading(false)
    }
  }

  const handleArchive = async (id: number) => {
    await archiveDefinition(id)
    onDefinitionsChange()
  }

  const formatDateRange = (def: CheckinDefinition) => {
    if (!def.startDate && !def.endDate) return null
    const s = def.startDate ? format(parseLocalDate(def.startDate), 'MM/dd', { locale: zhCN }) : '…'
    const e = def.endDate ? format(parseLocalDate(def.endDate), 'MM/dd', { locale: zhCN }) : '持续'
    return `${s} — ${e}`
  }

  const frequencyOptions: CheckinFrequency[] = ['daily', 'weekday', 'weekend', 'weekly', 'monthly']

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">打卡组件</h4>
        {!showForm && (
          <Button size="sm" variant="outline" className="h-7 text-xs rounded-xl" onClick={() => { resetForm(); setShowForm(true) }}>
            <Plus className="h-3 w-3 mr-1" />
            添加
          </Button>
        )}
      </div>

      {/* 新建 / 编辑表单 */}
      {showForm && (
        <div className="card-elevated rounded-2xl p-3 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              {editingId !== null ? '编辑打卡' : '新建打卡'}
            </span>
            <button onClick={resetForm} className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <textarea
            ref={nameRef}
            placeholder="名称，如：体重、阅读"
            value={name}
            rows={1}
            autoFocus
            onChange={(e) => { setName(e.target.value); autoResize(e.target) }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSave() } }}
            className="text-sm rounded-xl w-full border border-input bg-background px-3 py-2 resize-none overflow-hidden focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground leading-snug"
          />
          <div className="flex gap-2">
            <Select value={type} onValueChange={(v) => setType(v as CheckinType)} className="flex-1">
              <SelectItem value="boolean">开关型</SelectItem>
              <SelectItem value="numeric">数值型</SelectItem>
              <SelectItem value="text">文字型</SelectItem>
              <SelectItem value="time">时间型</SelectItem>
            </Select>
            {type === 'numeric' && (
              <Input
                placeholder="单位 kg"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSave() } }}
                className="w-20 text-sm rounded-xl"
              />
            )}
          </div>

          {/* 打卡周期 */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Repeat className="h-3 w-3" />
              <span>打卡周期</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {frequencyOptions.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFrequency(f)}
                  className={cn(
                    'py-1.5 rounded-xl text-xs font-medium border transition-all duration-150 text-center',
                    frequency === f
                      ? 'border-primary/40 bg-primary/15 text-primary shadow-sm'
                      : 'border-transparent bg-secondary text-muted-foreground hover:text-foreground'
                  )}
                >
                  {CHECKIN_FREQUENCY_LABELS[f]}
                </button>
              ))}
            </div>
          </div>

          {/* 日期范围 */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarRange className="h-3 w-3" />
              <span>有效期（选填）</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <label className="text-[10px] text-muted-foreground">开始</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full h-8 px-2 text-xs rounded-xl border border-input bg-background hover:border-primary/40 focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">结束</label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full h-8 px-2 text-xs rounded-xl border border-input bg-background hover:border-primary/40 focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                />
              </div>
            </div>
            {!startDate && !endDate && (
              <p className="text-[10px] text-muted-foreground">不填则永久有效</p>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 rounded-xl text-xs" onClick={resetForm}>
              取消
            </Button>
            <Button size="sm" className="flex-1 rounded-xl text-xs" onClick={handleSave} disabled={!name.trim() || loading}>
              {editingId !== null ? '保存修改' : '确认添加'}
            </Button>
          </div>
        </div>
      )}

      {/* 定义列表 */}
      <div className="flex flex-col gap-1.5">
        {definitions.length === 0 && !showForm && (
          <p className="text-xs text-muted-foreground text-center py-6">还没有打卡组件，点击上方添加</p>
        )}
        {definitions.map((def) => {
          const dateRange = formatDateRange(def)
          const freq = def.frequency ?? 'daily'
          const isEditing = editingId === def.id
          return (
            <div
              key={def.id}
              className={cn(
                'card-elevated rounded-2xl px-3 py-2.5 flex items-start justify-between gap-2 transition-colors',
                isEditing && 'ring-1 ring-primary/40'
              )}
            >
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-sm font-medium truncate">{def.name}</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={cn(
                    'text-[10px] px-2 py-0.5 rounded-full font-medium',
                    def.type === 'boolean' ? 'bg-primary/10 text-primary' :
                    def.type === 'numeric' ? 'bg-warning/10 text-warning' :
                    def.type === 'time' ? 'bg-success/10 text-success' :
                    'bg-surface-inset text-foreground'
                  )}>
                    {CHECKIN_TYPE_LABELS[def.type as CheckinType]}
                    {def.unit ? ` · ${def.unit}` : ''}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium flex items-center gap-0.5">
                    <Repeat className="h-2.5 w-2.5" />
                    {CHECKIN_FREQUENCY_LABELS[freq as CheckinFrequency] ?? '每天'}
                  </span>
                  {dateRange && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                      <CalendarRange className="h-2.5 w-2.5" />
                      {dateRange}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => startEditing(def)}
                  className="h-6 w-6 flex items-center justify-center rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                  title="编辑"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleArchive(def.id)}
                  className="h-6 w-6 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  title="删除"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
