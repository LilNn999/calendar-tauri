// ============================================================
// 法定节假日 & 调休安排（静态数据）
// 数据依据国务院办公厅年度放假通知与《全国年节及纪念日放假办法》：
//   2025 年：国办发明电〔2024〕12 号
//   2026 年：国办发明电〔2025〕7 号
//   2027 年：国办发明电〔2026〕10 号
// 新年度通知发布后，在 RULES 追加规则、在 YEAR_SOURCES 登记来源即可，无需改界面代码；
// 未登记的年份由月度统计按周末估算，并明确提示未收录。
// ============================================================

/** 单条假期规则：一段放假区间 + 若干调休上班日 */
interface HolidayRule {
  /** 节日名称 */
  name: string
  /** 放假首日（YYYY-MM-DD，含） */
  start: string
  /** 放假末日（YYYY-MM-DD，含） */
  end: string
  /** 该假期的法定节假日日期（《放假办法》规定的节日日期，不含调休与普通周末） */
  statutoryDates: string[]
  /** 调休上班日（周末补班） */
  workdays: string[]
  /** 放假安排说明（悬浮气泡正文） */
  tip: string
  /** 补班日期附注（悬浮气泡补充行，仅该假期存在调休时提供） */
  extra?: string
  /** 特定日期展示的节日名（如春节含除夕、国庆中秋连休）；缺省仅在放假首日展示 rule.name */
  dayNames?: Record<string, string>
}

/** 单个日期的节假日信息，供日历格子渲染 */
export interface HolidayDayInfo {
  /** true = 放假日（休角标），false = 调休上班日（班角标） */
  isOffDay: boolean
  /** 悬浮气泡标题（节日名 / 调休上班） */
  title: string
  /** 放假安排说明 */
  tip: string
  /** 补班日期附注 */
  extra?: string
  /** 日期数字旁展示的节日名（仅假期代表日有值） */
  label?: string
}

