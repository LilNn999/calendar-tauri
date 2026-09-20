// ============================================================
// 农历 / 节气 / 传统节日换算（1900–2100）
// 算法为社区通用的历法表查表法（calendar.js 系）：农历位信息取 LUNAR_INFO，
// 节气日期取 TERM_DAYS（构建期自 solarlunar 权威数据固化，见 lunar-data.ts）。
// 仅做纯日期换算，无外部依赖、离线可用。
// ============================================================
import { LUNAR_INFO, TERM_DAYS } from './lunar-data'

/** 农历月份数字 → 中文（1-12），拼「月」使用 */
const LUNAR_MONTH_CN = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '腊']

/** 农历日数字 → 中文（初一…三十） */
const LUNAR_DAY_CN = [
  '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十',
]

/** 24 节气名，与 TERM_DAYS 每年 24 字符一一对应（小寒在 1 月，依序到冬至在 12 月） */
export const SOLAR_TERMS = [
  '小寒', '大寒', '立春', '雨水', '惊蛰', '春分', '清明', '谷雨',
  '立夏', '小满', '芒种', '夏至', '小暑', '大暑', '立秋', '处暑',
  '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至',
]

/** 农历传统节日：key = `${农历月}-${农历日}`（闰月不记节日） */
const LUNAR_FESTIVALS: Record<string, string> = {
  '1-1': '春节',
  '1-15': '元宵节',
  '2-2': '龙抬头',
  '5-5': '端午节',
  '7-7': '七夕',
  '8-15': '中秋节',
  '9-9': '重阳节',
  '12-8': '腊八节',
}

/** 公历节日：key = `${月}-${日}` */
const SOLAR_FESTIVALS: Record<string, string> = {
  '1-1': '元旦',
  '2-14': '情人节',
  '3-8': '妇女节',
  '3-12': '植树节',
  '5-1': '劳动节',
  '5-4': '青年节',
  '6-1': '儿童节',
  '7-1': '建党节',
  '8-1': '建军节',
  '9-10': '教师节',
  '10-1': '国庆节',
  '12-24': '平安夜',
  '12-25': '圣诞节',
}

export interface LunarDay {
  /** 农历年（正月初一所在的农历年） */
  lunarYear: number
  /** 农历月（1-12） */
  lunarMonth: number
  /** 农历日（1-30） */
  lunarDay: number
  /** 是否闰月 */
  isLeapMonth: boolean
  /** 农历月中文（如「八月」「闰六月」「正月」「腊月」） */
  monthCn: string
  /** 农历日中文（如「十五」「廿三」） */
  dayCn: string
  /** 当日节气（无则 undefined） */
  term?: string
  /** 当日农历传统节日（无则 undefined） */
  lunarFestival?: string
  /** 当日公历节日（无则 undefined） */
  solarFestival?: string
}

/** 某农历年的闰月编号（0 = 无闰月） */
function lunarLeapMonth(year: number): number {
  return LUNAR_INFO[year - 1900] & 0xf
}

/** 某农历年闰月的天数（无闰月为 0） */
function lunarLeapDays(year: number): number {
  if (lunarLeapMonth(year) === 0) return 0
  return (LUNAR_INFO[year - 1900] & 0x10000) ? 30 : 29
}

/** 某农历年的总天数 */
function lunarYearDays(year: number): number {
  let sum = 348 // 12 个期望小月（29 天）打底
  for (let bit = 0x8000; bit > 0x8; bit >>= 1) sum += (LUNAR_INFO[year - 1900] & bit) ? 1 : 0
  return sum + lunarLeapDays(year)
}

/** 某农历年第 month 个顺序月的天数（month 1-12，闰月按独立位） */
function lunarMonthDays(year: number, month: number): number {
  return (LUNAR_INFO[year - 1900] & (0x10000 >> month)) ? 30 : 29
}

/** 公历某年某月某日的节气名（当月恰好两个节气，逐日比对当月节气日期） */
function getTermInfo(year: number, month: number, day: number): string | undefined {
  const n = (month - 1) * 2
  if (day === parseInt(TERM_DAYS[(year - 1900) * 24 + n], 36)) return SOLAR_TERMS[n]
  if (day === parseInt(TERM_DAYS[(year - 1900) * 24 + n + 1], 36)) return SOLAR_TERMS[n + 1]
  return undefined
}

/** 公历日期 → 农历信息（含节气与传统节日）；支持范围 1900-01-31 至 2100 年末 */
export function solarToLunar(date: Date): LunarDay {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()

  // 基准：1900-01-31 = 农历 1900 年正月初一
  let offset = Math.floor(
    (Date.UTC(year, month - 1, day) - Date.UTC(1900, 0, 31)) / 86400000,
  )

  // 先定位农历年
  let lunarYear = 1900
  let daysInYear = 0
  for (; lunarYear < 2101 && offset > 0; lunarYear++) {
    daysInYear = lunarYearDays(lunarYear)
    offset -= daysInYear
  }
  if (offset < 0) {
    offset += daysInYear
    lunarYear--
  }

  // 再定位农历月（含闰月）
  const leapMonth = lunarLeapMonth(lunarYear)
  let isLeapMonth = false
  let lunarMonth = 1
  let daysInMonth = 0
  for (; lunarMonth < 13 && offset > 0; lunarMonth++) {
    if (leapMonth > 0 && lunarMonth === leapMonth + 1 && !isLeapMonth) {
      lunarMonth--
      isLeapMonth = true
      daysInMonth = lunarLeapDays(lunarYear)
    } else {
      daysInMonth = lunarMonthDays(lunarYear, lunarMonth)
    }
    if (isLeapMonth && lunarMonth === leapMonth + 1) isLeapMonth = false
    offset -= daysInMonth
  }
  if (offset === 0 && leapMonth > 0 && lunarMonth === leapMonth + 1) {
    if (isLeapMonth) {
      isLeapMonth = false
    } else {
      isLeapMonth = true
      lunarMonth--
    }
  }
  if (offset < 0) {
    offset += daysInMonth
    lunarMonth--
  }

  const lunarDay = offset + 1

  // 中文月日
  const monthCn = (isLeapMonth ? '闰' : '') + LUNAR_MONTH_CN[lunarMonth - 1] + '月'
  const dayCn = LUNAR_DAY_CN[lunarDay - 1]

  // 节气
  const term = getTermInfo(year, month, day)

  // 农历节日（除夕 = 腊月的最后一天，闰腊月极为罕见不记）
  let lunarFestival: string | undefined
  if (!isLeapMonth) {
    if (lunarMonth === 12 && lunarDay === lunarMonthDays(lunarYear, 12)) {
      lunarFestival = '除夕'
    } else {
      lunarFestival = LUNAR_FESTIVALS[`${lunarMonth}-${lunarDay}`]
    }
  }

  // 公历节日
  const solarFestival = SOLAR_FESTIVALS[`${month}-${day}`]

  return {
    lunarYear,
    lunarMonth,
    lunarDay,
    isLeapMonth,
    monthCn,
    dayCn,
    term,
    lunarFestival,
    solarFestival,
  }
}
