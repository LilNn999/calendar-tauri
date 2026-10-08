import React from 'react'
import ReactDOM from 'react-dom/client'
import { ThemeProvider } from '@/lib/theme'
import { ToastProvider } from '@/components/ui/toast'
import { initBridge } from '@/lib/ipc-bridge'
import { isTauri } from '@/lib/db'
import { App } from '@/App'
import FloatingApp from '@/FloatingApp'
import { useProjectStore } from '@/store/useProjectStore'
import './styles/globals.css'

async function bootstrap() {
  // 初始化数据层与 electronAPI 桥接（浏览器环境降级为内存实现）
  await initBridge()
  await useProjectStore.getState().initialize()

  // 浏览器开发预览：?preview=floating 可直接查看悬浮窗
  let isFloating = new URLSearchParams(window.location.search).get('preview') === 'floating'
  if (isTauri) {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      isFloating = getCurrentWindow().label === 'floating'
    } catch {
      isFloating = false
    }
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <ToastProvider>
          {isFloating ? <FloatingApp /> : <App />}
        </ToastProvider>
      </ThemeProvider>
    </React.StrictMode>
  )
}

void bootstrap().catch((error: unknown) => {
  console.error('日历初始化失败:', error)
  const root = document.getElementById('root')
  if (root) root.textContent = error instanceof Error ? error.message : '无法读取本地数据，请关闭日历后重新打开'
})
