import { useState, useEffect } from 'react'
import { Pin, PinOff, Minus, GripHorizontal, ExternalLink, SlidersHorizontal, Plus, X } from 'lucide-react'
import { Slider } from '@/components/ui/slider'
import { systemApi } from '@/api'
import { WidgetTaskList } from './WidgetTaskList'
import { WidgetCheckinRow } from './WidgetCheckinRow'
import { toDateString, checkinActiveOn } from '@/lib/utils'
import { isTauri } from '@/lib/db'
import { tasksApi, checkinsApi } from '@/api'
import { IPC } from '@shared/ipc-channels'
import { PRIORITY_CONFIG } from '@shared/constants'
import { SubtaskInputList, type SubtaskInputItem } from '@/components/tasks/SubtaskInputList'
import type { Task, CheckinDefinition, CheckinEntry, Priority } from '@shared/types'

type ResizeDirection = 'East' | 'North' | 'NorthEast' | 'NorthWest' | 'South' | 'SouthEast' | 'SouthWest' | 'West'

// 悬浮窗边缘/角部缩放手柄（配合 Rust 侧 resizable(true)）
const RESIZE_HANDLES: Array<{ dir: ResizeDirection; className: string }> = [
  { dir: 'North', className: 'top-0 left-2 right-2 h-1.5 cursor-n-resize' },
  { dir: 'South', className: 'bottom-0 left-2 right-2 h-1.5 cursor-s-resize' },
  { dir: 'West', className: 'left-0 top-2 bottom-2 w-1.5 cursor-w-resize' },
  { dir: 'East', className: 'right-0 top-2 bottom-2 w-1.5 cursor-e-resize' },
  { dir: 'NorthWest', className: 'top-0 left-0 h-3.5 w-3.5 cursor-nwse-resize' },
  { dir: 'NorthEast', className: 'top-0 right-0 h-3.5 w-3.5 cursor-nesw-resize' },
  { dir: 'SouthWest', className: 'bottom-0 left-0 h-3.5 w-3.5 cursor-nesw-resize' },
  { dir: 'SouthEast', className: 'bottom-0 right-0 h-3.5 w-3.5 cursor-nwse-resize' },
]

function startWindowResize(dir: ResizeDirection) {
  if (!isTauri) return
  import('@tauri-apps/api/window')
    .then(({ getCurrentWindow }) => getCurrentWindow().startResizeDragging(dir))
    .catch(() => {})
}

function formatWidgetDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })
}

function isActiveToday(def: CheckinDefinition, today: string): boolean {
  return checkinActiveOn(def, today)
}

