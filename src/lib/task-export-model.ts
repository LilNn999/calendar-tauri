import { addDays, format, isAfter, parseISO } from "date-fns";
import type { Priority, RecurrenceType, Project } from "@shared/types";
import type { TaskListRaw } from "./db";
import { matchesRecurrence } from "@/lib/task-recurrence";

/**
 * 未完成任务导出的统一选择器。
 *
 * 只做纯计算：输入数据库原始快照与选项，输出脱离实体引用的导出快照。
 * SQLite 与浏览器内存实现共用这一份规则，导出不修改任何数据库状态。
 */

export interface TaskExportOptions {
  includeRecurring: boolean;
}

export type TaskExportRaw = TaskListRaw & {
  capturedAt: string;
  today: string;
  projects: Project[];
};

export interface TaskExportItem {
  key: string;
  taskId: number;
  projectId: number;
  projectName: string;
  title: string;
  priority: Priority;
  dueDate: string;
  notes: string | null;
  recurrenceType: RecurrenceType | null;
  isOverdue: boolean;
  subtasks: Array<{
    id: number;
    title: string;
    sortOrder: number;
    isCompleted: boolean;
  }>;
}

export interface TaskExportSnapshot {
  capturedAt: string;
  today: string;
  includeRecurring: boolean;
  tasks: TaskExportItem[];
  summary: {
    taskCount: number;
    subtaskCount: number;
    completedSubtaskCount: number;
  };
}

/** 交给桌面原生保存的请求：字段名与 Rust 侧 serde camelCase 一致。 */
export interface TaskPdfRequest {
  html: string;
  defaultFileName: string;
}

/** 原生保存结果：只有真正写入磁盘才会得到 saved。 */
export type TaskPdfResult =
  | { status: "saved"; path: string }
  | { status: "cancelled" };

/**
 * 无结束日期的循环任务搜索上界。
 *
 * 62 天覆盖“月循环 31 日在 30 天月份跳过后”的下一次有效日期，
 * 因此不需要展开无限未来，也不会漏掉下一个月度候选。
 */
const MAX_RECURRENCE_SEARCH_DAYS = 62;

/** 优先级排序权重：高 → 中 → 低 → 无。 */
const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2, none: 3 };

/** 严格校验 YYYY-MM-DD；date-fns 的 parseISO 对越界日期会自动进位，不能直接采用。 */
function parseStrictDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = parseISO(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return format(parsed, "yyyy-MM-dd") === value ? parsed : null;
}

function requireDate(value: string, label: string): Date {
  const parsed = parseStrictDate(value);
  if (!parsed) throw new Error(`${label}不是有效日期：${value}`);
  return parsed;
}

/**
 * 找出该循环任务的下一次有效发生；找不到有效发生（已结束/全部完成或跳过）时返回 null。
 *
 * 搜索上界取 max(今天, 开始日期) + 62 天：合法循环下一次有效日期与“今天或开始日期”的间隔
 * 不会超过这个窗口（月循环 31 日遇到 30 天月份会顺延到再下一个月）。已记录的历史状态不会
 * 让窗口变窄，因为窗口起点本身就是今天或更晚。
 */
function nextRecurrenceDate(task: {
  dueDate: string;
  recurrenceType: string;
  recurrenceEnd: string | null;
  id: number;
}, today: Date, occurrenceMap: Map<string, { isCompleted: boolean; isFailed: boolean; isSkipped: boolean }>): string | null {
  const start = requireDate(task.dueDate, "循环任务开始日期");
  // 起点是今天或任务开始日期中较晚的一个。
  const from = isAfter(start, today) ? start : today;
  let cursor = from;
  const end = task.recurrenceEnd ? requireDate(task.recurrenceEnd, "循环任务结束日期") : null;
  if (end && isAfter(cursor, end)) return null;
  const bound = addDays(from, MAX_RECURRENCE_SEARCH_DAYS);

  while (!isAfter(cursor, bound)) {
    // 结束日期是包含边界，恰好等于结束日期的发生仍然有效。
    if (end && isAfter(cursor, end)) return null;
    if (matchesRecurrence(cursor, start, task.recurrenceType)) {
      const dateStr = format(cursor, "yyyy-MM-dd");
      const state = occurrenceMap.get(`${task.id}:${dateStr}`);
      const isCompleted = state?.isCompleted ?? false;
      const isFailed = state?.isFailed ?? false;
      const isSkipped = state?.isSkipped ?? false;
      if (!isCompleted && !isFailed && !isSkipped) return dateStr;
    }
    cursor = addDays(cursor, 1);
  }
  return null;
}

