import Database from "@tauri-apps/plugin-sql";
import {
  eachDayOfInterval, format, isAfter, isBefore,
  parseISO, subDays,
} from "date-fns";
import type {
  CheckinDefinition, CheckinEntry, CreateCheckinDefPayload, CreateTaskPayload,
  DailyNote, Priority, RecurrenceType, StreakData, Subtask, Task,
  TimeRange, TrendPoint, UpdateTaskPayload, UpsertCheckinEntryPayload,
} from "@/shared/types";

export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export interface TaskListItem extends Task {
  isRecurring?: boolean;
  subtasks: (Subtask & { isCompleted: boolean })[];
}

export interface TaskOccurrenceRow {
  id: number;
  taskId: number;
  date: string;
  isCompleted: boolean;
  isFailed: boolean;
  isSkipped: boolean;
}

export interface SubtaskOccurrenceRow {
  id: number;
  subtaskId: number;
  date: string;
  isCompleted: boolean;
}

export interface TaskListRaw {
  tasks: Task[];
  occurrences: TaskOccurrenceRow[];
  subtasks: Subtask[];
  subtaskOccurrences: SubtaskOccurrenceRow[];
}

function nowIso(): string {
  return new Date().toISOString();
}

function todayStr(): string {
  return format(new Date(), "yyyy-MM-dd");
}

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

function expandRecurringTasks(
  tasks: Task[],
  occurrenceMap: Map<string, { isCompleted: boolean; isFailed: boolean; isSkipped: boolean }>,
  rangeStart: string,
  rangeEnd: string,
): Task[] {
  const result: Task[] = [];
  const today = todayStr();
  for (const task of tasks) {
    if (!task.recurrenceType) {
      result.push(task);
      continue;
    }
    const start = parseISO(task.dueDate);
    const end = task.recurrenceEnd ? parseISO(task.recurrenceEnd) : null;
    const rangeFrom = parseISO(rangeStart);
    const rangeTo = parseISO(rangeEnd);
    const expandFrom = isAfter(start, rangeFrom) ? start : rangeFrom;
    const expandTo = end && isBefore(end, rangeTo) ? end : rangeTo;
    if (isAfter(expandFrom, expandTo)) continue;
    for (const day of eachDayOfInterval({ start: expandFrom, end: expandTo })) {
      if (!matchesRecurrence(day, start, task.recurrenceType)) continue;
      const dateStr = format(day, "yyyy-MM-dd");
      const occ = occurrenceMap.get(`${task.id}:${dateStr}`);
      if (occ?.isSkipped) continue;
      result.push({
        ...task,
        dueDate: dateStr,
        isCompleted: occ?.isCompleted ?? false,
        isFailed: occ?.isFailed ?? (dateStr < today && !occ?.isCompleted),
        isRecurring: true,
      });
    }
  }
  return result;
}
function buildTaskList(raw: TaskListRaw, rangeStart: string, rangeEnd: string): TaskListItem[] {
  const occurrenceMap = new Map(raw.occurrences.map((o) => [`${o.taskId}:${o.date}`, { isCompleted: o.isCompleted, isFailed: o.isFailed, isSkipped: o.isSkipped }]));
  const subtasksByTask = new Map<number, Subtask[]>();
  for (const s of raw.subtasks) {
    const list = subtasksByTask.get(s.taskId) ?? [];
    list.push(s);
    subtasksByTask.set(s.taskId, list);
  }
  const subtaskOccMap = new Map(raw.subtaskOccurrences.map((o) => [`${o.subtaskId}:${o.date}`, o.isCompleted]));
  return expandRecurringTasks(raw.tasks, occurrenceMap, rangeStart, rangeEnd).map((t) => ({
    ...t,
    subtasks: (subtasksByTask.get(t.id) ?? []).map((s) => ({ ...s, isCompleted: subtaskOccMap.get(`${s.id}:${t.dueDate}`) ?? false })),
  }));
}

export function getDateRange(range: TimeRange): { start: string; end: string } {
  const now = new Date();
  const today = format(now, "yyyy-MM-dd");
  switch (range) {
    case "week": {
      const dow = now.getDay();
      const daysSinceMon = dow === 0 ? 6 : dow - 1;
      const monday = new Date(now);
      monday.setDate(now.getDate() - daysSinceMon);
      return { start: format(monday, "yyyy-MM-dd"), end: today };
    }
    case "month": {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: format(first, "yyyy-MM-dd"), end: today };
    }
    case "quarter": {
      const m = now.getMonth() - 2;
      const y = now.getFullYear() + (m < 0 ? -1 : 0);
      const first = new Date(y, ((m % 12) + 12) % 12, 1);
      return { start: format(first, "yyyy-MM-dd"), end: today };
    }
    case "year": {
      const first = new Date(now.getFullYear(), 0, 1);
      return { start: format(first, "yyyy-MM-dd"), end: today };
    }
  }
}

function expandRecurringStats(
  task: { id: number; dueDate: string; recurrenceType: string | null; recurrenceEnd: string | null },
  occMap: Map<string, { isCompleted: boolean; isFailed: boolean; isSkipped: boolean }>,
  rangeStart: string,
  rangeEnd: string,
  today: string,
): Array<{ date: string; isCompleted: boolean; isFailed: boolean }> {
  const result: Array<{ date: string; isCompleted: boolean; isFailed: boolean }> = [];
  if (!task.recurrenceType) return result;
  const taskStart = parseISO(task.dueDate);
  const taskEnd = task.recurrenceEnd ? parseISO(task.recurrenceEnd) : null;
  const from = parseISO(rangeStart);
  const to = parseISO(rangeEnd);
  const expandFrom = isAfter(taskStart, from) ? taskStart : from;
  const expandTo = taskEnd && isBefore(taskEnd, to) ? taskEnd : to;
  if (isAfter(expandFrom, expandTo)) return result;
  for (const day of eachDayOfInterval({ start: expandFrom, end: expandTo })) {
    if (!matchesRecurrence(day, taskStart, task.recurrenceType)) continue;
    const dateStr = format(day, "yyyy-MM-dd");
    const occ = occMap.get(`${task.id}:${dateStr}`);
    if (occ?.isSkipped) continue;
    const isCompleted = occ?.isCompleted ?? false;
    const isFailed = occ?.isFailed ?? (dateStr < today && !isCompleted);
    result.push({ date: dateStr, isCompleted, isFailed });
  }
  return result;
}

export interface Db {
  listTasks(start: string, end: string): Promise<TaskListItem[]>;
  createTask(payload: CreateTaskPayload): Promise<Task>;
  updateTask(id: number, patch: UpdateTaskPayload): Promise<Task>;
  updateOccurrence(taskId: number, date: string, patch: { isCompleted?: boolean; isFailed?: boolean }): Promise<void>;
  deleteTask(id: number): Promise<void>;
  markFailed(ids: number[]): Promise<void>;
  skipOccurrence(taskId: number, date: string): Promise<void>;
  deleteFromDate(taskId: number, date: string): Promise<void>;
  detachOccurrence(taskId: number, date: string, patch: { title?: string; priority?: Priority; notes?: string }): Promise<Task | null>;
  splitFromDate(taskId: number, date: string, patch: { title?: string; priority?: Priority; notes?: string; recurrenceEnd?: string }): Promise<Task | null>;
  toggleSubtask(subtaskId: number, date: string, isCompleted: boolean): Promise<void>;
  updateSubtasks(taskId: number, items: { id?: number; title: string }[]): Promise<void>;
  listDeleted(): Promise<Task[]>;
  restore(id: number): Promise<Task>;
  purgeTrashed(id: number): Promise<void>;
  emptyTrash(): Promise<void>;
  listCheckinDefs(): Promise<CheckinDefinition[]>;
  createCheckinDef(payload: CreateCheckinDefPayload): Promise<CheckinDefinition>;
  updateCheckinDef(id: number, patch: Partial<CreateCheckinDefPayload>): Promise<CheckinDefinition>;
  archiveCheckinDef(id: number): Promise<void>;
  reorderCheckinDefs(orderedIds: number[]): Promise<void>;
  getCheckinEntries(start: string, end: string): Promise<CheckinEntry[]>;
  upsertCheckinEntry(payload: UpsertCheckinEntryPayload): Promise<CheckinEntry>;
  getNote(date: string): Promise<DailyNote | null>;
  upsertNote(date: string, content: string): Promise<DailyNote>;
  completion(range: TimeRange): Promise<import("@/shared/types").CompletionStats>;
  numericTrend(defId: number, range: TimeRange): Promise<TrendPoint[]>;
  streakSummary(): Promise<StreakData>;
  taskTrend(range: TimeRange): Promise<import("@/shared/types").TaskTrendStats[]>;
  listAchievements(): Promise<Array<{ id: number; key: string; title: string; description: string; icon: string; earned: boolean; earnedAt: string | null }>>;
  checkAndUnlockAchievements(): Promise<Array<{ id: number; key: string; title: string; description: string; icon: string; earned: boolean; earnedAt: string | null }>>;
  getSetting<T>(key: string, fallback: T): Promise<T>;
  setSetting(key: string, value: unknown): Promise<void>;
  dbInfo(): string;
}

