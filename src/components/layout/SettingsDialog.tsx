import { useState, useEffect } from 'react'
import { Power, Maximize, Minimize2, ZoomIn, ZoomOut, RefreshCw, LogOut, Sparkles, Info } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { systemApi } from '@/api'
import { WhatsNewDialog } from '@/components/layout/WhatsNewDialog'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [autoLaunch, setAutoLaunch] = useState(false)
  const [autoLaunchLoading, setAutoLaunchLoading] = useState(false)
  const [showWhatsNew, setShowWhatsNew] = useState(false)
  const [appVersion, setAppVersion] = useState('')

  useEffect(() => {
    if (open) {
      window.electronAPI.invoke('system:getAutoLaunch').then((v: unknown) => setAutoLaunch(Boolean(v)))
      systemApi.getAppVersion().then(setAppVersion).catch(() => {})
    }
  }, [open])

  const handleAutoLaunchToggle = async (checked: boolean) => {
    setAutoLaunchLoading(true)
    try {
      await window.electronAPI.invoke('system:toggleAutoLaunch', checked)
      setAutoLaunch(checked)
    } finally {
      setAutoLaunchLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>设置</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-6 px-6 pb-6 pt-2">
          {/* 系统 */}
          <section className="flex flex-col gap-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Power className="h-3.5 w-3.5" />
              系统
            </h4>
            <div className="card-elevated rounded-2xl divide-y divide-border/50">
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">开机自动启动</p>
                  <p className="text-xs text-muted-foreground mt-0.5">登录后自动在后台运行</p>
                </div>
                <Switch
                  checked={autoLaunch}
                  onCheckedChange={handleAutoLaunchToggle}
                  disabled={autoLaunchLoading}
                />
              </div>
            </div>
          </section>

          {/* 窗口控制 */}
          <section className="flex flex-col gap-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Maximize className="h-3.5 w-3.5" />
              窗口
            </h4>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex flex-col items-center gap-1.5 h-auto py-2.5 rounded-2xl text-xs"
                onClick={() => { systemApi.toggleFullscreen(); onOpenChange(false) }}
              >
                <Maximize className="h-4 w-4" />
                全屏
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex flex-col items-center gap-1.5 h-auto py-2.5 rounded-2xl text-xs"
                onClick={() => { systemApi.minimizeToTray(); onOpenChange(false) }}
              >
                <Minimize2 className="h-4 w-4" />
                最小化
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex flex-col items-center gap-1.5 h-auto py-2.5 rounded-2xl text-xs"
                onClick={() => { window.location.reload() }}
              >
                <RefreshCw className="h-4 w-4" />
                重新加载
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex flex-col items-center gap-1.5 h-auto py-2.5 rounded-2xl text-xs"
                onClick={() => systemApi.zoomIn()}
              >
                <ZoomIn className="h-4 w-4" />
                放大
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex flex-col items-center gap-1.5 h-auto py-2.5 rounded-2xl text-xs"
                onClick={() => systemApi.zoomReset()}
              >
                <RefreshCw className="h-4 w-4" />
                原始大小
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex flex-col items-center gap-1.5 h-auto py-2.5 rounded-2xl text-xs"
                onClick={() => systemApi.zoomOut()}
              >
                <ZoomOut className="h-4 w-4" />
                缩小
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full rounded-xl text-xs text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
              onClick={() => systemApi.quit()}
            >
              <LogOut className="h-3.5 w-3.5 mr-1.5" />
              退出应用
            </Button>
          </section>

          {/* 关于 */}
          <section className="flex flex-col gap-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5" />
              关于
            </h4>
            <div className="card-elevated rounded-2xl divide-y divide-border/50">
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">日历 v{appVersion}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">本地数据存储 · 隐私优先</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg text-xs"
                  onClick={() => setShowWhatsNew(true)}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  更新公告
                </Button>
              </div>
            </div>
          </section>

          <WhatsNewDialog open={showWhatsNew} onOpenChange={setShowWhatsNew} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
