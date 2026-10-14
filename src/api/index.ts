import { IPC } from '@shared/ipc-channels'
import type {
  Task, CreateTaskPayload, UpdateTaskPayload, SubtaskPatchItem,
  CheckinDefinition, CheckinEntry, CreateCheckinDefPayload, UpsertCheckinEntryPayload,
  DailyNote, CompletionStats, TrendPoint, StreakData, WidgetPrefs, TimeRange,
  Project, ProjectScope,
} from '@shared/types'
import type {
  TaskExportOptions, TaskExportSnapshot, TaskPdfRequest, TaskPdfResult,
} from '@/lib/task-export-model'

// 类型化的 invoke 封装
function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  return window.electronAPI.invoke(channel as never, ...args) as Promise<T>
}

// ==================== 任务 API ====================
export const projectsApi = {
  list: () => invoke<Project[]>(IPC.PROJECTS_LIST),
  create: (name: string) => invoke<Project>(IPC.PROJECTS_CREATE, name),
  rename: (id: number, name: string) => invoke<Project>(IPC.PROJECTS_RENAME, id, name),
  getSelection: () => invoke<ProjectScope>(IPC.PROJECTS_GET_SELECTION),
  select: (projectId: ProjectScope) => invoke<void>(IPC.PROJECTS_SELECT, projectId),
}

export const tasksApi = {
  list: (start: string, end: string, projectId?: ProjectScope) =>
    invoke<Task[]>(IPC.TASKS_LIST, { start, end, projectId }),
  create: (payload: CreateTaskPayload) =>
    invoke<Task>(IPC.TASKS_CREATE, payload),
  update: (id: number, patch: UpdateTaskPayload) =>
    invoke<Task>(IPC.TASKS_UPDATE, id, patch),
  updateOccurrence: (taskId: number, date: string, patch: { isCompleted?: boolean; isFailed?: boolean }) =>
    invoke<void>(IPC.TASKS_UPDATE_OCCURRENCE, taskId, date, patch),
  delete: (id: number) =>
    invoke<void>(IPC.TASKS_DELETE, id),
  skipOccurrence: (taskId: number, date: string) =>
    invoke<void>(IPC.TASKS_SKIP_OCCURRENCE, taskId, date),
  deleteFromDate: (taskId: number, date: string) =>
    invoke<void>(IPC.TASKS_DELETE_FROM_DATE, taskId, date),
  deleteBeforeDate: (taskId: number, date: string) =>
    invoke<void>(IPC.TASKS_DELETE_BEFORE_DATE, taskId, date),
  detachOccurrence: (taskId: number, date: string, patch: { projectId?: number; title?: string; priority?: string; notes?: string; subtasks?: SubtaskPatchItem[] }) =>
    invoke<Task>(IPC.TASKS_DETACH_OCCURRENCE, taskId, date, patch),
  splitFromDate: (taskId: number, date: string, patch: { projectId?: number; title?: string; priority?: string; notes?: string; recurrenceEnd?: string; subtasks?: SubtaskPatchItem[] }) =>
    invoke<Task>(IPC.TASKS_SPLIT_FROM_DATE, taskId, date, patch),
  toggleSubtask: (subtaskId: number, date: string, isCompleted: boolean) =>
    invoke<void>(IPC.SUBTASKS_TOGGLE, subtaskId, date, isCompleted),
  updateSubtasks: (taskId: number, items: { id?: number; title: string }[]) =>
    invoke<void>(IPC.SUBTASKS_UPDATE, taskId, items),
  listDeleted: (projectId?: ProjectScope) => invoke<Task[]>(IPC.TASKS_LIST_DELETED, projectId),
  restore: (id: number) => invoke<Task>(IPC.TASKS_RESTORE, id),
  purgeTrashed: (id: number) => invoke<void>(IPC.TASKS_PURGE_TRASHED, id),
  emptyTrash: (projectId?: ProjectScope) => invoke<void>(IPC.TASKS_EMPTY_TRASH, projectId),
  /** 全量只读导出快照；参数固定为一个 options 对象。 */
  exportSnapshot: (options: TaskExportOptions) =>
    invoke<TaskExportSnapshot>(IPC.TASKS_EXPORT_SNAPSHOT, options),
}

