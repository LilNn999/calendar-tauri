import { useEffect } from 'react'
import { WidgetShell } from '@/widget/WidgetShell'

// 悬浮窗入口：复用源项目 WidgetShell 布局，窗口透明、常驻桌面
export default function FloatingApp() {
  useEffect(() => {
    document.body.classList.add('floating-window')
    return () => document.body.classList.remove('floating-window')
  }, [])

  return (
    <div className="h-screen w-screen overflow-hidden">
      <WidgetShell />
    </div>
  )
}