type SqlRow = Record<string, unknown>;

function mapTask(r: SqlRow): Task {
  return {
    id: r.id as number,
    title: r.title as string,
    priority: r.priority as Priority,
    dueDate: r.dueDate as string,
    isCompleted: Boolean(r.isCompleted),
    isFailed: Boolean(r.isFailed),
    completedAt: (r.completedAt as string) ?? null,
    notes: (r.notes as string) ?? null,
    recurrenceType: (r.recurrenceType as RecurrenceType) ?? null,
    recurrenceEnd: (r.recurrenceEnd as string) ?? null,
    deletedAt: (r.deletedAt as string) ?? null,
    createdAt: r.createdAt as string,
    updatedAt: r.updatedAt as string,
  };
}

function mapDef(r: SqlRow): CheckinDefinition {
  return {
    id: r.id as number,
    name: r.name as string,
    type: r.type as CheckinDefinition["type"],
    unit: (r.unit as string) ?? null,
    sortOrder: r.sortOrder as number,
    archivedAt: (r.archivedAt as string) ?? null,
    startDate: (r.startDate as string) ?? null,
    endDate: (r.endDate as string) ?? null,
    frequency: (r.frequency as CheckinDefinition["frequency"]) ?? null,
    createdAt: r.createdAt as string,
  };
}

function mapEntry(r: SqlRow): CheckinEntry {
  return { id: r.id as number, definitionId: r.definitionId as number, entryDate: r.entryDate as string, value: r.value as string, updatedAt: r.updatedAt as string };
}

function mapNote(r: SqlRow): DailyNote {
  return { id: r.id as number, noteDate: r.noteDate as string, content: (r.content as string) ?? "", updatedAt: r.updatedAt as string };
}

function mapSubtaskRow(r: SqlRow): Subtask {
  return { id: r.id as number, taskId: r.taskId as number, title: r.title as string, sortOrder: r.sortOrder as number, createdAt: r.createdAt as string, updatedAt: r.updatedAt as string };
}

function computeStreakFrom(tasks: Pick<Task, "dueDate" | "isCompleted" | "isFailed">[]): StreakData {
  if (tasks.length === 0) return { currentStreak: 0, longestStreak: 0, lastCheckDate: null };
  const byDate: Record<string, { total: number; completed: number }> = {};
  for (const t of tasks) {
    if (!byDate[t.dueDate]) byDate[t.dueDate] = { total: 0, completed: 0 };
    byDate[t.dueDate].total++;
    if (t.isCompleted) byDate[t.dueDate].completed++;
  }
  const perfectDays = new Set(Object.entries(byDate).filter(([, v]) => v.total > 0 && v.completed === v.total).map(([d]) => d));
  let currentStreak = 0;
  let checkDate = todayStr();
  while (perfectDays.has(checkDate)) {
    currentStreak++;
    checkDate = format(subDays(parseISO(checkDate), 1), "yyyy-MM-dd");
  }
  const sortedDays = [...perfectDays].sort();
  let longestStreak = 0;
  let runLength = 0;
  let prevDate: string | null = null;
  for (const d of sortedDays) {
    if (prevDate && format(subDays(parseISO(d), 1), "yyyy-MM-dd") === prevDate) runLength++;
    else runLength = 1;
    longestStreak = Math.max(longestStreak, runLength);
    prevDate = d;
  }
  return { currentStreak, longestStreak, lastCheckDate: sortedDays[sortedDays.length - 1] ?? null };
}

class SqliteDb implements Db {
  private db!: Database;
  private inited = false;

  async connect() {
    if (this.inited) return;
    this.db = await Database.load("sqlite:calendar.db");
    // 双窗口同时初始化时避免锁库
    await this.db.execute("PRAGMA busy_timeout = 5000");
    await this.migrate();
    this.inited = true;
  }

  private async migrate() {
    const rows = await this.db.select<{ user_version: number }[]>("PRAGMA user_version");
    const version = rows[0]?.user_version ?? 0;
    if (version >= 1) return;
    const sql = `
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        priority TEXT NOT NULL DEFAULT 'none',
        dueDate TEXT NOT NULL,
        isCompleted INTEGER NOT NULL DEFAULT 0,
        isFailed INTEGER NOT NULL DEFAULT 0,
        completedAt TEXT,
        notes TEXT,
        recurrenceType TEXT,
        recurrenceEnd TEXT,
        deletedAt TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_tasks_dueDate ON tasks(dueDate);
      CREATE TABLE IF NOT EXISTS task_occurrences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        taskId INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        isCompleted INTEGER NOT NULL DEFAULT 0,
        isFailed INTEGER NOT NULL DEFAULT 0,
        isSkipped INTEGER NOT NULL DEFAULT 0,
        UNIQUE(taskId, date)
      );
      CREATE TABLE IF NOT EXISTS subtasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        taskId INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        sortOrder INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_subtasks_taskId ON subtasks(taskId);
      CREATE TABLE IF NOT EXISTS subtask_occurrences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subtaskId INTEGER NOT NULL REFERENCES subtasks(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        isCompleted INTEGER NOT NULL DEFAULT 0,
        UNIQUE(subtaskId, date)
      );
      CREATE TABLE IF NOT EXISTS checkin_definitions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'boolean',
        unit TEXT,
        sortOrder INTEGER NOT NULL DEFAULT 0,
        archivedAt TEXT,
        startDate TEXT,
        endDate TEXT,
        frequency TEXT DEFAULT 'daily',
        createdAt TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS checkin_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        definitionId INTEGER NOT NULL REFERENCES checkin_definitions(id) ON DELETE CASCADE,
        entryDate TEXT NOT NULL,
        value TEXT NOT NULL DEFAULT '',
        updatedAt TEXT NOT NULL,
        UNIQUE(definitionId, entryDate)
      );
      CREATE TABLE IF NOT EXISTS daily_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        noteDate TEXT NOT NULL UNIQUE,
        content TEXT NOT NULL DEFAULT '',
        updatedAt TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS achievement_definitions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        icon TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS earned_achievements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        definitionId INTEGER NOT NULL UNIQUE REFERENCES achievement_definitions(id) ON DELETE CASCADE,
        earnedAt TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `;
    await this.db.execute(sql);
    await this.db.execute("PRAGMA user_version = 1");
    await this.seedAchievements();
  }

  private async seedAchievements() {
    const { ACHIEVEMENT_SEEDS } = await import("@/shared/constants");
    for (const seed of ACHIEVEMENT_SEEDS) {
      await this.db.execute(
        "INSERT OR IGNORE INTO achievement_definitions (key, title, description, icon) VALUES (?, ?, ?, ?)",
        [seed.key, seed.title, seed.description, seed.icon],
      );
    }
  }

