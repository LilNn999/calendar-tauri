import { parseISO } from "date-fns";

/**
 * 循环任务的日期匹配规则。
 *
 * 从 db.ts 原样提取，行为保持不变（月循环按“日”匹配，不存在该日期的月份直接跳过，
 * 不做月底补齐）。db.ts 继续从这里导入并重新导出，避免既有导入入口失效。
 */
export function matchesRecurrence(date: Date, startDate: Date, type: string): boolean {
  const dow = date.getDay();
  switch (type) {
    case "daily": return true;
    case "weekday": return dow >= 1 && dow <= 5;
    case "weekend": return dow === 0 || dow === 6;
    case "weekly": return date.getDay() === startDate.getDay();
    case "monthly": return date.getDate() === startDate.getDate();
    default: return false;
  }
}

/** 与 db.ts 展开逻辑相同的日期解析入口，避免两处解析方式分叉。 */
export function parseRecurrenceDate(value: string): Date {
  return parseISO(value);
}
