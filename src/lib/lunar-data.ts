// ============================================================
// 农历历法数据表（1900–2100）
// 提取自开源项目 solarlunar（MIT License）的权威历法数据，构建期固化，
// 随版本内置、离线可用，不引入运行时依赖。新年度无需更新（覆盖 1900–2100）。
// - LUNAR_INFO：逐年农历位信息（闰月编号、闰月大小、12 个月大小）
// - TERM_DAYS：逐年 24 节气的“当月日期”，base36 单字符编码，每年 24 字符；
//   顺序：小寒、大寒、立春、雨水、惊蛰、春分、清明、谷雨、立夏、小满、
//   芒种、夏至、小暑、大暑、立秋、处暑、白露、秋分、寒露、霜降、立冬、小雪、大雪、冬至
// ============================================================

export const LUNAR_INFO: number[] = [
  0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2,//1900-1909
  0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977,//1910-1919
  0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970,//1920-1929
  0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,//1930-1939
  0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557,//1940-1949
  0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0,//1950-1959
  0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0,//1960-1969
  0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6,//1970-1979
  0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570,//1980-1989
  0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x05ac0, 0x0ab60, 0x096d5, 0x092e0,//1990-1999
  0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5,//2000-2009
  0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930,//2010-2019
  0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530,//2020-2029
  0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45,//2030-2039
  0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0,//2040-2049
  0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0,//2050-2059
  0x092e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4,//2060-2069
  0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0,//2070-2079
  0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160,//2080-2089
  0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a4d0, 0x0d150, 0x0f252,//2090-2099
  0x0d520,//2100-2109
]

