import { create } from 'zustand'
import { tasksApi } from '@/api'
import { IPC } from '@shared/ipc-channels'
import { useProjectStore } from './useProjectStore'
import { DEFAULT_PROJECT_ID, matchesProject } from '@/lib/projects'
import type { Task, CreateTaskPayload, UpdateTaskPayload, SubtaskPatchItem } from '@shared/types'
import type { TaskExportOptions, TaskExportSnapshot } from '@/lib/task-export-model'

function notifyWidget() {
  window.electronAPI.invoke(IPC.PUSH_WIDGET_DATA_REFRESH as never).catch(() => {/* ignore */})
}

let fetchRequest = 0

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
  detachOccurrence: (taskId: number, date: string, patch: { projectId?: number; title?: string; priority?: string; notes?: string; subtasks?: SubtaskPatchItem[] }) => Promise<Task>
  splitFromDate: (taskId: number, date: string, patch: { projectId?: number; title?: string; priority?: string; notes?: string; recurrenceEnd?: string; subtasks?: SubtaskPatchItem[] }) => Promise<Task>
  getTasksForDate: (date: string) => Task[]
  restoreTask: (id: number) => Promise<void>
  fetchExportSnapshot: (options: TaskExportOptions) => Promise<TaskExportSnapshot>
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  loading: false,

  fetchTasks: async (start, end) => {
    const request = ++fetchRequest
    const projectId = useProjectStore.getState().selectedProjectId
    set({ loading: true })
    try {
      const tasks = await tasksApi.list(start, end, projectId)
      if (request === fetchRequest && projectId === useProjectStore.getState().selectedProjectId) set({ tasks })
    } finally {
      if (request === fetchRequest) set({ loading: false })
    }
  },

  createTask: async (payload) => {
    const task = await tasksApi.create({
      ...payload,
      projectId: payload.projectId ?? useProjectStore.getState().selectedProjectId ?? DEFAULT_PROJECT_ID,
    })
    // 重复任务不直接加入 store（需要重新展开），重新 fetch 会在 CalendarPage 的 loadData 触发
    if (!payload.recurrenceType && matchesProject(task.projectId, useProjectStore.getState().selectedProjectId)) {
      set((s) => ({ tasks: [...s.tasks, task] }))
    }
    notifyWidget()
    return task
  },

  updateTask: async (id, patch) => {
    const updated = await tasksApi.update(id, patch)
    // 完成母任务：子任务一并划掉显示完成（仅展示层联动，不改动数据库子任务状态，与悬浮窗一致）
    if (patch.isCompleted === true) {
      updated.subtasks = updated.subtasks?.map((st) => ({ ...st, isCompleted: true }))
    }
    if (updated.recurrenceType) {
      // 重复任务：移除所有旧实例（含多个展开日期的副本），由后续 loadData 重新展开
      set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }))
    } else {
      set((s) => ({
        tasks: s.tasks.map((t) => (t.id === id ? updated : t))
          .filter((task) => matchesProject(task.projectId, useProjectStore.getState().selectedProjectId)),
      }))
    }
    notifyWidget()
  },

  updateOccurrence: async (taskId, date, patch) => {
    await tasksApi.updateOccurrence(taskId, date, patch)
    // 更新本地对应虚拟实例；完成母任务时子任务一并划掉显示完成（仅展示层联动，与悬浮窗一致）
    set((s) => ({
      tasks: s.tasks.map((t) => {
        if (!(t.id === taskId && t.dueDate === date)) return t
        if (patch.isCompleted === true) {
          return { ...t, ...patch, subtasks: t.subtasks?.map((st) => ({ ...st, isCompleted: true })) }
        }
        return { ...t, ...patch }
      }),
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
                st.id === subtaskId ? { ...st, isCompleted: t.isCompleted || isCompleted } : st
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
        ...(matchesProject(newTask.projectId, useProjectStore.getState().selectedProjectId) ? [newTask] : []),
      ],
    }))
    return newTask
  },

  // 修改当天及之后：本地移除该任务从 date 起的所有 occurrence（后续 onAfterChange 会重新 fetch）
  splitFromDate: async (taskId: number, date: string, patch: { projectId?: number; title?: string; priority?: string; notes?: string; recurrenceEnd?: string; subtasks?: SubtaskPatchItem[] }) => {
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

  /**
   * 导出快照：直接返回 DTO，不写入 tasks、不改动 selectedProjectId，
   * 也不触发完成通知、成就检测或悬浮窗刷新——导出必须是纯只读操作。
   */
  fetchExportSnapshot: async (options) => {
    return tasksApi.exportSnapshot(options)
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

// 切换项目立即清空上一项目的任务，并使未完成的旧请求失效，避免快速切换时串列表。
useProjectStore.subscribe((state, previous) => {
  if (state.selectedProjectId !== previous.selectedProjectId) {
    ++fetchRequest
    useTaskStore.setState({ tasks: [], loading: false })
  }
})
