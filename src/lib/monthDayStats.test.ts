import test from 'node:test'
import assert from 'node:assert/strict'
import {
  formatHolidayPeriod,
  formatShortDate,
  formatWeekdayCn,
  getMonthDayStats,
} from './monthDayStats.ts'
import { getHolidayDay, getHolidayYearSource, getMonthHolidayInfo } from './holidays.ts'

/** 取某年某月的统计；日期按本地时间构造，避免 UTC 偏移 */
const statsOf = (year: number, month: number) => getMonthDayStats(new Date(year, month - 1, 1))

/** 计划验收基线：期望值依据国务院办公厅通知固定，不由被测函数生成 */
const BASELINE = [
  { month: '2025-05', workDays: 19, restDays: 12, statutoryDays: 3, makeup: 0 },
  { month: '2025-06', workDays: 20, restDays: 10, statutoryDays: 0, makeup: 0 },
  { month: '2025-10', workDays: 18, restDays: 13, statutoryDays: 4, makeup: 1 },
  { month: '2026-02', workDays: 16, restDays: 12, statutoryDays: 4, makeup: 2 },
  { month: '2026-03', workDays: 22, restDays: 9, statutoryDays: 0, makeup: 0 },
  { month: '2026-09', workDays: 22, restDays: 8, statutoryDays: 1, makeup: 1 },
  { month: '2026-10', workDays: 18, restDays: 13, statutoryDays: 3, makeup: 1 },
  { month: '2026-11', workDays: 21, restDays: 9, statutoryDays: 0, makeup: 0 },
]

test('工作日/休息日/法定节假日与补班数量符合年度安排', () => {
  for (const item of BASELINE) {
    const [year, month] = item.month.split('-').map(Number)
    const stats = statsOf(year, month)
    assert.equal(stats.coverage, 'official', item.month)
    assert.equal(stats.workDays, item.workDays, `${item.month} 工作日`)
    assert.equal(stats.restDays, item.restDays, `${item.month} 休息日`)
    assert.equal(stats.statutoryDays, item.statutoryDays, `${item.month} 法定节假日`)
    assert.equal(stats.makeupDates?.length, item.makeup, `${item.month} 本月补班`)
  }
})

test('工作日 + 休息日恒等于当月公历总天数', () => {
  for (const year of [2025, 2026]) {
    for (let month = 1; month <= 12; month++) {
      const stats = statsOf(year, month)
      assert.equal(
        stats.workDays + stats.restDays,
        stats.totalDays,
        `${year}-${month} 总数 ${stats.workDays}+${stats.restDays}`,
      )
      assert.equal(stats.totalDays, new Date(year, month, 0).getDate())
    }
  }
})

test('已收录年度全年法定节假日合计 13 天', () => {
  for (const year of [2025, 2026]) {
    let sum = 0
    for (let month = 1; month <= 12; month++) {
      sum += statsOf(year, month).statutoryDays ?? 0
    }
    assert.equal(sum, 13, `${year} 年法定合计`)
  }
})

test('2025 年国庆中秋合并连休：法定日期去重后为 4 天', () => {
  const stats = statsOf(2025, 10)
  assert.equal(stats.statutoryDays, 4)
  // 中秋 10月6日与国庆 10月1—3日并列，不重复计数
  assert.deepEqual(getMonthHolidayInfo(2025, 10).statutoryDates, [
    '2025-10-01', '2025-10-02', '2025-10-03', '2025-10-06',
  ])
})

test('跨月假期与跨月补班按月切分', () => {
  // 春节 1月28日至2月4日：2 月占用 4 天
  const feb2025 = statsOf(2025, 2)
  assert.deepEqual(feb2025.holidayPeriods, [
    { name: '春节', start: '2025-01-28', end: '2025-02-04', totalDays: 8, daysInMonth: 4 },
  ])
  // 劳动节调休 4月27日不计入 5 月补班
  assert.deepEqual(statsOf(2025, 5).makeupDates, [])
  // 端午 5月31日至6月2日：6 月占用 2 天，法定日期仍只在 5 月
  assert.deepEqual(statsOf(2025, 6).makeupDates, [])
  assert.deepEqual(statsOf(2025, 6).holidayPeriods, [
    { name: '端午节', start: '2025-05-31', end: '2025-06-02', totalDays: 3, daysInMonth: 2 },
  ])
  assert.equal(statsOf(2025, 6).statutoryDays, 0)
  // 2026 年 9 月 20 日补班属于 9 月，国庆补班只计 10 月 10 日
  assert.deepEqual(statsOf(2026, 9).makeupDates, ['2026-09-20'])
  assert.deepEqual(statsOf(2026, 10).makeupDates, ['2026-10-10'])
})

test('2026 年春节连休 9 天与法定 4 天分别统计', () => {
  const stats = statsOf(2026, 2)
  assert.deepEqual(stats.holidayPeriods, [
    { name: '春节', start: '2026-02-15', end: '2026-02-23', totalDays: 9, daysInMonth: 9 },
  ])
  assert.deepEqual(getMonthHolidayInfo(2026, 2).statutoryDates, [
    '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19',
  ])
})

test('法定节假日都是休假日，且与补班日期不冲突', () => {
  for (const year of [2025, 2026]) {
    for (let month = 1; month <= 12; month++) {
      const info = getMonthHolidayInfo(year, month)
      for (const date of info.statutoryDates) {
        assert.equal(getHolidayDay(date)?.isOffDay, true, `${date} 应为休假日`)
        assert.equal(info.makeupDates.includes(date), false, `${date} 不应同时是补班日`)
      }
      for (const date of info.makeupDates) {
        assert.equal(getHolidayDay(date)?.isOffDay, false, `${date} 应为补班日`)
      }
    }
  }
})

test('未收录年度只按周末估算，未知项为 null 而不是 0', () => {
  const stats = statsOf(2024, 2)
  assert.equal(getHolidayYearSource(2024), undefined)
  assert.equal(stats.coverage, 'estimate')
  assert.equal(stats.totalDays, 29) // 闰年
  assert.equal(stats.workDays, 21)
  assert.equal(stats.restDays, 8)
  assert.equal(stats.statutoryDays, null)
  assert.equal(stats.holidayPeriods, null)
  assert.equal(stats.makeupDates, null)
  assert.equal(stats.source, null)
})

test('已收录年度的月份带上来源文号', () => {
  assert.equal(statsOf(2026, 10).source?.source, '国办发明电〔2025〕7号')
  assert.equal(statsOf(2025, 10).source?.source, '国办发明电〔2024〕12号')
})

test('假期区间与日期文案', () => {
  const period = { name: '国庆节', start: '2026-10-01', end: '2026-10-07', totalDays: 7, daysInMonth: 7 }
  assert.equal(formatHolidayPeriod(period, 10), '10.1–10.7 · 共 7 天')
  const crossMonth = { name: '端午节', start: '2025-05-31', end: '2025-06-02', totalDays: 3, daysInMonth: 2 }
  assert.equal(formatHolidayPeriod(crossMonth, 6), '5.31–6.2 · 共 3 天（本月 2 天）')
  assert.equal(formatShortDate('2025-01-01'), '1.1')
  assert.equal(formatWeekdayCn('2026-10-10'), '周六')
  assert.equal(formatWeekdayCn('2026-01-04'), '周日')
})
