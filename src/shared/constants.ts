import type { Priority } from './types'

export const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; dot: string }> = {
  none: { label: '无', color: 'text-muted-foreground', dot: 'bg-muted-foreground/30' },
  low: { label: '低', color: 'text-sky-500', dot: 'bg-sky-500' },
  medium: { label: '中', color: 'text-amber-500', dot: 'bg-amber-500' },
  high: { label: '高', color: 'text-red-500', dot: 'bg-red-500' },
}

export const CHECKIN_TYPE_LABELS = {
  numeric: '数值型',
  boolean: '开关型',
  text: '文字型',
  time: '时间型',
} as const

export const RECURRENCE_LABELS = {
  daily: '每天重复',
  weekday: '工作日重复',
  weekend: '周末重复',
  weekly: '每周重复',
  monthly: '每月重复',
} as const

export const CHECKIN_FREQUENCY_LABELS = {
  daily: '每天',
  weekday: '工作日',
  weekend: '周末',
  weekly: '每周',
  monthly: '每月',
} as const

// 日历每行显示的最大事项数（超出显示 "+X 更多"）
export const CELL_MAX_ITEMS = 4

// 成就种子数据
export const ACHIEVEMENT_SEEDS = [
  { key: 'streak_3', title: '初出茅庐', description: '连续打卡 3 天', icon: '🌱' },
  { key: 'streak_7', title: '一周坚持', description: '连续打卡 7 天', icon: '🔥' },
  { key: 'streak_30', title: '月度达人', description: '连续打卡 30 天', icon: '⭐' },
  { key: 'streak_100', title: '百日坚守', description: '连续打卡 100 天', icon: '🏆' },
  { key: 'perfect_week', title: '完美一周', description: '某一周完成率达到 100%', icon: '💎' },
  { key: 'all_done_today', title: '今日清零', description: '完成当天所有任务', icon: '✅' },
] as const