  private async listRaw(start: string, end: string): Promise<TaskListRaw> {
    const taskRows = await this.db.select<SqlRow[]>(
      `SELECT * FROM tasks
       WHERE deletedAt IS NULL AND (
         (recurrenceType IS NULL AND dueDate >= ? AND dueDate <= ?)
         OR (recurrenceType IS NOT NULL AND dueDate <= ? AND (recurrenceEnd IS NULL OR recurrenceEnd >= ?))
       )
       ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 WHEN 'low' THEN 2 ELSE 3 END, createdAt ASC`,
      [start, end, end, start],
    );
    const tasks = taskRows.map(mapTask);
    const recurringIds = tasks.filter((t) => t.recurrenceType).map((t) => t.id);
    let occurrences: TaskOccurrenceRow[] = [];
    if (recurringIds.length) {
      const ph = recurringIds.map(() => "?").join(",");
      const occRows = await this.db.select<SqlRow[]>(
        `SELECT * FROM task_occurrences WHERE taskId IN (${ph}) AND date >= ? AND date <= ?`,
        [...recurringIds, start, end],
      );
      occurrences = occRows.map((r) => ({ id: r.id as number, taskId: r.taskId as number, date: r.date as string, isCompleted: Boolean(r.isCompleted), isFailed: Boolean(r.isFailed), isSkipped: Boolean(r.isSkipped) }));
    }
    let subtasks: Subtask[] = [];
    let subtaskOccurrences: SubtaskOccurrenceRow[] = [];
    if (tasks.length) {
      const ph = tasks.map(() => "?").join(",");
      const stRows = await this.db.select<SqlRow[]>(`SELECT * FROM subtasks WHERE taskId IN (${ph}) ORDER BY sortOrder ASC`, tasks.map((t) => t.id));
      subtasks = stRows.map(mapSubtaskRow);
      const stIds = subtasks.map((s) => s.id);
      if (stIds.length) {
        const ph2 = stIds.map(() => "?").join(",");
        const soRows = await this.db.select<SqlRow[]>(`SELECT * FROM subtask_occurrences WHERE subtaskId IN (${ph2}) AND date >= ? AND date <= ?`, [...stIds, start, end]);
        subtaskOccurrences = soRows.map((r) => ({ id: r.id as number, subtaskId: r.subtaskId as number, date: r.date as string, isCompleted: Boolean(r.isCompleted) }));
      }
    }
    return { tasks, occurrences, subtasks, subtaskOccurrences };
  }

  private async checkAndMarkFailed() {
    const last = await this.getSetting("lastFailedCheckDate", "");
    const today = todayStr();
    if (last === today) return;
    await this.db.execute(`UPDATE tasks SET isFailed = 1, updatedAt = ? WHERE dueDate < ? AND isCompleted = 0 AND isFailed = 0`, [nowIso(), today]);
    await this.setSetting("lastFailedCheckDate", today);
  }

  async listTasks(start: string, end: string): Promise<TaskListItem[]> {
    await this.checkAndMarkFailed();
    const raw = await this.listRaw(start, end);
    return buildTaskList(raw, start, end);
  }

