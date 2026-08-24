import { useMemo } from 'react'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth,
} from 'date-fns'
import { useCalendarStore } from '@/store/useCalendarStore'
import { DayCell } from './DayCell'
import type { CheckinDefinition } from '@shared/types'

const WEEK_DAYS = ['一', '二', '三', '四', '五', '六', '日']

interface MonthViewProps {
  definitions: CheckinDefinition[]
  onDayClick: (date: string) => void
  onTaskToggle: (id: number, completed: boolean, occurrenceDate?: string) => void
  onTaskClick: (taskId: number, date: string) => void
  onCheckinClick: (defId: number, date: string) => void
}

export function MonthView({ definitions, onDayClick, onTaskToggle, onTaskClick, onCheckinClick }: MonthViewProps) {
  const { currentDate } = useCalendarStore()

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end })
  }, [currentDate])

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 星期表头 */}
      <div className="grid grid-cols-7 border-b border-border/60 shrink-0 bg-secondary/40 backdrop-blur-sm">
        {WEEK_DAYS.map((day) => (
          <div
            key={day}
            className="py-2 text-center text-xs font-bold tracking-wider text-muted-foreground border-r last:border-r-0"
          >
            {day}
          </div>
        ))}
      </div>

      {/* 日期网格 */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-7 h-full">
          {days.map((date) => (
            <DayCell
              key={date.toISOString()}
              date={date}
              isCurrentMonth={isSameMonth(date, currentDate)}
              definitions={definitions}
              onDayClick={onDayClick}
              onTaskToggle={onTaskToggle}
              onTaskClick={onTaskClick}
              onCheckinClick={onCheckinClick}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
