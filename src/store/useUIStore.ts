import { create } from 'zustand'

interface UIState {
  sidebarOpen: boolean
  sidebarDate: string | null   // 新建任务时预填的日期
  sidebarCollapsed: boolean    // 右侧面板是否折叠
  detailPopupDate: string | null
  setSidebarOpen: (open: boolean, date?: string) => void
  toggleSidebar: () => void
  setDetailPopupDate: (date: string | null) => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: false,
  sidebarDate: null,
  sidebarCollapsed: false,
  detailPopupDate: null,

  setSidebarOpen: (open, date) =>
    set({ sidebarOpen: open, sidebarDate: date ?? null }),

  toggleSidebar: () =>
    set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  setDetailPopupDate: (date) => set({ detailPopupDate: date }),
}))