  async createTask(payload: CreateTaskPayload): Promise<Task> {
    const ts = nowIso();
    const today = todayStr();
    const isHistoricalFailed = !payload.recurrenceType && payload.dueDate < today;
    const result = await this.db.execute(
      `INSERT INTO tasks (title, priority, dueDate, notes, recurrenceType, recurrenceEnd, isCompleted, isFailed, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
      [payload.title, payload.priority ?? "none", payload.dueDate, payload.notes ?? null, payload.recurrenceType ?? null, payload.recurrenceEnd ?? null, isHistoricalFailed ? 1 : 0, ts, ts],
    );
    const id = result.lastInsertId!;
    if (payload.subtasks?.length) {
      for (let i = 0; i < payload.subtasks.length; i++) {
        await this.db.execute(`INSERT INTO subtasks (taskId, title, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)`, [id, payload.subtasks[i], i, ts, ts]);
      }
    }
    return (await this.getTaskById(id))!;
  }

  private async getTaskById(id: number): Promise<Task | null> {
    const rows = await this.db.select<SqlRow[]>("SELECT * FROM tasks WHERE id = ?", [id]);
    return rows.length ? mapTask(rows[0]) : null;
  }

  async updateTask(id: number, patch: UpdateTaskPayload): Promise<Task> {
    const { occurrenceDate: _occ, ...rest } = patch;
    if (rest.recurrenceEnd !== undefined) {
      const existing = await this.getTaskById(id);
      if (existing?.recurrenceType && rest.recurrenceEnd) {
        await this.db.execute(`DELETE FROM task_occurrences WHERE taskId = ? AND date > ?`, [id, rest.recurrenceEnd]);
      }
    }
    const sets: string[] = [];
    const params: unknown[] = [];
    type TaskPatchKey = Exclude<keyof UpdateTaskPayload, "occurrenceDate">;
    const allow: TaskPatchKey[] = ["title", "priority", "dueDate", "isCompleted", "isFailed", "notes", "recurrenceType", "recurrenceEnd"];
    for (const key of allow) {
      if (rest[key] !== undefined) {
        sets.push(`${key} = ?`);
        params.push(typeof rest[key] === "boolean" ? (rest[key] ? 1 : 0) : rest[key]);
      }
    }
    if (rest.isCompleted) {
      sets.push("completedAt = ?");
      params.push(nowIso());
    }
    sets.push("updatedAt = ?");
    params.push(nowIso());
    params.push(id);
    await this.db.execute(`UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`, params);
    return (await this.getTaskById(id))!;
  }

  async updateOccurrence(taskId: number, date: string, patch: { isCompleted?: boolean; isFailed?: boolean }): Promise<void> {
    await this.db.execute(
      `INSERT INTO task_occurrences (taskId, date, isCompleted, isFailed, isSkipped) VALUES (?, ?, ?, ?, 0)
       ON CONFLICT(taskId, date) DO UPDATE SET isCompleted = COALESCE(?, isCompleted), isFailed = COALESCE(?, isFailed)`,
      [taskId, date, patch.isCompleted ? 1 : 0, patch.isFailed ? 1 : 0, patch.isCompleted === undefined ? null : (patch.isCompleted ? 1 : 0), patch.isFailed === undefined ? null : (patch.isFailed ? 1 : 0)],
    );
  }

  async deleteTask(id: number): Promise<void> {
    await this.db.execute(`UPDATE tasks SET deletedAt = ?, updatedAt = ? WHERE id = ?`, [nowIso(), nowIso(), id]);
  }

  async markFailed(ids: number[]): Promise<void> {
    if (!ids.length) return;
    const ph = ids.map(() => "?").join(",");
    await this.db.execute(`UPDATE tasks SET isFailed = 1, updatedAt = ? WHERE id IN (${ph})`, [nowIso(), ...ids]);
  }

  async skipOccurrence(taskId: number, date: string): Promise<void> {
    await this.db.execute(
      `INSERT INTO task_occurrences (taskId, date, isCompleted, isFailed, isSkipped) VALUES (?, ?, 0, 0, 1)
       ON CONFLICT(taskId, date) DO UPDATE SET isSkipped = 1`,
      [taskId, date],
    );
  }

  async deleteFromDate(taskId: number, date: string): Promise<void> {
    const task = await this.getTaskById(taskId);
    if (!task) return;
    const prevDay = format(subDays(parseISO(date), 1), "yyyy-MM-dd");
    if (date <= task.dueDate) {
      await this.deleteTask(taskId);
    } else {
      await this.db.execute(`UPDATE tasks SET recurrenceEnd = ?, updatedAt = ? WHERE id = ?`, [prevDay, nowIso(), taskId]);
      await this.db.execute(`DELETE FROM task_occurrences WHERE taskId = ? AND date >= ?`, [taskId, date]);
    }
  }

  async detachOccurrence(taskId: number, date: string, patch: { title?: string; priority?: Priority; notes?: string }): Promise<Task | null> {
    const task = await this.getTaskById(taskId);
    if (!task) return null;
    await this.skipOccurrence(taskId, date);
    return this.createTask({
      title: patch.title ?? task.title,
      priority: patch.priority ?? task.priority,
      dueDate: date,
      notes: patch.notes !== undefined ? patch.notes || undefined : task.notes ?? undefined,
    });
  }

  async splitFromDate(taskId: number, date: string, patch: { title?: string; priority?: Priority; notes?: string; recurrenceEnd?: string }): Promise<Task | null> {
    const task = await this.getTaskById(taskId);
    if (!task) return null;
    const prevDay = format(subDays(parseISO(date), 1), "yyyy-MM-dd");
    if (date <= task.dueDate) {
      return this.updateTask(taskId, {
        title: patch.title ?? task.title,
        priority: patch.priority ?? task.priority,
        notes: patch.notes !== undefined ? patch.notes || undefined : task.notes ?? undefined,
        recurrenceEnd: patch.recurrenceEnd !== undefined ? patch.recurrenceEnd || null : task.recurrenceEnd,
      });
    }
    const occRows = await this.db.select<SqlRow[]>(`SELECT * FROM task_occurrences WHERE taskId = ? AND date = ?`, [taskId, date]);
    const existingOcc = occRows[0];
    await this.db.execute(`UPDATE tasks SET recurrenceEnd = ?, updatedAt = ? WHERE id = ?`, [prevDay, nowIso(), taskId]);
    await this.db.execute(`DELETE FROM task_occurrences WHERE taskId = ? AND date >= ?`, [taskId, date]);
    const newRecurrenceEnd = patch.recurrenceEnd !== undefined ? patch.recurrenceEnd || null : task.recurrenceEnd;
    const newTask = await this.createTask({
      title: patch.title ?? task.title,
      priority: patch.priority ?? task.priority,
      dueDate: date,
      notes: patch.notes !== undefined ? patch.notes || undefined : task.notes ?? undefined,
      recurrenceType: task.recurrenceType ?? undefined,
      recurrenceEnd: newRecurrenceEnd ?? undefined,
    });
    if (existingOcc && (existingOcc.isCompleted || existingOcc.isFailed || existingOcc.isSkipped)) {
      await this.db.execute(`INSERT INTO task_occurrences (taskId, date, isCompleted, isFailed, isSkipped) VALUES (?, ?, ?, ?, ?)`,
        [newTask.id, date, existingOcc.isCompleted ? 1 : 0, existingOcc.isFailed ? 1 : 0, existingOcc.isSkipped ? 1 : 0]);
    }
    return newTask;
  }

  async toggleSubtask(subtaskId: number, date: string, isCompleted: boolean): Promise<void> {
    await this.db.execute(
      `INSERT INTO subtask_occurrences (subtaskId, date, isCompleted) VALUES (?, ?, ?)
       ON CONFLICT(subtaskId, date) DO UPDATE SET isCompleted = ?`,
      [subtaskId, date, isCompleted ? 1 : 0, isCompleted ? 1 : 0],
    );
  }

  async updateSubtasks(taskId: number, items: { id?: number; title: string }[]): Promise<void> {
    const existingRows = await this.db.select<SqlRow[]>(`SELECT * FROM subtasks WHERE taskId = ?`, [taskId]);
    const existing = existingRows.map(mapSubtaskRow);
    const existingById = new Map(existing.map((s) => [s.id, s]));
    const incomingIds = new Set(items.filter((i) => i.id).map((i) => i.id!));
    for (const s of existing) {
      if (!incomingIds.has(s.id)) {
        await this.db.execute(`DELETE FROM subtask_occurrences WHERE subtaskId = ?`, [s.id]);
        await this.db.execute(`DELETE FROM subtasks WHERE id = ?`, [s.id]);
      }
    }
    const ts = nowIso();
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const title = item.title.trim();
      if (item.id && existingById.has(item.id)) {
        await this.db.execute(`UPDATE subtasks SET title = ?, sortOrder = ?, updatedAt = ? WHERE id = ?`, [title, i, ts, item.id]);
      } else if (title) {
        await this.db.execute(`INSERT INTO subtasks (taskId, title, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)`, [taskId, title, i, ts, ts]);
      }
    }
  }

  async listDeleted(): Promise<Task[]> {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const rows = await this.db.select<SqlRow[]>(`SELECT * FROM tasks WHERE deletedAt IS NOT NULL AND deletedAt >= ? ORDER BY deletedAt DESC`, [cutoff]);
    return rows.map(mapTask);
  }

  async restore(id: number): Promise<Task> {
    await this.db.execute(`UPDATE tasks SET deletedAt = NULL, updatedAt = ? WHERE id = ?`, [nowIso(), id]);
    return (await this.getTaskById(id))!;
  }

  async purgeTrashed(id: number): Promise<void> {
    await this.db.execute(`DELETE FROM task_occurrences WHERE taskId = ?`, [id]);
    const stRows = await this.db.select<SqlRow[]>(`SELECT id FROM subtasks WHERE taskId = ?`, [id]);
    for (const r of stRows) {
      await this.db.execute(`DELETE FROM subtask_occurrences WHERE subtaskId = ?`, [r.id]);
    }
    await this.db.execute(`DELETE FROM subtasks WHERE taskId = ?`, [id]);
    await this.db.execute(`DELETE FROM tasks WHERE id = ?`, [id]);
  }

  async emptyTrash(): Promise<void> {
    const rows = await this.db.select<SqlRow[]>(`SELECT id FROM tasks WHERE deletedAt IS NOT NULL`);
    for (const r of rows) await this.purgeTrashed(r.id as number);
  }

  async listCheckinDefs(): Promise<CheckinDefinition[]> {
    const rows = await this.db.select<SqlRow[]>(`SELECT * FROM checkin_definitions WHERE archivedAt IS NULL ORDER BY sortOrder ASC`);
    return rows.map(mapDef);
  }

  async createCheckinDef(payload: CreateCheckinDefPayload): Promise<CheckinDefinition> {
    const countRows = await this.db.select<{ c: number }[]>(`SELECT COUNT(*) AS c FROM checkin_definitions WHERE archivedAt IS NULL`);
    const ts = nowIso();
    const result = await this.db.execute(
      `INSERT INTO checkin_definitions (name, type, unit, sortOrder, startDate, endDate, frequency, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [payload.name, payload.type, payload.unit ?? null, countRows[0]?.c ?? 0, payload.startDate ?? null, payload.endDate ?? null, payload.frequency ?? "daily", ts],
    );
    const rows = await this.db.select<SqlRow[]>(`SELECT * FROM checkin_definitions WHERE id = ?`, [result.lastInsertId]);
    return mapDef(rows[0]);
  }

  async updateCheckinDef(id: number, patch: Partial<CreateCheckinDefPayload>): Promise<CheckinDefinition> {
    const sets: string[] = [];
    const params: unknown[] = [];
    for (const key of ["name", "type", "unit", "startDate", "endDate", "frequency"] as const) {
      if (patch[key] !== undefined) {
        sets.push(`${key} = ?`);
        params.push(patch[key]);
      }
    }
    params.push(id);
    await this.db.execute(`UPDATE checkin_definitions SET ${sets.join(", ")} WHERE id = ?`, params);
    const rows = await this.db.select<SqlRow[]>(`SELECT * FROM checkin_definitions WHERE id = ?`, [id]);
    return mapDef(rows[0]);
  }

  async archiveCheckinDef(id: number): Promise<void> {
    await this.db.execute(`UPDATE checkin_definitions SET archivedAt = ? WHERE id = ?`, [nowIso(), id]);
  }

  async reorderCheckinDefs(orderedIds: number[]): Promise<void> {
    for (let i = 0; i < orderedIds.length; i++) {
      await this.db.execute(`UPDATE checkin_definitions SET sortOrder = ? WHERE id = ?`, [i, orderedIds[i]]);
    }
  }

  async getCheckinEntries(start: string, end: string): Promise<CheckinEntry[]> {
    const rows = await this.db.select<SqlRow[]>(`SELECT * FROM checkin_entries WHERE entryDate >= ? AND entryDate <= ? ORDER BY entryDate ASC`, [start, end]);
    return rows.map(mapEntry);
  }

  async upsertCheckinEntry(payload: UpsertCheckinEntryPayload): Promise<CheckinEntry> {
    const ts = nowIso();
    await this.db.execute(
      `INSERT INTO checkin_entries (definitionId, entryDate, value, updatedAt) VALUES (?, ?, ?, ?)
       ON CONFLICT(definitionId, entryDate) DO UPDATE SET value = ?, updatedAt = ?`,
      [payload.definitionId, payload.entryDate, payload.value, ts, payload.value, ts],
    );
    const rows = await this.db.select<SqlRow[]>(`SELECT * FROM checkin_entries WHERE definitionId = ? AND entryDate = ?`, [payload.definitionId, payload.entryDate]);
    return mapEntry(rows[0]);
  }

  async getNote(date: string): Promise<DailyNote | null> {
    const rows = await this.db.select<SqlRow[]>(`SELECT * FROM daily_notes WHERE noteDate = ?`, [date]);
    return rows.length ? mapNote(rows[0]) : null;
  }

  async upsertNote(date: string, content: string): Promise<DailyNote> {
    const ts = nowIso();
    await this.db.execute(
      `INSERT INTO daily_notes (noteDate, content, updatedAt) VALUES (?, ?, ?)
       ON CONFLICT(noteDate) DO UPDATE SET content = ?, updatedAt = ?`,
      [date, content, ts, content, ts],
    );
    const rows = await this.db.select<SqlRow[]>(`SELECT * FROM daily_notes WHERE noteDate = ?`, [date]);
    return mapNote(rows[0]);
  }

  async completion(range: TimeRange): Promise<import("@/shared/types").CompletionStats> {
    const { start, end } = getDateRange(range);
    const today = todayStr();
    const nonRecurring = await this.db.select<SqlRow[]>(
      `SELECT dueDate, isCompleted, isFailed FROM tasks WHERE deletedAt IS NULL AND dueDate >= ? AND dueDate <= ? AND recurrenceType IS NULL`, [start, end]);
    const recurringRows = await this.db.select<SqlRow[]>(
      `SELECT * FROM tasks WHERE deletedAt IS NULL AND recurrenceType IS NOT NULL AND dueDate <= ? AND (recurrenceEnd IS NULL OR recurrenceEnd >= ?)`, [end, start]);
    const recurringTasks = recurringRows.map(mapTask);
    const recurringIds = recurringTasks.map((t) => t.id);
    let occurrences: TaskOccurrenceRow[] = [];
    if (recurringIds.length) {
      const ph = recurringIds.map(() => "?").join(",");
      const occRows = await this.db.select<SqlRow[]>(`SELECT * FROM task_occurrences WHERE taskId IN (${ph}) AND date >= ? AND date <= ?`, [...recurringIds, start, end]);
      occurrences = occRows.map((r) => ({ id: r.id as number, taskId: r.taskId as number, date: r.date as string, isCompleted: Boolean(r.isCompleted), isFailed: Boolean(r.isFailed), isSkipped: Boolean(r.isSkipped) }));
    }
    const occMap = new Map(occurrences.map((o) => [`${o.taskId}:${o.date}`, { isCompleted: o.isCompleted, isFailed: o.isFailed, isSkipped: o.isSkipped }]));
    const recurringItems = recurringTasks.flatMap((t) => expandRecurringStats(t, occMap, start, end, today));
    const all = [
      ...nonRecurring.map((r) => ({ date: r.dueDate as string, isCompleted: Boolean(r.isCompleted), isFailed: Boolean(r.isFailed) })),
      ...recurringItems,
    ];
    const dayMap: Record<string, { completed: number; failed: number; total: number }> = {};
    for (const d of eachDayOfInterval({ start: parseISO(start), end: parseISO(end) })) {
      dayMap[format(d, "yyyy-MM-dd")] = { completed: 0, failed: 0, total: 0 };
    }
    for (const item of all) {
      const bucket = dayMap[item.date];
      if (!bucket) continue;
      bucket.total++;
      if (item.isCompleted) bucket.completed++;
      else if (item.isFailed) bucket.failed++;
    }
    const byDay = Object.entries(dayMap).map(([date, v]) => ({ date, ...v, rate: v.total > 0 ? Math.round((v.completed / v.total) * 100) : 0 }));
    const overall = all.reduce(
      (acc, item) => {
        acc.total++;
        if (item.isCompleted) acc.completed++;
        else if (item.isFailed) acc.failed++;
        else acc.pending++;
        return acc;
      },
      { completed: 0, failed: 0, pending: 0, total: 0 },
    );
    return { overall: { ...overall, rate: overall.total > 0 ? Math.round((overall.completed / overall.total) * 100) : 0 }, byDay };
  }

  async numericTrend(defId: number, range: TimeRange): Promise<TrendPoint[]> {
    const { start, end } = getDateRange(range);
    const defRows = await this.db.select<SqlRow[]>(`SELECT type FROM checkin_definitions WHERE id = ?`, [defId]);
    const defType = defRows[0]?.type as string | undefined;
    const rows = await this.db.select<SqlRow[]>(`SELECT entryDate, value FROM checkin_entries WHERE definitionId = ? AND entryDate >= ? AND entryDate <= ? ORDER BY entryDate ASC`, [defId, start, end]);
    return rows.map((r) => {
      let value = 0;
      if (defType === "time") {
        const [h, m] = (r.value as string).split(":").map(Number);
        value = !isNaN(h) ? h * 60 + (m || 0) : 0;
      } else {
        value = parseFloat(r.value as string) || 0;
      }
      return { date: r.entryDate as string, value };
    });
  }

  async streakSummary(): Promise<StreakData> {
    const rows = await this.db.select<SqlRow[]>(`SELECT dueDate, isCompleted, isFailed FROM tasks WHERE deletedAt IS NULL AND dueDate <= ? ORDER BY dueDate DESC`, [todayStr()]);
    return computeStreakFrom(rows.map((r) => ({ dueDate: r.dueDate as string, isCompleted: Boolean(r.isCompleted), isFailed: Boolean(r.isFailed) })));
  }

  async taskTrend(range: TimeRange): Promise<import("@/shared/types").TaskTrendStats[]> {
    const { start, end } = getDateRange(range);
    const today = todayStr();
    const taskRows = await this.db.select<SqlRow[]>(
      `SELECT * FROM tasks WHERE deletedAt IS NULL AND (
         (recurrenceType IS NULL AND dueDate >= ? AND dueDate <= ?)
         OR (recurrenceType IS NOT NULL AND dueDate <= ? AND (recurrenceEnd IS NULL OR recurrenceEnd >= ?))
       )`, [start, end, end, start]);
    const tasks = taskRows.map(mapTask);
    const recurringIds = tasks.filter((t) => t.recurrenceType).map((t) => t.id);
    let occRowsAll: SqlRow[] = [];
    if (recurringIds.length) {
      const ph = recurringIds.map(() => "?").join(",");
      occRowsAll = await this.db.select<SqlRow[]>(`SELECT * FROM task_occurrences WHERE taskId IN (${ph}) AND date >= ? AND date <= ?`, [...recurringIds, start, end]);
    }
    const occByTask = new Map<number, TaskOccurrenceRow[]>();
    for (const r of occRowsAll) {
      const o = { id: r.id as number, taskId: r.taskId as number, date: r.date as string, isCompleted: Boolean(r.isCompleted), isFailed: Boolean(r.isFailed), isSkipped: Boolean(r.isSkipped) };
      const list = occByTask.get(o.taskId) ?? [];
      list.push(o);
      occByTask.set(o.taskId, list);
    }
    return tasks
      .map((task) => {
        let completedCount = 0;
        let failedCount = 0;
        let totalCount = 0;
        let streak = 0;
        if (task.recurrenceType) {
          const occMap = new Map((occByTask.get(task.id) ?? []).map((o) => [`${o.taskId}:${o.date}`, { isCompleted: o.isCompleted, isFailed: o.isFailed, isSkipped: o.isSkipped }]));
          const items = expandRecurringStats(task, occMap, start, end, today);
          totalCount = items.length;
          completedCount = items.filter((i) => i.isCompleted).length;
          failedCount = items.filter((i) => i.isFailed).length;
          const completedDates = items.filter((i) => i.isCompleted).map((i) => i.date).sort().reverse();
          for (const d of completedDates) {
            if (d <= end) streak++;
            else break;
          }
        } else {
          totalCount = 1;
          if (task.isCompleted) { completedCount = 1; streak = 1; }
          if (task.isFailed) failedCount = 1;
        }
        return { taskId: task.id, title: task.title, completedCount, failedCount, totalCount, streak, isRecurring: !!task.recurrenceType };
      })
      .filter((t) => t.totalCount > 0);
  }

  async listAchievements(): Promise<Array<{ id: number; key: string; title: string; description: string; icon: string; earned: boolean; earnedAt: string | null }>> {
    const defs = await this.db.select<SqlRow[]>(`SELECT * FROM achievement_definitions`);
    const earnedRows = await this.db.select<SqlRow[]>(`SELECT * FROM earned_achievements`);
    const earnedSet = new Set(earnedRows.map((e) => e.definitionId as number));
    return defs.map((d) => ({
      id: d.id as number,
      key: d.key as string,
      title: d.title as string,
      description: d.description as string,
      icon: d.icon as string,
      earned: earnedSet.has(d.id as number),
      earnedAt: (earnedRows.find((e) => e.definitionId === d.id)?.earnedAt as string) ?? null,
    }));
  }

  async checkAndUnlockAchievements(): Promise<Array<{ id: number; key: string; title: string; description: string; icon: string; earned: boolean; earnedAt: string | null }>> {
    const unlocked: Array<{ id: number; key: string; title: string; description: string; icon: string; earned: boolean; earnedAt: string | null }> = [];
    const streak = await this.streakSummary();
    const milestones: Record<string, number> = { streak_3: 3, streak_7: 7, streak_30: 30, streak_100: 100 };
    for (const [key, milestone] of Object.entries(milestones)) {
      if (streak.currentStreak >= milestone) {
        const earned = await this.tryUnlock(key);
        if (earned) unlocked.push(earned);
      }
    }
    const today = todayStr();
    const todayRows = await this.db.select<SqlRow[]>(`SELECT * FROM tasks WHERE deletedAt IS NULL AND dueDate = ?`, [today]);
    if (todayRows.length > 0 && todayRows.every((t) => Boolean(t.isCompleted))) {
      const earned = await this.tryUnlock("all_done_today");
      if (earned) unlocked.push(earned);
    }
    return unlocked;
  }

  private async tryUnlock(key: string): Promise<{ id: number; key: string; title: string; description: string; icon: string; earned: boolean; earnedAt: string | null } | null> {
    const defs = await this.db.select<SqlRow[]>(`SELECT * FROM achievement_definitions WHERE key = ?`, [key]);
    if (!defs.length) return null;
    const def = defs[0];
    const existing = await this.db.select<SqlRow[]>(`SELECT * FROM earned_achievements WHERE definitionId = ?`, [def.id]);
    if (existing.length) return null;
    await this.db.execute(`INSERT INTO earned_achievements (definitionId, earnedAt) VALUES (?, ?)`, [def.id, nowIso()]);
    return { id: def.id as number, key: def.key as string, title: def.title as string, description: def.description as string, icon: def.icon as string, earned: true, earnedAt: nowIso() };
  }

  async getSetting<T>(key: string, fallback: T): Promise<T> {
    const rows = await this.db.select<SqlRow[]>(`SELECT value FROM settings WHERE key = ?`, [key]);
    if (!rows.length) return fallback;
    try {
      return JSON.parse(rows[0].value as string) as T;
    } catch {
      return rows[0].value as T;
    }
  }

  async setSetting(key: string, value: unknown): Promise<void> {
    await this.db.execute(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?`, [key, JSON.stringify(value), JSON.stringify(value)]);
  }

  dbInfo() {
    return "sqlite";
  }
}

/* ================= 内存实现（浏览器预览） ================= */

class MemoryDb implements Db {
  private tasks: Task[] = [];
  private taskOccurrences: TaskOccurrenceRow[] = [];
  private subtasks: Subtask[] = [];
  private subtaskOccurrences: SubtaskOccurrenceRow[] = [];
  private defs: CheckinDefinition[] = [];
  private entries: CheckinEntry[] = [];
  private notes: DailyNote[] = [];
  private achievementDefs: Array<{ id: number; key: string; title: string; description: string; icon: string }> = [];
  private earned: Array<{ definitionId: number; earnedAt: string }> = [];
  private settings: Record<string, string> = {};
  private nextId = 1;

  private ensureSeeded() {
    if (this.achievementDefs.length) return;
    this.achievementDefs = [
      { id: 1, key: 'streak_3', title: '初出茅庐', description: '连续打卡 3 天', icon: '🌱' },
      { id: 2, key: 'streak_7', title: '一周坚持', description: '连续打卡 7 天', icon: '🔥' },
      { id: 3, key: 'streak_30', title: '月度达人', description: '连续打卡 30 天', icon: '⭐' },
      { id: 4, key: 'streak_100', title: '百日坚守', description: '连续打卡 100 天', icon: '🏆' },
      { id: 5, key: 'perfect_week', title: '完美一周', description: '某一周完成率达到 100%', icon: '💎' },
      { id: 6, key: 'all_done_today', title: '今日清零', description: '完成当天所有任务', icon: '✅' },
    ];
  }

  private nid() { return this.nextId++; }

  private listRaw(start: string, end: string): TaskListRaw {
    const tasks = this.tasks.filter((t) => {
      if (t.deletedAt) return false;
      if (!t.recurrenceType) return t.dueDate >= start && t.dueDate <= end;
      return t.dueDate <= end && (!t.recurrenceEnd || t.recurrenceEnd >= start);
    });
    const occurrences = this.taskOccurrences.filter((o) => o.date >= start && o.date <= end);
    const st = this.subtasks.filter((s) => tasks.some((t) => t.id === s.taskId));
    const so = this.subtaskOccurrences.filter((o) => o.date >= start && o.date <= end);
    return { tasks, occurrences, subtasks: st, subtaskOccurrences: so };
  }

  private checkAndMarkFailed() {
    const today = todayStr();
    if (this.settings["lastFailedCheckDate"] === today) return;
    for (const t of this.tasks) {
      if (t.dueDate < today && !t.isCompleted && !t.isFailed) {
        t.isFailed = true;
        t.updatedAt = nowIso();
      }
    }
    this.settings["lastFailedCheckDate"] = today;
  }

  async listTasks(start: string, end: string): Promise<TaskListItem[]> {
    this.checkAndMarkFailed();
    return buildTaskList(this.listRaw(start, end), start, end);
  }

  async createTask(payload: CreateTaskPayload): Promise<Task> {
    const ts = nowIso();
    const today = todayStr();
    const isHistoricalFailed = !payload.recurrenceType && payload.dueDate < today;
    const task: Task = {
      id: this.nid(),
      title: payload.title,
      priority: payload.priority ?? "none",
      dueDate: payload.dueDate,
      isCompleted: false,
      isFailed: isHistoricalFailed,
      completedAt: null,
      notes: payload.notes ?? null,
      recurrenceType: payload.recurrenceType ?? null,
      recurrenceEnd: payload.recurrenceEnd ?? null,
      deletedAt: null,
      createdAt: ts,
      updatedAt: ts,
    };
    this.tasks.push(task);
    payload.subtasks?.forEach((title, i) => {
      this.subtasks.push({ id: this.nid(), taskId: task.id, title, sortOrder: i, createdAt: ts, updatedAt: ts });
    });
    return task;
  }

  async updateTask(id: number, patch: UpdateTaskPayload): Promise<Task> {
    const { occurrenceDate: _occ, ...rest } = patch;
    const task = this.tasks.find((t) => t.id === id);
    if (!task) throw new Error("任务不存在");
    if (rest.recurrenceEnd !== undefined && task.recurrenceType && rest.recurrenceEnd) {
      this.taskOccurrences = this.taskOccurrences.filter((o) => !(o.taskId === id && o.date > rest.recurrenceEnd!));
    }
    Object.assign(task, rest, { updatedAt: nowIso() });
    if (rest.isCompleted) task.completedAt = nowIso();
    return task;
  }

  async updateOccurrence(taskId: number, date: string, patch: { isCompleted?: boolean; isFailed?: boolean }): Promise<void> {
    const occ = this.taskOccurrences.find((o) => o.taskId === taskId && o.date === date);
    if (occ) {
      if (patch.isCompleted !== undefined) occ.isCompleted = patch.isCompleted;
      if (patch.isFailed !== undefined) occ.isFailed = patch.isFailed;
    } else {
      this.taskOccurrences.push({ id: this.nid(), taskId, date, isCompleted: patch.isCompleted ?? false, isFailed: patch.isFailed ?? false, isSkipped: false });
    }
  }

  async deleteTask(id: number): Promise<void> {
    const task = this.tasks.find((t) => t.id === id);
    if (task) { task.deletedAt = nowIso(); task.updatedAt = nowIso(); }
  }

  async markFailed(ids: number[]): Promise<void> {
    for (const t of this.tasks) {
      if (ids.includes(t.id)) { t.isFailed = true; t.updatedAt = nowIso(); }
    }
  }

  async skipOccurrence(taskId: number, date: string): Promise<void> {
    const occ = this.taskOccurrences.find((o) => o.taskId === taskId && o.date === date);
    if (occ) occ.isSkipped = true;
    else this.taskOccurrences.push({ id: this.nid(), taskId, date, isCompleted: false, isFailed: false, isSkipped: true });
  }

  async deleteFromDate(taskId: number, date: string): Promise<void> {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return;
    const prevDay = format(subDays(parseISO(date), 1), "yyyy-MM-dd");
    if (date <= task.dueDate) {
      await this.deleteTask(taskId);
    } else {
      task.recurrenceEnd = prevDay;
      task.updatedAt = nowIso();
      this.taskOccurrences = this.taskOccurrences.filter((o) => !(o.taskId === taskId && o.date >= date));
    }
  }

  async detachOccurrence(taskId: number, date: string, patch: { title?: string; priority?: Priority; notes?: string }): Promise<Task | null> {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return null;
    await this.skipOccurrence(taskId, date);
    return this.createTask({ title: patch.title ?? task.title, priority: patch.priority ?? task.priority, dueDate: date, notes: patch.notes !== undefined ? patch.notes || undefined : task.notes ?? undefined });
  }

  async splitFromDate(taskId: number, date: string, patch: { title?: string; priority?: Priority; notes?: string; recurrenceEnd?: string }): Promise<Task | null> {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return null;
    const prevDay = format(subDays(parseISO(date), 1), "yyyy-MM-dd");
    if (date <= task.dueDate) {
      return this.updateTask(taskId, { title: patch.title ?? task.title, priority: patch.priority ?? task.priority, notes: patch.notes !== undefined ? patch.notes || undefined : task.notes ?? undefined, recurrenceEnd: patch.recurrenceEnd !== undefined ? patch.recurrenceEnd || null : task.recurrenceEnd });
    }
    const existingOcc = this.taskOccurrences.find((o) => o.taskId === taskId && o.date === date);
    task.recurrenceEnd = prevDay;
    task.updatedAt = nowIso();
    this.taskOccurrences = this.taskOccurrences.filter((o) => !(o.taskId === taskId && o.date >= date));
    const newRecurrenceEnd = patch.recurrenceEnd !== undefined ? patch.recurrenceEnd || null : task.recurrenceEnd;
    const newTask = await this.createTask({ title: patch.title ?? task.title, priority: patch.priority ?? task.priority, dueDate: date, notes: patch.notes !== undefined ? patch.notes || undefined : task.notes ?? undefined, recurrenceType: task.recurrenceType ?? undefined, recurrenceEnd: newRecurrenceEnd ?? undefined });
    if (existingOcc && (existingOcc.isCompleted || existingOcc.isFailed || existingOcc.isSkipped)) {
      this.taskOccurrences.push({ id: this.nid(), taskId: newTask.id, date, isCompleted: existingOcc.isCompleted, isFailed: existingOcc.isFailed, isSkipped: existingOcc.isSkipped });
    }
    return newTask;
  }

  async toggleSubtask(subtaskId: number, date: string, isCompleted: boolean): Promise<void> {
    const occ = this.subtaskOccurrences.find((o) => o.subtaskId === subtaskId && o.date === date);
    if (occ) occ.isCompleted = isCompleted;
    else this.subtaskOccurrences.push({ id: this.nid(), subtaskId, date, isCompleted });
  }

  async updateSubtasks(taskId: number, items: { id?: number; title: string }[]): Promise<void> {
    const existing = this.subtasks.filter((s) => s.taskId === taskId);
    const incomingIds = new Set(items.filter((i) => i.id).map((i) => i.id!));
    for (const s of existing) {
      if (!incomingIds.has(s.id)) {
        this.subtasks = this.subtasks.filter((x) => x.id !== s.id);
        this.subtaskOccurrences = this.subtaskOccurrences.filter((o) => o.subtaskId !== s.id);
      }
    }
    const ts = nowIso();
    items.forEach((item, i) => {
      const title = item.title.trim();
      if (item.id) {
        const s = this.subtasks.find((x) => x.id === item.id);
        if (s) { s.title = title; s.sortOrder = i; s.updatedAt = ts; return; }
      }
      if (title) this.subtasks.push({ id: this.nid(), taskId, title, sortOrder: i, createdAt: ts, updatedAt: ts });
    });
  }

  async listDeleted(): Promise<Task[]> {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    return this.tasks.filter((t) => t.deletedAt && t.deletedAt >= cutoff).sort((a, b) => (b.deletedAt ?? "").localeCompare(a.deletedAt ?? ""));
  }

  async restore(id: number): Promise<Task> {
    const task = this.tasks.find((t) => t.id === id);
    if (!task) throw new Error("任务不存在");
    task.deletedAt = null;
    task.updatedAt = nowIso();
    return task;
  }

  async purgeTrashed(id: number): Promise<void> {
    this.tasks = this.tasks.filter((t) => t.id !== id);
    this.taskOccurrences = this.taskOccurrences.filter((o) => o.taskId !== id);
    const st = this.subtasks.filter((s) => s.taskId === id);
    for (const s of st) this.subtaskOccurrences = this.subtaskOccurrences.filter((o) => o.subtaskId !== s.id);
    this.subtasks = this.subtasks.filter((s) => s.taskId !== id);
  }

  async emptyTrash(): Promise<void> {
    for (const t of [...this.tasks]) {
      if (t.deletedAt) await this.purgeTrashed(t.id);
    }
  }

  async listCheckinDefs(): Promise<CheckinDefinition[]> {
    return [...this.defs].filter((d) => !d.archivedAt).sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async createCheckinDef(payload: CreateCheckinDefPayload): Promise<CheckinDefinition> {
    const def: CheckinDefinition = {
      id: this.nid(),
      name: payload.name,
      type: payload.type,
      unit: payload.unit ?? null,
      sortOrder: this.defs.filter((d) => !d.archivedAt).length,
      archivedAt: null,
      startDate: payload.startDate ?? null,
      endDate: payload.endDate ?? null,
      frequency: payload.frequency ?? "daily",
      createdAt: nowIso(),
    };
    this.defs.push(def);
    return def;
  }

  async updateCheckinDef(id: number, patch: Partial<CreateCheckinDefPayload>): Promise<CheckinDefinition> {
    const def = this.defs.find((d) => d.id === id);
    if (!def) throw new Error("打卡定义不存在");
    Object.assign(def, patch);
    return def;
  }

  async archiveCheckinDef(id: number): Promise<void> {
    const def = this.defs.find((d) => d.id === id);
    if (def) def.archivedAt = nowIso();
  }

  async reorderCheckinDefs(orderedIds: number[]): Promise<void> {
    orderedIds.forEach((id, i) => {
      const def = this.defs.find((d) => d.id === id);
      if (def) def.sortOrder = i;
    });
  }

  async getCheckinEntries(start: string, end: string): Promise<CheckinEntry[]> {
    return this.entries.filter((e) => e.entryDate >= start && e.entryDate <= end).sort((a, b) => a.entryDate.localeCompare(b.entryDate));
  }

  async upsertCheckinEntry(payload: UpsertCheckinEntryPayload): Promise<CheckinEntry> {
    const ts = nowIso();
    const existing = this.entries.find((e) => e.definitionId === payload.definitionId && e.entryDate === payload.entryDate);
    if (existing) {
      existing.value = payload.value;
      existing.updatedAt = ts;
      return existing;
    }
    const entry: CheckinEntry = { id: this.nid(), definitionId: payload.definitionId, entryDate: payload.entryDate, value: payload.value, updatedAt: ts };
    this.entries.push(entry);
    return entry;
  }

  async getNote(date: string): Promise<DailyNote | null> {
    return this.notes.find((n) => n.noteDate === date) ?? null;
  }

  async upsertNote(date: string, content: string): Promise<DailyNote> {
    const ts = nowIso();
    const existing = this.notes.find((n) => n.noteDate === date);
    if (existing) { existing.content = content; existing.updatedAt = ts; return existing; }
    const note: DailyNote = { id: this.nid(), noteDate: date, content, updatedAt: ts };
    this.notes.push(note);
    return note;
  }

  async completion(range: TimeRange): Promise<import("@/shared/types").CompletionStats> {
    const { start, end } = getDateRange(range);
    const today = todayStr();
    const raw = this.listRaw(start, end);
    const occMap = new Map(raw.occurrences.map((o) => [`${o.taskId}:${o.date}`, { isCompleted: o.isCompleted, isFailed: o.isFailed, isSkipped: o.isSkipped }]));
    const recurringItems = raw.tasks.filter((t) => t.recurrenceType).flatMap((t) => expandRecurringStats(t, occMap, start, end, today));
    const all = [
      ...raw.tasks.filter((t) => !t.recurrenceType).map((t) => ({ date: t.dueDate, isCompleted: t.isCompleted, isFailed: t.isFailed })),
      ...recurringItems,
    ];
    const dayMap: Record<string, { completed: number; failed: number; total: number }> = {};
    for (const d of eachDayOfInterval({ start: parseISO(start), end: parseISO(end) })) dayMap[format(d, "yyyy-MM-dd")] = { completed: 0, failed: 0, total: 0 };
    for (const item of all) {
      const bucket = dayMap[item.date];
      if (!bucket) continue;
      bucket.total++;
      if (item.isCompleted) bucket.completed++;
      else if (item.isFailed) bucket.failed++;
    }
    const byDay = Object.entries(dayMap).map(([date, v]) => ({ date, ...v, rate: v.total > 0 ? Math.round((v.completed / v.total) * 100) : 0 }));
    const overall = all.reduce((acc, item) => { acc.total++; if (item.isCompleted) acc.completed++; else if (item.isFailed) acc.failed++; else acc.pending++; return acc; }, { completed: 0, failed: 0, pending: 0, total: 0 });
    return { overall: { ...overall, rate: overall.total > 0 ? Math.round((overall.completed / overall.total) * 100) : 0 }, byDay };
  }

  async numericTrend(defId: number, range: TimeRange): Promise<TrendPoint[]> {
    const { start, end } = getDateRange(range);
    const def = this.defs.find((d) => d.id === defId);
    return this.entries
      .filter((e) => e.definitionId === defId && e.entryDate >= start && e.entryDate <= end)
      .sort((a, b) => a.entryDate.localeCompare(b.entryDate))
      .map((e) => {
        let value = 0;
        if (def?.type === "time") {
          const [h, m] = e.value.split(":").map(Number);
          value = !isNaN(h) ? h * 60 + (m || 0) : 0;
        } else {
          value = parseFloat(e.value) || 0;
        }
        return { date: e.entryDate, value };
      });
  }

  async streakSummary(): Promise<StreakData> {
    return computeStreakFrom(this.tasks.filter((t) => !t.deletedAt && t.dueDate <= todayStr()).map((t) => ({ dueDate: t.dueDate, isCompleted: t.isCompleted, isFailed: t.isFailed })));
  }

  async taskTrend(range: TimeRange): Promise<import("@/shared/types").TaskTrendStats[]> {
    const { start, end } = getDateRange(range);
    const today = todayStr();
    const raw = this.listRaw(start, end);
    return raw.tasks
      .map((task) => {
        let completedCount = 0;
        let failedCount = 0;
        let totalCount = 0;
        let streak = 0;
        if (task.recurrenceType) {
          const occMap = new Map(raw.occurrences.filter((o) => o.taskId === task.id).map((o) => [`${o.taskId}:${o.date}`, { isCompleted: o.isCompleted, isFailed: o.isFailed, isSkipped: o.isSkipped }]));
          const items = expandRecurringStats(task, occMap, start, end, today);
          totalCount = items.length;
          completedCount = items.filter((i) => i.isCompleted).length;
          failedCount = items.filter((i) => i.isFailed).length;
          const completedDates = items.filter((i) => i.isCompleted).map((i) => i.date).sort().reverse();
          for (const d of completedDates) {
            if (d <= end) streak++;
            else break;
          }
        } else {
          totalCount = 1;
          if (task.isCompleted) { completedCount = 1; streak = 1; }
          if (task.isFailed) failedCount = 1;
        }
        return { taskId: task.id, title: task.title, completedCount, failedCount, totalCount, streak, isRecurring: !!task.recurrenceType };
      })
      .filter((t) => t.totalCount > 0);
  }

  async listAchievements(): Promise<Array<{ id: number; key: string; title: string; description: string; icon: string; earned: boolean; earnedAt: string | null }>> {
    this.ensureSeeded();
    return this.achievementDefs.map((d) => {
      const e = this.earned.find((x) => x.definitionId === d.id);
      return { ...d, earned: !!e, earnedAt: e?.earnedAt ?? null };
    });
  }

  async checkAndUnlockAchievements(): Promise<Array<{ id: number; key: string; title: string; description: string; icon: string; earned: boolean; earnedAt: string | null }>> {
    this.ensureSeeded();
    const unlocked: Array<{ id: number; key: string; title: string; description: string; icon: string; earned: boolean; earnedAt: string | null }> = [];
    const streak = await this.streakSummary();
    const milestones: Record<string, number> = { streak_3: 3, streak_7: 7, streak_30: 30, streak_100: 100 };
    for (const [key, milestone] of Object.entries(milestones)) {
      if (streak.currentStreak >= milestone) {
        const def = this.achievementDefs.find((d) => d.key === key);
        if (def && !this.earned.some((x) => x.definitionId === def.id)) {
          this.earned.push({ definitionId: def.id, earnedAt: nowIso() });
          unlocked.push({ ...def, earned: true, earnedAt: nowIso() });
        }
      }
    }
    const today = todayStr();
    const todayTasks = this.tasks.filter((t) => !t.deletedAt && t.dueDate === today);
    if (todayTasks.length > 0 && todayTasks.every((t) => t.isCompleted)) {
      const def = this.achievementDefs.find((d) => d.key === "all_done_today");
      if (def && !this.earned.some((x) => x.definitionId === def.id)) {
        this.earned.push({ definitionId: def.id, earnedAt: nowIso() });
        unlocked.push({ ...def, earned: true, earnedAt: nowIso() });
      }
    }
    return unlocked;
  }

  async getSetting<T>(key: string, fallback: T): Promise<T> {
    const raw = this.settings[key];
    if (raw == null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as T;
    }
  }

  async setSetting(key: string, value: unknown): Promise<void> {
    this.settings[key] = JSON.stringify(value);
  }

  dbInfo() {
    return "memory";
  }
}

/* ================= 门面 ================= */

let instance: Db | null = null;
let initPromise: Promise<Db> | null = null;

export function initDb(): Promise<Db> {
  if (instance) return Promise.resolve(instance);
  if (!initPromise) {
    initPromise = (async () => {
      if (isTauri) {
        const sqlite = new SqliteDb();
        await sqlite.connect();
        instance = sqlite;
      } else {
        instance = new MemoryDb();
      }
      return instance;
    })().catch((e) => {
      initPromise = null;
      throw e;
    });
  }
  return initPromise;
}

export function getDb(): Db {
  if (!instance) throw new Error("数据库未初始化，请先调用 initDb()");
  return instance;
}
