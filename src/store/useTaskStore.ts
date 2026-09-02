import { create } from 'zustand'
import { tasksApi } from '@/api'
import { IPC } from '@shared/ipc-channels'
import type { Task, CreateTaskPayload, UpdateTaskPayload, SubtaskPatchItem } from '@shared/types'

function notifyWidget() {
  window.electronAPI.invoke(IPC.PUSH_WIDGET_DATA_REFRESH as never).catch(() => {/* ignore */})
}

interface TaskState {
  tasks: Task[]
  loading: boolean
  fetchTasks: (start: string, end: string) => Promise<void>
  createTask: (payload: CreateTaskPayload) => Promise<Task>
  updateTask: (id: number, patch: UpdateTaskPayload) => Promise<void>
  updateOccurrence: (taskId: number, date: string, patch: { isCompleted?: boolean; isFailed?: boolean }) => Promise<void>
  toggleSubtask: (subtaskId: number, date: string, isCompleted: boolean) => Promise<void>
  updateSubtasks: (taskId: number, items: { id?: number; title: string }[]) => Promise<void>
  deleteTask: (id: number) => Promise<void>
  skipOccurrence: (taskId: number, date: string) => Promise<void>
  deleteFromDate: (taskId: number, date: string) => Promise<void>
  deleteBeforeDate: (taskId: number, date: string) => Promise<void>
  detachOccurrence: (taskId: number, date: string, patch: { title?: string; priority?: string; notes?: string; subtasks?: SubtaskPatchItem[] }) => Promise<Task>
  splitFromDate: (taskId: number, date: string, patch: { title?: string; priority?: string; notes?: string; recurrenceEnd?: string; subtasks?: SubtaskPatchItem[] }) => Promise<Task>
  getTasksForDate: (date: string) => Task[]
  restoreTask: (id: number) => Promise<void>
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  loading: false,

  fetchTasks: async (start, end) => {
    set({ loading: true })
    try {
      const tasks = await tasksApi.list(start, end)
      set({ tasks })
    } finally {
      set({ loading: false })
    }
  },

  createTask: async (payload) => {
    const task = await tasksApi.create(payload)
    // 重复任务不直接加入 store（需要重新展开），重新 fetch 会在 CalendarPage 的 loadData 触发
    if (!payload.recurrenceType) {
      set((s) => ({ tasks: [...s.tasks, task] }))
    }
    notifyWidget()
    return task
  },

  updateTask: async (id, patch) => {
    const updated = await tasksApi.update(id, patch)
    if (updated.recurrenceType) {
      // 重复任务：移除所有旧实例（含多个展开日期的副本），由后续 loadData 重新展开
      set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }))
    } else {
      set((s) => ({
        tasks: s.tasks.map((t) => (t.id === id ? updated : t)),
      }))
    }
    notifyWidget()
  },

  updateOccurrence: async (taskId, date, patch) => {
    await tasksApi.updateOccurrence(taskId, date, patch)
    // 更新本地对应虚拟实例
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId && t.dueDate === date ? { ...t, ...patch } : t
      ),
    }))
    notifyWidget()
  },

  toggleSubtask: async (subtaskId, date, isCompleted) => {
    await tasksApi.toggleSubtask(subtaskId, date, isCompleted)
    // 仅更新该日期对应实例中子任务的完成状态，避免影响其他重复实例
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.dueDate === date
          ? {
              ...t,
              subtasks: t.subtasks?.map((st) =>
                st.id === subtaskId ? { ...st, isCompleted } : st
              ),
            }
          : t
      ),
    }))
    notifyWidget()
  },

  updateSubtasks: async (taskId, items) => {
    await tasksApi.updateSubtasks(taskId, items)
    notifyWidget()
  },

  deleteTask: async (id) => {
    await tasksApi.delete(id)
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }))
    notifyWidget()
  },

  skipOccurrence: async (taskId, date) => {
    await tasksApi.skipOccurrence(taskId, date)
    // 从本地列表中移除该 occurrence
    set((s) => ({
      tasks: s.tasks.filter((t) => !(t.id === taskId && t.dueDate === date)),
    }))
  },

  deleteFromDate: async (taskId, date) => {
    await tasksApi.deleteFromDate(taskId, date)
    set((s) => ({
      tasks: s.tasks.filter((t) => !(t.id === taskId && t.dueDate >= date)),
    }))
  },

  // 删除当天及之前：本地移除该日期及更早的 occurrence
  deleteBeforeDate: async (taskId, date) => {
    await tasksApi.deleteBeforeDate(taskId, date)
    set((s) => ({
      tasks: s.tasks.filter((t) => !(t.id === taskId && t.dueDate <= date)),
    }))
  },

  // 仅修改单日：本地移除该 occurrence（后续 onAfterChange 会重新 fetch）
  detachOccurrence: async (taskId, date, patch) => {
    const newTask = await tasksApi.detachOccurrence(taskId, date, patch)
    set((s) => ({
      tasks: [
        ...s.tasks.filter((t) => !(t.id === taskId && t.dueDate === date)),
        newTask,
      ],
    }))
    return newTask
  },

  // 修改当天及之后：本地移除该任务从 date 起的所有 occurrence（后续 onAfterChange 会重新 fetch）
  splitFromDate: async (taskId: number, date: string, patch: { title?: string; priority?: string; notes?: string; recurrenceEnd?: string; subtasks?: SubtaskPatchItem[] }) => {
    const newTask = await tasksApi.splitFromDate(taskId, date, patch)
    set((s) => ({
      tasks: s.tasks.filter((t) => !(t.id === taskId && t.dueDate >= date)),
    }))
    return newTask
  },

  restoreTask: async (id) => {
    await tasksApi.restore(id)
    // 恢复后由调用方触发 loadData，此处不修改本地 tasks
    notifyWidget()
  },

  getTasksForDate: (date) => {
    const PRIORITY_WEIGHT: Record<string, number> = { high: 3, medium: 2, low: 1, none: 0 }
    return get()
      .tasks.filter((t) => t.dueDate === date)
      .sort((a, b) => {
        const pw = (PRIORITY_WEIGHT[b.priority] ?? 0) - (PRIORITY_WEIGHT[a.priority] ?? 0)
        if (pw !== 0) return pw
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      })
  },
}))
