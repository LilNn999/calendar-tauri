import { useEffect } from 'react'
import { useToast } from '@/components/ui/toast'
import { IPC } from '@shared/ipc-channels'
import { fireSmallConfetti } from '@/lib/confetti'
import type { AchievementDefinition } from '@shared/types'

// 此组件挂载后监听成就解锁推送
export function AchievementToastListener() {
  const { addToast } = useToast()

  useEffect(() => {
    const unsub = window.electronAPI.on(
      IPC.PUSH_ACHIEVEMENT_UNLOCKED,
      (achievement: unknown) => {
        const a = achievement as AchievementDefinition
        addToast({
          title: `🏆 解锁成就：${a.title}`,
          description: a.description,
          icon: a.icon,
          variant: 'success',
          duration: 5000,
        })
        fireSmallConfetti()
      }
    )
    return () => unsub()
  }, [addToast])

  return null
}
