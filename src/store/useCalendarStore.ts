import { create } from 'zustand'
import { toDateString } from '@/lib/utils'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addMonths, subMonths, addWeeks, subWeeks,
} from 'date-fns'

type ViewMode = 'month' | 'week'

interface CalendarState {
  currentDate: Date
  selectedDate: string // YYYY-MM-DD
  viewMode: ViewMode
  setSelectedDate: (date: string) => void
  setViewMode: (mode: ViewMode) => void
  goNext: () => void
  goPrev: () => void
  goToday: () => void
  /** 直接跳转到某年某月（日历模式的年月选择面板用） */
  goToMonth: (year: number, month: number) => void
  getVisibleRange: () => { start: string; end: string }
}

export const useCalendarStore = create<CalendarState>((set, get) => ({
  currentDate: new Date(),
  selectedDate: toDateString(new Date()),
  viewMode: 'month',

  setSelectedDate: (date) => set({ selectedDate: date }),

  setViewMode: (mode) => set({ viewMode: mode }),

  goNext: () =>
    set((s) => ({
      currentDate:
        s.viewMode === 'month'
          ? addMonths(s.currentDate, 1)
          : addWeeks(s.currentDate, 1),
    })),

  goPrev: () =>
    set((s) => ({
      currentDate:
        s.viewMode === 'month'
          ? subMonths(s.currentDate, 1)
          : subWeeks(s.currentDate, 1),
    })),

  goToday: () => set({ currentDate: new Date(), selectedDate: toDateString(new Date()) }),

  goToMonth: (year, month) => set({ currentDate: new Date(year, month - 1, 1) }),

  getVisibleRange: () => {
    const { currentDate, viewMode } = get()
    if (viewMode === 'month') {
      const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 })
      const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 })
      return { start: toDateString(start), end: toDateString(end) }
    } else {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 })
      const end = endOfWeek(currentDate, { weekStartsOn: 1 })
      return { start: toDateString(start), end: toDateString(end) }
    }
  },
}))
