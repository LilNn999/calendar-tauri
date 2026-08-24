import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
}

export function toDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// 判断某个日期是否符合打卡频率
// startDate: 打卡的生效开始日期，用于确定"每周/每月"具体在哪天重复
export function matchesCheckinFrequency(
  dateStr: string,
  frequency: string | null | undefined,
  startDate?: string | null,
): boolean {
  if (!frequency || frequency === 'daily') return true
  const d = new Date(dateStr + 'T00:00:00')
  const dow = d.getDay() // 0=日 1=一 ... 6=六
  if (frequency === 'weekday') return dow >= 1 && dow <= 5
  if (frequency === 'weekend') return dow === 0 || dow === 6
  if (frequency === 'weekly') {
    // 以 startDate 的星期几为准，未设置时默认周一
    if (startDate) {
      const anchorDow = new Date(startDate + 'T00:00:00').getDay()
      return dow === anchorDow
    }
    return dow === 1
  }
  if (frequency === 'monthly') {
    // 以 startDate 的日期为准，未设置时默认每月 1 日
    if (startDate) {
      const anchorDay = new Date(startDate + 'T00:00:00').getDate()
      return d.getDate() === anchorDay
    }
    return d.getDate() === 1
  }
  return true
}
