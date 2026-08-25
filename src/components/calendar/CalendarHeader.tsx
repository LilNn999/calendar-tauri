import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useCalendarStore } from '@/store/useCalendarStore'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function CalendarHeader() {
  const { currentDate, viewMode, setViewMode, goNext, goPrev, goToday } = useCalendarStore()

  const title = viewMode === 'month'
    ? format(currentDate, 'yyyy年 M月', { locale: zhCN })
    : format(currentDate, 'yyyy年 M月 第w周', { locale: zhCN })

  return (
    <div className="surface-header flex items-center justify-between px-4 py-2.5 border-b shrink-0">
      <button
        onClick={goToday}
        className="font-skin-display flex items-center gap-1.5 text-base font-bold text-foreground hover:text-primary transition-colors"
      >
        <Calendar className="h-4 w-4" />
        {title}
      </button>

      <div className="flex items-center gap-1.5">
        <div className="control-inset flex items-center rounded-xl p-1 mr-1">
          <ViewToggleBtn active={viewMode === 'month'} onClick={() => setViewMode('month')}>月</ViewToggleBtn>
          <ViewToggleBtn active={viewMode === 'week'} onClick={() => setViewMode('week')}>周</ViewToggleBtn>
        </div>

        <Button variant="ghost" size="icon" onClick={goPrev} className="h-8 w-8 rounded-full">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={goNext} className="h-8 w-8 rounded-full">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={goToday} className="ml-0.5 rounded-full">
          今天
        </Button>
      </div>
    </div>
  )
}

function ViewToggleBtn({
  active, onClick, children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1 text-xs font-semibold rounded-lg transition-all duration-200',
        active
          ? 'control-raised text-foreground'
          : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {children}
    </button>
  )
}
