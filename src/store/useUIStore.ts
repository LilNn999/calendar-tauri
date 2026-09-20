import { create } from 'zustand'

interface UIState {
  sidebarOpen: boolean
  sidebarDate: string | null   // 新建任务时预填的日期
  sidebarCollapsed: boolean    // 右侧面板是否折叠
  detailPopupDate: string | null
  calendarMode: boolean        // 日历模式：纯日历展示（农历/节气/节假日），不显示日程
  setSidebarOpen: (open: boolean, date?: string) => void
  toggleSidebar: () => void
  setDetailPopupDate: (date: string | null) => void
  setCalendarMode: (on: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: false,
  sidebarDate: null,
  sidebarCollapsed: false,
  detailPopupDate: null,
  calendarMode: false,

  setSidebarOpen: (open, date) =>
    set({ sidebarOpen: open, sidebarDate: date ?? null }),

  toggleSidebar: () =>
    set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  setDetailPopupDate: (date) => set({ detailPopupDate: date }),

  setCalendarMode: (on) => set({ calendarMode: on }),
}))