const RULES: HolidayRule[] = [
  // ── 2025 年 ──
  {
    name: '元旦',
    start: '2025-01-01',
    end: '2025-01-01',
    statutoryDates: ['2025-01-01'],
    workdays: [],
    tip: '1月1日放假，共1天',
  },
  {
    name: '春节',
    start: '2025-01-28',
    end: '2025-02-04',
    statutoryDates: ['2025-01-28', '2025-01-29', '2025-01-30', '2025-01-31'],
    workdays: ['2025-01-26', '2025-02-08'],
    tip: '1月28日至2月4日放假调休，共8天',
    extra: '1月26日（周日）、2月8日（周六）上班',
    dayNames: { '2025-01-28': '除夕', '2025-01-29': '春节' },
  },
  {
    name: '清明节',
    start: '2025-04-04',
    end: '2025-04-06',
    statutoryDates: ['2025-04-04'],
    workdays: [],
    tip: '4月4日至6日放假，共3天',
  },
  {
    name: '劳动节',
    start: '2025-05-01',
    end: '2025-05-05',
    statutoryDates: ['2025-05-01', '2025-05-02'],
    workdays: ['2025-04-27'],
    tip: '5月1日至5日放假调休，共5天',
    extra: '4月27日（周日）上班',
  },
  {
    name: '端午节',
    start: '2025-05-31',
    end: '2025-06-02',
    statutoryDates: ['2025-05-31'],
    workdays: [],
    tip: '5月31日至6月2日放假，共3天',
  },
  {
    name: '国庆节',
    start: '2025-10-01',
    end: '2025-10-08',
    // 国庆节 3 天 + 并入连休的中秋节 1 天
    statutoryDates: ['2025-10-01', '2025-10-02', '2025-10-03', '2025-10-06'],
    workdays: ['2025-09-28', '2025-10-11'],
    tip: '10月1日至8日放假调休，共8天',
    extra: '9月28日（周日）、10月11日（周六）上班',
    dayNames: { '2025-10-01': '国庆节', '2025-10-06': '中秋节' },
  },

  // ── 2026 年 ──
  {
    name: '元旦',
    start: '2026-01-01',
    end: '2026-01-03',
    statutoryDates: ['2026-01-01'],
    workdays: ['2026-01-04'],
    tip: '1月1日至3日放假调休，共3天',
    extra: '1月4日（周日）上班',
  },
  {
    name: '春节',
    start: '2026-02-15',
    end: '2026-02-23',
    // 除夕、正月初一至初三
    statutoryDates: ['2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19'],
    workdays: ['2026-02-14', '2026-02-28'],
    tip: '2月15日至23日放假调休，共9天',
    extra: '2月14日（周六）、2月28日（周六）上班',
    dayNames: { '2026-02-16': '除夕', '2026-02-17': '春节' },
  },
  {
    name: '清明节',
    start: '2026-04-04',
    end: '2026-04-06',
    statutoryDates: ['2026-04-05'],
    workdays: [],
    tip: '4月4日至6日放假，共3天',
  },
  {
    name: '劳动节',
    start: '2026-05-01',
    end: '2026-05-05',
    statutoryDates: ['2026-05-01', '2026-05-02'],
    workdays: ['2026-05-09'],
    tip: '5月1日至5日放假调休，共5天',
    extra: '5月9日（周六）上班',
  },
  {
    name: '端午节',
    start: '2026-06-19',
    end: '2026-06-21',
    statutoryDates: ['2026-06-19'],
    workdays: [],
    tip: '6月19日至21日放假，共3天',
  },
  {
    name: '中秋节',
    start: '2026-09-25',
    end: '2026-09-27',
    statutoryDates: ['2026-09-25'],
    workdays: [],
    tip: '9月25日至27日放假，共3天',
  },
  {
    name: '国庆节',
    start: '2026-10-01',
    end: '2026-10-07',
    statutoryDates: ['2026-10-01', '2026-10-02', '2026-10-03'],
    workdays: ['2026-09-20', '2026-10-10'],
    tip: '10月1日至7日放假调休，共7天',
    extra: '9月20日（周日）、10月10日（周六）上班',
  },

  // ── 2027 年 ──
  {
    name: '元旦',
    start: '2027-01-01',
    end: '2027-01-03',
    statutoryDates: ['2027-01-01'],
    workdays: [],
    tip: '1月1日至3日放假，共3天',
  },
  {
    name: '春节',
    start: '2027-02-05',
    end: '2027-02-13',
    statutoryDates: ['2027-02-05', '2027-02-06', '2027-02-07', '2027-02-08'],
    workdays: ['2027-01-31', '2027-02-14'],
    tip: '2月5日至13日放假调休，共9天',
    extra: '1月31日（周日）、2月14日（周日）上班',
    dayNames: { '2027-02-05': '除夕', '2027-02-06': '春节' },
  },
  {
    name: '清明节',
    start: '2027-04-03',
    end: '2027-04-05',
    statutoryDates: ['2027-04-05'],
    workdays: [],
    tip: '4月3日至5日放假，共3天',
  },
  {
    name: '劳动节',
    start: '2027-05-01',
    end: '2027-05-05',
    statutoryDates: ['2027-05-01', '2027-05-02'],
    workdays: ['2027-05-08'],
    tip: '5月1日至5日放假调休，共5天',
    extra: '5月8日（周六）上班',
  },
  {
    name: '端午节',
    start: '2027-06-09',
    end: '2027-06-09',
    statutoryDates: ['2027-06-09'],
    workdays: [],
    tip: '6月9日放假，共1天',
  },
  {
    name: '中秋节',
    start: '2027-09-15',
    end: '2027-09-15',
    statutoryDates: ['2027-09-15'],
    workdays: [],
    tip: '9月15日放假，共1天',
  },
  {
    name: '国庆节',
    start: '2027-10-01',
    end: '2027-10-07',
    statutoryDates: ['2027-10-01', '2027-10-02', '2027-10-03'],
    workdays: ['2027-09-26', '2027-10-09'],
    tip: '10月1日至7日放假调休，共7天',
    extra: '9月26日（周日）、10月9日（周六）上班',
  },
]

// 展开规则为逐日查找表，模块加载时构建一次即可。
const HOLIDAY_MAP = new Map<string, HolidayDayInfo>()

const WEEKDAY_CN = ['日', '一', '二', '三', '四', '五', '六']

/** '2026-10-10' → 本地 Date（避免 UTC 解析偏移） */
function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

/** '2026-10-10' → '10月10日（周六）' */
function formatCnDate(dateStr: string): string {
  const date = parseDate(dateStr)
  return `${date.getMonth() + 1}月${date.getDate()}日（周${WEEKDAY_CN[date.getDay()]}）`
}

for (const rule of RULES) {
  // 放假区间逐日展开
  const cursor = parseDate(rule.start)
  const end = parseDate(rule.end)
  while (cursor <= end) {
    const y = cursor.getFullYear()
    const m = String(cursor.getMonth() + 1).padStart(2, '0')
    const d = String(cursor.getDate()).padStart(2, '0')
    const key = `${y}-${m}-${d}`
    HOLIDAY_MAP.set(key, {
      isOffDay: true,
      title: rule.dayNames?.[key] ?? rule.name,
      tip: rule.tip,
      extra: rule.extra,
      label: rule.dayNames?.[key] ?? (key === rule.start ? rule.name : undefined),
    })
    cursor.setDate(cursor.getDate() + 1)
  }
  // 调休上班日
  for (const workday of rule.workdays) {
    HOLIDAY_MAP.set(workday, {
      isOffDay: false,
      title: '调休上班',
      tip: `${formatCnDate(workday)}上班，补${rule.name}假期`,
    })
  }
}

