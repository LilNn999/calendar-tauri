import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Armchair, Briefcase, ChartColumn, Flag } from 'lucide-react'
import {
  formatHolidayPeriod,
  formatShortDate,
  formatWeekdayCn,
  getMonthDayStats,
} from '@/lib/monthDayStats'
import { cn } from '@/lib/utils'

/** 悬停展开 / 收起延迟（毫秒）：留出从图标移入浮层的时间 */
const OPEN_DELAY = 140
const CLOSE_DELAY = 180
/** 浮层与窗口边缘的最小间距 */
const VIEWPORT_MARGIN = 12
const POPUP_ID = 'month-day-stats-popup'
const TITLE_ID = 'month-day-stats-title'

interface MonthlyDayStatsPopoverProps {
  /** 当前浏览月份：取年月，与选中日期、项目、任务筛选无关 */
  currentDate: Date
  /** 是否展开（由头部持有，便于与年月选择面板互斥） */
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * 月历标题旁的天数统计图标：悬停展开工作日 / 休息日 / 法定节假日与假期、补班信息。
 * 浮层 portal 到 body，避免被日历容器或标题栏裁切并继承标题的特殊前景色。
 */
export function MonthlyDayStatsPopover({
  currentDate,
  open,
  onOpenChange,
}: MonthlyDayStatsPopoverProps) {
  const stats = useMemo(() => getMonthDayStats(currentDate), [currentDate])
  const { year, month, totalDays, workDays, restDays, statutoryDays, coverage, source } = stats
  const isEstimate = coverage === 'estimate'
  const periods = stats.holidayPeriods ?? []
  const makeups = stats.makeupDates ?? []
  const monthKey = `${year}-${month}`

  const triggerRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const openTimerRef = useRef<number | null>(null)
  const closeTimerRef = useRef<number | null>(null)
  /** 收起时把焦点还给图标后，不让这次焦点再次触发展开 */
  const skipFocusOpenRef = useRef(false)
  const prevMonthKeyRef = useRef(monthKey)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)

  const clearTimers = useCallback(() => {
    if (openTimerRef.current !== null) {
      window.clearTimeout(openTimerRef.current)
      openTimerRef.current = null
    }
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  // 卸载时清掉全部计时器，避免残留回调
  useEffect(() => clearTimers, [clearTimers])

  // 收起后不再保留计时器
  useEffect(() => {
    if (!open) clearTimers()
  }, [open, clearTimers])

  // 切换月份时先收起旧信息窗，再按新月份重新计算
  useEffect(() => {
    if (prevMonthKeyRef.current === monthKey) return
    prevMonthKeyRef.current = monthKey
    clearTimers()
    onOpenChange(false)
  }, [monthKey, clearTimers, onOpenChange])

  const cancelClose = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  const scheduleOpen = useCallback(() => {
    cancelClose()
    if (open || openTimerRef.current !== null) return
    openTimerRef.current = window.setTimeout(() => {
      openTimerRef.current = null
      onOpenChange(true)
    }, OPEN_DELAY)
  }, [cancelClose, open, onOpenChange])

  const scheduleClose = useCallback(() => {
    clearTimers()
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null
      // 键盘焦点仍在信息窗内时保持展开
      if (popupRef.current?.contains(document.activeElement)) return
      onOpenChange(false)
    }, CLOSE_DELAY)
  }, [clearTimers, onOpenChange])

  const closeNow = useCallback(
    (returnFocus = false) => {
      clearTimers()
      if (returnFocus && popupRef.current?.contains(document.activeElement)) {
        skipFocusOpenRef.current = true
        triggerRef.current?.focus({ preventScroll: true })
      }
      onOpenChange(false)
    },
    [clearTimers, onOpenChange],
  )

