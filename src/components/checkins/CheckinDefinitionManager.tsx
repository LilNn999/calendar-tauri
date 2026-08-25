import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectItem } from '@/components/ui/select'
import { useCheckinStore } from '@/store/useCheckinStore'
import type { CheckinType } from '@shared/types'
import { CHECKIN_TYPE_LABELS } from '@shared/constants'

export function CheckinDefinitionManager() {
  const { definitions, createDefinition, archiveDefinition } = useCheckinStore()
  const [name, setName] = useState('')
  const [type, setType] = useState<CheckinType>('boolean')
  const [unit, setUnit] = useState('')
  const [loading, setLoading] = useState(false)

  const handleCreate = async () => {
    if (!name.trim()) return
    setLoading(true)
    try {
      await createDefinition({ name: name.trim(), type, unit: type === 'numeric' ? unit : undefined })
      setName('')
      setUnit('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h4 className="text-sm font-semibold">打卡组件管理</h4>

      {/* 现有定义列表 */}
      <div className="flex flex-col gap-1.5">
        {definitions.length === 0 && (
          <p className="text-xs text-muted-foreground py-2">还没有打卡组件，在下方添加</p>
        )}
        {definitions.map((def) => (
          <div
            key={def.id}
            className="card-elevated flex items-center justify-between rounded-xl px-3 py-2 hover:bg-surface-hover transition-colors"
          >
            <div>
              <span className="text-sm font-medium">{def.name}</span>
              <span className="text-xs text-muted-foreground ml-2">
                {CHECKIN_TYPE_LABELS[def.type as CheckinType]}
                {def.unit ? ` · ${def.unit}` : ''}
              </span>
            </div>
            <button
              onClick={() => archiveDefinition(def.id)}
              className="h-6 w-6 flex items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* 新建表单 */}
      <div className="control-inset flex flex-col gap-2 rounded-2xl p-3">
        <span className="text-xs font-medium text-muted-foreground">添加新打卡组件</span>
        <Input
          placeholder="名称，如：体重、阅读"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="text-sm"
        />
        <div className="flex gap-2">
          <Select value={type} onValueChange={(v) => setType(v as CheckinType)} className="flex-1">
            <SelectItem value="boolean">开关型</SelectItem>
            <SelectItem value="numeric">数值型</SelectItem>
            <SelectItem value="text">文字型</SelectItem>
          </Select>
          {type === 'numeric' && (
            <Input
              placeholder="单位(如kg)"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-24 text-sm"
            />
          )}
        </div>
        <Button
          size="sm"
          onClick={handleCreate}
          disabled={!name.trim() || loading}
          className="self-end"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          添加
        </Button>
      </div>
    </div>
  )
}