export function WidgetShell() {
  const today = toDateString(new Date())
  const [tasks, setTasks] = useState<Task[]>([])
  const [definitions, setDefinitions] = useState<CheckinDefinition[]>([])
  const [entries, setEntries] = useState<CheckinEntry[]>([])
  const [alwaysOnTop, setAlwaysOnTop] = useState(true)
  const [opacity, setOpacity] = useState(95)
  const [showOpacitySlider, setShowOpacitySlider] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDate, setNewDate] = useState(today)
  const [newPriority, setNewPriority] = useState<Priority>('none')
  const [newSubtasks, setNewSubtasks] = useState<SubtaskInputItem[]>([])
  const [saving, setSaving] = useState(false)

  const loadData = async () => {
    const [taskList, defs, entryList] = await Promise.all([
      tasksApi.list(today, today),
      checkinsApi.listDefs(),
      checkinsApi.getEntries(today, today),
    ])
    setTasks(taskList)
    setDefinitions(defs)
    setEntries(entryList)
  }

  useEffect(() => {
    loadData()
    systemApi.getWidgetPrefs().then((prefs) => {
      setAlwaysOnTop(prefs.alwaysOnTop)
      setOpacity(Math.round(prefs.opacity * 100))
      // 启动时按保存的偏好同步置顶状态（按钮状态 + 窗口属性 + Rust 状态）
      if (isTauri) {
        void systemApi.setAlwaysOnTop(prefs.alwaysOnTop)
      }
      // 恢复窗口位置与尺寸（仅启动时一次，直接设置窗口；不经过 saveWidgetPrefs，避免与 onMoved/onResized 保存形成回路）
      if (isTauri) {
        import('@tauri-apps/api/window')
          .then(async ({ getCurrentWindow }) => {
            const { PhysicalPosition, PhysicalSize } = await import('@tauri-apps/api/dpi')
            const win = getCurrentWindow()
            await win.setPosition(new PhysicalPosition(prefs.posX, prefs.posY))
            // Rust 创建窗口后为修复透明背景会短暂重置一次尺寸，因此前端需再次应用用户缩放结果
            await win.setSize(new PhysicalSize(prefs.width, prefs.height))
          })
          .catch(() => {})
      }
    })
  }, [])

  useEffect(() => {
    const unsub = window.electronAPI.on(IPC.PUSH_WIDGET_DATA_REFRESH, () => loadData())
    return () => unsub()
  }, [])

  // 窗口移动/缩放时持久化偏好（Tauri 环境）
  useEffect(() => {
    if (!isTauri) return
    let unMoved: (() => void) | undefined
    let unResized: (() => void) | undefined
    let cancelled = false
    import('@tauri-apps/api/window').then(async ({ getCurrentWindow }) => {
      if (cancelled) return
      const win = getCurrentWindow()
      unMoved = await win.onMoved(({ payload }) => {
        void systemApi.saveWidgetPrefs({ posX: payload.x, posY: payload.y })
      })
      unResized = await win.onResized(({ payload }) => {
        void systemApi.saveWidgetPrefs({ width: payload.width, height: payload.height })
      })
    })
    return () => {
      cancelled = true
      unMoved?.()
      unResized?.()
    }
  }, [])

  // 窗口从隐藏恢复可见时重新加载（document.visibilityState 变化）
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadData()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  const toggleAlwaysOnTop = async () => {
    const next = !alwaysOnTop
    setAlwaysOnTop(next)
    await systemApi.setAlwaysOnTop(next)
  }

  const handleOpacityChange = async (v: number) => {
    setOpacity(v)
    await systemApi.setOpacity(v / 100)
  }

  const handleTaskToggle = async (id: number, completed: boolean, dueDate: string, isRecurring?: boolean) => {
    const isFailed = completed ? false : undefined
    if (isRecurring) {
      await tasksApi.updateOccurrence(id, dueDate, { isCompleted: completed, isFailed })
    } else {
      await tasksApi.update(id, { isCompleted: completed, isFailed })
    }
    if (completed) {
      // 完成母任务：子任务一并划掉显示完成（仅展示层联动，不改动数据库子任务状态）
      setTasks((prev) =>
        prev.map((t) =>
          t.id === id && t.dueDate === dueDate
            ? {
                ...t,
                isCompleted: true,
                subtasks: t.subtasks?.map((st) => ({ ...st, isCompleted: true })),
              }
            : t
        )
      )
    } else {
      // 取消完成：重新拉取数据库，子任务恢复各自真实状态
      await loadData()
    }
  }

  const handleSubtaskToggle = async (subtaskId: number, date: string, completed: boolean) => {
    await tasksApi.toggleSubtask(subtaskId, date, completed)
    setTasks((prev) =>
      prev.map((t) =>
        t.dueDate === date
          ? {
              ...t,
              subtasks: t.subtasks?.map((st) =>
                st.id === subtaskId ? { ...st, isCompleted: completed } : st
              ),
            }
          : t
      )
    )
  }

  const handleCheckinChange = async (defId: number, value: string) => {
    await checkinsApi.upsertEntry({ definitionId: defId, entryDate: today, value })
    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.definitionId === defId && e.entryDate === today)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], value }
        return next
      }
      return [...prev, { id: Date.now(), definitionId: defId, entryDate: today, value, updatedAt: new Date().toISOString() }]
    })
  }

  const handleCreateTask = async () => {
    const title = newTitle.trim()
    if (!title || saving) return
    setSaving(true)
    try {
      await tasksApi.create({
        title,
        priority: newPriority,
        dueDate: newDate,
        subtasks: newSubtasks.map((s) => s.title.trim()).filter(Boolean),
      })
      setNewTitle('')
      setNewDate(today)
      setNewPriority('none')
      setNewSubtasks([])
      setShowAddForm(false)
      // 重新拉取本地列表；主窗口由 TASKS_CREATE 的刷新信号同步
      await loadData()
    } finally {
      setSaving(false)
    }
  }

  const activeDefinitions = definitions.filter((d) => isActiveToday(d, today))
  const completedCount = tasks.filter((t) => t.isCompleted).length
  const progress = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0

  const PRIORITY_WEIGHT: Record<string, number> = { high: 3, medium: 2, low: 1, none: 0 }
  const sortedTasks = [...tasks].sort((a, b) => {
    const aGroup = (a.isCompleted || a.isFailed) ? 1 : 0
    const bGroup = (b.isCompleted || b.isFailed) ? 1 : 0
    if (aGroup !== bGroup) return aGroup - bGroup
    if (aGroup === 0) {
      const pw = (PRIORITY_WEIGHT[b.priority] ?? 0) - (PRIORITY_WEIGHT[a.priority] ?? 0)
      if (pw !== 0) return pw
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    }
    return 0
  })

  return (
    <div
      className="widget-shell relative flex flex-col h-full w-full overflow-hidden rounded-2xl border border-border-subtle backdrop-blur-2xl transition-opacity duration-200"
      style={{
        backgroundColor: 'hsl(var(--widget-bg))',
        backgroundImage: 'var(--widget-texture)',
        backgroundSize: 'cover',
        opacity: opacity / 100,
      }}
    >
      {/* 边缘/角部缩放手柄 */}
      {RESIZE_HANDLES.map(({ dir, className }) => (
        <div
          key={dir}
          className={`absolute z-50 touch-none select-none ${className}`}
          onPointerDown={(e) => {
            e.preventDefault()
            startWindowResize(dir)
          }}
        />
      ))}

      {/* 顶部渐变色条 */}
      <div className="h-px rounded-t-xl flex-shrink-0 bg-day-ring/40"
 />

      {/* 标题栏 */}
      <div
        className="bg-surface-subtle/70 flex items-center justify-between px-3 py-2 flex-shrink-0 border-b border-border-subtle cursor-move select-none"
        data-tauri-drag-region style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <GripHorizontal className="h-3 w-3 text-muted-foreground/40" />
          <div className="flex flex-col leading-tight">
            <span className="text-xs font-semibold text-foreground">今日</span>
            <span className="text-[10px] text-muted-foreground">{formatWidgetDate(today)}</span>
          </div>
        </div>
        <div
          className="flex items-center gap-0.5"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <button
            onClick={() => setShowOpacitySlider(!showOpacitySlider)}
            className="h-6 w-6 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            title="透明度"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={toggleAlwaysOnTop}
            className="h-6 w-6 flex items-center justify-center rounded-full hover:bg-muted/60 transition-colors"
            title={alwaysOnTop ? '取消置顶' : '窗口置顶'}
          >
            {alwaysOnTop
              ? <Pin className="h-3.5 w-3.5 text-primary" />
              : <PinOff className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>
          <button
            onClick={() => systemApi.showMainWindow()}
            className="h-6 w-6 flex items-center justify-center rounded-full text-muted-foreground hover:text-primary hover:bg-muted/60 transition-colors"
            title="打开主窗口"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => systemApi.hideWidget()}
            className="h-6 w-6 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            title="隐藏悬浮窗"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* 透明度滑块 */}
      {showOpacitySlider && (
        <div className="px-3 py-2 border-b border-border-subtle bg-surface-subtle/80 flex-shrink-0">
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-8">透明度</span>
            <Slider
              value={opacity}
              onValueChange={handleOpacityChange}
              min={20}
              max={100}
              step={5}
              className="flex-1"
            />
            <span className="text-[10px] text-muted-foreground w-7 text-right">{opacity}%</span>
          </div>
        </div>
      )}

      {/* 任务进度条 */}
      {tasks.length > 0 && (
        <div className="px-3 pt-2.5 pb-1 flex-shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-medium text-muted-foreground">今日任务</span>
            <span className="text-[10px] text-muted-foreground">{completedCount}/{tasks.length}</span>
          </div>
          <div className="h-1.5 bg-surface-inset shadow-inset rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progress}%`,
                background: progress === 100
                  ? 'hsl(var(--success))'
                  : undefined,
              }}
            />
          </div>
        </div>
      )}

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 pt-1 flex flex-col gap-3 min-h-0">
        {/* 新增日程按钮 / 内嵌表单 */}
        {showAddForm ? (
          <div className="flex flex-col gap-1.5 card-elevated bg-surface-raised p-2 flex-shrink-0">
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateTask() }}
              placeholder="任务标题…"
              className="control-inset h-8 w-full rounded-lg px-2 text-xs outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
            />
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value || today)}
                className="control-inset h-7 flex-1 rounded-lg px-1.5 text-[11px] outline-none focus:ring-1 focus:ring-ring"
              />
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as Priority)}
                className="control-inset h-7 w-24 rounded-lg px-1 text-[11px] outline-none focus:ring-1 focus:ring-ring"
              >
                {(Object.keys(PRIORITY_CONFIG) as Priority[]).map((p) => (
                  <option key={p} value={p}>{PRIORITY_CONFIG[p].label}优先级</option>
                ))}
              </select>
            </div>
            <SubtaskInputList value={newSubtasks} onChange={setNewSubtasks} />
            <div className="flex items-center justify-end gap-1.5">
              <button
                onClick={() => setShowAddForm(false)}
                className="control-raised flex items-center gap-1 rounded-full px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
              >
                <X className="h-3 w-3" /> 取消
              </button>
              <button
                onClick={handleCreateTask}
                disabled={saving || !newTitle.trim()}
                className="flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground shadow-raised hover:brightness-105 disabled:opacity-50 transition-[filter,opacity]"
              >
                <Plus className="h-3 w-3" /> {saving ? '添加中…' : '添加'}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex-shrink-0 flex items-center justify-center gap-1 rounded-full border border-dashed border-border-subtle text-[11px] text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-surface-hover py-1 transition-colors"
          >
            <Plus className="h-3 w-3" /> 添加日程
          </button>
        )}

        <WidgetTaskList tasks={sortedTasks} onToggle={handleTaskToggle} onSubtaskToggle={handleSubtaskToggle} />

        {activeDefinitions.length > 0 && (
          <>
            <div className="h-px bg-border-subtle" />
            <WidgetCheckinRow
              definitions={activeDefinitions}
              entries={entries}
              onChange={handleCheckinChange}
            />
          </>
        )}
      </div>
    </div>
  )
}
