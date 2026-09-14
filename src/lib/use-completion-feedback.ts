// src/lib/use-completion-feedback.ts
// 任务完成反馈：检测某任务由"未完成 → 完成"的瞬间，在持续窗口内返回 true，
// 供行组件播放完成动画（勾选弹跳 + 绿色脉冲）。初始即为完成状态不触发。

import { useEffect, useRef, useState } from 'react'

/** 完成反馈动画窗口时长（与任务总览/悬浮窗的宽限期保持一致） */
export const TASK_FEEDBACK_MS = 1200

export function useJustCompleted(isCompleted: boolean | undefined, durationMs = TASK_FEEDBACK_MS): boolean {
  const [celebrating, setCelebrating] = useState(false)
  const prevRef = useRef(isCompleted)

  useEffect(() => {
    const was = prevRef.current
    prevRef.current = isCompleted
    if (isCompleted && !was) {
      setCelebrating(true)
      const timer = window.setTimeout(() => setCelebrating(false), durationMs)
      return () => window.clearTimeout(timer)
    }
    if (!isCompleted) setCelebrating(false)
  }, [isCompleted, durationMs])

  return celebrating
}

/**
 * 批量版：跟踪一组子任务（如 task.subtasks），返回当前处于完成反馈窗口内的 id 集合。
 * 挂载时已为完成状态的子任务不触发；取消完成立即退出反馈。
 * 各子任务的到期计时器独立管理，互不影响。
 */
export function useJustCompletedMap(
  items: { id: number; isCompleted?: boolean }[] | undefined,
  durationMs = TASK_FEEDBACK_MS,
): Set<number> {
  const [celebrating, setCelebrating] = useState<Set<number>>(() => new Set())
  // null 表示首帧：仅记录初始状态，不触发动画
  const prevRef = useRef<Map<number, boolean> | null>(null)
  const timersRef = useRef<Map<number, number>>(new Map())

  useEffect(() => {
    const prev = prevRef.current
    const nextPrev = new Map<number, boolean>()
    const additions: number[] = []
    const removals: number[] = []
    for (const item of items ?? []) {
      const done = !!item.isCompleted
      nextPrev.set(item.id, done)
      if (prev === null) continue
      const was = prev.get(item.id)
      if (done && !was) additions.push(item.id)
      else if (!done && was) removals.push(item.id)
    }
    prevRef.current = nextPrev

    if (additions.length > 0) {
      setCelebrating((cur) => {
        const next = new Set(cur)
        for (const id of additions) next.add(id)
        return next
      })
    }
    if (removals.length > 0) {
      for (const id of removals) {
        const timer = timersRef.current.get(id)
        if (timer !== undefined) {
          window.clearTimeout(timer)
          timersRef.current.delete(id)
        }
      }
      setCelebrating((cur) => {
        const next = new Set(cur)
        let changed = false
        for (const id of removals) {
          if (next.delete(id)) changed = true
        }
        return changed ? next : cur
      })
    }
    for (const id of additions) {
      const timer = window.setTimeout(() => {
        timersRef.current.delete(id)
        setCelebrating((cur) => {
          if (!cur.has(id)) return cur
          const next = new Set(cur)
          next.delete(id)
          return next
        })
      }, durationMs)
      timersRef.current.set(id, timer)
    }
  }, [items, durationMs])

  // 卸载时清理所有未到期计时器
  useEffect(() => {
    const timers = timersRef.current
    return () => {
      for (const t of timers.values()) window.clearTimeout(t)
    }
  }, [])

  return celebrating
}
