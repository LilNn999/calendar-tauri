import { useCheckinStore } from '@/store/useCheckinStore'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
  const { getEntriesForDate, upsertEntry } = useCheckinStore()

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
        <div className="px-6 pb-6 pt-2">
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
      </DialogContent>
    </Dialog>
  )
}
