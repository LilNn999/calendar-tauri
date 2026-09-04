import { useState } from 'react'
import { useCheckinStore } from '@/store/useCheckinStore'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import { RecurringChangeDialog } from '@/components/tasks/RecurringChangeDialog'
import { toDateString } from '@/lib/utils'
import { NumericCheckin } from './NumericCheckin'
import { BooleanCheckin } from './BooleanCheckin'
import { TextCheckin } from './TextCheckin'
import { TimeCheckin } from './TimeCheckin'
import type { CheckinDefinition } from '@shared/types'

interface CheckinValueDialogProps {
  definition: CheckinDefinition | null
  date: string | null
  onClose: () => void
}

export function CheckinValueDialog({ definition, date, onClose }: CheckinValueDialogProps) {
  const { getEntriesForDate, upsertEntry, deleteCheckinDef } = useCheckinStore()
  const [showDeleteScope, setShowDeleteScope] = useState(false)

  const open = !!definition && !!date
  const entries = open ? getEntriesForDate(date!) : []
  const entry = definition ? entries.find((e) => e.definitionId === definition.id) : undefined
  const value = entry?.value ?? ''
  const onChange = (v: string) => {
    if (definition && date) upsertEntry(definition.id, date, v)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent
        onClose={onClose}
        className="max-w-xs"
        onKeyDown={(e) => {
          // 回车直接确认并关闭
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            onClose()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{definition?.name ?? ''}</DialogTitle>
        </DialogHeader>
        <div className="px-6 pb-3 pt-2">
          {definition?.type === 'numeric' && (
            <NumericCheckin definition={definition} value={value} onChange={onChange} />
          )}
          {definition?.type === 'boolean' && (
            <BooleanCheckin definition={definition} value={value} onChange={onChange} />
          )}
          {definition?.type === 'time' && (
            <TimeCheckin definition={definition} value={value} onChange={onChange} />
          )}
          {definition?.type === 'text' && (
            <TextCheckin definition={definition} value={value} onChange={onChange} />
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDeleteScope(true)}
            disabled={!definition}
            className="text-destructive hover:text-destructive mr-auto"
            title="删除该循环打卡（可选择影响范围）"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            删除打卡
          </Button>
        </DialogFooter>

        {/* 打卡也是循环任务：删除时选择影响范围 */}
        <RecurringChangeDialog
          open={showDeleteScope}
          mode="delete"
          taskTitle={definition?.name ?? ''}
          occurrenceDate={date ?? toDateString(new Date())}
          onConfirm={async (scope) => {
            if (!definition || !date) return
            await deleteCheckinDef(definition.id, date, scope)
            setShowDeleteScope(false)
            onClose()
          }}
          onCancel={() => setShowDeleteScope(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
