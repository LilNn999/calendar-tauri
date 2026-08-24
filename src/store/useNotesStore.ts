import { create } from 'zustand'
import { notesApi } from '@/api'

interface NotesState {
  notes: Record<string, string> // date -> content
  fetchNotesForRange: (start: string, end: string) => Promise<void>
  getNoteForDate: (date: string) => string
  upsertNote: (date: string, content: string) => Promise<void>
}

export const useNotesStore = create<NotesState>((set, get) => ({
  notes: {},

  fetchNotesForRange: async (start, end) => {
    // 加载范围内每天的备注（通过并行请求）
    // 实际上一次性请求会更高效，这里用现有的 get API
    // 先收集需要加载的日期（避免重复）
    const { notes } = get()
    try {
      // 使用一个简单的批量方式：查询有备注的日期
      // 由于当前 API 是按单日获取，我们用范围拉取实现
      const from = new Date(start)
      const to = new Date(end)
      const days: string[] = []
      const cur = new Date(from)
      while (cur <= to) {
        days.push(cur.toISOString().slice(0, 10))
        cur.setDate(cur.getDate() + 1)
      }

      // 并行获取（有备注的日期才有返回）
      const results = await Promise.all(
        days.map(async (d) => {
          const note = await notesApi.get(d)
          return { date: d, content: note?.content ?? '' }
        })
      )

      const updated = { ...notes }
      for (const { date, content } of results) {
        if (content) updated[date] = content
        else delete updated[date]
      }
      set({ notes: updated })
    } catch (e) {
      // 忽略错误
    }
  },

  getNoteForDate: (date) => get().notes[date] ?? '',

  upsertNote: async (date, content) => {
    await notesApi.upsert(date, content)
    set((s) => ({ notes: { ...s.notes, [date]: content } }))
  },
}))
