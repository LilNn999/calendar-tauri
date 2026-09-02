import type { RecurringChangeScope } from './RecurringChangeDialog'

/** 循环任务按范围删除所需的最小 store 动作集 */
interface RecurringDeleteActions {
  skipOccurrence: (taskId: number, date: string) => Promise<void>
  deleteBeforeDate: (taskId: number, date: string) => Promise<void>
  deleteFromDate: (taskId: number, date: string) => Promise<void>
}

/**
 * 循环任务按范围删除的统一入口：
 * - this：仅跳过此日程
 * - before：此日程及此前所有（若覆盖序列末尾则整条任务进回收站）
 * - future：此日程及未来所有
 */
export function applyRecurringDelete(
  actions: RecurringDeleteActions,
  taskId: number,
  date: string,
  scope: RecurringChangeScope,
): Promise<void> {
  if (scope === 'this') return actions.skipOccurrence(taskId, date)
  if (scope === 'before') return actions.deleteBeforeDate(taskId, date)
  return actions.deleteFromDate(taskId, date)
}
