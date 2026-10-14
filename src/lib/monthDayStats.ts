// ============================================================
// 月度工作日 / 休息日 / 法定节假日统计（纯函数，离线可用）
// 口径：中国大陆标准双休 + 国务院办公厅年度放假调休安排。
//   工作日     = 当月应上班的日期（含周末调休补班，扣除放假日期）
//   休息日     = 当月不必上班的日期（周末、调休放假、法定节假日）
//   法定节假日 = 法定节日本身落在当月的天数（休息日的子集，单独展示）
// 始终满足 工作日 + 休息日 = 当月公历总天数。
// 未收录年度只按周末估算，法定天数为 null（未知，不当作 0）；
// 假期与补班同样为 null，由界面明确提示未收录。
// ============================================================
// 相对导入带扩展名：node --experimental-strip-types 运行测试时需要显式扩展名
import {
  getHolidayDay,
  getHolidayYearSource,
  getMonthHolidayInfo,
  type MonthHolidayPeriod,
} from './holidays.ts'

/** 统计口径：官方年度安排，或未收录年度仅按周末的估算 */
export type MonthDayStatsCoverage = 'official' | 'estimate'

/** 单个公历月的天数统计结果（计算与展示模型，不落库） */
export interface MonthDayStats {
  /** 公历年 */
  year: number
  /** 公历月（1-12） */
  month: number
  /** 当月公历总天数 */
  totalDays: number
  /** 工作日（含调休补班） */
  workDays: number
  /** 休息日（含周末、调休放假与法定节假日） */
  restDays: number
  /** 法定节假日天数；未收录年度为 null */
  statutoryDays: number | null
  /** 统计口径 */
  coverage: MonthDayStatsCoverage
  /** 与当月相交的放假区间；未收录年度为 null */
  holidayPeriods: MonthHolidayPeriod[] | null
  /** 当月的调休上班日期；未收录年度为 null */
  makeupDates: string[] | null
  /** 年度安排来源；未收录年度为 null */
  source: { source: string; url: string } | null
}

/** '2026-10-10' → 本地 Date（避免直接解析为 UTC 造成偏移） */
function parseLocal(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * 统计某个公历月的工作日、休息日与法定节假日。
 * 只遍历当月 1 日至月末，不含月历网格补齐的上月 / 下月日期。
 */
export function getMonthDayStats(date: Date): MonthDayStats {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const totalDays = new Date(year, month, 0).getDate()
  const source = getHolidayYearSource(year) ?? null

  let workDays = 0
  let restDays = 0
  for (let day = 1; day <= totalDays; day++) {
    const holiday = getHolidayDay(toDateKey(year, month, day))
    const weekday = new Date(year, month - 1, day).getDay()
    const isOffDay = holiday ? holiday.isOffDay : weekday === 0 || weekday === 6
    if (isOffDay) restDays += 1
    else workDays += 1
  }

  if (!source) {
    return {
      year,
      month,
      totalDays,
      workDays,
      restDays,
      statutoryDays: null,
      coverage: 'estimate',
      holidayPeriods: null,
      makeupDates: null,
      source: null,
    }
  }

  const monthInfo = getMonthHolidayInfo(year, month)
  return {
    year,
    month,
    totalDays,
    workDays,
    restDays,
    statutoryDays: monthInfo.statutoryDates.length,
    coverage: 'official',
    holidayPeriods: monthInfo.periods,
    makeupDates: monthInfo.makeupDates,
    source,
  }
}

/** '2026-10-10' → '10.10' */
export function formatShortDate(dateStr: string): string {
  const date = parseLocal(dateStr)
  return `${date.getMonth() + 1}.${date.getDate()}`
}

/** '2026-10-10' → '周六' */
export function formatWeekdayCn(dateStr: string): string {
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  return `周${weekdays[parseLocal(dateStr).getDay()]}`
}

/**
 * 放假区间文案：'10.1–10.7 · 共 7 天'。
 * 区间跨月时补上本月占用天数：'5.31–6.2 · 共 3 天（本月 2 天）'。
 */
export function formatHolidayPeriod(period: MonthHolidayPeriod, month: number): string {
  const startMonth = parseLocal(period.start).getMonth() + 1
  const endMonth = parseLocal(period.end).getMonth() + 1
  const range = `${formatShortDate(period.start)}–${formatShortDate(period.end)}`
  const base = `${range} · 共 ${period.totalDays} 天`
  const crossesMonth = startMonth !== month || endMonth !== month
  return crossesMonth ? `${base}（本月 ${period.daysInMonth} 天）` : base
}
