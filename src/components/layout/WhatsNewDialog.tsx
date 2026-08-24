import { useState, useEffect } from 'react'
import { Sparkles, ChevronDown, ChevronUp, Wrench, Plus } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { VERSION_NOTES, type VersionNote } from '@/data/whatsNew'

const CURRENT_VERSION = VERSION_NOTES[0].version
const STORAGE_KEY = 'lastSeenVersion'

function VersionBody({ note }: { note: VersionNote }) {
  return (
    <div className="flex flex-col gap-3">
      {note.features && note.features.length > 0 && (
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold text-primary mb-1.5">
            <Plus className="h-3.5 w-3.5" />
            新增 / 优化
          </p>
          <ul className="flex flex-col gap-1">
            {note.features.map((f, i) => (
              <li key={i} className="text-sm leading-snug pl-1">{f}</li>
            ))}
          </ul>
        </div>
      )}
      {note.fixes && note.fixes.length > 0 && (
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1.5">
            <Wrench className="h-3.5 w-3.5" />
            问题修复
          </p>
          <ul className="flex flex-col gap-1">
            {note.fixes.map((f, i) => (
              <li key={i} className="text-sm leading-snug pl-1 text-foreground/80">{f}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

interface WhatsNewDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function WhatsNewDialog({ open: openProp, onOpenChange }: WhatsNewDialogProps = {}) {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const isControlled = openProp !== undefined

  useEffect(() => {
    if (isControlled) return
    const lastSeen = localStorage.getItem(STORAGE_KEY)
    if (lastSeen !== CURRENT_VERSION) {
      setOpen(true)
    }
  }, [isControlled])

  const isOpen = isControlled ? openProp : open

  const handleClose = () => {
    localStorage.setItem(STORAGE_KEY, CURRENT_VERSION)
    if (isControlled) onOpenChange?.(false)
    else setOpen(false)
  }

  const toggleExpand = (version: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(version)) next.delete(version)
      else next.add(version)
      return next
    })
  }

  const current = VERSION_NOTES[0]
  const history = VERSION_NOTES.slice(1)

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent onClose={handleClose}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            日历 v{CURRENT_VERSION} 更新内容
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6 pt-2 flex flex-col gap-4 max-h-[60vh] overflow-y-auto">
          {/* 本次更新 */}
          <div className="rounded-xl bg-primary/5 border border-primary/20 p-4">
            <p className="text-xs text-muted-foreground mb-3">{current.date}</p>
            <VersionBody note={current} />
          </div>

          {/* 历史版本（可展开） */}
          {history.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">历史版本</p>
              {history.map((v) => {
                const isOpen = expanded.has(v.version)
                return (
                  <div key={v.version} className="rounded-xl border overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-accent transition-colors"
                      onClick={() => toggleExpand(v.version)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">v{v.version}</span>
                        <span className="text-xs text-muted-foreground">{v.date}</span>
                      </div>
                      {isOpen
                        ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                        : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      }
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-3 pt-2 border-t bg-secondary/10">
                        <VersionBody note={v} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="px-6 pb-5">
          <Button className="w-full" onClick={handleClose}>
            知道了，开始使用
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
