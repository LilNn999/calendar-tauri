import { useEffect, useState, useCallback } from 'react'
import { CalendarHeader } from '@/components/calendar/CalendarHeader'
import { MonthView } from '@/components/calendar/MonthView'
import { WeekView } from '@/components/calendar/WeekView'
import { DayDetailPopup } from '@/components/calendar/DayDetailPopup'
import { TaskEditDialog } from '@/components/tasks/TaskEditDialog'
import { TaskCreationSidebar } from '@/components/tasks/TaskCreationSidebar'
import { CheckinValueDialog } from '@/components/checkins/CheckinValueDialog'
import { RightSidebar } from '@/components/sidebar/RightSidebar'
import { useCalendarStore } from '@/store/useCalendarStore'
import { useTaskStore } from '@/store/useTaskStore'
import { useCheckinStore } from '@/store/useCheckinStore'
import { useUIStore } from '@/store/useUIStore'
import { useNotesStore } from '@/store/useNotesStore'
import { IPC } from '@shared/ipc-channels'
import { fireConfetti } from '@/lib/confetti'
import type { Task } from '@shared/types'

export function CalendarPage() {
  const { viewMode, getVisibleRange, setSelectedDate } = useCalendarStore()
  const { fetchTasks, updateTask, updateOccurrence, getTasksForDate, tasks } = useTaskStore()
  const { fetchDefinitions, fetchEntries, definitions } = useCheckinStore()
  const { detailPopupDate, setDetailPopupDate } = useUIStore()
  const { fetchNotesForRange } = useNotesStore()
  const [editTask, setEditTask] = useState<Task | null>(null)
  const [editOccurrenceDate, setEditOccurrenceDate] = useState<string | undefined>(undefined)
  const [editCheckinDefId, setEditCheckinDefId] = useState<number | null>(null)
  const [editCheckinDate, setEditCheckinDate] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    const range = getVisibleRange()
    await Promise.all([
      fetchTasks(range.start, range.end),
      fetchEntries(range.start, range.end),
      fetchNotesForRange(range.start, range.end),
    ])
  }, [getVisibleRange, fetchTasks, fetchEntries, fetchNotesForRange])

  useEffect(() => {
    fetchDefinitions()
  }, [fetchDefinitions])

  const { currentDate, viewMode: vm } = useCalendarStore()
  useEffect(() => {
    loadData()
  }, [currentDate, vm, loadData])

  useEffect(() => {
    const unsubFailed = window.electronAPI.on(IPC.PUSH_TASKS_FAILED, () => loadData())
    const unsubRefresh = window.electronAPI.on(IPC.PUSH_WIDGET_DATA_REFRESH, () => loadData())
    return () => { unsubFailed(); unsubRefresh() }
  }, [loadData])

  // 跨零点自动刷新：计算距离下一个午夜的毫秒数，届时重置 currentDate 并重新加载数据
  const { goToday } = useCalendarStore()
  useEffect(() => {
    function scheduleNextMidnightRefresh() {
      const now = new Date()
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5)
      const msUntilMidnight = tomorrow.getTime() - now.getTime()
      return window.setTimeout(() => {
        goToday()
        loadData()
        // 刷新后继续调度下一个午夜
        timerRef = scheduleNextMidnightRefresh()
      }, msUntilMidnight)
    }
    let timerRef = scheduleNextMidnightRefresh()
    return () => window.clearTimeout(timerRef)
  }, [goToday, loadData])

  const handleTaskToggle = useCallback(async (id: number, completed: boolean, occurrenceDate?: string) => {
    const task = tasks.find((t) => t.id === id && (!occurrenceDate || t.dueDate === occurrenceDate))
    if (!task) return

    if (task.isRecurring && occurrenceDate) {
      await updateOccurrence(id, occurrenceDate, {
        isCompleted: completed,
        // 补打卡时同步清除失败标记
        isFailed: completed ? false : undefined,
      })
    } else {
      await updateTask(id, {
        isCompleted: completed,
        isFailed: completed ? false : undefined,
      })
    }

    if (completed) {
      const date = occurrenceDate ?? task.dueDate
      const dayTasks = getTasksForDate(date)
      const allDone = dayTasks.every((t) =>
        (t.id === id && t.dueDate === date) ? completed : t.isCompleted
      )
      if (allDone && dayTasks.length > 0) fireConfetti()
    }
  }, [updateTask, updateOccurrence, tasks, getTasksForDate])

  const handleCheckinClick = useCallback((defId: number, date: string) => {
    const def = definitions.find((d) => d.id === defId)
    if (!def) return
    // 开关型打卡也打开打卡弹窗，在弹窗内完成，不在格子上直接切换
    setEditCheckinDefId(defId)
    setEditCheckinDate(date)
  }, [definitions])

  const handleTaskClick = useCallback((taskId: number, date?: string) => {
    const task = tasks.find((t) => t.id === taskId && (!date || t.dueDate === date))
    if (task) {
      setEditTask(task)
      // 重复任务点击时记录 occurrence 日期，用于弹出范围选择
      setEditOccurrenceDate(task.isRecurring ? (date ?? task.dueDate) : undefined)
    }
  }, [tasks])

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* 日历主区域 */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <CalendarHeader />

        {viewMode === 'month' ? (
          <MonthView
            definitions={definitions}
            onDayClick={(date) => { setSelectedDate(date); setDetailPopupDate(date) }}
            onTaskToggle={handleTaskToggle}
            onTaskClick={handleTaskClick}
            onCheckinClick={handleCheckinClick}
          />
        ) : (
          <WeekView
            definitions={definitions}
            onDayClick={(date) => { setSelectedDate(date); setDetailPopupDate(date) }}
            onTaskToggle={handleTaskToggle}
            onTaskClick={handleTaskClick}
            onCheckinClick={handleCheckinClick}
          />
        )}
      </div>

      {/* 右侧持久侧边栏 */}
      <RightSidebar
        definitions={definitions}
        onDefinitionsChange={() => { fetchDefinitions(); loadData() }}
      />

      {/* 日期详情弹窗 */}
      <DayDetailPopup
        date={detailPopupDate}
        definitions={definitions}
        onClose={() => setDetailPopupDate(null)}
        onTaskToggle={handleTaskToggle}
        onAfterTaskChange={loadData}
      />

      {/* 打卡值编辑弹窗 */}
      <CheckinValueDialog
        definition={definitions.find((d) => d.id === editCheckinDefId) ?? null}
        date={editCheckinDate}
        onClose={() => { setEditCheckinDefId(null); setEditCheckinDate(null) }}
      />

      {/* 日历格子直接点击任务时的编辑对话框 */}
      <TaskEditDialog
        task={editTask}
        open={!!editTask}
        onOpenChange={(open) => {
          if (!open) {
            setEditTask(null)
            setEditOccurrenceDate(undefined)
          }
        }}
        occurrenceDate={editOccurrenceDate}
        onAfterChange={loadData}
      />

      {/* 日历格子 + 号触发的快速新建任务弹窗 */}
      <TaskCreationSidebar />
    </div>
  )
}