  // 展开期间的全局监听：外部点击与 Escape 收起
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (popupRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      closeNow()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      closeNow(true)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, closeNow])

  // 定位：默认在图标下方；下方空间不足时翻到上方，并夹在窗口内
  useLayoutEffect(() => {
    if (!open) {
      setPosition(null)
      return
    }
    const update = () => {
      const trigger = triggerRef.current
      const popup = popupRef.current
      if (!trigger || !popup) return
      const rect = trigger.getBoundingClientRect()
      const width = popup.offsetWidth
      const height = popup.offsetHeight
      const below = rect.bottom + 8
      const left = Math.max(
        VIEWPORT_MARGIN,
        Math.min(rect.left, window.innerWidth - width - VIEWPORT_MARGIN),
      )
      const top =
        below + height <= window.innerHeight - VIEWPORT_MARGIN
          ? below
          : Math.max(
              VIEWPORT_MARGIN,
              Math.min(rect.top - height - 8, window.innerHeight - height - VIEWPORT_MARGIN),
            )
      setPosition({ left, top })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open, monthKey])

  const handleTriggerBlur = (event: React.FocusEvent<HTMLElement>) => {
    const next = event.relatedTarget as Node | null
    if (next && (popupRef.current?.contains(next) || triggerRef.current?.contains(next))) return
    if (!open) return
    closeNow()
  }

  const workExtra = isEstimate
    ? '估算（仅按周末）'
    : makeups.length > 0
      ? `含 ${makeups.length} 天调休补班`
      : '本月无调休补班'

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="查看本月天数统计"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={POPUP_ID}
        title="本月天数统计"
        className={cn(
          'ml-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          open
            ? 'text-makeup-fg bg-makeup-bg'
            : 'text-muted-foreground hover:text-makeup-fg hover:bg-makeup-bg',
        )}
        onClick={() => (open ? closeNow() : onOpenChange(true))}
        onPointerEnter={(event) => {
          if (event.pointerType === 'touch') return
          scheduleOpen()
        }}
        onPointerLeave={() => {
          if (open || openTimerRef.current !== null) scheduleClose()
        }}
        onFocus={() => {
          if (skipFocusOpenRef.current) {
            skipFocusOpenRef.current = false
            return
          }
          clearTimers()
          onOpenChange(true)
        }}
        onBlur={handleTriggerBlur}
      >
        <ChartColumn className="h-4 w-4" />
      </button>

      {open && createPortal(
        <div
          ref={popupRef}
          id={POPUP_ID}
          role="dialog"
          aria-modal="false"
          aria-labelledby={TITLE_ID}
          tabIndex={-1}
          className={cn(
            'fixed z-[70] overflow-y-auto rounded-2xl border border-border-strong bg-surface-raised',
            'w-[min(328px,calc(100vw-24px))] max-h-[calc(100vh-24px)] p-4 text-foreground outline-none',
          )}
          style={{
            left: position?.left ?? 0,
            top: position?.top ?? 0,
            visibility: position ? 'visible' : 'hidden',
            boxShadow: 'var(--shadow-lg), var(--shadow-float)',
            animation: 'fm-pop-top-in 0.14s ease-out',
          }}
          onPointerEnter={(event) => {
            if (event.pointerType === 'touch') return
            cancelClose()
          }}
          onPointerLeave={scheduleClose}
          // 点击窗内内容时把焦点留在窗内，鼠标移出不收起（Escape / 外部点击仍可关闭）
          onPointerDown={() => popupRef.current?.focus({ preventScroll: true })}
          onBlur={handleTriggerBlur}
        >
          <div className="flex items-center justify-between gap-2.5 border-b border-border-subtle pb-3">
            <h2 id={TITLE_ID} className="text-[13px] font-semibold">
              {year}年{month}月 · 天数统计
            </h2>
            <span className="shrink-0 text-[11px] text-muted-foreground">共 {totalDays} 天</span>
          </div>

          {isEstimate && (
            <p className="mt-3 rounded-lg bg-surface-hover px-2.5 py-2 text-[10px] leading-relaxed text-muted-foreground">
              未收录该年度放假调休安排，工作日与休息日仅按周末估算，法定节假日未知。
            </p>
          )}

          <div className="py-1">
            <StatRow
              icon={<Briefcase className="h-4 w-4" />}
              tone="work"
              label="工作日"
              extra={workExtra}
              value={workDays}
            />
            <StatRow
              icon={<Armchair className="h-4 w-4" />}
              tone="rest"
              label="休息日"
              extra={isEstimate ? '估算（仅按周末）' : '含周末、调休及法定节假日'}
              value={restDays}
            />
            <StatRow
              icon={<Flag className="h-4 w-4" />}
              tone="legal"
              label="法定节假日"
              extra={isEstimate ? '未收录该年度安排' : '已计入休息日'}
              value={statutoryDays ?? '—'}
            />
          </div>

          <section className="border-t border-border-subtle pt-3">
            <h3 className="mb-1.5 text-[11px] font-semibold">本月假期与补班</h3>
            {isEstimate ? (
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                未收录该年度放假调休安排，无法列出假期与补班。
              </p>
            ) : periods.length === 0 && makeups.length === 0 ? (
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                本月无节假日安排，按周末双休。
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-[11px] text-muted-foreground">
                {periods.map((period) => (
                  <li key={`${period.name}-${period.start}`} className="flex items-start gap-2">
                    <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-holiday-fg" />
                    <span>
                      {period.name} {formatHolidayPeriod(period, month)}
                    </span>
                  </li>
                ))}
                {makeups.length > 0 && (
                  <li className="flex items-start gap-2">
                    <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-makeup-fg" />
                    <span>
                      调休上班{' '}
                      {makeups
                        .map((date) => `${formatShortDate(date)}（${formatWeekdayCn(date)}）`)
                        .join('、')}
                    </span>
                  </li>
                )}
              </ul>
            )}
          </section>

          <p className="mt-3 border-t border-border-subtle pt-2.5 text-[10px] leading-relaxed text-muted-foreground">
            休息日包含法定节假日，连休天数另列。
            {source && <span className="mt-1 block">数据来源：{source.source}</span>}
          </p>
        </div>,
        document.body,
      )}
    </>
  )
}

/** 三个统计行：图标 + 名称/口径说明 + 天数 */
function StatRow({
  icon,
  tone,
  label,
  extra,
  value,
}: {
  icon: React.ReactNode
  tone: 'work' | 'rest' | 'legal'
  label: string
  extra: string
  value: number | string
}) {
  const toneClass = {
    work: 'text-makeup-fg bg-makeup-bg',
    rest: 'text-task-done-fg bg-task-done-bg',
    legal: 'text-holiday-fg bg-holiday-bg',
  }[tone]

  return (
    <div className="flex items-center gap-2.5 rounded-lg px-1 py-2.5">
      <span className={cn('flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg', toneClass)}>
        {icon}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-xs text-foreground">{label}</span>
        <span className="text-[10px] text-muted-foreground">{extra}</span>
      </span>
      <span className="ml-auto flex items-baseline gap-1 whitespace-nowrap">
        <b className="text-[23px] leading-none font-semibold tracking-tight tabular-nums">{value}</b>
        {typeof value === 'number' && <span className="text-[11px] text-muted-foreground">天</span>}
      </span>
    </div>
  )
}
