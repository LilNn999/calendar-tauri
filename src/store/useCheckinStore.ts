import { create } from 'zustand'
import { checkinsApi } from '@/api'
import type { CheckinDefinition, CheckinEntry, CreateCheckinDefPayload } from '@shared/types'

interface CheckinState {
  definitions: CheckinDefinition[]
  entries: CheckinEntry[]
  fetchDefinitions: () => Promise<void>
  fetchEntries: (start: string, end: string) => Promise<void>
  createDefinition: (payload: CreateCheckinDefPayload) => Promise<void>
  updateDefinition: (id: number, patch: Partial<CreateCheckinDefPayload>) => Promise<void>
  archiveDefinition: (id: number) => Promise<void>
  deleteCheckinDef: (id: number, date: string, scope: 'this' | 'before' | 'future') => Promise<void>
  upsertEntry: (defId: number, date: string, value: string) => Promise<void>
  getEntriesForDate: (date: string) => CheckinEntry[]
  getEntryValue: (defId: number, date: string) => string | undefined
}

export const useCheckinStore = create<CheckinState>((set, get) => ({
  definitions: [],
  entries: [],

  fetchDefinitions: async () => {
    const defs = await checkinsApi.listDefs()
    set({ definitions: defs })
  },

  fetchEntries: async (start, end) => {
    const entries = await checkinsApi.getEntries(start, end)
    set({ entries })
  },

  createDefinition: async (payload) => {
    const def = await checkinsApi.createDef(payload)
    set((s) => ({ definitions: [...s.definitions, def] }))
  },

  updateDefinition: async (id, patch) => {
    const updated = await checkinsApi.updateDef(id, patch)
    set((s) => ({
      definitions: s.definitions.map((d) => (d.id === id ? { ...d, ...updated } : d)),
    }))
  },

  archiveDefinition: async (id) => {
    await checkinsApi.archiveDef(id)
    set((s) => ({ definitions: s.definitions.filter((d) => d.id !== id) }))
  },

  // 循环打卡按范围删除（this/before/future），完成后重新拉取定义
  deleteCheckinDef: async (id, date, scope) => {
    await checkinsApi.deleteCheckinDef(id, date, scope)
    await get().fetchDefinitions()
  },

  upsertEntry: async (defId, date, value) => {
    const entry = await checkinsApi.upsertEntry({ definitionId: defId, entryDate: date, value })
    // 防御：桥接层异常返回时避免把 undefined 写入 entries 导致渲染崩溃
    if (!entry) return
    set((s) => {
      const existing = s.entries.findIndex(
        (e) => e.definitionId === defId && e.entryDate === date
      )
      if (existing >= 0) {
        const next = [...s.entries]
        next[existing] = entry
        return { entries: next }
      }
      return { entries: [...s.entries, entry] }
    })
  },

  getEntriesForDate: (date) => get().entries.filter((e) => e.entryDate === date),

  getEntryValue: (defId, date) =>
    get().entries.find((e) => e.definitionId === defId && e.entryDate === date)?.value,
}))
