import { format } from "date-fns";
import { DEFAULT_PROJECT_ID, DEFAULT_PROJECT_NAME } from "@/lib/projects";
import type { Priority, Project, Subtask, Task } from "@shared/types";
import type { SubtaskOccurrenceRow, TaskOccurrenceRow } from "./db";
import type { TaskExportOptions, TaskExportRaw } from "./task-export-model";
import { validateTaskExportOptions } from "./task-export-model";

/**
 * 未完成任务导出的全量只读查询。
 *
 * 与 listTasks 的区别：
 * - 不调用 checkAndMarkFailed，导出不会写入 lastFailedCheckDate 或任何任务状态；
 * - 普通任务不限日期，按导出选项筛选项目，逾期与远期任务都在范围内；
 * - 用一条 SELECT + UNION ALL 读取任务、项目、子任务与发生记录，同一语句内数据一致，
 *   避免多语句之间被其它窗口改动造成母子状态错配；
 * - 只读取型接口，reader 仅需提供 select。
 */

/** SQL 读取接口：只暴露 select，导出路径不可能通过它写库。 */
export interface TaskExportSqlReader {
  select<T>(query: string, values?: unknown[]): Promise<T>;
}

/**
 * 候选任务集合：
 * - 普通任务：未软删除、未完成（逾期、失败都不排除），与 includeRecurring 无关；
 * - 循环模板：只有包含循环任务时才加入，且仍是未软删除、未完成的模板。
 *
 * 不做超长 IN 参数列表展开，也不生成多年日期实例；具体发生的选择交给纯选择器。
 */
const EXPORT_QUERY = `
WITH candidates AS (
  SELECT id, projectId, title, priority, dueDate, isCompleted, isFailed, completedAt,
         notes, recurrenceType, recurrenceEnd, createdAt, updatedAt
  FROM tasks
  WHERE deletedAt IS NULL AND isCompleted = 0
    AND (recurrenceType IS NULL OR ? = 1)
    AND (? IS NULL OR projectId = ?)
),
template_ids AS (
  SELECT id FROM candidates WHERE recurrenceType IS NOT NULL
),
scope_subtasks AS (
  SELECT s.id, s.taskId, s.title, s.sortOrder, s.createdAt, s.updatedAt
  FROM subtasks s JOIN candidates c ON c.id = s.taskId
)
SELECT kind, payload FROM (
  SELECT 1 AS kind,
         json_object(
           'id', id, 'projectId', projectId, 'title', title, 'priority', priority,
           'dueDate', dueDate, 'isCompleted', isCompleted, 'isFailed', isFailed,
           'completedAt', completedAt, 'notes', notes, 'recurrenceType', recurrenceType,
           'recurrenceEnd', recurrenceEnd, 'createdAt', createdAt, 'updatedAt', updatedAt
         ) AS payload
  FROM candidates
  UNION ALL
  SELECT 2, json_object('id', id, 'name', name) FROM projects
  UNION ALL
  SELECT 3,
         json_object(
           'id', id, 'taskId', taskId, 'title', title, 'sortOrder', sortOrder,
           'createdAt', createdAt, 'updatedAt', updatedAt
         )
  FROM scope_subtasks
  UNION ALL
  SELECT 4,
         json_object(
           'id', id, 'taskId', taskId, 'date', date, 'isCompleted', isCompleted,
           'isFailed', isFailed, 'isSkipped', isSkipped
         )
  FROM task_occurrences
  WHERE taskId IN (SELECT id FROM template_ids)
    AND date >= ?
    AND (isCompleted = 1 OR isFailed = 1 OR isSkipped = 1)
  UNION ALL
  SELECT 5,
         json_object(
           'id', id, 'subtaskId', subtaskId, 'date', date, 'isCompleted', isCompleted
         )
  FROM subtask_occurrences
  WHERE subtaskId IN (SELECT id FROM scope_subtasks) AND date >= ?
) ORDER BY kind`;
// 参数依次为：是否包含循环模板、项目范围（两次）、发生记录起始日期、子任务发生起始日期。

interface SqlJsonRow {
  kind: number;
  payload: string | null;
}

/** SQLite 的 0/1 规范化为布尔值。 */
function toBoolean(value: unknown): boolean {
  return Number(value) === 1;
}

