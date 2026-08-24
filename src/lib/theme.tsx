import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { systemApi } from '@/api'
import { IPC } from '@shared/ipc-channels'
import { isTauri } from '@/lib/db'

export type Theme = 'light' | 'dark' | 'system'

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme | string) => void
  resolvedTheme: 'light' | 'dark'
}

interface ThemeProviderProps {
  children: ReactNode
  attribute?: string
  defaultTheme?: Theme
  enableSystem?: boolean
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function resolve(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return theme
}

function applyClass(theme: Theme) {
  const root = document.documentElement
  root.classList.remove('light', 'dark')
  root.classList.add(resolve(theme))
}

export function ThemeProvider({ children, defaultTheme = 'system' }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem('theme') as Theme | null
      return saved ?? defaultTheme
    } catch {
      return defaultTheme
    }
  })

  // 桌面端：从设置表读取已保存主题（跨窗口共享）
  useEffect(() => {
    if (!isTauri) return
    systemApi
      .getTheme()
      .then((saved) => {
        if (saved === 'light' || saved === 'dark' || saved === 'system') {
          setThemeState(saved)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    applyClass(theme)
    try {
      localStorage.setItem('theme', theme)
    } catch {
      /* ignore */
    }
    if (isTauri) {
      systemApi.setTheme(theme).catch(() => {})
      // 通知另一个窗口同步主题（悬浮窗与主窗口保持实时一致）
      import('@tauri-apps/api/event')
        .then(async ({ emitTo }) => {
          const { getCurrentWindow } = await import('@tauri-apps/api/window')
          const selfLabel = getCurrentWindow().label
          const target = selfLabel === 'floating' ? 'main' : 'floating'
          await emitTo(target, IPC.PUSH_THEME_CHANGED, theme)
        })
        .catch(() => {})
    }
  }, [theme])

  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyClass('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  // 接收另一个窗口的主题变更推送（如主窗口切换主题时同步悬浮窗）
  useEffect(() => {
    if (!isTauri) return
    const unsub = window.electronAPI.on(IPC.PUSH_THEME_CHANGED, (t) => {
      const next = t as Theme
      if (next === 'light' || next === 'dark' || next === 'system') {
        setThemeState(next)
      }
    })
    return () => unsub()
  }, [])

  const value: ThemeContextValue = { theme, setTheme: (t) => setThemeState(t as Theme), resolvedTheme: resolve(theme) }
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme 必须在 ThemeProvider 内使用')
  return ctx
}