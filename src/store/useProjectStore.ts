import { create } from 'zustand'
import { projectsApi } from '@/api'
import { DEFAULT_PROJECT_ID } from '@/lib/projects'
import { IPC } from '@shared/ipc-channels'
import type { Project, ProjectScope } from '@shared/types'

interface ProjectState {
  projects: Project[]
  selectedProjectId: ProjectScope
  switching: boolean
  error: string | null
  initialize: () => Promise<void>
  refresh: () => Promise<void>
  selectProject: (projectId: ProjectScope) => Promise<void>
  createProject: (name: string) => Promise<Project>
  renameProject: (id: number, name: string) => Promise<Project>
}

let refreshRequest = 0
let projectListRevision = 0
let initialized = false

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  selectedProjectId: DEFAULT_PROJECT_ID,
  switching: false,
  error: null,

  refresh: async () => {
    const request = ++refreshRequest
    const revision = projectListRevision
    try {
      const [projects, selectedProjectId] = await Promise.all([projectsApi.list(), projectsApi.getSelection()])
      if (request === refreshRequest) {
        // 本地新建/改名已保存时，保留新列表；仍同步另一窗口的最新项目选择。
        set({ projects: revision === projectListRevision ? projects : get().projects, selectedProjectId, error: null })
      }
    } catch (error) {
      if (request === refreshRequest) set({ error: error instanceof Error ? error.message : '读取项目失败，请重试' })
      throw error
    }
  },

  initialize: async () => {
    await get().refresh()
    if (!initialized) {
      window.electronAPI.on(IPC.PUSH_PROJECTS_CHANGED, () => { void get().refresh().catch(() => {}) })
      initialized = true
    }
  },

  selectProject: async (projectId) => {
    if (get().switching) return
    ++refreshRequest
    set({ switching: true, error: null })
    try {
      await projectsApi.select(projectId)
      set({ selectedProjectId: projectId })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '切换项目失败，请重试' })
      throw error
    } finally {
      set({ switching: false })
    }
  },

  createProject: async (name) => {
    const project = await projectsApi.create(name)
    ++projectListRevision
    set((state) => ({ projects: [...state.projects.filter((item) => item.id !== project.id), project] }))
    await get().selectProject(project.id)
    return project
  },

  renameProject: async (id, name) => {
    const project = await projectsApi.rename(id, name)
    ++projectListRevision
    set((state) => ({ projects: state.projects.map((item) => item.id === id ? project : item), error: null }))
    return project
  },
}))
