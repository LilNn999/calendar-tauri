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
    <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/60 shrink-0 bg-card/50 backdrop-blur-md">
      <button
        onClick={goToday}
        className="flex items-center gap-1.5 text-sm font-bold text-foreground hover:text-primary transition-colors"
      >
        <Calendar className="h-4 w-4" />
        {title}
      </button>

      <div className="flex items-center gap-1.5">
        {/* 视图切换 */}
        <div className="flex items-center rounded-full bg-secondary/80 p-1 mr-1"
          style={{ boxShadow: 'inset 0 1px 3px rgb(0 0 0 / 0.05)' }}>
          <ViewToggleBtn active={viewMode === 'month'} onClick={() => setViewMode('month')}>月</ViewToggleBtn>
          <ViewToggleBtn active={viewMode === 'week'} onClick={() => setViewMode('week')}>周</ViewToggleBtn>
        </div>

        <Button variant="ghost" size="icon" onClick={goPrev} className="h-8 w-8 rounded-full">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={goNext} className="h-8 w-8 rounded-full">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={goToday} className="ml-0.5 rounded-full bg-accent text-accent-foreground border-accent-foreground/20 hover:bg-accent/80 hover:text-accent-foreground">
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
        'px-3 py-1 text-xs font-semibold rounded-full transition-all duration-200',
        active
          ? 'bg-gradient-brand text-primary-foreground shadow-glow'
          : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {children}
    </button>
  )
}