function parsePayload(row: SqlJsonRow): Record<string, unknown> | null {
  if (typeof row.payload !== "string" || !row.payload) return null;
  const parsed: unknown = JSON.parse(row.payload);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  return parsed as Record<string, unknown>;
}

function mapTask(payload: Record<string, unknown>): Task {
  return {
    id: Number(payload.id),
    projectId: Number(payload.projectId),
    title: String(payload.title ?? ""),
    priority: (payload.priority ?? "none") as Priority,
    dueDate: String(payload.dueDate ?? ""),
    isCompleted: toBoolean(payload.isCompleted),
    isFailed: toBoolean(payload.isFailed),
    completedAt: payload.completedAt === null || payload.completedAt === undefined ? null : String(payload.completedAt),
    notes: payload.notes === null || payload.notes === undefined ? null : String(payload.notes),
    recurrenceType: (payload.recurrenceType ?? null) as Task["recurrenceType"],
    recurrenceEnd: payload.recurrenceEnd === null || payload.recurrenceEnd === undefined ? null : String(payload.recurrenceEnd),
    deletedAt: null,
    createdAt: String(payload.createdAt ?? ""),
    updatedAt: String(payload.updatedAt ?? ""),
  };
}

function mapSubtask(payload: Record<string, unknown>): Subtask {
  return {
    id: Number(payload.id),
    taskId: Number(payload.taskId),
    title: String(payload.title ?? ""),
    sortOrder: Number(payload.sortOrder ?? 0),
    createdAt: String(payload.createdAt ?? ""),
    updatedAt: String(payload.updatedAt ?? ""),
  };
}

/**
 * 读取导出所需的原始快照。
 *
 * `capturedAt` 只在这里取一次时间，快照的 capturedAt 与 today 都来自它，
 * 保证预览与 PDF 使用同一组“生成时间/今天”。
 */
export async function readTaskExportRaw(
  reader: TaskExportSqlReader,
  options: TaskExportOptions,
  capturedAt: Date,
): Promise<TaskExportRaw> {
  validateTaskExportOptions(options);
  const today = format(capturedAt, "yyyy-MM-dd");
  const includeRecurring = options.includeRecurring ? 1 : 0;
  const rows = await reader.select<SqlJsonRow[]>(EXPORT_QUERY, [
    includeRecurring,
    options.projectId ?? null,
    options.projectId ?? null,
    today,
    today,
  ]);

  const tasks: Task[] = [];
  const projects: Project[] = [];
  const subtasks: Subtask[] = [];
  const occurrences: TaskOccurrenceRow[] = [];
  const subtaskOccurrences: SubtaskOccurrenceRow[] = [];

  for (const row of rows) {
    const payload = parsePayload(row);
    if (!payload) continue;
    switch (Number(row.kind)) {
      case 1:
        tasks.push(mapTask(payload));
        break;
      case 2:
        projects.push({
          id: Number(payload.id),
          name: String(payload.name ?? ""),
          createdAt: "",
        });
        break;
      case 3:
        subtasks.push(mapSubtask(payload));
        break;
      case 4:
        occurrences.push({
          id: Number(payload.id),
          taskId: Number(payload.taskId),
          date: String(payload.date ?? ""),
          isCompleted: toBoolean(payload.isCompleted),
          isFailed: toBoolean(payload.isFailed),
          isSkipped: toBoolean(payload.isSkipped),
        });
        break;
      case 5:
        subtaskOccurrences.push({
          id: Number(payload.id),
          subtaskId: Number(payload.subtaskId),
          date: String(payload.date ?? ""),
          isCompleted: toBoolean(payload.isCompleted),
        });
        break;
      default:
        break;
    }
  }

  // 项目缺失时补上默认项目，保证选择器能给出可读的项目名而不是丢失任务。
  if (!projects.some((project) => project.id === DEFAULT_PROJECT_ID)) {
    projects.push({ id: DEFAULT_PROJECT_ID, name: DEFAULT_PROJECT_NAME, createdAt: "" });
  }

  return {
    tasks,
    occurrences,
    subtasks,
    subtaskOccurrences,
    capturedAt: capturedAt.toISOString(),
    today,
    projects,
  };
}
