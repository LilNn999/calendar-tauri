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
      <div className="grid grid-cols-7 shrink-0 pt-2 pb-1">
        {WEEK_DAYS.map((day) => (
          <div
            key={day}
            className="py-1 text-center text-xs font-semibold tracking-wider text-muted-foreground"
          >
            {day}
          </div>
        ))}
      </div>

      {/* 日期网格：皮肤化圆角容器，网格间隙承载分隔线 */}
      <div className="calendar-shell flex-1 min-h-0 p-1">
        <div className="calendar-grid h-full overflow-y-auto overflow-x-hidden">
          <div className="grid grid-cols-7 auto-rows-fr gap-px h-full min-h-[420px]">
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
    </div>
  )
}
