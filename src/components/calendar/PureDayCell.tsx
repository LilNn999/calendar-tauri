import { cn } from '@/lib/utils'
import { toDateString } from '@/lib/utils'
import { getDayCellState } from '@/lib/dayCellState'
import { getHolidayDay } from '@/lib/holidays'
import { solarToLunar } from '@/lib/lunar'
import { useCalendarStore } from '@/store/useCalendarStore'
import { HolidayBadge } from './HolidayBadge'

interface PureDayCellProps {
  date: Date
  isCurrentMonth?: boolean
  onDayClick: (date: string) => void
}

/**
 * 日历模式下的纯日历格子：只展示日期、农历/节气/节日与休班角标，不展示日程。
 * 副行优先级：法定节日名 > 农历传统节日 > 公历节日 > 节气 > 农历日期；
 * 主行为节日/节气时，下方以次级文字补一行农历日期。
 */
export function PureDayCell({ date, isCurrentMonth = true, onDayClick }: PureDayCellProps) {
  const dateStr = toDateString(date)
  const today = toDateString(new Date())
  const isToday = dateStr === today
  const { selectedDate, setSelectedDate } = useCalendarStore()
  const isSelected = selectedDate === dateStr
  const dayState = getDayCellState({ isSelected, isToday, isCurrentMonth })
  const dimmed = dayState === 'outside'

  const holiday = getHolidayDay(dateStr)
  const lunar = solarToLunar(date)
  const lunarText = `${lunar.monthCn}${lunar.dayCn}`

  const festival =
    holiday?.label ?? lunar.lunarFestival ?? lunar.solarFestival ?? undefined
  const isTermPrimary = !festival && !!lunar.term
  const primary = festival ?? lunar.term ?? lunarText

  const primaryColor = isTermPrimary ? 'text-term-fg' : festival ? 'text-holiday-fg' : 'text-muted-foreground'

  return (
    <div
      className={cn(
        'relative flex flex-col p-2 bg-cell-bg overflow-hidden transition-colors cursor-pointer',
        'min-h-[76px]',
        dimmed ? 'bg-cell-dim-bg' : 'bg-cell-bg',
        'hover:brightness-105 dark:hover:brightness-110',
      )}
      onClick={() => { setSelectedDate(dateStr); onDayClick(dateStr) }}
    >
      {/* 日期数字 + 休/班角标 */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span
          className={cn(
            'text-sm font-medium h-6 min-w-6 px-0.5 flex items-center justify-center rounded-full transition-all duration-200',
            isToday
              ? 'bg-primary text-primary-foreground font-bold'
              : isSelected
              ? 'bg-primary/10 text-primary font-semibold ring-1 ring-primary/20'
              : dimmed
              ? 'text-muted-foreground/50'
              : 'text-foreground'
          )}
        >
          {date.getDate()}
        </span>
        {holiday && <HolidayBadge holiday={holiday} dimmed={dimmed} />}
      </div>

      {/* 农历 / 节气 / 节日 */}
      <div className="flex flex-col gap-0.5 min-w-0">
        <span
          className={cn(
            'text-xs font-medium leading-tight truncate',
            primaryColor,
            dimmed && 'opacity-60'
          )}
        >
          {primary}
        </span>
        {primary !== lunarText && (
          <span className={cn('text-[10px] leading-tight text-muted-foreground/75 truncate', dimmed && 'opacity-60')}>
            {lunarText}
          </span>
        )}
      </div>
    </div>
  )
}