// ==================== 打卡 API ====================
export const checkinsApi = {
  listDefs: () =>
    invoke<CheckinDefinition[]>(IPC.CHECKINS_LIST_DEFS),
  createDef: (payload: CreateCheckinDefPayload) =>
    invoke<CheckinDefinition>(IPC.CHECKINS_CREATE_DEF, payload),
  updateDef: (id: number, patch: Partial<CreateCheckinDefPayload>) =>
    invoke<CheckinDefinition>(IPC.CHECKINS_UPDATE_DEF, id, patch),
  archiveDef: (id: number) =>
    invoke<void>(IPC.CHECKINS_ARCHIVE_DEF, id),
  deleteCheckinDef: (id: number, date: string, scope: 'this' | 'before' | 'future') =>
    invoke<void>(IPC.CHECKINS_DELETE_DEF, id, date, scope),
  reorderDefs: (orderedIds: number[]) =>
    invoke<void>(IPC.CHECKINS_REORDER_DEFS, orderedIds),
  getEntries: (start: string, end: string) =>
    invoke<CheckinEntry[]>(IPC.CHECKINS_GET_ENTRIES, { start, end }),
  upsertEntry: (payload: UpsertCheckinEntryPayload) =>
    invoke<CheckinEntry>(IPC.CHECKINS_UPSERT_ENTRY, payload),
}

// ==================== 备注 API ====================
export const notesApi = {
  get: (date: string) =>
    invoke<DailyNote | null>(IPC.NOTES_GET, date),
  upsert: (date: string, content: string) =>
    invoke<DailyNote>(IPC.NOTES_UPSERT, date, content),
}

// ==================== 统计 API ====================
export const analyticsApi = {
  completion: (range: TimeRange, projectId?: ProjectScope) =>
    invoke<CompletionStats>(IPC.ANALYTICS_COMPLETION, range, projectId),
  numericTrend: (defId: number, range: TimeRange) =>
    invoke<TrendPoint[]>(IPC.ANALYTICS_NUMERIC_TREND, defId, range),
  streakSummary: (projectId?: ProjectScope) =>
    invoke<StreakData>(IPC.ANALYTICS_STREAK_SUMMARY, projectId),
  taskTrend: (range: TimeRange, projectId?: ProjectScope) =>
    invoke<import('@shared/types').TaskTrendStats[]>(IPC.ANALYTICS_TASK_TREND, range, projectId),
}

// ==================== 成就 API ====================
export const achievementsApi = {
  list: () => invoke<Array<{
    id: number; key: string; title: string; description: string; icon: string;
    earned: boolean; earnedAt: string | null
  }>>(IPC.ACHIEVEMENTS_LIST),
}

// ==================== 系统 API ====================
export const systemApi = {
  getWidgetPrefs: () => invoke<WidgetPrefs>(IPC.SYSTEM_GET_WIDGET_PREFS),
  saveWidgetPrefs: (prefs: Partial<WidgetPrefs>) => invoke<void>(IPC.SYSTEM_SAVE_WIDGET_PREFS, prefs),
  setAlwaysOnTop: (v: boolean) => invoke<void>(IPC.SYSTEM_SET_ALWAYS_ON_TOP, v),
  setOpacity: (v: number) => invoke<void>(IPC.SYSTEM_SET_OPACITY, v),
  toggleAutoLaunch: (v: boolean) => invoke<void>(IPC.SYSTEM_TOGGLE_AUTO_LAUNCH, v),
  getAutoLaunch: () => invoke<boolean>(IPC.SYSTEM_GET_AUTO_LAUNCH),
  getAppVersion: () => invoke<string>(IPC.SYSTEM_GET_VERSION),
  getTheme: () => invoke<string>(IPC.SYSTEM_GET_THEME),
  setTheme: (theme: string) => invoke<void>(IPC.SYSTEM_SET_THEME, theme),
  getSkin: () => invoke<string>(IPC.SYSTEM_GET_SKIN),
  setSkin: (skin: string) => invoke<void>(IPC.SYSTEM_SET_SKIN, skin),
  showWidget: () => invoke<void>(IPC.SYSTEM_SHOW_WIDGET),
  hideWidget: () => invoke<void>(IPC.SYSTEM_HIDE_WIDGET),
  minimizeToTray: () => invoke<void>(IPC.SYSTEM_MINIMIZE_TO_TRAY),
  showMainWindow: () => invoke<void>(IPC.SYSTEM_SHOW_MAIN_WINDOW),
  quit: () => invoke<void>(IPC.SYSTEM_QUIT),
  toggleFullscreen: () => invoke<void>(IPC.SYSTEM_TOGGLE_FULLSCREEN),
  zoomIn: () => invoke<void>(IPC.SYSTEM_ZOOM_IN),
  zoomOut: () => invoke<void>(IPC.SYSTEM_ZOOM_OUT),
  zoomReset: () => invoke<void>(IPC.SYSTEM_ZOOM_RESET),
  /** 桌面原生保存 PDF；浏览器环境由 ipc-bridge 返回明确的不可用错误。 */
  exportTaskPdf: (request: TaskPdfRequest) =>
    invoke<TaskPdfResult>(IPC.SYSTEM_EXPORT_TASK_PDF, request),
}
