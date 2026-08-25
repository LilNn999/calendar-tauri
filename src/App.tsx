import { useState, useEffect } from 'react'
import { TabBar } from '@/components/layout/TabBar'
import { CalendarPage } from '@/pages/CalendarPage'
import { AnalyticsPage } from '@/pages/AnalyticsPage'
import { AchievementToastListener } from '@/components/streaks/AchievementToast'
import { WhatsNewDialog } from '@/components/layout/WhatsNewDialog'
import { Maximize, X } from 'lucide-react'
import { IPC } from '@shared/ipc-channels'
import { systemApi } from '@/api'

type TabId = 'calendar' | 'analytics'

export function App() {
  const [activeTab, setActiveTab] = useState<TabId>('calendar')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showFullscreenBanner, setShowFullscreenBanner] = useState(false)

  useEffect(() => {
    const unsub = window.electronAPI.on(IPC.PUSH_FULLSCREEN_CHANGED, (entering: unknown) => {
      const fs = Boolean(entering)
      setIsFullscreen(fs)
      if (fs) {
        setShowFullscreenBanner(true)
        // 5秒后自动隐藏提示横幅
        setTimeout(() => setShowFullscreenBanner(false), 5000)
      } else {
        setShowFullscreenBanner(false)
      }
    })
    return () => unsub()
  }, [])

  // ESC 退出全屏
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        systemApi.toggleFullscreen()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isFullscreen])

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-transparent">
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* 全屏提示横幅 */}
      {showFullscreenBanner && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-full bg-black/70 backdrop-blur-xl text-white text-xs shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
          <Maximize className="h-3.5 w-3.5 opacity-70" />
          <span>已进入全屏，按 <kbd className="bg-white/20 px-2 py-0.5 rounded-full text-[11px] font-mono">ESC</kbd> 退出</span>
          <button onClick={() => setShowFullscreenBanner(false)} className="ml-1 opacity-60 hover:opacity-100">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'calendar' ? <CalendarPage /> : <AnalyticsPage />}
      </div>

      <AchievementToastListener />
      <WhatsNewDialog />
    </div>
  )
}

export default App
