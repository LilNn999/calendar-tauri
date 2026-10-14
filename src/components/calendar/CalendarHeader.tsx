import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { motion } from '@/lib/motion'
import { useCalendarStore } from '@/store/useCalendarStore'
import { useUIStore } from '@/store/useUIStore'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MonthlyDayStatsPopover } from './MonthlyDayStatsPopover'

/** 年月选择面板的年份范围（与农历数据表 1900–2100 对齐） */
const PICKER_MIN_YEAR = 1900
const PICKER_MAX_YEAR = 2100

export function CalendarHeader() {
  const { currentDate, viewMode, setViewMode, goNext, goPrev, goToday, goToMonth } = useCalendarStore()
  const { calendarMode, setCalendarMode } = useUIStore()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerYear, setPickerYear] = useState(currentDate.getFullYear())
  const [pickerView, setPickerView] = useState<'month' | 'year'>('month')
  const [pickerPos, setPickerPos] = useState<React.CSSProperties | null>(null)
  const [statsOpen, setStatsOpen] = useState(false)
  const titleRef = useRef<HTMLButtonElement>(null)

  // 天数统计入口只在普通月视图与纯日历模式显示（周视图不展示月统计）
  const showDayStats = calendarMode || viewMode === 'month'

  useEffect(() => {
    if (!showDayStats) setStatsOpen(false)
  }, [showDayStats])

  // 年份宫格页起点：以当前选中年所在 12 年页展示（‹ › 按 pickerYear ±12 整页翻动）
  const yearPageStart = Math.floor(pickerYear / 12) * 12

  // 日历模式下点「月/周」即退出日历模式并切到对应视图
  const switchView = (mode: 'month' | 'week') => {
    if (calendarMode) setCalendarMode(false)
    setViewMode(mode)
  }

  // 年月面板经 portal 挂到 body：header 表面会重定义前景色变量（.surface-header 覆盖
  // .text-foreground），面板留在 header 内会继承红/金色系导致浅色面板上文字不可读
  const openPicker = (open: boolean) => {
    if (open) {
      // 与统计信息窗互斥，避免两个浮层重叠
      setStatsOpen(false)
      const rect = titleRef.current?.getBoundingClientRect()
      if (rect) {
        const W = 264
        const H = 232
        const style: React.CSSProperties = { position: 'fixed', zIndex: 60, width: W }
        if (rect.left + W + 8 > window.innerWidth) style.left = rect.right - W
        else style.left = rect.left
        if (rect.bottom + H + 8 > window.innerHeight) style.top = rect.top - H - 8
        else style.top = rect.bottom + 8
        setPickerPos(style)
      }
      setPickerYear(currentDate.getFullYear())
      setPickerView('month')
    }
    setPickerOpen(open)
  }

  const title = viewMode === 'month'
    ? format(currentDate, 'yyyy年 M月', { locale: zhCN })
    : format(currentDate, 'yyyy年 M月 第w周', { locale: zhCN })

  const nowYear = new Date().getFullYear()
  const nowMonth = new Date().getMonth() + 1
  const displayedYear = currentDate.getFullYear()
  const displayedMonth = currentDate.getMonth() + 1

  return (
    <>
    <div className="surface-header flex items-center justify-between px-4 py-2.5 border-b shrink-0">
      <div className="flex min-w-0 items-center">
        {calendarMode ? (
          <button
            ref={titleRef}
            onClick={() => openPicker(!pickerOpen)}
            className="font-skin-display flex items-center gap-1.5 text-base font-bold text-foreground hover:text-primary transition-colors"
            title="选择年月"
          >
            <Calendar className="h-4 w-4" />
            {title}
            <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform duration-200', pickerOpen && 'rotate-180')} />
          </button>
        ) : (
          <button
            onClick={goToday}
            className="font-skin-display flex items-center gap-1.5 text-base font-bold text-foreground hover:text-primary transition-colors"
          >
            <Calendar className="h-4 w-4" />
            {title}
          </button>
        )}

        {/* 月度天数统计：图标 + 悬停信息窗，与年月选择面板互斥 */}
        {showDayStats && (
          <MonthlyDayStatsPopover
            currentDate={currentDate}
            open={statsOpen}
            onOpenChange={(next) => {
              setStatsOpen(next)
              if (next) setPickerOpen(false)
            }}
          />
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <div className="control-inset flex items-center rounded-xl p-1 mr-1">
          <ViewToggleBtn active={calendarMode || viewMode === 'month'} highlight={calendarMode} onClick={() => switchView('month')}>月</ViewToggleBtn>
          <ViewToggleBtn active={!calendarMode && viewMode === 'week'} onClick={() => switchView('week')}>周</ViewToggleBtn>
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

    {/* 年月选择面板：portal 到 body，脱离 header 前景色作用域 */}
    {pickerOpen && calendarMode && pickerPos && createPortal(
      <>
        <div className="fixed inset-0 z-40" onClick={() => openPicker(false)} />
        <motion.div
          className="fixed rounded-xl border border-border-subtle bg-surface-raised text-foreground p-3"
          style={{ ...pickerPos, boxShadow: 'var(--shadow-lg)' }}
          initial={{ opacity: 0, y: -4, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
        >
          {pickerView === 'month' ? (
            <>
              {/* 年份切换：点年份文字进入年份宫格 */}
              <div className="flex items-center justify-between mb-2 px-1">
                <button
                  onClick={() => setPickerYear(Math.max(PICKER_MIN_YEAR, pickerYear - 1))}
                  disabled={pickerYear <= PICKER_MIN_YEAR}
                  className="h-7 w-7 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-30 disabled:pointer-events-none"
                  title="上一年"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setPickerView('year')}
                  className="text-sm font-bold text-foreground rounded-lg px-2 py-0.5 hover:bg-accent transition-colors"
                  title="选择年份"
                >
                  {pickerYear}年
                </button>
                <button
                  onClick={() => setPickerYear(Math.min(PICKER_MAX_YEAR, pickerYear + 1))}
                  disabled={pickerYear >= PICKER_MAX_YEAR}
                  className="h-7 w-7 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-30 disabled:pointer-events-none"
                  title="下一年"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              {/* 月份网格 */}
              <div className="grid grid-cols-4 gap-1">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                  const selected = pickerYear === displayedYear && m === displayedMonth
                  const isNowMonth = pickerYear === nowYear && m === nowMonth
                  return (
                    <button
                      key={m}
                      onClick={() => { goToMonth(pickerYear, m); setPickerOpen(false) }}
                      className={cn(
                        'relative h-9 rounded-lg text-xs font-medium transition-all duration-150',
                        selected
                          ? 'control-raised text-primary font-bold'
                          : 'text-foreground hover:bg-accent'
                      )}
                    >
                      {m}月
                      {isNowMonth && !selected && (
                        <span className="absolute top-1 right-1.5 h-1 w-1 rounded-full bg-primary/60" />
                      )}
                    </button>
                  )
                })}
              </div>
            </>
          ) : (
            <>
              {/* 年份宫格：12 年一页，‹ › 整页翻动 */}
              <div className="flex items-center justify-between mb-2 px-1">
                <button
                  onClick={() => setPickerYear(yearPageStart - 1)}
                  disabled={yearPageStart <= PICKER_MIN_YEAR}
                  className="h-7 w-7 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-30 disabled:pointer-events-none"
                  title="前 12 年"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm font-bold text-foreground">{yearPageStart} – {yearPageStart + 11}年</span>
                <button
                  onClick={() => setPickerYear(yearPageStart + 12)}
                  disabled={yearPageStart + 12 > PICKER_MAX_YEAR}
                  className="h-7 w-7 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-30 disabled:pointer-events-none"
                  title="后 12 年"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {Array.from({ length: 12 }, (_, i) => yearPageStart + i).map((y) => {
                  const outOfRange = y < PICKER_MIN_YEAR || y > PICKER_MAX_YEAR
                  const selected = y === pickerYear
                  const isNowYear = y === nowYear
                  return (
                    <button
                      key={y}
                      onClick={() => { if (!outOfRange) { setPickerYear(y); setPickerView('month') } }}
                      disabled={outOfRange}
                      className={cn(
                        'relative h-9 rounded-lg text-xs font-medium transition-all duration-150',
                        selected
                          ? 'control-raised text-primary font-bold'
                          : 'text-foreground hover:bg-accent',
                        outOfRange && 'opacity-30 pointer-events-none'
                      )}
                    >
                      {y}
                      {isNowYear && !selected && (
                        <span className="absolute top-1 right-1.5 h-1 w-1 rounded-full bg-primary/60" />
                      )}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </motion.div>
      </>,
      document.body
    )}
    </>
  )
}

function ViewToggleBtn({
  active, highlight, onClick, children,
}: {
  active: boolean
  /** 日历模式下「月」按钮带高亮点位，提示当前处于日历模式 */
  highlight?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1 text-xs font-semibold rounded-lg transition-all duration-200 relative',
        active
          ? 'control-raised text-foreground'
          : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {children}
      {highlight && (
        <span className="absolute top-0.5 right-0.5 h-1 w-1 rounded-full bg-term-fg" />
      )}
    </button>
  )
}
