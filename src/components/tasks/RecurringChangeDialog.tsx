import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { format, parseISO } from 'date-fns'
import { zhCN } from 'date-fns/locale'

export type RecurringChangeScope = 'this' | 'future'
export type RecurringChangeMode = 'edit' | 'delete'

interface RecurringChangeDialogProps {
  open: boolean
  mode: RecurringChangeMode
  taskTitle: string
  occurrenceDate: string // YYYY-MM-DD
  currentRecurrenceEnd?: string // 当前截止日期，用于编辑模式预填
  onConfirm: (scope: RecurringChangeScope, newRecurrenceEnd?: string) => void
  onCancel: () => void
}

export function RecurringChangeDialog({
  open,
  mode,
  taskTitle,
  occurrenceDate,
  currentRecurrenceEnd,
  onConfirm,
  onCancel,
}: RecurringChangeDialogProps) {
  const [scope, setScope] = useState<RecurringChangeScope>('this')
  const [newRecurrenceEnd, setNewRecurrenceEnd] = useState(currentRecurrenceEnd ?? '')

  const dateLabel = format(parseISO(occurrenceDate), 'M月d日 EEEE', { locale: zhCN })
  const verb = mode === 'edit' ? '更改' : '删除'

  const endDateInvalid = mode === 'edit' && scope === 'future'
    && !!newRecurrenceEnd && newRecurrenceEnd < occurrenceDate

  const handleConfirm = () => {
    if (endDateInvalid) return
    const end = scope === 'future' && mode === 'edit' ? newRecurrenceEnd || undefined : undefined
    onConfirm(scope, end)
    setScope('this')
  }

  const handleCancel = () => {
    setScope('this')
    onCancel()
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent onClose={handleCancel}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-primary" />
            {verb}重复任务
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-2 flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            您正在{verb}一个重复性任务
            「<span className="text-foreground font-medium">{taskTitle}</span>」
            <br />
            <span className="text-foreground font-medium">{dateLabel}</span>
          </p>

          {/* 选项 A */}
          <label
            className={cn(
              'flex items-start gap-3 p-3 rounded-2xl border-[1.5px] cursor-pointer transition-colors',
              scope === 'this'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-muted-foreground/40'
            )}
            onClick={() => setScope('this')}
          >
            <RadioDot checked={scope === 'this'} />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">仅限此日程</span>
              <span className="text-[11px] text-muted-foreground">
                只{verb}这一天，前后的循环任务保持不变
              </span>
            </div>
          </label>

          {/* 选项 B */}
          <label
            className={cn(
              'flex items-start gap-3 p-3 rounded-2xl border-[1.5px] cursor-pointer transition-colors',
              scope === 'future'
                ? 'border-destructive bg-destructive/5'
                : 'border-border hover:border-muted-foreground/40'
            )}
            onClick={() => setScope('future')}
          >
            <RadioDot checked={scope === 'future'} danger />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">此日程及未来所有</span>
              <span className="text-[11px] text-muted-foreground">
                从该日期起，所有未来循环均同步{verb}，不影响历史记录
              </span>
            </div>
          </label>

          {/* 编辑模式 + 选择"此后全部"时，允许修改截止日期 */}
          {mode === 'edit' && scope === 'future' && (
            <div className="flex flex-col gap-1 pl-1">
              <label className="text-xs text-muted-foreground">
                新的重复截止日期（留空 = 不修改原截止日期）
              </label>
              <Input
                type="date"
                value={newRecurrenceEnd}
                min={occurrenceDate}
                onChange={(e) => setNewRecurrenceEnd(e.target.value)}
                className="text-sm"
              />
              {endDateInvalid && (
                <p className="text-[11px] text-destructive">截止日期不能早于当前日期</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={handleCancel}>取消</Button>
          <Button
            size="sm"
            variant={scope === 'future' ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={endDateInvalid}
          >
            {scope === 'this'
              ? `${verb}此日程`
              : `${verb}此日程及未来`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RadioDot({ checked, danger }: { checked: boolean; danger?: boolean }) {
  return (
    <div className={cn(
      'mt-0.5 shrink-0 h-4 w-4 rounded-full border-[1.5px] flex items-center justify-center transition-colors',
      checked
        ? danger ? 'border-destructive' : 'border-primary'
        : 'border-muted-foreground/40'
    )}>
      {checked && (
        <div className={cn(
          'h-2 w-2 rounded-full',
          danger ? 'bg-destructive' : 'bg-primary'
        )} />
      )}
    </div>
  )
}