/** 查询某日期的节假日 / 调休信息，无则返回 undefined */
export function getHolidayDay(dateStr: string): HolidayDayInfo | undefined {
  return HOLIDAY_MAP.get(dateStr)
}

/** 年度放假安排的来源与文号 */
export interface HolidayYearSource {
  /** 通知文号 */
  source: string
  /** 通知原文链接 */
  url: string
}

/**
 * 已收录完整年度安排的年份。
 * 只有登记在此的年份才输出确定的法定天数与假期/补班安排，
 * 避免某年只存在零星规则时被误判为全年已覆盖。
 */
const YEAR_SOURCES: Record<number, HolidayYearSource> = {
  2025: {
    source: '国办发明电〔2024〕12号',
    url: 'https://big5.www.gov.cn/gate/big5/www.gov.cn/zhengce/zhengceku/202411/content_6986383.htm',
  },
  2026: {
    source: '国办发明电〔2025〕7号',
    url: 'https://big5.www.gov.cn/gate/big5/www.gov.cn/zhengce/zhengceku/202511/content_7047091.htm',
  },
  2027: {
    source: '国办发明电〔2026〕10号',
    url: 'https://www.gov.cn/zhengce/content/202611/content_7085101.htm',
  },
}

/** 查询年度安排的收录来源；未收录的年份返回 undefined */
export function getHolidayYearSource(year: number): HolidayYearSource | undefined {
  return YEAR_SOURCES[year]
}

/** 与某个月相交的放假区间（跨月假期给出整段起止与本月占用天数） */
export interface MonthHolidayPeriod {
  /** 节日名称 */
  name: string
  /** 整段放假首日（YYYY-MM-DD） */
  start: string
  /** 整段放假末日（YYYY-MM-DD） */
  end: string
  /** 整段放假天数 */
  totalDays: number
  /** 落在该月的天数 */
  daysInMonth: number
}

/** 某个月的假期结构信息 */
export interface MonthHolidayInfo {
  /** 落在该月的法定节假日日期（升序） */
  statutoryDates: string[]
  /** 与该月相交的放假区间（按开始日期升序） */
  periods: MonthHolidayPeriod[]
  /** 落在该月的调休上班日期（升序） */
  makeupDates: string[]
}

/** '2026-10-10' → 天数序号（仅用于同年同月的区间天数计算） */
function dayIndex(dateStr: string): number {
  return Math.round(parseDate(dateStr).getTime() / 86400000)
}

/** 某年某月的公历总天数 */
function monthTotalDays(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

/**
 * 查询某年某月（month 为 1-12）的放假区间、法定节假日与调休上班日期。
 * 未收录年度返回空结果，由调用方转换为“未收录”提示。
 */
export function getMonthHolidayInfo(year: number, month: number): MonthHolidayInfo {
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`
  const monthStart = `${monthPrefix}-01`
  const monthEnd = `${monthPrefix}-${String(monthTotalDays(year, month)).padStart(2, '0')}`

  const statutoryDates: string[] = []
  const periods: MonthHolidayPeriod[] = []
  const makeupDates: string[] = []

  for (const rule of RULES) {
    // 放假区间与本月相交：给出整段信息与本月占用天数
    if (rule.start <= monthEnd && rule.end >= monthStart) {
      const overlapStart = rule.start < monthStart ? monthStart : rule.start
      const overlapEnd = rule.end > monthEnd ? monthEnd : rule.end
      periods.push({
        name: rule.name,
        start: rule.start,
        end: rule.end,
        totalDays: dayIndex(rule.end) - dayIndex(rule.start) + 1,
        daysInMonth: dayIndex(overlapEnd) - dayIndex(overlapStart) + 1,
      })
    }
    // 法定日期与补班日期按当月筛选，其他月份的关联日期不计入本月
    for (const date of rule.statutoryDates) {
      if (date >= monthStart && date <= monthEnd) statutoryDates.push(date)
    }
    for (const date of rule.workdays) {
      if (date >= monthStart && date <= monthEnd) makeupDates.push(date)
    }
  }

  statutoryDates.sort()
  makeupDates.sort()
  periods.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0))

  return { statutoryDates, periods, makeupDates }
}
