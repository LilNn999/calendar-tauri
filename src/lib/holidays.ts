// ============================================================
// 法定节假日 & 调休安排（静态数据）
// 数据依据国务院办公厅年度放假通知：
//   2025 年：国办发明电〔2024〕7 号
//   2026 年：国办发明电〔2025〕7 号
// 新年度通知发布后，在 RULES 中追加一条规则即可，无需改界面代码。
// ============================================================

/** 单条假期规则：一段放假区间 + 若干调休上班日 */
interface HolidayRule {
  /** 节日名称 */
  name: string
  /** 放假首日（YYYY-MM-DD，含） */
  start: string
  /** 放假末日（YYYY-MM-DD，含） */
  end: string
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
    workdays: [],
    tip: '1月1日放假，共1天',
  },
  {
    name: '春节',
    start: '2025-01-28',
    end: '2025-02-04',
    workdays: ['2025-01-26', '2025-02-08'],
    tip: '1月28日至2月4日放假调休，共8天',
    extra: '1月26日（周日）、2月8日（周六）上班',
    dayNames: { '2025-01-28': '除夕', '2025-01-29': '春节' },
  },
  {
    name: '清明节',
    start: '2025-04-04',
    end: '2025-04-06',
    workdays: [],
    tip: '4月4日至6日放假，共3天',
  },
  {
    name: '劳动节',
    start: '2025-05-01',
    end: '2025-05-05',
    workdays: ['2025-04-27'],
    tip: '5月1日至5日放假调休，共5天',
    extra: '4月27日（周日）上班',
  },
  {
    name: '端午节',
    start: '2025-05-31',
    end: '2025-06-02',
    workdays: [],
    tip: '5月31日至6月2日放假，共3天',
  },
  {
    name: '国庆节',
    start: '2025-10-01',
    end: '2025-10-08',
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
    workdays: ['2026-01-04'],
    tip: '1月1日至3日放假调休，共3天',
    extra: '1月4日（周日）上班',
  },
  {
    name: '春节',
    start: '2026-02-15',
    end: '2026-02-23',
    workdays: ['2026-02-14', '2026-02-28'],
    tip: '2月15日至23日放假调休，共9天',
    extra: '2月14日（周六）、2月28日（周六）上班',
    dayNames: { '2026-02-16': '除夕', '2026-02-17': '春节' },
  },
  {
    name: '清明节',
    start: '2026-04-04',
    end: '2026-04-06',
    workdays: [],
    tip: '4月4日至6日放假，共3天',
  },
  {
    name: '劳动节',
    start: '2026-05-01',
    end: '2026-05-05',
    workdays: ['2026-05-09'],
    tip: '5月1日至5日放假调休，共5天',
    extra: '5月9日（周六）上班',
  },
  {
    name: '端午节',
    start: '2026-06-19',
    end: '2026-06-21',
    workdays: [],
    tip: '6月19日至21日放假，共3天',
  },
  {
    name: '中秋节',
    start: '2026-09-25',
    end: '2026-09-27',
    workdays: [],
    tip: '9月25日至27日放假，共3天',
  },
  {
    name: '国庆节',
    start: '2026-10-01',
    end: '2026-10-07',
    workdays: ['2026-09-20', '2026-10-10'],
    tip: '10月1日至7日放假调休，共7天',
    extra: '9月20日（周日）、10月10日（周六）上班',
  },
]

// 展开规则为逐日查找表（总量不足百条，模块加载时构建一次即可）
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
