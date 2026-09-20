import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import type { HolidayDayInfo } from '@/lib/holidays'

interface HolidayBadgeProps {
  holiday: HolidayDayInfo
  /** 非本月等场景下降低对比度 */
  dimmed?: boolean
}

/** 节假日（休）/ 调休补班（班）角标 + 悬浮说明气泡（portal 到 body，避免被格子 overflow 裁切） */
export function HolidayBadge({ holiday, dimmed }: HolidayBadgeProps) {
  const [tipStyle, setTipStyle] = useState<React.CSSProperties | null>(null)
  const badgeRef = useRef<HTMLDivElement>(null)

  const openTip = () => {
    if (!badgeRef.current) return
    const rect = badgeRef.current.getBoundingClientRect()
    const TIP_W = 208
    const TIP_H = 96
    const style: React.CSSProperties = { position: 'fixed', zIndex: 9999, width: TIP_W }
    if (rect.left + TIP_W + 8 > window.innerWidth) style.left = rect.right - TIP_W
    else style.left = rect.left
    if (rect.bottom + TIP_H + 6 > window.innerHeight) style.top = rect.top - TIP_H - 6
    else style.top = rect.bottom + 6
    setTipStyle(style)
  }

  return (
    <>
      <div
        ref={badgeRef}
        className="relative shrink-0"
        onMouseEnter={openTip}
        onMouseLeave={() => setTipStyle(null)}
        onClick={(e) => e.stopPropagation()}
      >
        <span
          className={cn(
            'h-3.5 w-3.5 flex items-center justify-center rounded-[4px] text-[9px] font-bold leading-none cursor-help',
            holiday.isOffDay ? 'bg-holiday-bg text-holiday-fg' : 'bg-makeup-bg text-makeup-fg',
            dimmed && 'opacity-60'
          )}
        >
          {holiday.isOffDay ? '休' : '班'}
        </span>
      </div>

      {tipStyle && createPortal(
        <div
          className="fixed w-52 p-2.5 bg-popover border rounded-2xl pointer-events-none"
          style={{ ...tipStyle, boxShadow: 'var(--shadow-lg)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-foreground mb-1">
            {holiday.title}
            <span
              className={cn(
                'ml-auto shrink-0 h-3.5 w-3.5 flex items-center justify-center rounded-[4px] text-[9px] font-bold leading-none',
                holiday.isOffDay ? 'bg-holiday-bg text-holiday-fg' : 'bg-makeup-bg text-makeup-fg'
              )}
            >
              {holiday.isOffDay ? '休' : '班'}
            </span>
          </p>
          <p className="text-muted-foreground leading-relaxed">{holiday.tip}</p>
          {holiday.extra && (
            <p className="mt-1 text-muted-foreground/80 leading-relaxed">{holiday.extra}</p>
          )}
        </div>,
        document.body
      )}
    </>
  )
}
