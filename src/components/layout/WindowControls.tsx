import { useEffect, useState } from 'react'
import { Minus, Square, Copy, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { IPC } from '@shared/ipc-channels'
import { isTauri } from '@/lib/db'

interface WinHandle {
  minimize: () => Promise<void>
  toggleMaximize: () => Promise<void>
  close: () => Promise<void>
}

// 自定义窗口控制（最小化 / 最大化·还原 / 关闭）
// 配合无边框窗口（decorations:false）提供现代感的标题栏按钮；全屏时自动隐藏。
export function WindowControls() {
  const [isMaximized, setIsMaximized] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [win, setWin] = useState<WinHandle | null>(null)

  useEffect(() => {
    if (!isTauri) return
    let unResized: (() => void) | undefined
    let cancelled = false
    import('@tauri-apps/api/window')
      .then(async ({ getCurrentWindow }) => {
        if (cancelled) return
        const current = getCurrentWindow()
        try {
          setIsMaximized(await current.isMaximized())
        } catch {
          /* ignore */
        }
        unResized = await current.onResized(() => {
          current.isMaximized().then(setIsMaximized).catch(() => {})
        })
        setWin({
          minimize: () => current.minimize(),
          toggleMaximize: () => current.toggleMaximize(),
          close: () => current.close(),
        })
      })
      .catch(() => {})
    return () => {
      cancelled = true
      unResized?.()
    }
  }, [])

  // 全屏时隐藏窗口控制（无系统标题栏可操作）
  useEffect(() => {
    if (!isTauri) return
    const unsub = window.electronAPI.on(IPC.PUSH_FULLSCREEN_CHANGED, (v: unknown) => {
      setIsFullscreen(Boolean(v))
    })
    return () => unsub()
  }, [])

  if (isFullscreen) return null

  const ctrlCls =
    'h-8 w-9 flex items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground'

  return (
    <div className="flex items-center gap-0.5 ml-1 select-none">
      <button onClick={() => win?.minimize()} title="最小化" className={ctrlCls}>
        <Minus className="h-4 w-4" />
      </button>
      <button onClick={() => win?.toggleMaximize()} title={isMaximized ? '还原' : '最大化'} className={ctrlCls}>
        {isMaximized ? <Copy className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
      </button>
      <button
        onClick={() => win?.close()}
        title="关闭"
        className={cn(ctrlCls, 'hover:bg-destructive hover:text-white')}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}