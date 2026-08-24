import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { systemApi } from '@/api'
import { IPC } from '@shared/ipc-channels'
import { isTauri } from '@/lib/db'
import { normalizeSkin, skinClassName, SKIN_OPTIONS, type Skin } from '@/lib/skin'

export type Theme = 'light' | 'dark' | 'system'

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme | string) => void
  resolvedTheme: 'light' | 'dark'
  skin: Skin
  setSkin: (skin: Skin) => void
}

interface ThemeProviderProps {
  children: ReactNode
  attribute?: string
  defaultTheme?: Theme
  defaultSkin?: Skin
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

function applySkinClass(skin: Skin) {
  const root = document.documentElement
  for (const option of SKIN_OPTIONS) {
    if (option.className) root.classList.remove(option.className)
  }
  const next = skinClassName(skin)
  if (next) root.classList.add(next)
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  defaultSkin = 'default',
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem('theme') as Theme | null
      return saved ?? defaultTheme
    } catch {
      return defaultTheme
    }
  })

  const [skin, setSkinState] = useState<Skin>(() => {
    try {
      return normalizeSkin(localStorage.getItem('skin'))
    } catch {
      return defaultSkin
    }
  })

  // 桌面端：从设置表读取已保存主题与皮肤（跨窗口共享）
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
    systemApi
      .getSkin()
      .then((saved) => setSkinState(normalizeSkin(saved)))
      .catch(() => {})
  }, [])

  useEffect(() => {
    applyClass(theme)
    applySkinClass(skin)
    try {
      localStorage.setItem('theme', theme)
      localStorage.setItem('skin', skin)
    } catch {
      /* ignore */
    }
    if (isTauri) {
      systemApi.setTheme(theme).catch(() => {})
      systemApi.setSkin(skin).catch(() => {})
      // 通知另一个窗口同步主题与皮肤（悬浮窗与主窗口保持实时一致）
      import('@tauri-apps/api/event')
        .then(async ({ emitTo }) => {
          const { getCurrentWindow } = await import('@tauri-apps/api/window')
          const selfLabel = getCurrentWindow().label
          const target = selfLabel === 'floating' ? 'main' : 'floating'
          await emitTo(target, IPC.PUSH_THEME_CHANGED, theme)
          await emitTo(target, IPC.PUSH_SKIN_CHANGED, skin)
        })
        .catch(() => {})
    }
  }, [theme, skin])

  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyClass('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  // 接收另一个窗口的主题/皮肤变更推送（如主窗口切换时同步悬浮窗）
  useEffect(() => {
    if (!isTauri) return
    const unsubTheme = window.electronAPI.on(IPC.PUSH_THEME_CHANGED, (t) => {
      const next = t as Theme
      if (next === 'light' || next === 'dark' || next === 'system') {
        setThemeState(next)
      }
    })
    const unsubSkin = window.electronAPI.on(IPC.PUSH_SKIN_CHANGED, (s) => {
      setSkinState(normalizeSkin(s))
    })
    return () => {
      unsubTheme()
      unsubSkin()
    }
  }, [])

  const value: ThemeContextValue = {
    theme,
    setTheme: (t) => setThemeState(t as Theme),
    resolvedTheme: resolve(theme),
    skin,
    setSkin: (s) => setSkinState(normalizeSkin(s)),
  }
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme 必须在 ThemeProvider 内使用')
  return ctx
}
