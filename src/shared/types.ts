// ==================== 任务 ====================
export type Priority = 'none' | 'low' | 'medium' | 'high'
export type RecurrenceType = 'daily' | 'weekday' | 'weekend' | 'weekly' | 'monthly'

export interface Task {
  id: number
  title: string
  priority: Priority
  dueDate: string // YYYY-MM-DD（重复任务为每次发生日期）
  isCompleted: boolean
  isFailed: boolean
  completedAt: string | null
  notes: string | null
  recurrenceType: RecurrenceType | null
  recurrenceEnd: string | null
  isRecurring?: boolean  // 前端标记：是否为重复任务展开的实例
  deletedAt?: string | null  // 软删除时间，null 表示未删除
  createdAt: string
  updatedAt: string
  /** 子任务列表（含当天 isCompleted 状态，由后端按日期注入） */
  subtasks?: Subtask[]
}

/** 任务下的子任务（次级日程） */
export interface Subtask {
  id: number
  taskId: number
  title: string
  sortOrder: number
  createdAt: string
  updatedAt: string
  /** 指定日期的完成状态（查询时按日期注入） */
  isCompleted?: boolean
}

export interface CreateTaskPayload {
  title: string
  priority?: Priority
  dueDate: string
  notes?: string
  recurrenceType?: RecurrenceType
  recurrenceEnd?: string
  /** 新建时创建的子任务标题列表 */
  subtasks?: string[]
}

/** 循环任务编辑时随范围选择提交的子任务项（数组顺序即排序） */
export interface SubtaskPatchItem {
  id?: number
  title: string
  /** 该子任务在目标日期的完成状态 */
  isCompleted?: boolean
}

export interface UpdateTaskPayload {
  title?: string
  priority?: Priority
  dueDate?: string
  isCompleted?: boolean
  isFailed?: boolean
  notes?: string
  recurrenceType?: RecurrenceType | null
  recurrenceEnd?: string | null
  // 重复任务实例更新时传入的发生日期
  occurrenceDate?: string
}

// ==================== 打卡 ====================
export type CheckinType = 'numeric' | 'boolean' | 'text' | 'time'
export type CheckinFrequency = 'daily' | 'weekday' | 'weekend' | 'weekly' | 'monthly'

export interface CheckinDefinition {
  id: number
  name: string
  type: CheckinType
  unit: string | null
  sortOrder: number
  archivedAt: string | null
  startDate: string | null // 打卡有效期开始
  endDate: string | null   // 打卡有效期结束
  frequency: CheckinFrequency | null // 打卡周期（null 视同 daily）
  /** 单日跳过的日期（循环打卡范围删除「仅此日程」） */
  skipDates?: string[]
  createdAt: string
}

export interface CheckinEntry {
  id: number
  definitionId: number
  entryDate: string // YYYY-MM-DD
  value: string
  updatedAt: string
}

export interface CreateCheckinDefPayload {
  name: string
  type: CheckinType
  unit?: string
  startDate?: string
  endDate?: string
  frequency?: CheckinFrequency
}

export interface UpsertCheckinEntryPayload {
  definitionId: number
  entryDate: string
  value: string
}

// ==================== 每日备注 ====================
export interface DailyNote {
  id: number
  noteDate: string
  content: string
  updatedAt: string
}

// ==================== 成就 ====================
export interface AchievementDefinition {
  id: number
  key: string
  title: string
  description: string
  icon: string
}

export interface EarnedAchievement {
  id: number
  definitionId: number
  earnedAt: string
  definition: AchievementDefinition
}

// ==================== 统计分析 ====================
export type TimeRange = 'week' | 'month' | 'quarter' | 'year'

export interface TaskTrendStats {
  taskId: number
  title: string
  completedCount: number
  failedCount: number
  totalCount: number
  streak: number
  isRecurring: boolean
}

export interface CompletionDataPoint {
  date: string
  completed: number
  failed: number
  total: number
  rate: number // 0-100
}

export interface CompletionStats {
  overall: {
    completed: number
    failed: number
    pending: number
    total: number
    rate: number
  }
  byDay: CompletionDataPoint[]
}

export interface TrendPoint {
  date: string
  value: number
}

export interface StreakData {
  currentStreak: number
  longestStreak: number
  lastCheckDate: string | null
}

// ==================== 悬浮窗偏好 ====================
export interface WidgetPrefs {
  posX: number
  posY: number
  opacity: number
  alwaysOnTop: boolean
  width: number
  height: number
}

// ==================== IPC 通用 ====================
export interface IpcResponse<T> {
  success: boolean
  data?: T
  error?: string
}
