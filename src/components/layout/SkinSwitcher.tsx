import { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Shirt, Sun, Moon, Monitor, Check, type LucideIcon } from 'lucide-react'
import { motion } from '@/lib/motion'
import { useTheme, type Theme } from '@/lib/theme'
import { SKIN_OPTIONS, type Skin } from '@/lib/skin'
import { cn } from '@/lib/utils'

const THEME_OPTIONS: Array<{ value: Theme; label: string; icon: LucideIcon }> = [
  { value: 'light', label: '浅色', icon: Sun },
  { value: 'dark', label: '深色', icon: Moon },
  { value: 'system', label: '跟随系统', icon: Monitor },
]

const SKIN_PREVIEWS: Record<Skin, string> = {
  minimal: 'linear-gradient(135deg, #ffffff 45%, #14161a 46%)',
  neu: 'linear-gradient(135deg, #fbfdff 0%, #e3e9f2 48%, #cbd3e0 52%, #e3e9f2 100%)',
  'warm-wood': 'linear-gradient(135deg, #3a2818 0%, #c8a87e 48%, #f8f1e0 50%, #3a2818 100%)',
  cny: 'linear-gradient(135deg, #a02c2c 0%, #c02c38 48%, #f4e8cd 50%, #d9bd82 100%)',
  press: 'linear-gradient(135deg, #1a1a1a 0%, #4a463c 48%, #f9f7f1 50%, #b3261e 100%)',
}

export function SkinSwitcher() {
  const { theme, setTheme, skin, setSkin } = useTheme()
  const [open, setOpen] = useState(false)

  return (
    <Popover.Root open={open} onOpenChange={setOpen} modal={false}>
      <Popover.Trigger asChild>
        <button
          aria-expanded={open}
          className="h-8 w-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
          title="换肤与外观"
        >
          <Shirt className="h-4 w-4" />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-[100] w-72 p-3 rounded-2xl border border-border-subtle bg-surface-raised text-popover-foreground shadow-float overflow-hidden outline-none"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
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
                          ? 'control-raised text-primary ring-1 ring-primary/30'
                          : 'border border-border-subtle text-muted-foreground hover:border-primary/40 hover:text-foreground'
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
                            ? 'control-raised text-primary ring-1 ring-primary/30'
                            : 'border border-border-subtle text-muted-foreground hover:border-primary/40 hover:text-foreground hover:bg-accent/60'
                        )}
                      >
                        <span
                          className="h-6 w-6 shrink-0 rounded-lg border border-border-subtle"
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
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
