import { Flame } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StreakBadgeProps {
  streak: number
  className?: string
}

export function StreakBadge({ streak, className }: StreakBadgeProps) {
  if (streak === 0) return null

  const isHot = streak >= 7

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold shadow-sm',
        isHot
          ? 'bg-gradient-brand text-white border-transparent shadow-glow'
          : 'bg-amber-500/10 text-amber-600 border border-amber-500/20',
        className
      )}
    >
      <Flame className={cn('h-4 w-4', isHot && 'animate-pulse')} />
      <span>{streak} 天连续</span>
    </div>
  )
}
