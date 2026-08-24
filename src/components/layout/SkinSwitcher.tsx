import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Shirt, Sun, Moon, Monitor, Check, type LucideIcon } from 'lucide-react'
import { motion, AnimatePresence } from '@/lib/motion'
import { useTheme, type Theme } from '@/lib/theme'
import { SKIN_OPTIONS, type Skin } from '@/lib/skin'
import { cn } from '@/lib/utils'

const THEME_OPTIONS: Array<{ value: Theme; label: string; icon: LucideIcon }> = [
  { value: 'light', label: '浅色', icon: Sun },
  { value: 'dark', label: '深色', icon: Moon },
  { value: 'system', label: '跟随系统', icon: Monitor },
]

const SKIN_PREVIEWS: Record<Skin, string> = {
  default: 'linear-gradient(135deg, hsl(234 84% 63%), hsl(217 85% 66%))',
  aurora: 'linear-gradient(135deg, hsl(262 75% 65%), hsl(190 85% 60%))',
  'warm-wood': 'linear-gradient(135deg, hsl(28 75% 40%), hsl(35 50% 88%))',
  macos: 'linear-gradient(135deg, hsl(211 100% 50%), hsl(220 18% 96%))',
  win11: 'linear-gradient(135deg, hsl(205 85% 52%), hsl(190 90% 55%))',
  minimal: 'linear-gradient(135deg, hsl(0 0% 0%), hsl(0 0% 100%))',
}

export function SkinSwitcher() {
  const { theme, setTheme, skin, setSkin } = useTheme()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open])

  return (
    <>
      <button
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="h-8 w-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
        title="换肤与外观"
      >
        <Shirt className="h-4 w-4" />
      </button>

      {createPortal(
        <AnimatePresence>
          {open && (
            <>
              <div
                className="fixed inset-0 z-[90]"
                onClick={() => setOpen(false)}
              />
              <motion.div
                className="fixed right-4 top-[58px] z-[100] w-72 p-3 rounded-2xl border bg-popover text-popover-foreground shadow-xl overflow-hidden"
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                transition={{ duration: 0.14, ease: 'easeOut' }}
              >
                <div className="flex flex-col gap-4">
                  <section className="flex flex-col gap-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">显示模式</h4>
                    <div className="grid grid-cols-3 gap-1.5">
                      {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                        <button
                          key={value}
                          onClick={() => setTheme(value)}
                          className={cn(
                            'flex flex-col items-center gap-1 rounded-xl border py-2 text-[11px] font-medium transition-all',
                            theme === value
                              ? 'border-primary/60 bg-primary/10 text-primary shadow-glow'
                              : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {label}
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="flex flex-col gap-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">皮肤</h4>
                    <div className="grid grid-cols-2 gap-1.5">
                      {SKIN_OPTIONS.map((option) => {
                        const selected = option.value === skin
                        return (
                          <button
                            key={option.value}
                            onClick={() => setSkin(option.value)}
                            className={cn(
                              'flex items-center gap-1.5 rounded-xl border px-2 py-1.5 text-left transition-all',
                              selected
                                ? 'border-primary/60 bg-primary/10 text-primary shadow-glow'
                                : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground hover:bg-accent/60'
                            )}
                          >
                            <span
                              className="h-6 w-6 shrink-0 rounded-lg border border-black/10 dark:border-white/10"
                              style={{ background: SKIN_PREVIEWS[option.value] }}
                            />
                            <span className="flex-1 text-[11px] font-medium leading-tight">{option.label}</span>
                            {selected && <Check className="h-3 w-3 shrink-0" />}
                          </button>
                        )
                      })}
                    </div>
                  </section>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}