/**
 * 生成导出快照。
 *
 * - 普通任务：未软删除且未完成即纳入，逾期与失败都不排除，且不受日期范围限制；
 * - 母任务已完成或已软删除：不导出，其子任务也不作为独立任务导出；
 * - 循环任务：只有 includeRecurring 为真时才可能纳入，每条循环母任务只保留一个最近的有效发生；
 * - 子任务：只要母任务纳入就全部保留，读取所选发生日期的真实完成状态；
 * - 输出不引用原始实体，任何字段都不会写回 raw。
 */
export function buildTaskExportSnapshot(
  raw: TaskExportRaw,
  options: TaskExportOptions,
): TaskExportSnapshot {
  if (typeof options.includeRecurring !== "boolean") {
    throw new Error("导出选项 includeRecurring 必须是布尔值");
  }
  const today = requireDate(raw.today, "快照日期");
  const occurrenceMap = new Map(
    raw.occurrences.map((occurrence) => [
      `${occurrence.taskId}:${occurrence.date}`,
      {
        isCompleted: Boolean(occurrence.isCompleted),
        isFailed: Boolean(occurrence.isFailed),
        isSkipped: Boolean(occurrence.isSkipped),
      },
    ]),
  );
  const subtasksByTask = new Map<number, TaskListRaw["subtasks"]>();
  for (const subtask of raw.subtasks) {
    const list = subtasksByTask.get(subtask.taskId) ?? [];
    list.push(subtask);
    subtasksByTask.set(subtask.taskId, list);
  }
  const subtaskOccurrenceMap = new Map(
    raw.subtaskOccurrences.map((occurrence) => [
      `${occurrence.subtaskId}:${occurrence.date}`,
      Boolean(occurrence.isCompleted),
    ]),
  );
  const projectNames = new Map(raw.projects.map((project) => [project.id, project.name]));
  const createdAtById = new Map(raw.tasks.map((task) => [task.id, task.createdAt]));

  const items: TaskExportItem[] = [];
  for (const task of raw.tasks) {
    if (task.deletedAt) continue;

    let dueDate = task.dueDate;
    if (task.recurrenceType) {
      // 不勾选循环任务时，整个循环母子组都不出现。
      if (!options.includeRecurring) continue;
      // 模板的 isCompleted / isFailed 只代表某一次记录，不代表整个序列；
      // 具体是否纳入完全由所选发生日期在 task_occurrences 中的状态决定。
      const selected = nextRecurrenceDate(
        {
          id: task.id,
          dueDate: task.dueDate,
          recurrenceType: task.recurrenceType,
          recurrenceEnd: task.recurrenceEnd ?? null,
        },
        today,
        occurrenceMap,
      );
      // 已结束或找不到有效发生的循环任务不导出。
      if (!selected) continue;
      dueDate = selected;
    } else if (task.isCompleted) {
      // 普通母任务已完成即不导出，其子任务也不作为独立任务导出。
      continue;
    }

    const occurrence = occurrenceMap.get(`${task.id}:${dueDate}`);
    const isFailed = task.recurrenceType ? occurrence?.isFailed ?? false : Boolean(task.isFailed);
    if (occurrence?.isCompleted) continue;

    const due = requireDate(dueDate, "任务日期");
    // 母任务完成时子任务展示层联动划掉；导出读取的是所选日期的真实记录。
    const subtasks = (subtasksByTask.get(task.id) ?? [])
      .map((subtask) => ({
        id: subtask.id,
        title: subtask.title,
        sortOrder: subtask.sortOrder,
        isCompleted: (subtaskOccurrenceMap.get(`${subtask.id}:${dueDate}`) ?? false),
      }))
      .sort((a, b) => (a.sortOrder - b.sortOrder) || (a.id - b.id));

    items.push({
      key: `${task.id}:${dueDate}`,
      taskId: task.id,
      projectId: task.projectId,
      // 项目缺失时不静默丢任务，用可读占位名表示。
      projectName: projectNames.get(task.projectId) ?? `项目 #${task.projectId}`,
      title: task.title,
      priority: task.priority,
      dueDate,
      notes: task.notes ?? null,
      recurrenceType: (task.recurrenceType as RecurrenceType | null) ?? null,
      isOverdue: isAfter(today, due) && !isFailed,
      subtasks,
    });
  }

  items.sort((a, b) => {
    if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
    const priority = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (priority !== 0) return priority;
    const aCreated = createdAtById.get(a.taskId) ?? "";
    const bCreated = createdAtById.get(b.taskId) ?? "";
    if (aCreated !== bCreated) return aCreated < bCreated ? -1 : 1;
    return a.taskId - b.taskId;
  });

  const subtaskCount = items.reduce((total, item) => total + item.subtasks.length, 0);
  const completedSubtaskCount = items.reduce(
    (total, item) => total + item.subtasks.filter((subtask) => subtask.isCompleted).length,
    0,
  );

  return {
    capturedAt: raw.capturedAt,
    today: raw.today,
    includeRecurring: options.includeRecurring,
    tasks: items,
    summary: { taskCount: items.length, subtaskCount, completedSubtaskCount },
  };
}