export const TERM_DAYS: string =
  '6k4j6l5k6l6m7n8n8n9o8n7m' +
  '6l4j6l5l6m6m8n8o8o9o8n8m' +
  '6l5j6l6l6m7m8o8o8o9o8n8n' +
  '6l5k7m6l7m7m8o9o9o9o8n8n' +
  '7l5k6l5k6l6m7n8n8n9o8n7m' +
  '6l4j6l5l6m6m8n8o8o9o8n8m' +
  '6l5j6l6l6m6m8o8o8o9o8n8n' +
  '6l5k7m6l7m7m8o9o9o9o8n8n' +
  '7l5k6l5k6l6m7n8n8n9o8n7m' +
  '6l4j6l5l6m6m8n8o8o9o8n8m' +
  '6l5j6l6l6m6m8o8o8o9o8n8n' +
  '6l5k7m6l7m7m8o9o9o9o8n8n' +
  '7l5k6l5k6l6m7n8n8n9o8n7m' +
  '6k4j6l5l6m6m8n8o8o9o8n8m' +
  '6l4j6l5l6m6m8o8o8o9o8n8n' +
  '6l5k6m6l6m7m8o8o9o9o8n8n' +
  '6l5k6l5k6l6m7n8n8n8o8m7m' +
  '6k4j6l5l6l6m8n8o8n9o8n7m' +
  '6l4j6l5l6m6m8o8o8o9o8n8m' +
  '6l5k6m6l6m7m8o8o9o9o8n8n' +
  '6l5k6l5k6l6m7n8n8n8o8m7m' +
  '6k4j6l5k6l6m8n8o8n9o8n7m' +
  '6l4j6l5l6m6m8o8o8o9o8n8m' +
  '6l5j6l6l6m7m8o8o9o9o8n8n' +
  '6l5k6l5k6l6m7n8n8n8o8m7m' +
  '6k4j6l5k6l6m8n8o8n9o8n7m' +
  '6l4j6l5l6m6m8n8o8o9o8n8m' +
  '6l5j6l6l6m7m8o8o8o9o8n8n' +
  '6l5k6l5k6l6l7n8n8n8n7m7m' +
  '6k4j6l5k6l6m7n8n8n9o8n7m' +
  '6l4j6l5l6m6m8n8o8o9o8n8m' +
  '6l5j6l6l6m7m8o8o8o9o8n8n' +
  '6l5k6l5k6l6l7n8n8n8n7m7m' +
  '6k4j6l5k6l6m7n8n8n9o8n7m' +
  '6l4j6l5l6m6m8n8o8o9o8n8m' +
  '6l5j6l6l6m6m8o8o8o9o8n8n' +
  '6l5k6l5k6l6l7n8n8n8n7m7m' +
  '6k4j6l5k6l6m7n8n8n9o8n7m' +
  '6l4j6l5l6m6m8n8o8o9o8n8m' +
  '6l5j6l6l6m6m8o8o8o9o8n8n' +
  '6l5k6l5k6l6l7n8n8n8n7m7m' +
  '6k4j6l5k6l6m7n8n8n9o8n7m' +
  '6l4j6l5l6m6m8n8o8o9o8n8m' +
  '6l5j6l6l6m6m8o8o8o9o8n8n' +
  '6l5k6l5k5l6l7n8n8n8n7m7m' +
  '6k4j6l5k6l6m7n8n8n8o8m7m' +
  '6k4j6l5l6m6m8n8o8n9o8n8m' +
  '6l4j6l5l6m6m8o8o8o9o8n8n' +
  '6l5k5l5k5l6l7n7n8n8n7m7m' +
  '5k4j6l5k6l6m7n8n8n8o8m7m' +
  '6k4j6l5k6l6m8n8o8n9o8n8m' +
  '6l4j6l5l6m6m8o8o8o9o8n8n' +
  '6l5k5l5k5l6l7n7n8n8n7m7m' +
  '5k4j6l5k6l6m7n8n8n8o8m7m' +
  '6k4j6l5k6l6m8n8o8n9o8n7m' +
  '6l4j6l5l6m6m8n8o8o9o8n8m' +
  '6l5k5k5k5l6l7n7n8n8n7m7m' +
  '5k4j6l5k6l6m7n8n8n8o8m7m' +
  '6k4j6l5k6l6m7n8n8n9o8n7m' +
  '6l4j6l5l6m6m8n8o8o9o8n8m' +
  '6l5j5k5k5l6l7n7n7n8n7m7m' +
  '5k4j6l5k6l6l7n8n8n8n7m7m' +
  '6k4j6l5k6l6m7n8n8n9o8n7m' +
  '6l4j6l5l6m6m8n8o8o9o8n8m' +
  '6l5j5k5k5l6l7n7n7n8n7m7m' +
  '5k4j6l5k6l6l7n8n8n8n7m7m' +
  '6k4j6l5k6l6m7n8n8n9o8n7m' +
  '6l4j6l5l6m6m8n8o8o9o8n8m' +
  '6l5j5k5k5l5l7n7n7n8n7m7m' +
  '5k4j6l5k6l6l7n8n8n8n7m7m' +
  '6k4j6l5k6l6m7n8n8n9o8n7m' +
  '6l4j6l5l6m6m8n8o8o9o8n8m' +
  '6l5j5k5k5l5l7n7n7n8n7m7m' +
  '5k4j6l5k5l6l7n8n8n8n7m7m' +
  '6k4j6l5k6l6m7n8n8n9o8n7m' +
  '6l4j6l5l6m6m8n8o8n9o8n8m' +
  '6l5j5k4k5l5l7n7n7n8n7m7m' +
  '5k4j6l5k5l6l7n7n8n8n7m7m' +
  '6k4j6l5k6l6m7n8n8n8o8n7m' +
  '6l4j6l5l6l6m8n8o8n9o8n8m' +
  '6l5j5k4k5l5l7n7n7n8n7m7m' +
  '5k4j6l5k5l6l7n7n8n8n7m7m' +
  '6k4j6l5k6l6m7n8n8n8o8m7m' +
  '6k4j6l5k6l6m8n8o8n9o8n8m' +
  '6l4j5k4k5l5l7m7n7n8n7m7m' +
  '5k4j5l5k5l6l7n7n8n8n7m7m' +
  '5k4j6l5k6l6m7n8n8n8o8m7m' +
  '6k4j6l5k6l6m7n8o8n9o8n7m' +
  '6l4j5k4k5l5l7m7n7n8n7m7l' +
  '5k4j5k5k5l6l7n7n7n8n7m7m' +
  '5k4j6l5k6l6l7n8n8n8o8m7m' +
  '6k4j6l5k6l6m7n8n8n9o8n7m' +
  '6l4j5k4k5l5l7m7n7n8n7m7l' +
  '5k4i5k5k5l6l7n7n7n8n7m7m' +
  '5k4j6l5k6l6l7n8n8n8n7m7m' +
  '6k4j6l5k6l6m7n8n8n9o8n7m' +
  '6l4j5k4k5l5l7m7n7n8n7m7l' +
  '5k4i5k5k5l5l7n7n7n8n7m7m' +
  '5k4j6l5k6l6l7n8n8n8n7m7m' +
  '6k4j6l5k6l6m7n8n8n9o8n7m' +
  '6l4j5k4k5l5l7m7n7n8n7m7l' +
  '5k4i5k5k5l5l7n7n7n8n7m7m' +
  '5k4j6l5k6l6l7n8n8n8n7m7m' +
  '6k4j6l5k6l6m7n8n8n9o8n7m' +
  '6l4j5k4k5l5l7m7n7n8n7m7l' +
  '5k4i5k5k5l5l7n7n7n8n7m7m' +
  '5k4j6l5k5l6l7n7n8n8n7m7m' +
  '6k4j6l5k6l6m7n8n8n9o8n7m' +
  '6l4j5k4k5l5l7m7n7m8n7m7l' +
  '5k4i5k4k5l5l7n7n7n8n7m7m' +
  '5k4j6l5k5l6l7n7n8n8n7m7m' +
  '6k4j6l5k6l6m7n8n8n8o8n7m' +
  '6l4j5k4k5k5l7m7n7m8n7m7l' +
  '5k4i5k4k5l5l7m7n7n8n7m7m' +
  '5k4j6l5k5l6l7n7n8n8n7m7m' +
  '6k4j6l5k6l6m7n8n8n8o8m7m' +
  '6k4j5k4j5k5l7m7n7m8n7m7l' +
  '5k3i5k4k5l5l7m7n7n8n7m7m' +
  '5k4j5l5k5l6l7n7n8n8n7m7m' +
  '5k4j6l5k6l6l7n8n8n8o8m7m' +
  '6k4j5k4j5k5l6m7m7m8n7m7l' +
  '5k3i5k4k5l5l7m7n7n8n7m7l' +
  '5k4j5k5k5l6l7n7n7n8n7m7m' +
  '5k4j6l5k6l6l7n8n8n8o8m7m' +
  '6k4j5k4j5k5l6m7m7m8n7m6l' +
  '5k3i5k4k5l5l7m7n7n8n7m7l' +
  '5k4i5k5k5l5l7n7n7n8n7m7m' +
  '5k4j6l5k6l6l7n8n8n8n7m7m' +
  '6k4j5k4j5k5l6m7m7m8n7m6l' +
  '5k3i5k4k5l5l7m7n7n8n7m7l' +
  '5k4i5k5k5l5l7n7n7n8n7m7m' +
  '5k4j6l5k6l6l7n8n8n8n7m7m' +
  '6k4j5k4j5k5l6m7m7m8n7m6l' +
  '5k3i5k4k5l5l7m7n7n8n7m7l' +
  '5k4i5k5k5l5l7n7n7n8n7m7m' +
  '5k4j6l5k5l6l7n7n8n8n7m7m' +
  '6k4j5k4j5k5l6m7m7m8n7m6l' +
  '5k3i5k4k5l5l7m7n7n8n7m7l' +
  '5k4i5k5k5l5l7n7n7n8n7m7m' +
  '5k4j6l5k5l6l7n7n8n8n7m7m' +
  '6k4j5k4j5k5l6m7m7m8n7m6l' +
  '5k3i5k4k5k5l7m7n7m8n7m7l' +
  '5k4i5k4k5l5l7n7n7n8n7m7m' +
  '5k4j6l5k5l6l7n7n8n8n7m7m' +
  '6k4j5k4j5k5l6m7m7m7n7m6l' +
  '5k3i5k4j5k5l7m7n7m8n7m7l' +
  '5k4i5k4k5l5l7m7n7n8n7m7m' +
  '5k4j6l5k5l6l7n7n8n8n7m7m' +
  '6k4j5k4j5k5k6m7m7m7n7l6l' +
  '5j3i5k4j5k5l6m7m7m8n7m7l' +
  '5k3i5k4k5l5l7m7n7n8n7m7m' +
  '5k4j5k5k5l6l7n7n7n8n7m7m' +
  '5k4j5k4j5k5k6m7m7m7n7l6l' +
  '5j3i5k4j5k5l6m7m7m8n7m7l' +
  '5k3i5k4k5l5l7m7n7n8n7m7m' +
  '5k4j5k5k5l5l7n7n7n8n7m7m' +
  '5k4j5k4j5k5k6m7m7m7n7l6l' +
  '5j3i5k4j5k5l6m7m7m8n7m6l' +
  '5k3i5k4k5l5l7m7n7n8n7m7l' +
  '5k4j5k5k5l5l7n7n7n8n7m7m' +
  '5k4j5k4j5k5k6m7m7m7m6l6l' +
  '5j3i5k4j5k5l6m7m7m8n7m6l' +
  '5k3i5k4k5l5l7m7n7n8n7m7l' +
  '5k4i5k5k5l5l7n7n7n8n7m7m' +
  '5k4j5k4j5k5k6m7m7m7m6l6l' +
  '5j3i5k4j5k5l6m7m7m8n7m6l' +
  '5k3i5k4k5l5l7m7n7n8n7m7l' +
  '5k4i5k5k5l5l7n7n7n8n7m7m' +
  '5k4j5k4j4k5k6m6m7m7m6l6l' +
  '5j3i5k4j5k5l6m7m7m8n7m6l' +
  '5k3i5k4k5k5l7m7n7m8n7m7l' +
  '5k4i5k5k5l5l7n7n7n8n7m7m' +
  '5k4j5k4j4k5k6m6m7m7m6l6l' +
  '5j3i5k4j5k5l6m7m7m7n7m6l' +
  '5k3i5k4k5k5l7m7n7m8n7m7l' +
  '5k4i5k4k5l5l7m7n7n8n7m7m' +
  '5k4j5k4j4k5k6m6m7m7m6l6l' +
  '5j3i5k4j5k5l6m7m7m7n7m6l' +
  '5k3i5k4j5k5l6m7n7m8n7m7l' +
  '5k4i5k4k5l5l7m7n7n8n7m7m' +
  '5k4j5k4j4k5k6m6m7m7m6l6l' +
  '5j3i5k4j5k5k6m7m7m7n7l6l' +
  '5k3i5k4j5k5l6m7m7m8n7m7l' +
  '5k3i5k4k5l5l7m7n7n8n7m7m' +
  '5k4j4j4j4k5k6m6m6m7m6l6l' +
  '4j3i5k4j5k5k6m7m7m7n7l6l' +
  '5j3i5k4j5k5l6m7m7m8n7m7l' +
  '5k3i5k4k5l5l7m7n7n8n7m7m' +
  '5k4j4j4j4k4k6m6m6m7m6l6l' +
  '4j3i5k4j5k5k6m7m7m7n7l6l' +
  '5j3i5k4j5k5l6m7m7m8n7m6l' +
  '5k3i5k4k5l5l7m7n7n8n7m7l' +
  '5k4j4j4j4k4k6m6m6m7m6l6l' +
  '4j3i5k4j5k5k6m7m7m7m6l6l' +
  '5j3i5k4j5k5l6m7m7m8n7m6l' +
  '5k3i5k4k5l5l7m7n7n8n7m7l' +
  '5k4i4j4j4k4k6m6m6m7m6l6l' +
  '4j3i5k4j5k5k6m6m7m7m6l6l' +
  '5j3i5k4j5k5l6m7m7m8n7m6l' +
  '5k3i5k4k5l5l7m7n7n8n7m7l' +
  '5k4i5k5k5l5l7n7n7n8n7m7m'
