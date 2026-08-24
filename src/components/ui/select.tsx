import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SelectProps {
  value: string
  onValueChange: (value: string) => void
  children: React.ReactNode
  placeholder?: string
  className?: string
  disabled?: boolean
}

interface SelectItemProps {
  value: string
  children: React.ReactNode
}

function Select({ value, onValueChange, children, placeholder, className, disabled }: SelectProps) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  // 收集所有 SelectItem
  const items: { value: string; label: React.ReactNode }[] = []
  React.Children.forEach(children, (child) => {
    if (React.isValidElement(child) && child.type === SelectItem) {
      items.push({ value: (child.props as SelectItemProps).value, label: (child.props as SelectItemProps).children })
    }
  })

  const selectedItem = items.find((i) => i.value === value)

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className="flex h-9 w-full items-center justify-between rounded-xl border border-input bg-card/60 backdrop-blur-sm px-3 py-2 text-sm transition-all placeholder:text-muted-foreground hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={selectedItem ? '' : 'text-muted-foreground'}>
          {selectedItem ? selectedItem.label : placeholder}
        </span>
        <ChevronDown className={cn('h-4 w-4 opacity-50 transition-transform duration-150', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1.5 w-full rounded-2xl border bg-popover text-popover-foreground overflow-hidden" style={{ boxShadow: 'var(--shadow-lg)' }}>
          <div className="p-1.5">
            {items.map((item) => (
              <div
                key={item.value}
                onClick={() => { onValueChange(item.value); setOpen(false) }}
                className={cn(
                  'relative flex cursor-pointer select-none items-center rounded-xl px-2.5 py-2 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground',
                  item.value === value && 'bg-accent text-accent-foreground'
                )}
              >
                {item.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SelectItem({ children }: SelectItemProps) {
  return <>{children}</>
}

export { Select, SelectItem }