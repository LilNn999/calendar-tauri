import * as React from 'react'
import { motion, AnimatePresence } from '@/lib/motion'
import { cn } from '@/lib/utils'

interface PopoverProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

function Popover({ open, onOpenChange, children }: PopoverProps) {
  return (
    <div className="relative">
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          if (child.type === PopoverTrigger) {
            return React.cloneElement(child as React.ReactElement<PopoverTriggerProps>, {
              onClick: () => onOpenChange(!open),
            })
          }
          if (child.type === PopoverContent) {
            return React.cloneElement(child as React.ReactElement<PopoverContentProps>, {
              open,
              onClose: () => onOpenChange(false),
            })
          }
        }
        return child
      })}
    </div>
  )
}

interface PopoverTriggerProps {
  children: React.ReactNode
  onClick?: () => void
  asChild?: boolean
}

function PopoverTrigger({ children, onClick, asChild }: PopoverTriggerProps) {
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ onClick?: () => void }>, { onClick })
  }
  return <div onClick={onClick} className="cursor-pointer">{children}</div>
}

interface PopoverContentProps {
  children: React.ReactNode
  className?: string
  open?: boolean
  onClose?: () => void
  align?: 'start' | 'center' | 'end'
}

function PopoverContent({ children, className, open, onClose, align = 'center' }: PopoverContentProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={onClose} />
          <motion.div
            className={cn(
              'absolute z-50 mt-1.5 rounded-xl border border-border-subtle bg-surface-raised text-popover-foreground p-0 overflow-hidden',
              {
                'left-0': align === 'start',
                'left-1/2 -translate-x-1/2': align === 'center',
                'right-0': align === 'end',
              },
              className
            )}
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export { Popover, PopoverTrigger, PopoverContent }
